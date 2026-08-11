import React, { useState, useEffect } from "react";
import { Calendar, ChevronDown, ChevronRight, Loader2, Inbox, Users, FlaskConical, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useWorkspace } from "@/lib/WorkspaceContext";
import PlayerPhoto from "@/components/player/PlayerPhoto";

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}

export default function EvaluationsSessions({ onSelectPlayer }) {
  const { activeSquad } = useWorkspace();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [resultsBySession, setResultsBySession] = useState({});
  const [playersMap, setPlayersMap] = useState(new Map());

  useEffect(() => {
    base44.entities.Player.list("full_name", 1000)
      .then((data) => setPlayersMap(new Map((data || []).map((p) => [p.id, p]))))
      .catch(() => setPlayersMap(new Map()));
  }, []);

  useEffect(() => {
    const filter = activeSquad?.id ? { squad_id: activeSquad.id } : {};
    base44.entities.EvaluationSession.filter(filter, "-assessment_date", 50)
      .then((data) => setSessions(data || []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [activeSquad?.id]);

  async function toggleExpand(sessionId) {
    if (expanded === sessionId) { setExpanded(null); return; }
    setExpanded(sessionId);
    if (!resultsBySession[sessionId]) {
      try {
        const results = await base44.entities.EvaluationResult.filter({ session_id: sessionId }, "test_key", 500);
        setResultsBySession((prev) => ({ ...prev, [sessionId]: results || [] }));
      } catch { setResultsBySession((prev) => ({ ...prev, [sessionId]: [] })); }
    }
  }

  if (loading) return <div className="py-10 flex justify-center"><Loader2 size={20} className="text-zinc-500 animate-spin" /></div>;

  if (!sessions.length) {
    return (
      <div className="py-12 text-center">
        <Inbox size={28} className="text-zinc-600 mx-auto mb-2" />
        <p className="text-zinc-500 text-sm">No hay fechas de evaluación</p>
        <p className="text-zinc-600 text-xs mt-1">Importá un CSV para crear la primera batería</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((s) => {
        const isOpen = expanded === s.session_id;
        const results = resultsBySession[s.session_id] || [];
        return (
          <div key={s.session_id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <button onClick={() => toggleExpand(s.session_id)} className="w-full flex items-center gap-3 p-3 hover:bg-zinc-800/30 text-left">
              {isOpen ? <ChevronDown size={16} className="text-zinc-500 shrink-0" /> : <ChevronRight size={16} className="text-zinc-500 shrink-0" />}
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Calendar size={16} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{s.name || `Batería ${fmtDate(s.assessment_date)}`}</p>
                <p className="text-xs text-zinc-500">{fmtDate(s.assessment_date)} · {s.squad_name || "Sin plantel"} · {s.context || "Sin contexto"}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs">
                <span className="flex items-center gap-1 text-zinc-400"><Users size={13} /> {s.total_players}</span>
                <span className="flex items-center gap-1 text-zinc-400"><FlaskConical size={13} /> {s.total_results}</span>
                {s.pending_results > 0 && <span className="flex items-center gap-1 text-orange-400"><AlertCircle size={13} /> {s.pending_results}</span>}
                <div className="flex gap-1">
                  {(s.test_keys || []).map((tk) => (
                    <span key={tk} className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 text-[10px] font-bold uppercase">{tk}</span>
                  ))}
                </div>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-zinc-800 p-3">
                {results.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-zinc-950/50 text-zinc-500">
                          <th className="text-left p-2 font-semibold">Jugador</th>
                          <th className="text-left p-2 font-semibold">Prueba</th>
                          <th className="text-left p-2 font-semibold">Lado</th>
                          <th className="text-left p-2 font-semibold">Intento</th>
                          <th className="text-left p-2 font-semibold">Métricas (primeras 5)</th>
                          <th className="text-left p-2 font-semibold">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r, i) => {
                          const player = r.player_id ? playersMap.get(r.player_id) : null;
                          const displayName = player?.full_name || r.player_name_csv;
                          return (
                          <tr key={i} className="border-t border-zinc-800/40 hover:bg-zinc-800/20 cursor-pointer" onClick={() => { if (r.player_id && onSelectPlayer) onSelectPlayer(r.player_id); }}>
                            <td className="p-2">
                              <div className="flex items-center gap-1.5">
                                <PlayerPhoto player={{ photo_url: player?.photo_url, full_name: displayName }} className="w-5 h-5 rounded-full object-cover border border-zinc-700 shrink-0" />
                                <span className="text-white font-medium truncate">{displayName}</span>
                              </div>
                            </td>
                            <td className="p-2"><span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 font-bold uppercase text-[10px]">{r.test_key}</span></td>
                            <td className="p-2 text-zinc-400">{r.test_side}</td>
                            <td className="p-2 text-zinc-400">{r.attempt_number}{r.retest ? " (retest)" : ""}</td>
                            <td className="p-2 text-zinc-300">
                              {Object.entries(r.metrics || {}).slice(0, 5).map(([k, v]) => (
                                <span key={k} className="mr-2">{k}: <span className="text-white">{typeof v === "number" ? v.toFixed(1) : v}</span></span>
                              ))}
                            </td>
                            <td className="p-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                r.linking_status === "linked" ? "bg-emerald-500/15 text-emerald-300" :
                                r.linking_status === "collision" ? "bg-orange-500/15 text-orange-300" :
                                "bg-red-500/15 text-red-300"
                              }`}>{r.linking_status}</span>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-zinc-500 text-xs text-center py-4">Sin resultados cargados</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}