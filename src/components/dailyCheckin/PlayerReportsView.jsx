import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, FileText, Download, Eye, Loader2, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { REPORT_METRICS, fmtMetric } from "@/lib/matchReportData";
import { exportMatchReportPdf } from "@/lib/reports/matchReportPdf";
import MatchBlockCard from "@/components/matchReports/MatchBlockCard";

const VIEWED_KEY = "pp_viewed_reports";

function getViewedReportIds() {
  try { return JSON.parse(localStorage.getItem(VIEWED_KEY) || "[]"); } catch { return []; }
}

function isReportNew(reportId) {
  return !getViewedReportIds().includes(reportId);
}

function markReportViewed(reportId) {
  const viewed = getViewedReportIds();
  if (!viewed.includes(reportId)) {
    viewed.push(reportId);
    localStorage.setItem(VIEWED_KEY, JSON.stringify(viewed));
  }
}

function adaptReportData(report, player) {
  const selected = report.matches
    .filter((m) => m.hasGps)
    .map((m) => ({
      match: m.match,
      gpsRow: { ...m.gpsRow, pl_min: m.gpsRow?.player_load && m.gpsRow?.duration_minutes ? m.gpsRow.player_load / m.gpsRow.duration_minutes : null },
      minutesPlayed: m.minutesPlayed,
      hasGps: true,
    }))
    .sort((a, b) => (a.match.date || "").localeCompare(b.match.date || ""));

  const personalAvg = {};
  REPORT_METRICS.forEach((m) => {
    personalAvg[m.key] = selected.length ? selected.reduce((s, s2) => s + Number(s2.gpsRow[m.key] || 0), 0) / selected.length : 0;
  });

  return {
    player,
    competitionProfile: null,
    selected,
    personalAvg,
    historicalRows: selected.map((s) => s.gpsRow),
    seasonBests: {},
    smaxSorted: [...selected].sort((a, b) => Number(b.gpsRow.smax || 0) - Number(a.gpsRow.smax || 0)),
    isMulti: selected.length > 1,
  };
}

export default function PlayerReportsView({ token, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("getPlayerMatchReportsByToken", { token });
      const result = res.data || res;
      if (result.error) throw new Error(result.error);
      setData(result);
    } catch (e) {
      setError(e?.message || "No se pudieron cargar tus informes");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleDownload(report) {
    setExporting(true);
    try {
      const reportData = adaptReportData(report, data?.player);
      await exportMatchReportPdf({ reportData, reportMeta: { title: report.title }, staffComment: report.staff_comment });
    } catch (e) { console.error(e); }
    finally { setExporting(false); }
  }

  function handleView(report) {
    markReportViewed(report.id);
    setViewing(report);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-zinc-950"><div className="w-8 h-8 border-4 border-zinc-700 border-t-emerald-400 rounded-full animate-spin" /></div>;
  if (error) return (
    <div className="min-h-screen bg-zinc-950 max-w-md mx-auto p-5 space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-zinc-400 text-sm"><ChevronLeft size={18} /> Volver</button>
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">{error}</div>
      <button onClick={load} className="w-full py-3 bg-zinc-800 rounded-xl text-sm font-semibold">Reintentar</button>
    </div>
  );

  const reports = data?.reports || [];

  if (viewing) {
    const reportData = adaptReportData(viewing, data?.player);
    return (
      <div className="min-h-screen bg-zinc-950 max-w-md mx-auto">
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-4 flex items-center gap-3 z-10">
          <button onClick={() => setViewing(null)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"><ChevronLeft size={20} /></button>
          <h2 className="text-base font-bold text-white flex-1 truncate">{viewing.title}</h2>
          <button onClick={() => handleDownload(viewing)} disabled={exporting} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} PDF
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 rounded-2xl p-4 text-white">
            <p className="text-emerald-100 text-xs font-semibold uppercase">Informe individual de rendimiento</p>
            <h2 className="text-xl font-black mt-0.5">{data?.player?.full_name}</h2>
            <p className="text-emerald-100 text-sm">{[data?.player?.position, data?.player?.squad_name, data?.player?.division].filter(Boolean).join(" · ")}</p>
            <p className="text-emerald-50 text-xs mt-1">{reportData.selected.length} {reportData.selected.length === 1 ? "partido" : "partidos"} analizado{reportData.selected.length === 1 ? "" : "s"}</p>
          </div>

          {reportData.selected.map((matchData) => (
            <MatchBlockCard key={matchData.match.id} matchData={matchData} />
          ))}

          {viewing.staff_comment && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <h3 className="text-xs font-bold text-white mb-1.5">Comentario del área de Rendimiento</h3>
              <p className="text-sm text-zinc-300 leading-relaxed">{viewing.staff_comment}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 max-w-md mx-auto p-5 space-y-5">
      <div className="flex items-center gap-2 pt-4">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"><ChevronLeft size={20} /></button>
        <h1 className="text-xl font-black text-white">Mis informes</h1>
      </div>

      {reports.length === 0 ? (
        <div className="py-16 text-center">
          <FileText size={32} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">Todavía no tenés informes publicados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const isNew = isReportNew(report.id);
            const matchLabels = report.match_labels || [];
            const matchDates = report.match_dates || [];
            const lastDate = matchDates[matchDates.length - 1] || report.published_at;

            return (
              <div key={report.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">Informe individual de rendimiento</p>
                    <p className="text-xs text-zinc-500">
                      {report.report_type === "multi_match"
                        ? `${report.match_ids?.length || 0} partidos analizados`
                        : matchLabels[0] || "Partido"}
                    </p>
                  </div>
                  {isNew && <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-zinc-950 text-[10px] font-black">Nuevo</span>}
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3 text-[11px] text-zinc-400">
                  {matchLabels.slice(0, 3).map((l, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-zinc-800">{l}</span>
                  ))}
                </div>

                {lastDate && (
                  <p className="text-[10px] text-zinc-600 mb-3">
                    {new Date(lastDate + (lastDate.length === 10 ? "T00:00:00" : "")).toLocaleDateString("es-AR")}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <button onClick={() => handleView(report)} className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-zinc-700">
                    <Eye size={14} /> Ver informe
                  </button>
                  <button onClick={() => handleDownload(report)} disabled={exporting} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                    {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} PDF
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}