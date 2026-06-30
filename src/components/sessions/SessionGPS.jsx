import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, CheckCircle, AlertCircle, Eye, X, Filter } from "lucide-react";
import { isGoalkeeper } from "@/components/squad/squadConstants";
import { useToast } from "@/components/ui/use-toast";
import { fmtMetric, fmtSmax } from "@/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// Métricas con sus colores de referencia
const METRICS = [
  { key: "total_distance", label: "Distancia (m)",        color: "#3b82f6" },
  { key: "distance_19_8",  label: "19,8-25 km/h (m)",     color: "#10b981" },
  { key: "distance_25",    label: "+25 km/h (m)",          color: "#f97316" },
  { key: "player_load",    label: "Carga del jugador",     color: "#a855f7" },
  { key: "smax",           label: "Vel. Máx (km/h)",       color: "#ef4444" },
  { key: "acc_3",          label: "Aceleraciones",         color: "#f59e0b" },
  { key: "dec_3",          label: "Desaceleraciones",      color: "#ec4899" },
  { key: "sprints",        label: "Esfuerzos de sprint",   color: "#06b6d4" },
];

// ── Normalize player name for matching ──────────────────────────────────────
function normalize(s) {
  return (s || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

// ── Parse a float value (dot decimal, ignore empty/dash) ───────────────────
function parseNum(v) {
  if (!v || v === "-" || v === "") return undefined;
  const n = parseFloat(v.toString().trim());
  return isNaN(n) ? undefined : n;
}

// ── RFC-4180 CSV parser: handles commas inside double-quoted fields ─────────
function parseCSV(text) {
  // Strip BOM if present
  const raw = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const next = raw[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }          // escaped quote
      else if (ch === '"') { inQuotes = false; }                       // closing quote
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field.trim()); field = ""; }
      else if (ch === '\n') {
        row.push(field.trim()); field = "";
        if (row.some(c => c !== "")) rows.push(row);
        row = [];
      } else if (ch === '\r') { /* skip */ }
      else { field += ch; }
    }
  }
  // last field/row
  if (field || row.length) { row.push(field.trim()); if (row.some(c => c !== "")) rows.push(row); }
  return rows;
}

// ── Exact column name → entity field mapping ───────────────────────────────
const COLUMN_MAP = {
  "Name":                     { field: "player_name_original", numeric: false },
  "Total Duration":           { field: "duration",             numeric: false }, // keep as HH:MM:SS
  "Total Distance (m)":       { field: "total_distance",       numeric: true  },
  "D 19,8-25,0 km/h (m)":    { field: "distance_19_8",        numeric: true  },
  "D+ 25,0 km/h (m)":        { field: "distance_25",          numeric: true  },
  "Sprint Efforts":           { field: "sprints",              numeric: true  },
  "Acc + 3mt/s eff":          { field: "acc_3",                numeric: true  },
  "Dec +3mts/s Eff":          { field: "dec_3",                numeric: true  },
  "Total Player Load":        { field: "player_load",          numeric: true  },
  "Maximum Velocity (km/h)":  { field: "smax",                 numeric: true  },
  "Max Vel (% Max)":          { field: "max_vel_percent",      numeric: true  },
  "Metros x Min":             { field: "m_min",                numeric: true  },
};

const REQUIRED_COLS = ["Name", "Total Distance (m)", "Total Duration"];

// Filas resumen del CSV que NO son jugadores reales
const SUMMARY_ROW_NAMES = new Set([
  "total", "promedio", "average", "avg", "summary", "team total", "totals"
]);

