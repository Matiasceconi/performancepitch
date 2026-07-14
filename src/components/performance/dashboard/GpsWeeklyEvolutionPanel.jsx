import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import moment from "moment";
import { Link } from "react-router-dom";
import { Archive, CheckCircle2, History } from "lucide-react";
import { BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import GpsMicrocycleHighlights from "./GpsMicrocycleHighlights";
import GpsMicrocyclePdfButton from "./GpsMicrocyclePdfButton";
import GpsMicrocycleFiltersPanel, { getMicrocycleFilterLabels } from "./GpsMicrocycleFiltersPanel";
import GpsMicrocycleHistoryPanel from "./GpsMicrocycleHistoryPanel";
import GpsMicrocycleWeekNavigator from "./GpsMicrocycleWeekNavigator";
import GpsMicrocycleDayHeader from "./GpsMicrocycleDayHeader";
import GpsDailyPlayerTable from "./GpsDailyPlayerTable";
import {
  MICRO_METRICS,
  buildDailySummaries,
  rowsForCycle,
  buildHighlights,
  buildComparison,
  getCycleDays,
  buildSessionAverages,
} from "./gpsMicrocycleReportUtils";

const RANKING_KEYS = new Set(["total_distance", "sprints", "player_load"]);
const OBJECTIVES = ["Fuerza", "Velocidad", "Resistencia", "Prevención"];
const LOAD_METRIC_KEYS = ["total_distance", "player_load", "sprints", "m_min"];

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

function normalizeText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function avg(values) {
  const numbers = values.map((v) => Number(v)).filter(Number.isFinite);
  if (!numbers.length) return null;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

function getStatus(diff) {
  if (diff == null) return "NORMAL";
  if (diff <= -8) return "BAJO";
  if (diff >= 8) return "ALTO";
  return "NORMAL";
}

function statusClass(status) {
  if (status === "ALTO") return "bg-red-500/15 text-red-300 border-red-500/30";
  if (status === "BAJO") return "bg-blue-500/15 text-blue-300 border-blue-500/30";
  return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
}

function ObjectiveComparisonTable({ rows }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 overflow-x-auto">
      <div className="mb-4">
        <h3 className="text-white font-bold text-lg">Comparativa por objetivo físico</h3>
        <p className="text-zinc-500 text-sm">Promedio actual vs histórico (últimas 2 semanas) para días equivalentes y mismo objetivo.</p>
      </div>
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="text-left text-zinc-500 border-b border-zinc-800">
            <th className="py-2 pr-3">Objetivo</th>
            <th className="py-2 pr-3">Promedio actual</th>
            <th className="py-2 pr-3">Histórico 2 semanas</th>
            <th className="py-2 pr-3">Dif. %</th>
            <th className="py-2 pr-3">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.objective} className="border-b border-zinc-800/60">
              <td className="py-2 pr-3 text-white font-semibold">{row.objective}</td>
              <td className="py-2 pr-3 text-zinc-300">{row.current == null ? "—" : row.current.toFixed(1)}</td>
              <td className="py-2 pr-3 text-zinc-300">{row.historical == null ? "—" : row.historical.toFixed(1)}</td>
              <td className="py-2 pr-3 text-zinc-300">{row.diff == null ? "—" : `${row.diff > 0 ? "+" : ""}${row.diff.toFixed(1)}%`}</td>
              <td className="py-2 pr-3">
                <span className={`inline-flex px-2 py-1 rounded-lg border text-xs font-bold ${statusClass(row.status)}`}>{row.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GpsWeeklyEvolutionPanel({ sessions, gpsBySession, cycleDays, playerMap, squadName, season, squadId, weeklyPlans = [], competitionProfiles = [], microcycleProfiles = [] }) {
  const reportCaptureRef = useRef(null);
  const [filters, setFilters] = useState({});
  const [summaries, setSummaries] = useState([]);
  const [cycleMode, setCycleMode] = useState("current");
  const [selectedSummaryId, setSelectedSummaryId] = useState("");
  const [selectedWeekStart, setSelectedWeekStart] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [savingState, setSavingState] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const players = useMemo(() => Object.values(playerMap || {}).filter(Boolean), [playerMap]);

  async function loadSummaries() {
    if (!squadId) { setSummaries([]); return; }
    const rows = await base44.entities.MicrocycleSummary.filter({ squad_id: squadId }, "-fecha_inicio", 300);
    setSummaries(rows);
  }

  useEffect(() => { loadSummaries(); }, [squadId]);

  const latestSummary = useMemo(() => [...summaries].sort((a, b) => String(b.updated_at || b.created_at || b.fecha_inicio || "").localeCompare(String(a.updated_at || a.created_at || a.fecha_inicio || "")))[0] || null, [summaries]);
  const selectedSummary = useMemo(() => summaries.find((s) => s.id === selectedSummaryId), [summaries, selectedSummaryId]);
  const nextMicrocycleNumber = useMemo(() => {
    const numbers = summaries.map((s) => Number(s.microcycle_number)).filter(Number.isFinite);
    return numbers.length ? Math.max(...numbers) + 1 : summaries.length + 1;
  }, [summaries]);

  useEffect(() => {
    if (cycleMode === "lastSaved" && latestSummary && selectedSummaryId !== latestSummary.id) setSelectedSummaryId(latestSummary.id);
  }, [cycleMode, latestSummary, selectedSummaryId]);

  const selectedPlan = useMemo(() => {
    if (!weeklyPlans.length) return null;
    return weeklyPlans.find((plan) => plan.week_start === selectedWeekStart) || weeklyPlans.find((plan) => (plan.days_data || []).some((day) => day.date === moment().format("YYYY-MM-DD"))) || weeklyPlans[0];
  }, [weeklyPlans, selectedWeekStart]);

  useEffect(() => {
    if (!selectedWeekStart && selectedPlan?.week_start) setSelectedWeekStart(selectedPlan.week_start);
  }, [selectedWeekStart, selectedPlan]);

  const normalizedCurrentDays = useMemo(() => getCycleDays(selectedPlan?.days_data?.length ? selectedPlan.days_data : cycleDays), [selectedPlan, cycleDays]);
  const baseCycleDays = useMemo(() => {
    if ((cycleMode === "historical" || cycleMode === "lastSaved") && selectedSummary) return daysFromSummary(selectedSummary);
    if (cycleMode === "previous") return normalizedCurrentDays.map((d) => ({ ...d, date: addDays(d.date, -7) }));
    return normalizedCurrentDays;
  }, [cycleMode, selectedSummary, normalizedCurrentDays]);

  const effectiveCycleDays = useMemo(() => {
    let days = baseCycleDays;
    const today = moment().format("YYYY-MM-DD");
    if (filters.rangePreset === "current") days = normalizedCurrentDays;
    if (filters.rangePreset === "previous") days = normalizedCurrentDays.map((d) => ({ ...d, date: addDays(d.date, -7) }));
    if (filters.rangePreset === "last7") days = rangeDays(addDays(today, -6), today);
    if (filters.rangePreset === "last14") days = rangeDays(addDays(today, -13), today);
    if (filters.rangePreset === "last4weeks") days = rangeDays(addDays(today, -27), today);
    if (filters.dateFrom || filters.dateTo || filters.rangePreset === "custom") {
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
  }, [baseCycleDays, normalizedCurrentDays, filters.rangePreset, filters.dateFrom, filters.dateTo, filters.selectedDates]);

  const visibleMetrics = useMemo(() => filters.metricKey ? MICRO_METRICS.filter((m) => m.key === filters.metricKey) : MICRO_METRICS, [filters.metricKey]);
  const rankingMetrics = useMemo(() => MICRO_METRICS.filter((metric) => RANKING_KEYS.has(metric.key)).map((metric) => ({ ...metric, mode: "sum" })), []);
  const dailySummaries = useMemo(() => buildDailySummaries({ sessions, gpsBySession, cycleDays: effectiveCycleDays, playerMap, filters, metrics: visibleMetrics }), [sessions, gpsBySession, effectiveCycleDays, playerMap, filters, visibleMetrics]);
  const cycleRows = useMemo(() => rowsForCycle({ sessions, gpsBySession, cycleDays: effectiveCycleDays, playerMap, filters }), [sessions, gpsBySession, effectiveCycleDays, playerMap, filters]);
  const allCycleRows = useMemo(() => rowsForCycle({ sessions, gpsBySession, cycleDays: effectiveCycleDays, playerMap, filters, includeExcluded: true }), [sessions, gpsBySession, effectiveCycleDays, playerMap, filters]);
  const highlights = useMemo(() => buildHighlights(cycleRows, playerMap, rankingMetrics), [cycleRows, playerMap, rankingMetrics]);
  const comparison = useMemo(() => buildComparison({ sessions, gpsBySession, cycleDays: effectiveCycleDays, playerMap, filters, metrics: visibleMetrics }), [sessions, gpsBySession, effectiveCycleDays, playerMap, filters, visibleMetrics]);
  const sessionAverages = useMemo(() => buildSessionAverages({ sessions, gpsBySession, playerMap, weeklyPlans, filters: { ...filters, dateFrom: "", dateTo: "", date: "", selectedDates: [] }, metrics: MICRO_METRICS }), [sessions, gpsBySession, playerMap, weeklyPlans, filters]);
  const isSavedMicrocycleView = (cycleMode === "historical" || cycleMode === "lastSaved") && selectedSummary;
  const shownDailySummaries = (isSavedMicrocycleView && selectedSummary?.snapshot?.dailySummaries) || (isSavedMicrocycleView && selectedSummary?.summary_snapshot?.daily) || dailySummaries;
  const shownHighlights = highlights;
  const shownComparison = (isSavedMicrocycleView && selectedSummary?.snapshot?.comparison) || comparison;
  const filterLabels = useMemo(() => getMicrocycleFilterLabels(filters, { players, sessions, metrics: MICRO_METRICS }), [filters, players, sessions]);
  const weekStart = shownDailySummaries[0]?.date || effectiveCycleDays[0]?.date;
  const weekEnd = shownDailySummaries[shownDailySummaries.length - 1]?.date || effectiveCycleDays[effectiveCycleDays.length - 1]?.date;
  const objectiveTableRows = useMemo(() => {
    if (!effectiveCycleDays.length || !sessionAverages.length) {
      return OBJECTIVES.map((objective) => ({ objective, current: null, historical: null, diff: null, status: "NORMAL" }));
    }
    const cycleStart = effectiveCycleDays[0]?.date;
    const cycleEnd = effectiveCycleDays[effectiveCycleDays.length - 1]?.date;
    const historyStart = cycleStart ? moment(cycleStart).subtract(14, "days").format("YYYY-MM-DD") : "";
    const baselineByMetric = Object.fromEntries(LOAD_METRIC_KEYS.map((key) => [key, avg(sessionAverages.map((session) => session[key])) || 0]));
    const indexedSessions = sessionAverages.map((session) => {
      const normalized = LOAD_METRIC_KEYS.map((key) => baselineByMetric[key] > 0 ? Number(session[key] || 0) / baselineByMetric[key] : null).filter(Number.isFinite);
      return { ...session, load_index: normalized.length ? (normalized.reduce((a, b) => a + b, 0) / normalized.length) * 100 : null };
    });
    return OBJECTIVES.map((objective) => {
      const objectiveDays = effectiveCycleDays.filter((day) => normalizeText(day.objetivo || day.physical_objective || day.objetivo_fisico) === normalizeText(objective));
      const weekdaySet = new Set(objectiveDays.map((day) => String(moment(day.date).isoWeekday())));
      const currentRows = indexedSessions.filter((session) => session.date >= cycleStart && session.date <= cycleEnd && weekdaySet.has(String(moment(session.date).isoWeekday())) && normalizeText(session.objective) === normalizeText(objective));
      const historicalRows = indexedSessions.filter((session) => session.date < cycleStart && session.date >= historyStart && weekdaySet.has(String(moment(session.date).isoWeekday())) && normalizeText(session.objective) === normalizeText(objective));
      const current = avg(currentRows.map((row) => row.load_index));
      const historical = avg(historicalRows.map((row) => row.load_index));
      const diff = current != null && historical ? ((current - historical) / historical) * 100 : null;
      return { objective, current, historical, diff, status: getStatus(diff) };
    });
  }, [effectiveCycleDays, sessionAverages]);

  const cycleTitle = selectedSummary?.nombre_microciclo || selectedSummary?.microcycle_name || `Microciclo ${selectedPlan?.microcycle_number || nextMicrocycleNumber}`;
  const selectedDay = useMemo(() => baseCycleDays.find((day) => day.date === selectedDate) || baseCycleDays[0] || null, [baseCycleDays, selectedDate]);

  useEffect(() => {
    if (!baseCycleDays.length) return;
    const today = moment().format("YYYY-MM-DD");
    const todayInCycle = baseCycleDays.find((day) => day.date === today);
    const lastWithGps = [...baseCycleDays].reverse().find((day) => sessions.some((s) => s.date === day.date && (gpsBySession[s.id] || []).length > 0));
    const nextDate = todayInCycle?.date || lastWithGps?.date || baseCycleDays[0]?.date || "";
    if (!selectedDate || !baseCycleDays.some((day) => day.date === selectedDate)) setSelectedDate(nextDate);
  }, [baseCycleDays, sessions, gpsBySession, selectedDate]);

  async function saveMicrocycle(nextState, silent = false) {
    if (!squadId || !weekStart || !weekEnd) return;
    const existing = selectedSummary || summaries.find((s) => s.squad_id === squadId && s.fecha_inicio === weekStart && (!season || !s.season_id || s.season_id === season) && !["finalizado", "archivado", "cerrado", "congelado"].includes(s.estado));
    if (existing?.snapshot_locked && !silent) {
      const shouldUpdate = window.confirm("Este microciclo ya está finalizado. ¿Desea actualizar también el microciclo guardado?");
      if (!shouldUpdate) return;
    }
    if (!silent) {
      setSavingState(nextState);
      setSaveMessage("");
    }
    const now = new Date().toISOString();
    const gpsVariables = Object.fromEntries(MICRO_METRICS.map((metric) => [metric.key, { label: metric.label, value: aggregateRows(cycleRows, metric), mode: metric.mode, unit: metric.unit }]));
    const rankings = Object.fromEntries(highlights.map((item) => [item.metric.key, { label: item.metric.label, top3: item.top.map((p) => ({ player_id: p.player?.id || p.player_id || "", name: p.name, value: p.value })) }]));
    const sessionsInCycle = sessions.filter((s) => s.date >= weekStart && s.date <= weekEnd && (!squadId || !s.squad_id || s.squad_id === squadId));
    const sessionsWithGps = new Set(cycleRows.map((row) => row.session_id).filter(Boolean));
    const daysSnapshot = effectiveCycleDays.map((day) => ({ date: day.date, md: day.md || "—", objective: day.objetivo || day.physical_objective || day.objetivo_fisico || "—", sessions: sessionsInCycle.filter((s) => s.date === day.date).map((s) => s.id) }));
    const sessionsSnapshot = sessionsInCycle.map((s) => ({ id: s.id, title: s.title, date: s.date, session_type: s.session_type, duration_minutes: s.duration_minutes, session_objective: s.session_objective, objective: s.objective, match_day_code: s.match_day_code, microcycle_day: s.microcycle_day, squad_id: s.squad_id, squad_name: s.squad_name, season_id: s.season_id, csv_url: s.csv_url, pdf_exported: s.pdf_exported, notes: s.notes }));
    const payload = {
      squad_id: squadId,
      squad_name: squadName || "",
      season_id: season || "",
      microcycle_number: selectedSummary?.microcycle_number || existing?.microcycle_number || nextMicrocycleNumber,
      version_number: (selectedSummary?.version_number || existing?.version_number || 0) + (nextState === "finalizado" && !existing ? 1 : 0) || 1,
      microcycle_name: cycleTitle,
      nombre_microciclo: cycleTitle,
      fecha_inicio: weekStart,
      fecha_fin: weekEnd,
      rival: selectedSummary?.rival || existing?.rival || "",
      partido_asociado: selectedSummary?.partido_asociado || selectedSummary?.rival || existing?.partido_asociado || existing?.rival || "",
      resultado: selectedSummary?.resultado || existing?.resultado || "",
      competencia: selectedSummary?.competencia || existing?.competencia || "",
      tags: selectedSummary?.tags || existing?.tags || [],
      cantidad_sesiones: sessionsWithGps.size || sessionsInCycle.length,
      cantidad_partidos: selectedSummary?.cantidad_partidos || existing?.cantidad_partidos || 0,
      estado: nextState,
      created_at: selectedSummary?.created_at || existing?.created_at || now,
      updated_at: now,
      archived_at: nextState === "finalizado" || nextState === "archivado" ? now : selectedSummary?.archived_at || existing?.archived_at || "",
      finalized_at: nextState === "finalizado" ? now : selectedSummary?.finalized_at || existing?.finalized_at || "",
      snapshot_locked: nextState === "finalizado" || nextState === "archivado",
      pdf_url: selectedSummary?.pdf_url || existing?.pdf_url || "",
      pdf_generated_at: selectedSummary?.pdf_generated_at || existing?.pdf_generated_at || "",
      exports_snapshot: { pdf_url: selectedSummary?.pdf_url || existing?.pdf_url || "", cronograma_url: "", resumen_url: "", informes_gps_url: "" },
      days_snapshot: daysSnapshot,
      sessions_snapshot: sessionsSnapshot,
      physical_objectives_snapshot: daysSnapshot.map((d) => ({ date: d.date, objective: d.objective })),
      md_codes_snapshot: daysSnapshot.map((d) => ({ date: d.date, md: d.md })),
      load_summary_snapshot: gpsVariables,
      ai_analysis_snapshot: selectedSummary?.ai_analysis_snapshot || existing?.ai_analysis_snapshot || {},
      reports_snapshot: { gps_rows_included: cycleRows.length, gps_rows_excluded: Math.max(0, allCycleRows.length - cycleRows.length), pdf_url: selectedSummary?.pdf_url || existing?.pdf_url || "" },
      summary_snapshot: { daily: dailySummaries, gps_rows_included: cycleRows.length, gps_rows_excluded: Math.max(0, allCycleRows.length - cycleRows.length) },
      charts_snapshot: { daily: dailySummaries, metrics: visibleMetrics },
      rankings_snapshot: rankings,
      gps_variables_snapshot: gpsVariables,
      promedios_snapshot: gpsVariables,
      highlighted_players_snapshot: { items: highlights },
      weekly_comparison_snapshot: { items: comparison },
      filters_snapshot: filters,
      snapshot: { days: daysSnapshot, sessions: sessionsSnapshot, dailySummaries, highlights, comparison, filters, metrics: visibleMetrics, loadSummary: gpsVariables },
    };
    if (existing) await base44.entities.MicrocycleSummary.update(existing.id, payload);
    else await base44.entities.MicrocycleSummary.create(payload);
    await loadSummaries();
    if (!silent) {
      setSavingState("");
      setSaveMessage(nextState === "finalizado" ? "Informe semanal cerrado y guardado como snapshot histórico." : "Informe semanal guardado.");
    }
  }

  async function updateMicrocycleSummary(id, data) {
    await base44.entities.MicrocycleSummary.update(id, { ...data, snapshot_locked: data.estado === "cerrado", updated_at: new Date().toISOString() });
    await loadSummaries();
    setSaveMessage("Microciclo actualizado.");
  }

  async function deleteMicrocycleSummary(id) {
    await base44.entities.MicrocycleSummary.delete(id);
    if (selectedSummaryId === id) {
      setSelectedSummaryId("");
      setCycleMode("current");
    }
    await loadSummaries();
    setSaveMessage("Microciclo eliminado.");
  }

  // La semana ahora se encuentra desde WeeklyPlan; el informe cerrado es opcional y no se guarda automáticamente.

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Análisis histórico de carga</p>
            <h2 className="text-2xl font-bold text-white mt-1">Carga del Microciclo</h2>
            <p className="text-zinc-400 text-sm mt-1">{squadName || "Plantel activo"} · {weekStart ? moment(weekStart).format("DD/MM") : ""} - {weekEnd ? moment(weekEnd).format("DD/MM/YYYY") : ""}</p>
            {saveMessage && <p className="text-emerald-300 text-xs font-semibold mt-2 flex items-center gap-1"><CheckCircle2 size={13} />{saveMessage}</p>}
          </div>
          <div className="flex gap-2 flex-wrap"><Link to="/performance/microcycle-history" className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-bold"><History size={16} />Historial de informes</Link><GpsMicrocycleFiltersPanel filters={filters} onApply={setFilters} players={players} sessions={sessions} cycleDays={effectiveCycleDays} metrics={MICRO_METRICS} /><GpsMicrocyclePdfButton squadName={squadName} season={season} dailySummaries={shownDailySummaries} highlights={shownHighlights} comparison={shownComparison} cycleDays={effectiveCycleDays} /><button onClick={() => saveMicrocycle("finalizado")} disabled={!!savingState} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white rounded-xl text-sm font-bold"><Archive size={16} />{savingState === "finalizado" ? "Cerrando..." : "Cerrar informe semanal"}</button></div>
        </div>
      </div>

      {showHistory && <GpsMicrocycleHistoryPanel summaries={summaries} selectedSummaryId={selectedSummaryId} onSelect={(id) => { setSelectedSummaryId(id); setCycleMode("historical"); setShowHistory(false); }} onUpdate={updateMicrocycleSummary} onDelete={deleteMicrocycleSummary} onClose={() => setShowHistory(false)} />}

      <GpsMicrocycleWeekNavigator weeklyPlans={weeklyPlans} selectedWeekStart={selectedPlan?.week_start || selectedWeekStart} onSelectWeek={(weekStart) => { setSelectedWeekStart(weekStart); setCycleMode("current"); setSelectedSummaryId(""); setFilters((current) => ({ ...current, selectedDates: [] })); }} sessions={sessions} gpsBySession={gpsBySession} />
      <GpsMicrocycleDayHeader days={baseCycleDays} sessions={sessions} gpsBySession={gpsBySession} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      <GpsDailyPlayerTable selectedDate={selectedDate} sessions={sessions} gpsBySession={gpsBySession} playerMap={playerMap} microcycleProfiles={microcycleProfiles} competitionProfiles={competitionProfiles} squadId={squadId} season={season} selectedDay={selectedDay} />
      {selectedDate && <div className="flex justify-end"><button onClick={() => setFilters((current) => ({ ...current, selectedDates: [selectedDate] }))} className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white">Filtrar gráficos por este día</button></div>}

      <div ref={reportCaptureRef} className="space-y-5">
        {filterLabels.length > 0 && <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl p-4"><p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Filtros aplicados</p><div className="flex flex-wrap gap-2">{filterLabels.map((label) => <span key={label} className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs font-semibold">{label}</span>)}</div></div>}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {visibleMetrics.map((metric) => <MetricChart key={metric.key} metric={metric} data={shownDailySummaries} />)}
        </div>
        <GpsMicrocycleHighlights highlights={shownHighlights} />
        <ObjectiveComparisonTable rows={objectiveTableRows} />
      </div>
    </div>
  );
}