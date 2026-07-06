import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import moment from "moment";
import { Archive, CheckCircle2, Save } from "lucide-react";
import { BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import GpsMicrocycleDailyTable from "./GpsMicrocycleDailyTable";
import GpsMicrocycleHighlights from "./GpsMicrocycleHighlights";
import GpsMicrocycleComparison from "./GpsMicrocycleComparison";
import GpsMicrocycleAiAnalysis from "./GpsMicrocycleAiAnalysis";
import GpsMicrocyclePdfButton from "./GpsMicrocyclePdfButton";
import GpsMicrocycleFiltersPanel, { getMicrocycleFilterLabels } from "./GpsMicrocycleFiltersPanel";
import {
  MICRO_METRICS,
  HIGHLIGHT_METRICS,
  buildDailySummaries,
  rowsForCycle,
  buildHighlights,
  buildComparison,
  getCycleDays,
} from "./gpsMicrocycleReportUtils";

function MetricChart({ metric, data }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <div className="mb-3">
        <h3 className="text-white font-bold text-sm">{metric.label}</h3>
        <p className="text-zinc-500 text-xs">Datos filtrados por día</p>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ReBarChart data={data} margin={{ top: 18, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="label" stroke="#71717a" fontSize={10} />
            <YAxis stroke="#71717a" fontSize={10} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12, color: "#fff" }} />
            <Bar dataKey={metric.key} name={metric.label} fill={metric.color} radius={[6, 6, 0, 0]}>
              <LabelList dataKey={metric.key} position="top" fill="#e4e4e7" fontSize={10} fontWeight={700} formatter={(v) => v == null ? "—" : Math.round(v)} />
            </Bar>
          </ReBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function addDays(date, days) { return moment(date).add(days, "days").format("YYYY-MM-DD"); }
function rangeDays(start, end) {
  if (!start || !end || start > end) return [];
  const days = [];
  let current = moment(start);
  const limit = moment(end);
  while (current.isSameOrBefore(limit, "day")) { days.push({ date: current.format("YYYY-MM-DD"), md: "—" }); current.add(1, "day"); }
  return days;
}
function daysFromSummary(summary) {
  const daily = summary?.summary_snapshot?.daily;
  if (Array.isArray(daily) && daily.length) return daily.map((d) => ({ date: d.date, md: d.md || "—", objetivo: d.objetivo || "—" }));
  return rangeDays(summary?.fecha_inicio, summary?.fecha_fin);
}
function aggregateRows(rows, metric) {
  const values = rows.map((r) => Number(r[metric.key])).filter((v) => Number.isFinite(v));
  if (!values.length) return null;
  if (metric.mode === "max") return Math.max(...values);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export default function GpsWeeklyEvolutionPanel({ sessions, gpsBySession, cycleDays, playerMap, squadName, season, squadId }) {
  const reportCaptureRef = useRef(null);
  const [filters, setFilters] = useState({});
  const [summaries, setSummaries] = useState([]);
  const [cycleMode, setCycleMode] = useState("current");
  const [selectedSummaryId, setSelectedSummaryId] = useState("");
  const [savingState, setSavingState] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const players = useMemo(() => Object.values(playerMap || {}).filter(Boolean), [playerMap]);

  async function loadSummaries() {
    if (!squadId) { setSummaries([]); return; }
    const rows = await base44.entities.MicrocycleSummary.filter({ squad_id: squadId }, "-fecha_inicio", 300);
    setSummaries(rows.filter((row) => !season || !row.season_id || row.season_id === season));
  }

  useEffect(() => { loadSummaries(); }, [squadId, season]);

  const selectedSummary = useMemo(() => summaries.find((s) => s.id === selectedSummaryId), [summaries, selectedSummaryId]);
  const normalizedCurrentDays = useMemo(() => getCycleDays(cycleDays), [cycleDays]);
  const baseCycleDays = useMemo(() => {
    if (cycleMode === "historical" && selectedSummary) return daysFromSummary(selectedSummary);
    if (cycleMode === "previous") return normalizedCurrentDays.map((d) => ({ ...d, date: addDays(d.date, -7) }));
    return normalizedCurrentDays;
  }, [cycleMode, selectedSummary, normalizedCurrentDays]);

  const effectiveCycleDays = useMemo(() => {
    let days = baseCycleDays;
    if (filters.dateFrom || filters.dateTo) {
      const start = filters.dateFrom || days[0]?.date;
      const end = filters.dateTo || days[days.length - 1]?.date;
      const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
      days = rangeDays(start, end).map((d) => byDate[d.date] || d);
    }
    if (filters.selectedDates?.length) {
      const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
      filters.selectedDates.forEach((date) => { if (!byDate[date]) byDate[date] = { date, md: "—" }; });
      days = Object.values(byDate).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    }
    return days;
  }, [baseCycleDays, filters.dateFrom, filters.dateTo, filters.selectedDates]);

  const visibleMetrics = useMemo(() => filters.metricKey ? MICRO_METRICS.filter((m) => m.key === filters.metricKey) : MICRO_METRICS, [filters.metricKey]);
  const visibleHighlightMetrics = useMemo(() => filters.metricKey ? HIGHLIGHT_METRICS.filter((m) => m.key === filters.metricKey) : HIGHLIGHT_METRICS, [filters.metricKey]);
  const dailySummaries = useMemo(() => buildDailySummaries({ sessions, gpsBySession, cycleDays: effectiveCycleDays, playerMap, filters, metrics: visibleMetrics }), [sessions, gpsBySession, effectiveCycleDays, playerMap, filters, visibleMetrics]);
  const cycleRows = useMemo(() => rowsForCycle({ sessions, gpsBySession, cycleDays: effectiveCycleDays, playerMap, filters }), [sessions, gpsBySession, effectiveCycleDays, playerMap, filters]);
  const allCycleRows = useMemo(() => rowsForCycle({ sessions, gpsBySession, cycleDays: effectiveCycleDays, playerMap, filters, includeExcluded: true }), [sessions, gpsBySession, effectiveCycleDays, playerMap, filters]);
  const highlights = useMemo(() => buildHighlights(cycleRows, playerMap, visibleHighlightMetrics), [cycleRows, playerMap, visibleHighlightMetrics]);
  const comparison = useMemo(() => buildComparison({ sessions, gpsBySession, cycleDays: effectiveCycleDays, playerMap, filters, metrics: visibleMetrics }), [sessions, gpsBySession, effectiveCycleDays, playerMap, filters, visibleMetrics]);
  const filterLabels = useMemo(() => getMicrocycleFilterLabels(filters, { players, sessions, metrics: MICRO_METRICS }), [filters, players, sessions]);
  const weekStart = dailySummaries[0]?.date || effectiveCycleDays[0]?.date;
  const weekEnd = dailySummaries[dailySummaries.length - 1]?.date || effectiveCycleDays[effectiveCycleDays.length - 1]?.date;

  const cycleTitle = selectedSummary?.nombre_microciclo || selectedSummary?.microcycle_name || (cycleMode === "previous" ? "Microciclo anterior" : `Microciclo ${weekStart || "actual"}`);

  async function saveMicrocycle(nextState) {
    if (!squadId || !weekStart || !weekEnd) return;
    setSavingState(nextState);
    setSaveMessage("");
    const now = new Date().toISOString();
    const gpsVariables = Object.fromEntries(MICRO_METRICS.map((metric) => [metric.key, { label: metric.label, value: aggregateRows(cycleRows, metric), mode: metric.mode }]));
    const rankings = Object.fromEntries(highlights.map((item) => [item.metric.key, { label: item.metric.label, top3: item.top.map((p) => ({ player_id: p.player?.id || p.player_id || "", name: p.name, value: p.value })) }]));
    const sessionsWithGps = new Set(cycleRows.map((row) => row.session_id).filter(Boolean));
    const payload = {
      squad_id: squadId,
      squad_name: squadName || "",
      season_id: season || "",
      microcycle_name: cycleTitle,
      nombre_microciclo: cycleTitle,
      fecha_inicio: weekStart,
      fecha_fin: weekEnd,
      rival: selectedSummary?.rival || "",
      partido_asociado: selectedSummary?.partido_asociado || selectedSummary?.rival || "",
      cantidad_sesiones: sessionsWithGps.size,
      cantidad_partidos: selectedSummary?.cantidad_partidos || 0,
      estado: nextState,
      created_at: selectedSummary?.created_at || now,
      updated_at: now,
      snapshot_locked: nextState === "cerrado",
      pdf_url: selectedSummary?.pdf_url || "",
      pdf_generated_at: selectedSummary?.pdf_generated_at || "",
      summary_snapshot: { daily: dailySummaries, gps_rows_included: cycleRows.length, gps_rows_excluded: Math.max(0, allCycleRows.length - cycleRows.length) },
      charts_snapshot: { daily: dailySummaries, metrics: visibleMetrics },
      rankings_snapshot: rankings,
      gps_variables_snapshot: gpsVariables,
      promedios_snapshot: gpsVariables,
      highlighted_players_snapshot: highlights,
      weekly_comparison_snapshot: comparison,
      filters_snapshot: filters,
      snapshot: { dailySummaries, highlights, comparison, filters, metrics: visibleMetrics },
    };
    const existing = selectedSummary || summaries.find((s) => s.squad_id === squadId && s.fecha_inicio === weekStart && (!season || !s.season_id || s.season_id === season));
    if (existing) await base44.entities.MicrocycleSummary.update(existing.id, payload);
    else await base44.entities.MicrocycleSummary.create(payload);
    await loadSummaries();
    setSavingState("");
    setSaveMessage(nextState === "cerrado" ? "Microciclo cerrado y congelado en historial." : "Microciclo guardado en historial.");
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Informe semanal de carga</p>
            <h2 className="text-2xl font-bold text-white mt-1">Resumen del microciclo</h2>
            <p className="text-zinc-400 text-sm mt-1">{squadName || "Plantel activo"} · {weekStart ? moment(weekStart).format("DD/MM") : ""} - {weekEnd ? moment(weekEnd).format("DD/MM/YYYY") : ""}</p>
            {saveMessage && <p className="text-emerald-300 text-xs font-semibold mt-2 flex items-center gap-1"><CheckCircle2 size={13} />{saveMessage}</p>}
          </div>
          <div className="flex gap-2 flex-wrap"><GpsMicrocycleFiltersPanel filters={filters} onApply={setFilters} players={players} sessions={sessions} cycleDays={effectiveCycleDays} metrics={MICRO_METRICS} /><GpsMicrocycleAiAnalysis dailySummaries={dailySummaries} highlights={highlights} comparison={comparison} /><GpsMicrocyclePdfButton squadName={squadName} season={season} dailySummaries={dailySummaries} highlights={highlights} comparison={comparison} cycleDays={effectiveCycleDays} /><button onClick={() => saveMicrocycle("abierto")} disabled={!!savingState} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-white rounded-xl text-sm font-bold"><Save size={16} />{savingState === "abierto" ? "Guardando..." : "Guardar microciclo"}</button><button onClick={() => saveMicrocycle("cerrado")} disabled={!!savingState} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700 text-white rounded-xl text-sm font-bold"><Archive size={16} />{savingState === "cerrado" ? "Cerrando..." : "Cerrar microciclo"}</button></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <label className="space-y-1"><span className="text-xs font-semibold text-zinc-400">Selector de microciclo</span><select value={cycleMode} onChange={(e) => { setCycleMode(e.target.value); if (e.target.value !== "historical") setSelectedSummaryId(""); }} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"><option value="current">Microciclo actual</option><option value="previous">Microciclo anterior / semana anterior</option><option value="historical">Histórico de microciclos</option></select></label>
          <label className="space-y-1 lg:col-span-2"><span className="text-xs font-semibold text-zinc-400">Microciclo guardado</span><select value={selectedSummaryId} onChange={(e) => { setSelectedSummaryId(e.target.value); setCycleMode(e.target.value ? "historical" : "current"); }} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"><option value="">Seleccionar histórico...</option>{summaries.map((s) => <option key={s.id} value={s.id}>{s.nombre_microciclo || s.microcycle_name || s.fecha_inicio} · {s.fecha_inicio} - {s.fecha_fin} · {s.estado || "abierto"}</option>)}</select></label>
        </div>
      </div>

      <div ref={reportCaptureRef} className="space-y-5">
        {filterLabels.length > 0 && <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl p-4"><p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Filtros aplicados</p><div className="flex flex-wrap gap-2">{filterLabels.map((label) => <span key={label} className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs font-semibold">{label}</span>)}</div></div>}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {visibleMetrics.map((metric) => <MetricChart key={metric.key} metric={metric} data={dailySummaries} />)}
        </div>

        <GpsMicrocycleDailyTable dailySummaries={dailySummaries} metrics={visibleMetrics} />
        <GpsMicrocycleHighlights highlights={highlights} />
        <GpsMicrocycleComparison comparison={comparison} />
      </div>
    </div>
  );
}