export default function SessionGPS({ session, sessionPlayers }) {
  const [uploading, setUploading] = useState(false);
  const [gpsRows, setGpsRows] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [aliasTargets, setAliasTargets] = useState({});
  const [allPlayers, setAllPlayers] = useState([]);
  const [preview, setPreview] = useState(null); // { detectedCols, missingCols, parsedRows, fileName, file }
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    base44.entities.SessionGPSData.filter({ session_id: session.id }, "player_name", 200)
      .then(rows => setGpsRows(rows));
    base44.entities.Player.list("-created_date", 500)
      .then(p => setAllPlayers(p.filter(x => x.active !== false)));
  }, [session.id]);

  // ── Step 1: Parse & preview ───────────────────────────────────────────────
  async function handleFile(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);

    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) {
      toast({ title: "CSV vacío o inválido", variant: "destructive" });
      setUploading(false);
      return;
    }

    const headers = rows[0]; // first row = headers
    const detectedCols = {}; // colName -> index (only those in COLUMN_MAP)
    headers.forEach((h, i) => { if (COLUMN_MAP[h]) detectedCols[h] = i; });

    const missingCols = REQUIRED_COLS.filter(c => !(c in detectedCols));

    // Build parsed rows for preview (use ALL columns found in COLUMN_MAP)
    const allDataRows = rows.slice(1).map(cols => {
      const rec = {};
      Object.entries(detectedCols).forEach(([colName, idx]) => {
        rec[colName] = cols[idx] ?? "";
      });
      return rec;
    }).filter(r => r["Name"] && r["Name"] !== "");

    // Separar filas resumen de jugadores reales
    const summaryRows = allDataRows.filter(r => SUMMARY_ROW_NAMES.has(r["Name"].toLowerCase().trim()));
    const parsedRows = allDataRows.filter(r => !SUMMARY_ROW_NAMES.has(r["Name"].toLowerCase().trim()));

    setPreview({ detectedCols, missingCols, parsedRows, summaryRows, fileName: file.name, file });
    setUploading(false);
  }

  // ── Step 2: Confirm & import ──────────────────────────────────────────────
  async function confirmImport() {
    if (!preview) return;
    const { detectedCols, parsedRows, summaryRows, fileName, file } = preview;
    setImporting(true);

    // Load aliases & player maps
    const aliases = await base44.entities.PlayerAlias.list("-created_date", 1000);
    const aliasMap = {};
    aliases.forEach(a => { if (a.normalized_alias) aliasMap[a.normalized_alias] = a.player_id; });
    const spMap = {};
    sessionPlayers.forEach(sp => { spMap[normalize(sp.player_name)] = sp.player_id; });
    const allPlayerMap = {};
    allPlayers.forEach(p => { allPlayerMap[normalize(p.full_name || "")] = p.id; });

    const toCreate = [];
    const unmatchedList = [];

    parsedRows.forEach(row => {
      const rawName = row["Name"] || "";
      const normName = normalize(rawName);
      const playerId = aliasMap[normName] || spMap[normName] || allPlayerMap[normName];
      const playerRecord = allPlayers.find(p => p.id === playerId);

      const record = {
        session_id: session.id,
        player_name_original: rawName,
        player_id: playerId || "",
        player_name: playerRecord?.full_name || rawName,
        source_file: fileName,
      };

      // Map each detected column to its entity field
      Object.entries(detectedCols).forEach(([colName, idx]) => {
        const { field, numeric } = COLUMN_MAP[colName];
        if (field === "player_name_original") return; // already set above
        const raw = row[colName] ?? "";
        record[field] = numeric ? parseNum(raw) : (raw || undefined);
      });

      if (playerId) toCreate.push(record);
      else unmatchedList.push({ rawName, record });
    });

    // Upload file reference
    await base44.integrations.Core.UploadFile({ file });
    await base44.entities.TrainingSession.update(session.id, { csv_label: fileName });

    // Replace existing GPS data
    const existing = await base44.entities.SessionGPSData.filter({ session_id: session.id }, "-created_date", 500);
    await Promise.all(existing.map(r => base44.entities.SessionGPSData.delete(r.id)));

    let savedRows = [];
    if (toCreate.length > 0) {
      savedRows = await base44.entities.SessionGPSData.bulkCreate(toCreate);
    }

    // Guardar resumen de sesión desde filas Total/Promedio del CSV
    if (summaryRows && summaryRows.length > 0) {
      const totalRow = summaryRows.find(r => ["total", "totals", "team total"].includes(r["Name"].toLowerCase().trim()));
      const avgRow = summaryRows.find(r => ["promedio", "average", "avg"].includes(r["Name"].toLowerCase().trim()));

      const summaryPayload = {
        session_id: session.id,
        source_file: fileName,
        total_distance: parseNum(totalRow?.["Total Distance (m)"]),
        avg_distance: parseNum(avgRow?.["Total Distance (m)"]),
        avg_m_min: parseNum(avgRow?.["Metros x Min"]),
        avg_player_load: parseNum(avgRow?.["Total Player Load"]),
        max_speed: parseNum(totalRow?.["Maximum Velocity (km/h)"] || avgRow?.["Maximum Velocity (km/h)"]),
      };

      // Reemplazar resumen anterior
      const existingSummary = await base44.entities.SessionGPSSummary.filter({ session_id: session.id });
      await Promise.all(existingSummary.map(r => base44.entities.SessionGPSSummary.delete(r.id)));
      await base44.entities.SessionGPSSummary.create(summaryPayload);
    }

    setGpsRows(Array.isArray(savedRows) ? savedRows : toCreate);
    setUnmatched(unmatchedList);
    setPreview(null);
    setImporting(false);
    toast({ title: `GPS importado: ${toCreate.length} jugadores OK, ${unmatchedList.length} sin reconocer` });
  }

  // ── Manual alias ──────────────────────────────────────────────────────────
  async function saveManualAlias(rawName, playerId) {
    if (!playerId) return;
    const player = allPlayers.find(p => p.id === playerId);
    if (!player) return;
    await base44.entities.PlayerAlias.create({
      player_id: playerId,
      player_name: player.full_name || "",
      alias_name: rawName,
      normalized_alias: normalize(rawName),
      source: "Manual",
      confidence_score: 1,
    });
    const unmRow = unmatched.find(u => u.rawName === rawName);
    if (unmRow) {
      const record = { ...unmRow.record, player_id: playerId, player_name: player.full_name || "" };
      const created = await base44.entities.SessionGPSData.create(record);
      setGpsRows(prev => [...prev, created]);
      setUnmatched(prev => prev.filter(u => u.rawName !== rawName));
    }
    toast({ title: `✓ Alias guardado para ${player.full_name}` });
  }

  const [activeMetric, setActiveMetric] = useState("total_distance");
  const [playerTypeFilter, setPlayerTypeFilter] = useState("todos"); // todos | campo | arqueros

  // ── Stats ──────────────────────────────────────────────────────────────────
  // Classify rows using allPlayers lookup
  const gkRows = gpsRows.filter(r => {
    const p = allPlayers.find(x => x.id === r.player_id);
    return isGoalkeeper(p || { position: r.player_name });
  });
  const fieldRows = gpsRows.filter(r => {
    const p = allPlayers.find(x => x.id === r.player_id);
    return !isGoalkeeper(p || { position: r.player_name });
  });
  const filteredRows = playerTypeFilter === "arqueros" ? gkRows
    : playerTypeFilter === "campo" ? fieldRows
    : gpsRows;

  function avg(key, rows = filteredRows) {
    const vals = rows.map(r => r[key] || 0).filter(v => v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  const activeMeta = METRICS.find(m => m.key === activeMetric) || METRICS[0];
  const chartData = [...filteredRows]
    .sort((a, b) => (b[activeMetric] || 0) - (a[activeMetric] || 0))
    .map(r => ({
      name: (r.player_name || "").split(" ")[0],
      value: r[activeMetric] || 0,
    }));

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <div className="border-2 border-dashed border-zinc-700 rounded-xl p-6 text-center">
        <Upload size={20} className="text-zinc-500 mx-auto mb-2" />
        <p className="text-sm text-zinc-400 mb-1">Cargar CSV de GPS Catapult</p>
        <p className="text-[10px] text-zinc-600 mb-3">Separado por comas · con comillas dobles · UTF-8</p>
        <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white hover:bg-zinc-700 transition-colors ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
          <Upload size={14} /> {uploading ? "Leyendo archivo..." : "Seleccionar archivo CSV"}
          <input type="file" accept=".csv" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
        {session.csv_label && <p className="text-xs text-zinc-500 mt-2">Último cargado: {session.csv_label}</p>}
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <Eye size={14} className="text-blue-400" /> Vista previa — {preview.fileName}
            </p>
            <button onClick={() => setPreview(null)} className="text-zinc-500 hover:text-white">
              <X size={16} />
            </button>
          </div>

          {/* Missing required columns error */}
          {preview.missingCols.length > 0 && (
            <div className="flex items-start gap-2 px-3 py-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-300">Columnas obligatorias no encontradas:</p>
                <p className="text-xs text-red-400 mt-0.5">{preview.missingCols.join(", ")}</p>
                <p className="text-[10px] text-zinc-500 mt-1">Revisá que los encabezados del CSV coincidan exactamente con los esperados.</p>
              </div>
            </div>
          )}

          {/* Detected columns */}
          <div>
            <p className="text-[10px] text-zinc-500 mb-2 uppercase tracking-wider font-medium">Columnas detectadas ({Object.keys(preview.detectedCols).length})</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(COLUMN_MAP).map(col => {
                const found = col in preview.detectedCols;
                const required = REQUIRED_COLS.includes(col);
                return (
                  <span key={col}
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                      found
                        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                        : required
                          ? "bg-red-500/10 text-red-400 border-red-500/30"
                          : "bg-zinc-800 text-zinc-500 border-zinc-700"
                    }`}>
                    {found ? "✓" : "✗"} {col}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Preview rows */}
          {preview.parsedRows.length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-500 mb-2 uppercase tracking-wider font-medium">
                Primeras filas ({Math.min(5, preview.parsedRows.length)} de {preview.parsedRows.length})
              </p>
              <div className="overflow-x-auto">
                <table className="text-[10px] border-collapse w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      {Object.keys(preview.detectedCols).map(col => (
                        <th key={col} className="text-left py-1.5 px-2 text-zinc-500 font-medium whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.parsedRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-zinc-800/40">
                        {Object.keys(preview.detectedCols).map(col => (
                          <td key={col} className="py-1.5 px-2 text-zinc-300 whitespace-nowrap">{row[col] || "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setPreview(null)}
              className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-xs hover:bg-zinc-700 transition-colors">
              Cancelar
            </button>
            <button
              onClick={confirmImport}
              disabled={importing || preview.missingCols.length > 0}
              className="px-4 py-1.5 bg-white text-zinc-900 font-semibold rounded-lg text-xs hover:bg-zinc-200 transition-colors disabled:opacity-40">
              {importing ? "Importando..." : `Confirmar e importar (${preview.parsedRows.length} jugadores)`}
            </button>
          </div>
        </div>
      )}

      {/* No data */}
      {gpsRows.length === 0 && unmatched.length === 0 && !preview && (
        <p className="text-zinc-600 text-sm text-center py-2">Sin datos GPS cargados</p>
      )}

      {/* Type filter */}
      {gpsRows.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={12} className="text-zinc-500" />
          {[
            { key: "todos", label: `Todos (${gpsRows.length})` },
            { key: "campo", label: `Campo (${fieldRows.length})` },
            { key: "arqueros", label: `Arqueros (${gkRows.length})` },
          ].map(opt => (
            <button key={opt.key} onClick={() => setPlayerTypeFilter(opt.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                playerTypeFilter === opt.key
                  ? "bg-white text-zinc-900 border-transparent"
                  : "bg-transparent border-zinc-700 text-zinc-400 hover:text-white"
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Summary cards */}
      {gpsRows.length > 0 && (
        <div className="space-y-3">
          {/* Selected group averages */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {METRICS.map(m => {
              const a = avg(m.key, filteredRows);
              const display = m.key === "smax" ? (a != null ? fmtSmax(a) : "—") : (a != null ? fmtMetric(a) : "—");
              return (
                <div key={m.key} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
                  <p className="text-[10px] text-zinc-500 mb-1">{m.label}</p>
                  <p className="text-xl font-bold" style={{ color: m.color }}>{display}</p>
                  {/* Show field / gk breakdown when viewing all */}
                  {playerTypeFilter === "todos" && fieldRows.length > 0 && gkRows.length > 0 && (
                    <div className="flex justify-center gap-2 mt-1">
                      <span className="text-[8px] text-zinc-500">
                        C: {m.key === "smax" ? fmtSmax(avg(m.key, fieldRows) || 0) : fmtMetric(avg(m.key, fieldRows) || 0)}
                      </span>
                      <span className="text-[8px] text-yellow-600">
                        A: {m.key === "smax" ? fmtSmax(avg(m.key, gkRows) || 0) : fmtMetric(avg(m.key, gkRows) || 0)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GPS Table */}
      {filteredRows.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-3 px-4 text-zinc-400 font-medium whitespace-nowrap">Jugador</th>
                  {METRICS.map(m => (
                    <th key={m.key} className="text-right py-3 px-3 font-medium whitespace-nowrap" style={{ color: m.color }}>
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r, i) => (
                  <tr key={r.player_id || i} className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2.5 px-4 text-white font-semibold whitespace-nowrap">{r.player_name}</td>
                    <td className="py-2.5 px-3 text-right font-bold" style={{ color: "#3b82f6" }}>{fmtMetric(r.total_distance)}</td>
                    <td className="py-2.5 px-3 text-right font-bold" style={{ color: "#10b981" }}>{fmtMetric(r.distance_19_8)}</td>
                    <td className="py-2.5 px-3 text-right font-bold" style={{ color: "#f97316" }}>{fmtMetric(r.distance_25)}</td>
                    <td className="py-2.5 px-3 text-right font-bold" style={{ color: "#a855f7" }}>{fmtMetric(r.player_load)}</td>
                    <td className="py-2.5 px-3 text-right font-bold" style={{ color: "#ef4444" }}>{fmtSmax(r.smax)}</td>
                    <td className="py-2.5 px-3 text-right font-bold" style={{ color: "#f59e0b" }}>{fmtMetric(r.acc_3)}</td>
                    <td className="py-2.5 px-3 text-right font-bold" style={{ color: "#ec4899" }}>{fmtMetric(r.dec_3)}</td>
                    <td className="py-2.5 px-3 text-right font-bold" style={{ color: "#06b6d4" }}>{fmtMetric(r.sprints)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bar chart — metric selector + chart */}
      {gpsRows.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
          {/* Metric tabs */}
          <div className="flex flex-wrap gap-2">
            {METRICS.map(m => (
              <button
                key={m.key}
                onClick={() => setActiveMetric(m.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  activeMetric === m.key
                    ? "border-transparent text-zinc-900"
                    : "bg-transparent border-zinc-700 text-zinc-400 hover:text-white"
                }`}
                style={activeMetric === m.key ? { backgroundColor: m.color } : {}}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div>
            <p className="text-xs text-zinc-400 mb-3 font-medium">{activeMeta.label} — por jugador</p>
            <ResponsiveContainer width="100%" height={chartData.length * 32 + 20}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 60, right: 40, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} width={60} />
                <Tooltip
                  contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: "#fff" }}
                  itemStyle={{ color: activeMeta.color }}
                  formatter={v => [activeMetric === "smax" ? fmtSmax(v) : fmtMetric(v), activeMeta.label]}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, idx) => (
                    <Cell key={idx} fill={activeMeta.color} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Unmatched */}
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