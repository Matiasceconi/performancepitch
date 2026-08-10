import React, { useState, useEffect } from "react";
import { Calendar, ChevronDown, ChevronRight, Loader2, Users, FlaskConical, Inbox } from "lucide-react";
import { base44 } from "@/api/base44Client";

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}

export default function ValdSessionsList() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [resultsBySession, setResultsBySession] = useState({});
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    base44.entities.ValdAssessmentSession.list("-assessment_date", 50)
      .then((data) => setSessions(data || []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  async function toggleExpand(sessionId) {
    if (expanded === sessionId) {
      setExpanded(null);
      return;
    }
    setExpanded(sessionId);
    if (!resultsBySession[sessionId]) {
      setLoadingResults(true);
      try {
        const results = await base44.entities.ValdTestResult.filter({ session_id: sessionId }, "test_type", 500);
        setResultsBySession((prev) => ({ ...prev, [sessionId]: results || [] }));
      } catch {
        setResultsBySession((prev) => ({ ...prev, [sessionId]: [] }));
      } finally {
        setLoadingResults(false);
      }
    }
  }

  if (loading) {
    return (
      <div className="py-10 flex items-center justify-center">
        <Loader2 size={20} className="text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (!sessions.length) {
    return (
      <div className="py-10 text-center">
        <Inbox size={28} className="text-zinc-600 mx-auto mb-2" />
        <p className="text-zinc-500 text-sm">No hay baterías importadas todavía</p>
        <p className="text-zinc-600 text-xs mt-1">Usá el botón "Importar CSV" para cargar la primera evaluación</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => {
        const isOpen = expanded === session.session_id;
        const results = resultsBySession[session.session_id] || [];
        return (
          <div key={session.session_id} className="bg-zinc-950/40 border border-zinc-800 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleExpand(session.session_id)}
              className="w-full flex items-center gap-3 p-3 hover:bg-zinc-800/30 transition-colors text-left"
            >
              {isOpen ? <ChevronDown size={16} className="text-zinc-500 shrink-0" /> : <ChevronRight size={16} className="text-zinc-500 shrink-0" />}
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Calendar size={16} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{fmtDate(session.assessment_date)}</p>
                <p className="text-xs text-zinc-500">{session.squad_name || "Sin plantel"}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1 text-xs text-zinc-400">
                  <Users size={13} /> {session.total_players}
                </div>
                <div className="flex items-center gap-1 text-xs text-zinc-400">
                  <FlaskConical size={13} /> {session.total_results}
                </div>
                <div className="flex gap-1">
                  {(session.test_types || []).map((t) => (
                    <span key={t} className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 text-[10px] font-bold">{t}</span>
                  ))}
                </div>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-zinc-800 p-3">
                {loadingResults && !results.length ? (
                  <div className="py-6 flex items-center justify-center">
                    <Loader2 size={16} className="text-zinc-500 animate-spin" />
                  </div>
                ) : results.length ? (
                  <ResultsTable results={results} />
                ) : (
                  <p className="text-zinc-500 text-xs text-center py-4">Sin resultados cargados</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ResultsTable({ results }) {
  // Group by player
  const byPlayer = {};
  for (const r of results) {
    const key = r.player_name_csv || "Sin nombre";
    if (!byPlayer[key]) byPlayer[key] = [];
    byPlayer[key].push(r);
  }
  const players = Object.keys(byPlayer).sort();

  // Get all unique metric keys
  const metricKeys = new Set();
  for (const r of results) {
    for (const k of Object.keys(r.metrics || {})) metricKeys.add(k);
  }
  const sortedMetrics = [...metricKeys].sort().slice(0, 8); // show first 8

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-zinc-900">
            <th className="text-left p-2 text-zinc-400 font-semibold sticky left-0 bg-zinc-900">Jugador</th>
            <th className="text-left p-2 text-zinc-400 font-semibold">Test</th>
            <th className="text-left p-2 text-zinc-400 font-semibold">Lado</th>
            {sortedMetrics.map((m) => (
              <th key={m} className="text-right p-2 text-zinc-400 font-semibold whitespace-nowrap">{m.length > 20 ? m.slice(0, 18) + "…" : m}</th>
            ))}
            <th className="text-left p-2 text-zinc-400 font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody>
          {players.map((name) => {
            const playerResults = byPlayer[name];
            const linked = playerResults[0]?.linking_status === "linked";
            return playerResults.map((r, i) => (
              <tr key={`${name}-${i}`} className="border-t border-zinc-800/40 hover:bg-zinc-800/20">
                {i === 0 ? (
                  <td className="p-2 text-white font-medium sticky left-0 bg-zinc-950/40 align-top" rowSpan={playerResults.length}>
                    {name}
                    {linked && <span className="block text-[10px] text-emerald-400">✓ vinculado</span>}
                  </td>
                ) : null}
                <td className="p-2 text-zinc-300">{r.test_type}</td>
                <td className="p-2 text-zinc-500">{r.test_side}</td>
                {sortedMetrics.map((m) => (
                  <td key={m} className="p-2 text-right text-zinc-300 tabular-nums whitespace-nowrap">
                    {r.metrics?.[m] != null ? Number(r.metrics[m]).toFixed(1) : "—"}
                  </td>
                ))}
                <td className="p-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    r.linking_status === "linked" ? "bg-emerald-500/15 text-emerald-300" :
                    r.linking_status === "collision" ? "bg-orange-500/15 text-orange-300" :
                    "bg-red-500/15 text-red-300"
                  }`}>
                    {r.linking_status === "linked" ? "OK" : r.linking_status === "collision" ? "Col." : "Pend."}
                  </span>
                </td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}