import React, { useState, useEffect } from "react";
import { Loader2, Inbox, Search, Table, Grid3x3 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useWorkspace } from "@/lib/WorkspaceContext";
import PlayerPhoto from "@/components/player/PlayerPhoto";
import ChangeMap from "@/components/evaluations/ChangeMap";

function fmtVal(v, d = 1) {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  return Number(v).toFixed(d);
}

export default function EvaluationsSquadAnalysis({ onSelectPlayer }) {
  const { activeSquad } = useWorkspace();
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [results, setResults] = useState([]);
  const [playersMap, setPlayersMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("table"); // table | map
  const [search, setSearch] = useState("");
  const [selectedMetric, setSelectedMetric] = useState(null);

  // Load players in batch (once)
  useEffect(() => {
    base44.entities.Player.list("full_name", 1000)
      .then((data) => setPlayersMap(new Map((data || []).map((p) => [p.id, p]))))
      .catch(() => setPlayersMap(new Map()));
  }, []);

  useEffect(() => {
    const filter = activeSquad?.id ? { squad_id: activeSquad.id } : {};
    base44.entities.EvaluationSession.filter(filter, "-assessment_date", 50)
      .then((data) => {
        setSessions(data || []);
        if (data?.length) setSelectedSession(data[0].session_id);
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [activeSquad?.id]);

  useEffect(() => {
    if (!selectedSession) return;
    setLoading(true);
    base44.entities.EvaluationResult.filter({ session_id: selectedSession }, "test_key", 500)
      .then((data) => {
        setResults(data || []);
        const metrics = new Set();
        (data || []).forEach((r) => Object.keys(r.metrics || {}).forEach((k) => metrics.add(k)));
        const sorted = [...metrics].sort();
        if (sorted.length && !selectedMetric) setSelectedMetric(sorted[0]);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [selectedSession]);

  if (loading && !results.length) return <div className="py-10 flex justify-center"><Loader2 size={20} className="text-zinc-500 animate-spin" /></div>;

  if (!sessions.length) {
    return (
      <div className="py-12 text-center">
        <Inbox size={28} className="text-zinc-600 mx-auto mb-2" />
        <p className="text-zinc-500 text-sm">No hay fechas para analizar</p>
      </div>
    );
  }

  const primaryResults = results.filter((r) => r.is_primary);
  const filtered = search
    ? primaryResults.filter((r) => {
        const player = r.player_id ? playersMap.get(r.player_id) : null;
        const name = player?.full_name || r.player_name_csv || "";
        return name.toLowerCase().includes(search.toLowerCase());
      })
    : primaryResults;

  // Build change map data from results
  const changeMapPlayers = new Map();
  for (const r of filtered) {
    const key = r.player_id || r.player_name_csv;
    if (!changeMapPlayers.has(key)) {
      const player = r.player_id ? playersMap.get(r.player_id) : null;
      changeMapPlayers.set(key, {
        player_id: r.player_id,
        player_name: player?.full_name || r.player_name_csv,
        player_photo_url: player?.photo_url || null,
        position: player?.position || "—",
        metrics: {},
      });
    }
    const p = changeMapPlayers.get(key);
    for (const [mk, mv] of Object.entries(r.metrics || {})) {
      const mapKey = `${r.test_key}|${mk}`;
      p.metrics[mapKey] = {
        current_value: mv,
        baseline_value: null,
        baseline_sufficient: false,
        change_abs: null,
        change_pct: null,
        z_score_individual: null,
        z_score_squad: null,
        signal: "insufficient",
        test_key: r.test_key,
        metric_key: mk,
        assessment_date: r.assessment_date,
      };
    }
  }

  const allMetrics = [...new Set(results.flatMap((r) => Object.keys(r.metrics || {})))].sort();

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3 flex-wrap">
        <select value={selectedSession || ""} onChange={(e) => setSelectedSession(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
          {sessions.map((s) => <option key={s.session_id} value={s.session_id}>{s.assessment_date} — {s.name || s.squad_name}</option>)}
        </select>
        <div className="relative flex-1 min-w-[150px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar jugador..." className="w-full pl-8 pr-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white" />
        </div>
        <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-0.5">
          <button onClick={() => setMode("table")} className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 ${mode === "table" ? "bg-blue-500 text-white" : "text-zinc-400"}`}><Table size={13} /> Tabla</button>
          <button onClick={() => setMode("map")} className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 ${mode === "map" ? "bg-blue-500 text-white" : "text-zinc-400"}`}><Grid3x3 size={13} /> Mapa</button>
        </div>
      </div>

      {mode === "map" ? (
        <ChangeMap players={[...changeMapPlayers.values()]} metricKey={selectedMetric} allMetrics={allMetrics} onSelectPlayer={onSelectPlayer} />
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-950/50 text-zinc-500 border-b border-zinc-800">
                  <th className="text-left p-2.5 font-semibold sticky left-0 bg-zinc-950/50">Jugador</th>
                  <th className="text-left p-2.5 font-semibold">Prueba</th>
                  <th className="text-left p-2.5 font-semibold">Lado</th>
                  <th className="text-left p-2.5 font-semibold">Intento</th>
                  <th className="text-left p-2.5 font-semibold">Estado</th>
                  {allMetrics.slice(0, 8).map((mk) => (
                    <th key={mk} className="text-right p-2.5 font-semibold whitespace-nowrap">{mk.length > 20 ? mk.slice(0, 18) + "…" : mk}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const player = r.player_id ? playersMap.get(r.player_id) : null;
                  const displayName = player?.full_name || r.player_name_csv;
                  return (
                  <tr key={i} className="border-b border-zinc-800/40 hover:bg-zinc-800/20 cursor-pointer" onClick={() => { if (r.player_id && onSelectPlayer) onSelectPlayer(r.player_id); }}>
                    <td className="p-2.5 sticky left-0 bg-zinc-900">
                      <div className="flex items-center gap-2">
                        <PlayerPhoto player={{ photo_url: player?.photo_url, full_name: displayName }} className="w-6 h-6 rounded-full object-cover border border-zinc-700 shrink-0" />
                        <span className="text-white font-medium truncate">{displayName}</span>
                      </div>
                    </td>
                    <td className="p-2.5"><span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 font-bold uppercase text-[10px]">{r.test_key}</span></td>
                    <td className="p-2.5 text-zinc-400">{r.test_side}</td>
                    <td className="p-2.5 text-zinc-400">{r.attempt_number}{r.retest ? " (R)" : ""}</td>
                    <td className="p-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        r.linking_status === "linked" ? "bg-emerald-500/15 text-emerald-300" :
                        r.linking_status === "collision" ? "bg-orange-500/15 text-orange-300" :
                        "bg-red-500/15 text-red-300"
                      }`}>{r.linking_status}</span>
                    </td>
                    {allMetrics.slice(0, 8).map((mk) => (
                      <td key={mk} className="p-2.5 text-right text-zinc-300 tabular-nums">{r.metrics?.[mk] != null ? fmtVal(r.metrics[mk]) : "—"}</td>
                    ))}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}