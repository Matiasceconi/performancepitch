import React, { useState, useEffect, useCallback } from "react";
import { FileText, Download, Eye, Loader2, ChevronLeft, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { adaptPublishedReport } from "@/lib/matchReportData";
import { exportMatchReportPdf } from "@/lib/reports/matchReportPdf";
import MatchReportPreview from "@/components/matchReports/MatchReportPreview";

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
  return adaptPublishedReport(report, player);
}

export default function PlayerMatchReports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [refreshNew, setRefreshNew] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("getPlayerMatchReports", {});
      setData(res.data || res);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "No se pudieron cargar tus informes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDownload(report) {
    setExporting(true);
    try {
      const reportData = adaptReportData(report, data?.player);
      await exportMatchReportPdf({ reportData, reportMeta: { title: report.title }, staffComment: report.staff_comment });
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  }

  function handleView(report) {
    markReportViewed(report.id);
    setRefreshNew((n) => n + 1);
    setViewing(report);
  }

  if (loading) return <div className="p-6 flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-4 border-zinc-700 border-t-emerald-400 rounded-full animate-spin" /></div>;
  if (error) return <div className="p-6 space-y-4"><div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">{error}</div><button onClick={load} className="w-full py-3 bg-zinc-800 rounded-xl text-sm font-semibold">Reintentar</button></div>;

  const reports = data?.reports || [];
  // refreshNew forces re-evaluation of isReportNew after marking viewed
  void refreshNew;

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center gap-2">
        <FileText size={20} className="text-emerald-400" />
        <h1 className="text-xl font-black text-white">Mis informes</h1>
      </div>

      {reports.length === 0 ? (
        <div className="py-16 text-center">
          <FileText size={32} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">Todavía no tenés informes publicados.</p>
          <p className="text-zinc-600 text-xs mt-1">Cuando el área de Rendimiento genere un informe para vos, lo verás acá.</p>
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
                  {isNew && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-zinc-950 text-[10px] font-black">Nuevo</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3 text-[11px] text-zinc-400">
                  {matchLabels.slice(0, 3).map((l, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-zinc-800">{l}</span>
                  ))}
                  {matchLabels.length > 3 && <span className="px-1.5 py-0.5 text-zinc-500">+{matchLabels.length - 3}</span>}
                </div>

                {lastDate && (
                  <p className="text-[10px] text-zinc-600 mb-3">
                    {report.report_type === "multi_match" ? "Último partido: " : "Fecha: "}
                    {new Date(lastDate + (lastDate.length === 10 ? "T00:00:00" : "")).toLocaleDateString("es-AR")}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <button onClick={() => handleView(report)} className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-zinc-700 transition-colors">
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

      {viewing && (
        <PlayerReportViewer report={viewing} player={data?.player} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

function PlayerReportViewer({ report, player, onClose }) {
  const reportData = adaptReportData(report, player);

  return (
    <div className="fixed inset-0 bg-zinc-950 z-50 overflow-y-auto">
      <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-4 flex items-center gap-3 z-10">
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"><ChevronLeft size={20} /></button>
        <h2 className="text-base font-bold text-white flex-1 truncate">{report.title}</h2>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"><X size={20} /></button>
      </div>
      <div className="p-4 max-w-5xl mx-auto">
        <MatchReportPreview reportData={reportData} staffComment={report.staff_comment} readOnly />
      </div>
    </div>
  );
}