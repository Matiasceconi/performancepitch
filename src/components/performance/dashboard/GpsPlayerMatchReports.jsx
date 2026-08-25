import React, { useCallback, useEffect, useState } from "react";
import { Download, Eye, EyeOff, FileText, Inbox, Loader2, Send, Trash2, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { buildMatchReportData, reportDataFromSnapshot } from "@/lib/matchReportData";
import { exportMatchReportPdf } from "@/lib/reports/matchReportPdf";
import MatchReportPreview from "@/components/matchReports/MatchReportPreview";

const STATUS = {
  draft: ["Borrador", "border-zinc-700 bg-zinc-800 text-zinc-300"],
  published: ["Publicado", "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"],
  archived: ["Archivado", "border-zinc-800 bg-zinc-900 text-zinc-500"],
};

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-AR");
}

export default function GpsPlayerMatchReports({ playerId, squadId }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!playerId || !squadId) return;
    setLoading(true);
    setError("");
    try {
      const response = await base44.functions.invoke("managePlayerMatchReport", {
        operation: "list",
        player_id: playerId,
        squad_id: squadId,
      });
      const result = response.data || response;
      if (result.error) throw new Error(result.error);
      setReports(result.reports || []);
    } catch (cause) {
      setReports([]);
      setError(cause?.response?.data?.error || cause.message || "No se pudieron cargar los informes.");
    } finally {
      setLoading(false);
    }
  }, [playerId, squadId]);

  useEffect(() => { load(); }, [load]);

  async function dataFor(report) {
    const frozen = reportDataFromSnapshot(report.report_snapshot);
    return frozen || buildMatchReportData({ playerId: report.player_id, matchIds: report.match_ids || [] });
  }

  async function view(report) {
    setBusy(`view-${report.id}`);
    try {
      setViewing({ report, data: await dataFor(report) });
    } catch (cause) {
      setError(cause.message || "No se pudo abrir el informe.");
    } finally {
      setBusy("");
    }
  }

  async function download(report) {
    setBusy(`pdf-${report.id}`);
    try {
      const data = await dataFor(report);
      await exportMatchReportPdf({ reportData: data, reportMeta: { title: report.title }, staffComment: report.staff_comment });
    } finally {
      setBusy("");
    }
  }

  async function action(operation, report) {
    setBusy(`${operation}-${report.id}`);
    setError("");
    try {
      const response = await base44.functions.invoke("managePlayerMatchReport", { operation, id: report.id });
      const result = response.data || response;
      if (result.error) throw new Error(result.error);
      if (viewing?.report?.id === report.id) setViewing(null);
      await load();
    } catch (cause) {
      setError(cause?.response?.data?.error || cause.message || "No se pudo completar la acción.");
    } finally {
      setBusy("");
    }
  }

  if (loading) return <div className="flex h-56 items-center justify-center"><Loader2 className="animate-spin text-emerald-400" /></div>;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-end justify-between"><div><h2 className="text-lg font-black text-white">Informes del jugador</h2><p className="text-xs text-zinc-500">Borradores, publicaciones y trazabilidad de cambios.</p></div><span className="text-xs text-zinc-500">{reports.length} informes</span></div>
        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}
        {!reports.length ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 py-16 text-center"><Inbox className="mx-auto mb-3 text-zinc-700" /><p className="text-sm font-semibold text-zinc-400">Todavía no hay informes</p><p className="mt-1 text-xs text-zinc-600">Generalo desde Resumen, Partidos, Evolución o Comparación.</p></div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {reports.map((report) => {
              const cfg = STATUS[report.status] || STATUS.draft;
              const isBusy = busy.endsWith(report.id);
              return <article key={report.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${cfg[1]}`}>{cfg[0]}</span>{report.report_version >= 2 && <span className="text-[10px] text-sky-400">Snapshot v{report.report_version}</span>}</div><h3 className="truncate text-sm font-bold text-white">{report.title}</h3><p className="mt-1 text-xs text-zinc-500">{report.match_ids?.length || 0} {report.match_ids?.length === 1 ? "partido" : "partidos"} · actualizado {formatDate(report.updated_at || report.created_at || report.updated_date)}</p></div><FileText className="shrink-0 text-emerald-400" size={18} /></div>
                <div className="mt-3 flex flex-wrap gap-1.5">{(report.match_labels || []).slice(0, 3).map((label) => <span key={label} className="rounded-md bg-zinc-800 px-2 py-1 text-[10px] text-zinc-400">{label}</span>)}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => view(report)} disabled={isBusy} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200">{busy === `view-${report.id}` ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Ver</button>
                  <button onClick={() => download(report)} disabled={isBusy} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200">{busy === `pdf-${report.id}` ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} PDF</button>
                  <button onClick={() => action(report.status === "published" ? "unpublish" : "publish", report)} disabled={isBusy} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${report.status === "published" ? "bg-amber-500/10 text-amber-300" : "bg-emerald-600 text-white"}`}>{report.status === "published" ? <EyeOff size={14} /> : <Send size={14} />}{report.status === "published" ? "Ocultar" : "Publicar"}</button>
                  <button onClick={() => window.confirm("¿Eliminar este informe?") && action("delete", report)} disabled={isBusy} className="rounded-lg bg-red-500/10 p-2 text-red-300"><Trash2 size={14} /></button>
                </div>
              </article>;
            })}
          </div>
        )}
      </div>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"><div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 p-4"><div><h2 className="font-bold text-white">{viewing.report.title}</h2><p className="text-xs text-zinc-500">Vista congelada del informe</p></div><button onClick={() => setViewing(null)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800"><X size={18} /></button></div><div className="p-4"><MatchReportPreview reportData={viewing.data} staffComment={viewing.report.staff_comment} readOnly /></div></div></div>
      )}
    </>
  );
}
