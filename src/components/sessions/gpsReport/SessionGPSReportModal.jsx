import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { X, FileDown, Loader, TrendingUp, TrendingDown, AlertCircle, ArrowUpDown } from "lucide-react";
import moment from "moment";
import "moment/locale/es";
import { useToast } from "@/components/ui/use-toast";
import { REPORT_METRICS, fmtMetricVal, buildReportData } from "./sessionGpsReportData";
import { generateSessionGPSReportPDF } from "./SessionGPSReportPDF";
moment.locale("es");

function pctColorClass(pct) {
  if (pct == null) return "bg-zinc-700 text-zinc-300";
  if (pct >= 90) return "bg-emerald-500/80 text-white";
  if (pct >= 70) return "bg-yellow-500/80 text-zinc-900";
  return "bg-red-500/80 text-white";
}

export default function SessionGPSReportModal({ session, sessionPlayers, onClose }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [observations, setObservations] = useState(session.gps_report_observations || "");
  const [sortKey, setSortKey] = useState("total_distance");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    async function load() {
      const weekStart = moment(session.date).startOf("isoWeek").format("YYYY-MM-DD");
      const weekEnd = moment(session.date).endOf("isoWeek").format("YYYY-MM-DD");

      const [gpsRows, players, allSessions, competitionProfiles] = await Promise.all([
        base44.entities.SessionGPSData.filter({ session_id: session.id }, "-created_date", 200),
        base44.entities.Player.list("-created_date", 500),
        base44.entities.TrainingSession.list("-date", 300),
        base44.entities.PlayerCompetitionProfile.list("-updated_at", 500),
      ]);

      const weekSessions = allSessions.filter((s) =>
        s.id !== session.id && s.squad_id === session.squad_id && s.date >= weekStart && s.date <= weekEnd
      );
      const weekGpsRows = weekSessions.length
        ? (await Promise.all(weekSessions.map((s) => base44.entities.SessionGPSData.filter({ session_id: s.id }, "-created_date", 200)))).flat()
        : [];

      const data = buildReportData({ session, sessionPlayers, gpsRows, players, weekGpsRows, competitionProfiles });
      setReportData(data);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const sortedPrincipal = useMemo(() => {
    if (!reportData) return [];
    return [...reportData.principal].sort((a, b) => ((b[sortKey] || 0) - (a[sortKey] || 0)) * (sortDir === "desc" ? 1 : -1));
  }, [reportData, sortKey, sortDir]);

  const rankByKey = useMemo(() => {
    if (!reportData) return {};
    const map = {};
    REPORT_METRICS.forEach((m) => {
      map[m.key] = [...reportData.principal].sort((a, b) => (b[m.key] || 0) - (a[m.key] || 0)).map((r) => r.player_id).slice(0, 3);
    });
    return map;
  }, [reportData]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  async function saveObservations() {
    setSaving(true);
    await base44.entities.TrainingSession.update(session.id, { gps_report_observations: observations });
    setSaving(false);
    toast({ title: "✓ Observaciones guardadas" });
  }

  async function handleExport() {
    setExporting(true);
    try {
      await generateSessionGPSReportPDF({ session, reportData, observations });
      toast({ title: "✓ Informe PDF generado" });
    } catch (err) {
      toast({ title: "Error al generar el PDF: " + err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
          <p className="text-sm font-semibold text-white">Informe de Sesión GPS — {session.title}</p>
          <div className="flex items-center gap-2">
            <button onClick={handleExport} disabled={exporting || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-semibold rounded-lg text-xs transition-colors disabled:opacity-50">
              {exporting ? <Loader size={12} className="animate-spin" /> : <FileDown size={12} />} Exportar PDF
            </button>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors"><X size={18} /></button>
          </div>
        </div>

        <div className="overflow-y-auto p-5 space-y-6">
          {loading || !reportData ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Resumen general */}
              <section className="space-y-3">
                <h3 className="text-sm font-bold text-white">1. Resumen general</h3>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    ["Con GPS", reportData.summary.conGps], ["Excluidos", reportData.summary.excluidos],
                    ["Diferenciados", reportData.summary.diferenciados], ["Kinesiología", reportData.summary.kinesiologia],
                    ["Arqueros", reportData.summary.arqueros], ["Duración", reportData.summary.duracion ? `${reportData.summary.duracion}'` : "—"],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-zinc-800/60 rounded-lg p-2 text-center">
                      <p className="text-base font-bold text-white">{val}</p>
                      <p className="text-[9px] text-zinc-500">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {REPORT_METRICS.map((m) => {
                    const val = reportData.teamAverages[m.key], wk = reportData.weekAverages[m.key];
                    const diff = (val != null && wk) ? Math.round(((val - wk) / wk) * 100) : null;
                    return (
                      <div key={m.key} className="bg-zinc-800/40 border border-zinc-800 rounded-lg p-2.5">
                        <p className="text-[9px] text-zinc-500">{m.label}</p>
                        <p className="text-sm font-bold text-white">{fmtMetricVal(m.key, val)} {m.unit}</p>
                        {diff != null && (
                          <p className={`text-[9px] flex items-center gap-1 ${diff >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {diff >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />} {diff >= 0 ? "+" : ""}{diff}% vs semana
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Jugadores destacados */}
              <section className="space-y-3">
                <h3 className="text-sm font-bold text-white">2. Jugadores destacados</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {reportData.highlights.map((h) => (
                    <div key={h.label} className="bg-zinc-800/60 border border-zinc-800 rounded-lg p-2.5 flex items-center gap-2">
                      {h.photo_url ? (
                        <img src={h.photo_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-zinc-700 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-[8.5px] text-zinc-500 truncate">{h.label}</p>
                        <p className="text-xs font-semibold text-white truncate">{h.player_name}</p>
                        <p className="text-[9px] text-yellow-400">{h.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Tabla general */}
              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white">3. Tabla general</h3>
                <div className="overflow-x-auto border border-zinc-800 rounded-lg">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-800">
                        <th className="text-left py-2 px-3 text-zinc-400 font-medium whitespace-nowrap">Jugador</th>
                        {REPORT_METRICS.map((m) => (
                          <th key={m.key} className="text-right py-2 px-2 text-zinc-400 font-medium whitespace-nowrap cursor-pointer hover:text-white"
                            onClick={() => toggleSort(m.key)}>
                            <span className="flex items-center justify-end gap-1">{m.label} <ArrowUpDown size={9} /></span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPrincipal.map((r) => (
                        <tr key={r.player_id} className="border-t border-zinc-800/60 hover:bg-zinc-800/30">
                          <td className="py-2 px-3 whitespace-nowrap flex items-center gap-2">
                            {r._player?.photo_url ? (
                              <img src={r._player.photo_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                            ) : <div className="w-6 h-6 rounded-full bg-zinc-700" />}
                            <div>
                              <p className="text-white font-medium">{r.player_name}</p>
                              <p className="text-[9px] text-zinc-500">{r._player?.position || "—"}</p>
                            </div>
                          </td>
                          {REPORT_METRICS.map((m) => {
                            const isTop3 = rankByKey[m.key]?.includes(r.player_id);
                            return (
                              <td key={m.key} className={`text-right py-2 px-2 font-semibold whitespace-nowrap ${isTop3 ? "text-emerald-400" : "text-zinc-300"}`}>
                                {fmtMetricVal(m.key, r[m.key])}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {reportData.excluded.length > 0 && (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                    <p className="text-[10px] font-semibold text-amber-300 mb-1">Excluidos de los promedios ({reportData.excluded.length})</p>
                    <p className="text-[10px] text-zinc-400">{reportData.excluded.map((r) => r.player_name).join(", ")}</p>
                  </div>
                )}
              </section>

              {/* Comparación competitiva */}
              {reportData.comparison.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-bold text-white">4. Comparación vs. perfil competitivo</h3>
                  <div className="space-y-2">
                    {reportData.comparison.map((c) => (
                      <div key={c.player_id} className="bg-zinc-800/40 border border-zinc-800 rounded-lg p-2.5">
                        <p className="text-xs font-semibold text-white mb-1.5">{c.player_name}</p>
                        <div className="grid grid-cols-3 sm:grid-cols-7 gap-1.5">
                          {c.metrics.map((m) => (
                            <div key={m.key} className={`rounded px-1.5 py-1 text-center ${pctColorClass(m.pct)}`}>
                              <p className="text-[8px] opacity-80">{m.label}</p>
                              <p className="text-[10px] font-bold">{m.pct != null ? `${Math.round(m.pct)}%` : "—"}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Análisis automático */}
              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white">5. Análisis automático</h3>
                <div className="bg-zinc-800/40 border border-zinc-800 rounded-lg p-3 space-y-1">
                  {reportData.insights.map((line, i) => (
                    <p key={i} className="text-xs text-zinc-300">• {line}</p>
                  ))}
                </div>
              </section>

              {/* Alertas */}
              {reportData.alerts.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-bold text-white">6. Alertas</h3>
                  <div className="space-y-1.5">
                    {reportData.alerts.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-red-500/5 border border-red-500/20 rounded-lg">
                        <AlertCircle size={11} className="text-red-400 shrink-0" />
                        <span className="text-xs text-red-300">{a.text}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Observaciones */}
              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white">7. Observaciones</h3>
                <textarea rows={3} value={observations} onChange={(e) => setObservations(e.target.value)}
                  placeholder="Observaciones del cuerpo técnico sobre esta sesión..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white resize-none focus:outline-none focus:border-zinc-500" />
                <button onClick={saveObservations} disabled={saving}
                  className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 rounded-lg text-xs transition-colors disabled:opacity-50">
                  {saving ? "Guardando..." : "Guardar observaciones"}
                </button>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}