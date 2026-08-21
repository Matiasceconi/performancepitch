import React, { useState, useEffect, useCallback } from "react";
import { Download, Send, Eye, Loader2, Inbox, X, MoreVertical, Trash2, EyeOff, FileText } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { buildMatchReportData } from "@/lib/matchReportData";
import { exportMatchReportPdf } from "@/lib/reports/matchReportPdf";
import MatchReportPreview from "@/components/matchReports/MatchReportPreview";

const STATUS_CONFIG = {
  draft: ["bg-zinc-500/15 text-zinc-400 border-zinc-500/30", "Borrador"],
  published: ["bg-emerald-500/15 text-emerald-300 border-emerald-500/30", "Publicado"],
  archived: ["bg-zinc-700/15 text-zinc-500 border-zinc-700/30", "Archivado"],
};

export default function GpsPlayerMatchReports({ playerId, squadId, seasonId }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    if (!playerId) return;
    setLoading(true);
    try {
      const rows = await base44.entities.PlayerMatchReport.filter({ player_id: playerId }, "-created_at", 100);
      setReports(rows.filter((r) => !r.deleted_at));
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function handleClickOutside() { setMenuOpen(null); }
    if (menuOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [menuOpen]);

  async function handleView(report) {
    try {
      const data = await buildMatchReportData({ playerId: report.player_id, matchIds: report.match_ids || [] });
      setViewing({ report, data });
      setMenuOpen(null);
    } catch (e) { console.error(e); }
  }

  async function handleDownload(report) {
    setMenuOpen(null);
    try {
      const data = await buildMatchReportData({ playerId: report.player_id, matchIds: report.match_ids || [] });
      await exportMatchReportPdf({ reportData: data, reportMeta: { title: report.title }, staffComment: report.staff_comment });
    } catch (e) { console.error(e); }
  }

  async function handleTogglePublish(report) {
    setMenuOpen(null);
    setActionLoading(true);
    try {
      if (report.status === "published") {
        await base44.entities.PlayerMatchReport.update(report.id, { status: "draft", published_at: null });
      } else {
        await base44.entities.PlayerMatchReport.update(report.id, { status: "published", published_at: new Date().toISOString() });
      }
      load();
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  }

  async function handleDelete(report) {
    setActionLoading(true);
    try {
      await base44.entities.PlayerMatchReport.update(report.id, {
        deleted_at: new Date().toISOString(),
        status: "archived",
      });
      setConfirmDelete(null);
      load();
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  }

  if (loading) return <div className="py-12 flex justify-center"><Loader2 size={20} className="text-zinc-500 animate-spin" /></div>;

  if (reports.length === 0) {
    return (
      <div className="py-12 text-center">
        <Inbox size={28} className="text-zinc-600 mx-auto mb-2" />
        <p className="text-zinc-500 text-sm">Sin reportes guardados para este jugador.</p>
        <p className="text-zinc-600 text-xs mt-1">Generá uno desde la pestaña Análisis.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {reports.map((r) => {
          const [cls, label] = STATUS_CONFIG[r.status] || STATUS_CONFIG.draft;
          const isPublished = r.status === "published";
          return (
            <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 relative">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{r.title}</p>
                  <p className="text-xs text-zinc-500">{r.report_type === "multi_match" ? "Multi-partido" : "Un partido"}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${cls}`}>{label}</span>
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === r.id ? null : r.id); }}
                      className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {menuOpen === r.id && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-30 py-1">
                        <button onClick={() => handleView(r)} className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-700 flex items-center gap-2">
                          <Eye size={13} /> Ver
                        </button>
                        <button onClick={() => handleDownload(r)} className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-700 flex items-center gap-2">
                          <Download size={13} /> Descargar PDF
                        </button>
                        <button onClick={() => handleTogglePublish(r)} disabled={actionLoading} className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-700 flex items-center gap-2 disabled:opacity-50">
                          {isPublished ? <><EyeOff size={13} /> Despublicar</> : <><Send size={13} /> Publicar</>}
                        </button>
                        <div className="border-t border-zinc-700 my-1" />
                        <button onClick={() => { setMenuOpen(null); setConfirmDelete(r); }} className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-zinc-700 flex items-center gap-2">
                          <Trash2 size={13} /> Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {(r.match_labels || []).slice(0, 3).map((l, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]">{l}</span>
                ))}
                {(r.match_labels || []).length > 3 && <span className="px-1.5 py-0.5 text-zinc-500 text-[10px]">+{r.match_labels.length - 3}</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleView(r)} className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-zinc-700">
                  <Eye size={13} /> Ver
                </button>
                <button onClick={() => handleDownload(r)} className="px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-zinc-700">
                  <Download size={13} /> PDF
                </button>
                {r.status === "draft" && (
                  <button onClick={() => handleTogglePublish(r)} disabled={actionLoading} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                    <Send size={13} /> Publicar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {viewing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-20">
              <h2 className="text-lg font-bold text-white">{viewing.report.title}</h2>
              <button onClick={() => setViewing(null)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"><X size={20} /></button>
            </div>
            <div className="p-5">
              <MatchReportPreview
                reportData={viewing.data}
                staffComment={viewing.report.staff_comment || ""}
                onCommentChange={() => {}}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <h3 className="text-base font-bold text-white">Eliminar reporte</h3>
            </div>
            <p className="text-sm text-zinc-400 mb-4">
              {confirmDelete.status === "published"
                ? "Este reporte está disponible en el portal del jugador. Al eliminarlo dejará de estar visible para el futbolista."
                : "¿Eliminar este reporte?"}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 rounded-lg bg-zinc-800 text-zinc-200 text-sm font-semibold hover:bg-zinc-700">
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDelete)} disabled={actionLoading} className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-500 disabled:opacity-50 flex items-center justify-center gap-2">
                {actionLoading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Eliminar reporte
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}