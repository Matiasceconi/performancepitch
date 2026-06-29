import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, CheckCircle, AlertCircle, Zap } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

function normalize(s) {
  return (s || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

export default function SessionGPS({ session, sessionPlayers }) {
  const [uploading, setUploading] = useState(false);
  const [csvData, setCsvData] = useState(null); // parsed rows
  const [matched, setMatched] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const { toast } = useToast();

  const GPS_KEYS = ["Total Distance", "Distance", "Player Load", "Max Velocity", "Sprint Distance", "HSR Distance", "Accelerations", "Decelerations"];

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);

    // Upload CSV
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    // Save url to session
    await base44.entities.TrainingSession.update(session.id, { csv_url: file_url, csv_label: file.name });

    // Parse CSV text
    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) { setUploading(false); return; }

    // Detect separator
    const sep = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(sep).map(h => h.replace(/"/g, "").trim());
    const nameCol = headers.findIndex(h => /name|jugador|player/i.test(h));

    const rows = lines.slice(1).map(l => {
      const cols = l.split(sep).map(c => c.replace(/"/g, "").trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = cols[i] || ""; });
      return obj;
    }).filter(r => r[headers[nameCol]] || Object.values(r).some(v => v));

    setCsvData(rows);

    // Load aliases for matching
    const aliases = await base44.entities.PlayerAlias.list("-created_date", 1000);
    const aliasMap = {}; // normalized alias -> player_id
    aliases.forEach(a => { if (a.normalized_alias) aliasMap[a.normalized_alias] = a.player_id; });

    // Also match by session player names directly
    const sessionPlayerMap = {}; // normalized name -> SessionPlayer record
    sessionPlayers.forEach(sp => { sessionPlayerMap[normalize(sp.player_name)] = sp; });

    const matchedRows = [];
    const unmatchedRows = [];

    rows.forEach(row => {
      const rawName = headers[nameCol] ? row[headers[nameCol]] : "";
      const normName = normalize(rawName);

      let playerId = aliasMap[normName];
      // Fallback: direct name match in session players
      if (!playerId && sessionPlayerMap[normName]) {
        playerId = sessionPlayerMap[normName].player_id;
      }

      const sp = sessionPlayers.find(s => s.player_id === playerId);
      const metrics = {};
      headers.forEach(h => {
        if (GPS_KEYS.some(k => h.toLowerCase().includes(k.toLowerCase()))) {
          metrics[h] = row[h];
        }
      });

      if (sp) {
        matchedRows.push({ sp, rawName, metrics });
      } else {
        unmatchedRows.push({ rawName, metrics });
      }
    });

    setMatched(matchedRows);
    setUnmatched(unmatchedRows);
    setUploading(false);
    toast({ title: `GPS: ${matchedRows.length} reconocidos, ${unmatchedRows.length} sin reconocer` });
  }

  return (
    <div className="space-y-5">
      {/* Upload */}
      <div className="border-2 border-dashed border-zinc-700 rounded-xl p-6 text-center">
        <Upload size={20} className="text-zinc-500 mx-auto mb-2" />
        <p className="text-sm text-zinc-400 mb-3">Cargar CSV de GPS (Catapult / OpenField)</p>
        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white hover:bg-zinc-700 transition-colors">
          <Upload size={14} /> {uploading ? "Procesando..." : "Seleccionar archivo CSV"}
          <input type="file" accept=".csv" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
        {session.csv_label && <p className="text-xs text-zinc-500 mt-2">Último: {session.csv_label}</p>}
      </div>

      {/* Matched */}
      {matched.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CheckCircle size={12} /> Reconocidos ({matched.length})
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-2 px-2 text-zinc-500 font-medium">Jugador</th>
                  {matched[0] && Object.keys(matched[0].metrics).map(k => (
                    <th key={k} className="text-right py-2 px-2 text-zinc-500 font-medium whitespace-nowrap">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matched.map(({ sp, metrics }) => (
                  <tr key={sp.player_id} className="border-b border-zinc-800/40">
                    <td className="py-1.5 px-2 text-white font-medium">{sp.player_name}</td>
                    {Object.values(metrics).map((v, i) => (
                      <td key={i} className="py-1.5 px-2 text-right text-zinc-300">{v || "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unmatched */}
      {unmatched.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <AlertCircle size={12} /> Sin reconocer ({unmatched.length})
          </p>
          <div className="space-y-1">
            {unmatched.map(({ rawName }, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-red-500/5 border border-red-500/20 rounded-lg">
                <AlertCircle size={11} className="text-red-400 shrink-0" />
                <span className="text-xs text-red-300">{rawName || "(sin nombre)"}</span>
                <span className="text-[10px] text-zinc-600 ml-auto">Agregar alias en Administración → Identity Manager</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}