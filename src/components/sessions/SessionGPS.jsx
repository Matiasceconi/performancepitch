import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, CheckCircle, AlertCircle, TrendingUp, Zap, Footprints } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

function normalize(s) {
  return (s || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function parseNum(v) {
  const n = parseFloat((v || "").toString().replace(",", "."));
  return isNaN(n) ? undefined : n;
}

// Map CSV headers to our fields
const HEADER_MAP = [
  { field: "duration",       patterns: [/duration|tiempo|duracion/i] },
  { field: "total_distance", patterns: [/total.?dist|distancia.?total/i] },
  { field: "m_min",          patterns: [/m.?min|metros.?por.?min/i] },
  { field: "distance_19_8",  patterns: [/19[._]?8|hsr|high.?speed/i] },
  { field: "distance_25",    patterns: [/25|sprint.?dist|dist.?25/i] },
  { field: "sprints",        patterns: [/sprint.?effort|sprint.?count|sprints(?!.?dist)/i] },
  { field: "acc_3",          patterns: [/acc[^c]|accel/i] },
  { field: "dec_3",          patterns: [/dec|decel/i] },
  { field: "player_load",    patterns: [/player.?load/i] },
  { field: "smax",           patterns: [/max.?vel|vel.?max|smax|vmax/i] },
  { field: "rhie",           patterns: [/rhie/i] },
  { field: "pl_min",         patterns: [/pl.?min|load.?min/i] },
];

function mapHeaders(headers) {
  const mapping = {}; // field -> header key
  headers.forEach(h => {
    HEADER_MAP.forEach(({ field, patterns }) => {
      if (!mapping[field] && patterns.some(p => p.test(h))) mapping[field] = h;
    });
  });
  return mapping;
}

export default function SessionGPS({ session, sessionPlayers }) {
  const [uploading, setUploading] = useState(false);
  const [gpsRows, setGpsRows] = useState([]); // SessionGPSData records
  const [unmatched, setUnmatched] = useState([]);
  const [aliasTargets, setAliasTargets] = useState({}); // rawName -> playerId (for manual correction)
  const [allPlayers, setAllPlayers] = useState([]);
  const { toast } = useToast();

  // Load existing GPS data for this session
  useEffect(() => {
    base44.entities.SessionGPSData.filter({ session_id: session.id }, "player_name", 200)
      .then(rows => setGpsRows(rows));
    base44.entities.Player.list("-created_date", 500)
      .then(p => setAllPlayers(p.filter(x => x.active !== false)));
  }, [session.id]);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);

    // Upload file
    await base44.integrations.Core.UploadFile({ file });
    await base44.entities.TrainingSession.update(session.id, { csv_url: undefined, csv_label: file.name });

    // Parse CSV
    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) { setUploading(false); return; }

    const sep = lines[0].includes(";") ? ";" : ",";
    const rawHeaders = lines[0].split(sep).map(h => h.replace(/"/g, "").trim());
    const nameColIdx = rawHeaders.findIndex(h => /^name$|^jugador$|^player.?name$|^atleta/i.test(h));
    const fieldMap = mapHeaders(rawHeaders);

    const csvRows = lines.slice(1).map(l => {
      const cols = l.split(sep).map(c => c.replace(/"/g, "").trim());
      const obj = {};
      rawHeaders.forEach((h, i) => { obj[h] = cols[i] || ""; });
      return obj;
    }).filter(r => Object.values(r).some(v => v));

    // Load aliases
    const aliases = await base44.entities.PlayerAlias.list("-created_date", 1000);
    const aliasMap = {}; // normalized -> player_id
    aliases.forEach(a => { if (a.normalized_alias) aliasMap[a.normalized_alias] = a.player_id; });
    // Also match directly from session players
    const spMap = {};
    sessionPlayers.forEach(sp => { spMap[normalize(sp.player_name)] = sp.player_id; });
    // And all players
    const allPlayerMap = {};
    allPlayers.forEach(p => { allPlayerMap[normalize(p.full_name || "")] = p.id; });

    const toCreate = [];
    const unmatchedList = [];

    csvRows.forEach(row => {
      const rawName = nameColIdx >= 0 ? row[rawHeaders[nameColIdx]] : "";
      const normName = normalize(rawName);
      const playerId = aliasMap[normName] || spMap[normName] || allPlayerMap[normName];
      const playerRecord = allPlayers.find(p => p.id === playerId);

      const record = {
        session_id: session.id,
        player_name_original: rawName,
        player_id: playerId || "",
        player_name: playerRecord?.full_name || rawName,
        source_file: file.name,
      };
      Object.entries(fieldMap).forEach(([field, hdr]) => {
        record[field] = parseNum(row[hdr]);
      });

      if (playerId) {
        toCreate.push(record);
      } else {
        unmatchedList.push({ rawName, record });
      }
    });

    // Delete old GPS for this session and save new
    const existing = await base44.entities.SessionGPSData.filter({ session_id: session.id }, "-created_date", 500);
    await Promise.all(existing.map(r => base44.entities.SessionGPSData.delete(r.id)));

    let savedRows = [];
    if (toCreate.length > 0) {
      savedRows = await base44.entities.SessionGPSData.bulkCreate(toCreate);
    }

    setGpsRows(Array.isArray(savedRows) ? savedRows : toCreate);
    setUnmatched(unmatchedList);
    setUploading(false);
    toast({ title: `GPS: ${toCreate.length} reconocidos, ${unmatchedList.length} sin reconocer` });
  }

  async function saveManualAlias(rawName, playerId) {
    if (!playerId) return;
    const player = allPlayers.find(p => p.id === playerId);
    if (!player) return;
    const normAlias = normalize(rawName);
    await base44.entities.PlayerAlias.create({
      player_id: playerId,
      player_name: player.full_name || "",
      alias_name: rawName,
      normalized_alias: normAlias,
      source: "Manual",
      confidence_score: 1,
    });
    // Update the unmatched record and move it to matched
    const unmRow = unmatched.find(u => u.rawName === rawName);
    if (unmRow) {
      const record = { ...unmRow.record, player_id: playerId, player_name: player.full_name || "" };
      const created = await base44.entities.SessionGPSData.create(record);
      setGpsRows(prev => [...prev, created]);
      setUnmatched(prev => prev.filter(u => u.rawName !== rawName));
    }
    toast({ title: `✓ Alias guardado para ${player.full_name}` });
  }

  // Summary stats
  const withGPS = gpsRows.length;
  const withoutGPS = sessionPlayers.filter(sp => !gpsRows.find(r => r.player_id === sp.player_id)).length;
  const avgDist = gpsRows.length ? Math.round(gpsRows.reduce((s, r) => s + (r.total_distance || 0), 0) / gpsRows.length) : 0;
  const avgMMin = gpsRows.length ? (gpsRows.reduce((s, r) => s + (r.m_min || 0), 0) / gpsRows.length).toFixed(1) : 0;
  const topDist = gpsRows.length ? gpsRows.reduce((a, b) => (b.total_distance || 0) > (a.total_distance || 0) ? b : a, gpsRows[0]) : null;
  const topSpeed = gpsRows.length ? gpsRows.reduce((a, b) => (b.smax || 0) > (a.smax || 0) ? b : a, gpsRows[0]) : null;
  const topSprints = gpsRows.length ? gpsRows.reduce((a, b) => (b.sprints || 0) > (a.sprints || 0) ? b : a, gpsRows[0]) : null;

  return (
    <div className="space-y-6">
      {/* Upload */}
      <div className="border-2 border-dashed border-zinc-700 rounded-xl p-6 text-center">
        <Upload size={20} className="text-zinc-500 mx-auto mb-2" />
        <p className="text-sm text-zinc-400 mb-3">Cargar CSV de GPS (Catapult / OpenField)</p>
        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white hover:bg-zinc-700 transition-colors">
          <Upload size={14} /> {uploading ? "Procesando..." : "Seleccionar archivo CSV"}
          <input type="file" accept=".csv" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
        {session.csv_label && <p className="text-xs text-zinc-500 mt-2">Último cargado: {session.csv_label}</p>}
      </div>

      {gpsRows.length === 0 && unmatched.length === 0 && (
        <p className="text-zinc-600 text-sm text-center py-2">Sin carga externa cargada</p>
      )}

      {/* Summary */}
      {gpsRows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Con GPS", value: withGPS, color: "text-emerald-400" },
            { label: "Sin GPS", value: withoutGPS, color: "text-zinc-500" },
            { label: "Prom. distancia", value: avgDist ? `${avgDist}m` : "—", color: "text-blue-400" },
            { label: "Prom. m/min", value: avgMMin > 0 ? avgMMin : "—", color: "text-cyan-400" },
            { label: "Mayor distancia", value: topDist?.player_name?.split(" ").pop() || "—", color: "text-violet-400" },
            { label: "Mayor velocidad", value: topSpeed ? `${topSpeed.smax} km/h` : "—", color: "text-orange-400" },
          ].map(s => (
            <div key={s.label} className="bg-zinc-800/50 rounded-xl p-3 text-center">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* GPS Table */}
      {gpsRows.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CheckCircle size={12} /> Jugadores con GPS ({gpsRows.length})
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800">
                  {["Jugador", "Dist. (m)", "m/min", "D>19.8", "D>25", "Sprints", "ACC+3", "DEC+3", "P.Load", "Smax"].map(h => (
                    <th key={h} className="text-left py-2 px-2 text-zinc-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gpsRows.map(r => (
                  <tr key={r.player_id || r.player_name_original} className="border-b border-zinc-800/40 hover:bg-zinc-800/20">
                    <td className="py-2 px-2 text-white font-medium whitespace-nowrap">{r.player_name}</td>
                    <td className="py-2 px-2 text-zinc-300">{r.total_distance ?? "—"}</td>
                    <td className="py-2 px-2 text-zinc-300">{r.m_min ?? "—"}</td>
                    <td className="py-2 px-2 text-zinc-300">{r.distance_19_8 ?? "—"}</td>
                    <td className="py-2 px-2 text-zinc-300">{r.distance_25 ?? "—"}</td>
                    <td className="py-2 px-2 text-zinc-300">{r.sprints ?? "—"}</td>
                    <td className="py-2 px-2 text-zinc-300">{r.acc_3 ?? "—"}</td>
                    <td className="py-2 px-2 text-zinc-300">{r.dec_3 ?? "—"}</td>
                    <td className="py-2 px-2 text-zinc-300">{r.player_load ?? "—"}</td>
                    <td className="py-2 px-2 text-orange-300 font-semibold">{r.smax ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unmatched with manual fix */}
      {unmatched.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <AlertCircle size={12} /> Sin reconocer ({unmatched.length}) — vincular manualmente
          </p>
          <div className="space-y-2">
            {unmatched.map(({ rawName }) => (
              <div key={rawName} className="flex items-center gap-2 px-3 py-2 bg-red-500/5 border border-red-500/20 rounded-lg flex-wrap">
                <AlertCircle size={11} className="text-red-400 shrink-0" />
                <span className="text-xs text-red-300 flex-1 min-w-[120px]">{rawName || "(sin nombre)"}</span>
                <select
                  value={aliasTargets[rawName] || ""}
                  onChange={e => setAliasTargets(p => ({ ...p, [rawName]: e.target.value }))}
                  className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none flex-1 min-w-[160px]">
                  <option value="">Seleccionar jugador...</option>
                  {allPlayers.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
                <button
                  onClick={() => saveManualAlias(rawName, aliasTargets[rawName])}
                  disabled={!aliasTargets[rawName]}
                  className="px-3 py-1 bg-white text-zinc-900 rounded text-xs font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-40">
                  Vincular y guardar alias
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}