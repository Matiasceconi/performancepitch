import React, { useState, useEffect, useCallback } from "react";
import { FileText, Download, Eye, Loader2, ChevronLeft, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { REPORT_METRICS, fmtMetric } from "@/lib/matchReportData";
import { exportMatchReportPdf } from "@/lib/reports/matchReportPdf";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function formatDate(d) {
  if (!d) return "—";
  const date = new Date(d + 'T12:00:00');
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]}`;
}

// Reconstruye reportData desde la respuesta del backend (formato simplificado)
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

export default function PlayerMatchReports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('getPlayerMatchReports', {});
      setData(res.data || res);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'No se pudieron cargar tus informes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDownload(report) {
    setExporting(true);
    try {
      const reportData = adaptReportData(report, data?.player);
      await exportMatchReportPdf({ reportData, reportMeta: { title: report.title }, staffComment: report.staff_comment, evolutionMetricKey: "total_distance" });
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <div className="p-6 flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-4 border-zinc-700 border-t-emerald-400 rounded-full animate-spin" /></div>;
  if (error) return <div className="p-6 space-y-4"><div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">{error}</div><button onClick={load} className="w-full py-3 bg-zinc-800 rounded-xl text-sm font-semibold">Reintentar</button></div>;

  const reports = data?.reports || [];

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
          {reports.map((report) => (
            <div key={report.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">{report.title}</p>
                  <p className="text-xs text-zinc-500">{report.report_type === "multi_match" ? "Multi-partido" : "Un partido"}</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Publicado</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {(report.match_labels || []).slice(0, 3).map((l, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]">{l}</span>
                ))}
              </div>
              {report.published_at && <p className="text-[10px] text-zinc-600 mb-3">Publicado: {new Date(report.published_at).toLocaleDateString("es-AR")}</p>}
              <div className="flex items-center gap-2">
                <button onClick={() => setViewing(report)} className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5">
                  <Eye size={14} /> Ver informe
                </button>
                <button onClick={() => handleDownload(report)} disabled={exporting} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                  {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} PDF
                </button>
              </div>
            </div>
          ))}
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
  const [evolutionMetricKey] = useState("total_distance");
  const { selected, isMulti } = reportData;

  const kpis = REPORT_METRICS.slice(0, 6).map((m) => ({ ...m, value: isMulti ? selected.reduce((s, s2) => s + Number(s2.gpsRow[m.key] || 0), 0) / selected.length : selected[selected.length - 1]?.gpsRow[m.key] }));
  const compData = ["total_distance", "m_min", "distance_19_8", "distance_25", "sprints", "player_load", "smax"].map((k) => {
    const metric = REPORT_METRICS.find((m) => m.key === k);
    const last = selected[selected.length - 1];
    return { metric: metric.label, "Partido": Number(last?.gpsRow[k] || 0), "Promedio personal": Number(reportData.personalAvg[k] || 0) };
  });

  return (
    <div className="fixed inset-0 bg-zinc-950 z-50 overflow-y-auto">
      <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-4 flex items-center gap-3 z-10">
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"><ChevronLeft size={20} /></button>
        <h2 className="text-base font-bold text-white flex-1">{report.title}</h2>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"><X size={20} /></button>
      </div>
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 rounded-2xl p-4 text-white">
          <p className="text-emerald-100 text-xs font-semibold uppercase">Informe individual de rendimiento</p>
          <h2 className="text-xl font-black mt-0.5">{player?.full_name}</h2>
          <p className="text-emerald-100 text-sm">{[player?.position, player?.squad_name, player?.division].filter(Boolean).join(" · ")}</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2">
          {kpis.map((kpi) => (
            <div key={kpi.key} className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5">
              <p className="text-[9px] text-zinc-500 uppercase font-semibold truncate">{kpi.label}</p>
              <p className="text-lg font-black text-white">{fmtMetric(kpi.value, kpi.decimals)}</p>
              <p className="text-[9px] text-zinc-500">{kpi.unit}</p>
            </div>
          ))}
        </div>

        {/* Gráfico */}
        {!isMulti ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3">
            <h3 className="text-xs font-bold text-white mb-2">Comparación vs promedio personal</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={compData} layout="vertical" margin={{ left: 0, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#71717a", fontSize: 9 }} />
                <YAxis type="category" dataKey="metric" tick={{ fill: "#d4d4d8", fontSize: 9 }} width={90} />
                <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 8, color: "#fff" }} />
                <Bar dataKey="Partido" fill="#00843D" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Promedio personal" fill="#52525b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3">
            <h3 className="text-xs font-bold text-white mb-2">Evolución en partidos</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={selected.map((s) => ({ shortDate: s.match.date ? new Date(s.match.date + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "—", [evolutionMetricKey]: Number(s.gpsRow[evolutionMetricKey] || 0), average: reportData.personalAvg[evolutionMetricKey] }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="shortDate" tick={{ fill: "#71717a", fontSize: 9 }} />
                <YAxis tick={{ fill: "#71717a", fontSize: 9 }} width={36} />
                <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 8, color: "#fff" }} />
                <ReferenceLine y={reportData.personalAvg[evolutionMetricKey]} stroke="#71717a" strokeDasharray="5 5" />
                <Line type="monotone" dataKey={evolutionMetricKey} stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4, fill: "#22c55e", strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Comentario del staff */}
        {report.staff_comment && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3">
            <h3 className="text-xs font-bold text-white mb-1.5">Comentario del área de Rendimiento</h3>
            <p className="text-sm text-zinc-300 leading-relaxed">{report.staff_comment}</p>
          </div>
        )}
      </div>
    </div>
  );
}