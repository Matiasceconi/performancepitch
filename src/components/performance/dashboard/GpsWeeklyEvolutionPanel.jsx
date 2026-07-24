import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import moment from "moment";
import "moment/locale/es";
import { CheckCircle2 } from "lucide-react";
import GpsMicrocycleHighlights from "./GpsMicrocycleHighlights";
import GpsMicrocyclePdfButton from "./GpsMicrocyclePdfButton";
import GpsMicrocycleFiltersPanel, { getMicrocycleFilterLabels } from "./GpsMicrocycleFiltersPanel";
import GpsMicrocycleHistoryPanel from "./GpsMicrocycleHistoryPanel";
import GpsMicrocycleWeekNavigator from "./GpsMicrocycleWeekNavigator";
import GpsMicrocycleSourceHeader from "./GpsMicrocycleSourceHeader";
import GpsDailyPlayerTable from "./GpsDailyPlayerTable";
import GpsMicrocycleCharts, { DEFAULT_CHART_CONFIG } from "./GpsMicrocycleCharts";
import { MICRO_METRICS, buildHighlights } from "./gpsMicrocycleReportUtils";
import { buildGpsSources, filterSourcesByDateRange, rowsFromGpsSources, buildDailySummariesFromSources, buildComparisonFromSources } from "./externalGpsSources";

const RANKING_STORAGE_KEY = "gps_microcycle_ranking_metrics_v1";
const CHART_STORAGE_KEY = "gps_microcycle_chart_config_v1";
const DEFAULT_RANKING_CONFIG = { metricKeys: ["total_distance", "player_load", "sprints"], topCount: 3, scope: "full" };

function addDays(date, days) { return moment(date).add(days, "days").format("YYYY-MM-DD"); }

function aggregateRows(rows, metric) {
  const values = rows.map((r) => Number(r[metric.key])).filter((v) => Number.isFinite(v));
  if (!values.length) return null;
  if (metric.mode === "max") return Math.max(...values);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function loadRankingConfig() {
  if (typeof window === "undefined") return DEFAULT_RANKING_CONFIG;
  try { return { ...DEFAULT_RANKING_CONFIG, ...(JSON.parse(window.localStorage.getItem(RANKING_STORAGE_KEY) || "{}")) }; } catch { return DEFAULT_RANKING_CONFIG; }
}
function loadChartConfig() {
  if (typeof window === "undefined") return DEFAULT_CHART_CONFIG;
  try { return { ...DEFAULT_CHART_CONFIG, ...(JSON.parse(window.localStorage.getItem(CHART_STORAGE_KEY) || "{}")) }; } catch { return DEFAULT_CHART_CONFIG; }
}

export default function GpsWeeklyEvolutionPanel({ sessions, gpsBySession, matchGpsByMatch = {}, cycleDays: _cycleDays, playerMap, squadName, season, squadId, weeklyPlans = [], selectedWeeklyPlanId = "", onSelectWeeklyPlan, competitionProfiles = [], microcycleProfiles = [], calendarEvents: _calendarEvents, matchReports = [], onReload: _onReload }) {
  const reportCaptureRef = useRef(null);
  const [filters, setFilters] = useState({});
  const [summaries, setSummaries] = useState([]);
  const [cycleMode, setCycleMode] = useState("current");
  const [selectedSummaryId, setSelectedSummaryId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState(selectedWeeklyPlanId || "");
  const [selectedSourceIds, setSelectedSourceIds] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [savingState, setSavingState] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [rankingConfig, setRankingConfig] = useState(loadRankingConfig);
  const [chartConfig, setChartConfig] = useState(loadChartConfig);
  const players = useMemo(() => Object.values(playerMap || {}).filter(Boolean), [playerMap]);

  useEffect(() => { window.localStorage.setItem(RANKING_STORAGE_KEY, JSON.stringify(rankingConfig)); }, [rankingConfig]);
  useEffect(() => { window.localStorage.setItem(CHART_STORAGE_KEY, JSON.stringify(chartConfig)); }, [chartConfig]);

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

  useEffect(() => {
    if (selectedWeeklyPlanId && selectedWeeklyPlanId !== selectedPlanId) setSelectedPlanId(selectedWeeklyPlanId);
  }, [selectedWeeklyPlanId, selectedPlanId]);

  const selectedPlan = useMemo(() => {
    if (!weeklyPlans.length) return null;
    const today = moment().format("YYYY-MM-DD");
    return weeklyPlans.find((plan) => plan.id === selectedPlanId) || weeklyPlans.find((plan) => (plan.operational_days || plan.days_data || []).some((day) => day.date === today)) || null;
  }, [weeklyPlans, selectedPlanId]);

  useEffect(() => {
    if (selectedPlan?.id && selectedPlan.id !== selectedPlanId) setSelectedPlanId(selectedPlan.id);
    if (selectedPlan?.id && selectedPlan.id !== selectedWeeklyPlanId) onSelectWeeklyPlan?.(selectedPlan.id);
  }, [selectedPlan, selectedPlanId, selectedWeeklyPlanId, onSelectWeeklyPlan]);

  // ── Build GPS sources from real data ──
  const gpsSources = useMemo(() => buildGpsSources({ sessions, gpsBySession, matchReports, matchGpsByMatch, weeklyPlans, squadId, seasonId: season }), [sessions, gpsBySession, matchReports, matchGpsByMatch, weeklyPlans, squadId, season]);

  // ── Determine date range from plan or filters ──
  const periodDateRange = useMemo(() => {
    if (cycleMode === "historical" || cycleMode === "lastSaved") return null;
    const today = moment().format("YYYY-MM-DD");
    if (cycleMode === "previous" && selectedPlan) {
      const days = selectedPlan.operational_days || selectedPlan.days_data || [];
      if (days.length) return { from: addDays(days[0].date, -7), to: addDays(days[days.length - 1].date, -7) };
    }
    if (selectedPlan) {
      const days = selectedPlan.operational_days || selectedPlan.days_data || [];
      if (days.length) return { from: days[0].date, to: days[days.length - 1].date };
    }
    if (filters.rangePreset === "last7") return { from: addDays(today, -6), to: today };
    if (filters.rangePreset === "last14") return { from: addDays(today, -13), to: today };
    if (filters.rangePreset === "last4weeks") return { from: addDays(today, -27), to: today };
    if (filters.dateFrom || filters.dateTo) return { from: filters.dateFrom || "", to: filters.dateTo || "" };
    return null;
  }, [cycleMode, selectedPlan, filters.rangePreset, filters.dateFrom, filters.dateTo]);

  const periodSources = useMemo(() => {
    if (cycleMode === "historical" || cycleMode === "lastSaved") return [];
    if (!periodDateRange) return gpsSources;
    return filterSourcesByDateRange(gpsSources, periodDateRange.from, periodDateRange.to);
  }, [gpsSources, periodDateRange, cycleMode]);

  // ── Auto-select most recent source ──
  useEffect(() => {
    if (!periodSources.length) { setSelectedSourceIds([]); return; }
    setSelectedSourceIds((current) => {
      const valid = current.filter((id) => periodSources.some((s) => s.id === id));
      if (valid.length) return valid;
      return [periodSources[0].id];
    });
  }, [periodSources]);

  const selectedDates = useMemo(() => [...new Set(periodSources.filter((s) => selectedSourceIds.includes(s.id)).map((s) => s.date))].sort(), [periodSources, selectedSourceIds]);
  const selectedSources = useMemo(() => periodSources.filter((s) => selectedSourceIds.includes(s.id)), [periodSources, selectedSourceIds]);

  const visibleMetrics = useMemo(() => filters.metricKey ? MICRO_METRICS.filter((m) => m.key === filters.metricKey) : MICRO_METRICS, [filters.metricKey]);
  const displayedChartConfig = ((cycleMode === "historical" || cycleMode === "lastSaved") && selectedSummary) ? (selectedSummary?.charts_snapshot?.config || DEFAULT_CHART_CONFIG) : chartConfig;
  const selectedChartMetrics = useMemo(() => (displayedChartConfig.metricKeys || []).map((key) => MICRO_METRICS.find((metric) => metric.key === key)).filter(Boolean), [displayedChartConfig.metricKeys]);
  const reportMetrics = useMemo(() => {
    const map = new Map();
    [...visibleMetrics, ...selectedChartMetrics].forEach((metric) => { if (metric) map.set(metric.key, metric); });
    return Array.from(map.values());
  }, [visibleMetrics, selectedChartMetrics]);
  const rankingMetrics = useMemo(() => (rankingConfig.metricKeys || []).map((key) => MICRO_METRICS.find((metric) => metric.key === key)).filter(Boolean), [rankingConfig.metricKeys]);

  const dailySummaries = useMemo(() => buildDailySummariesFromSources({ gpsSources: periodSources, playerMap, filters, metrics: reportMetrics }), [periodSources, playerMap, filters, reportMetrics]);
  const cycleRows = useMemo(() => rowsFromGpsSources(periodSources, playerMap, filters), [periodSources, playerMap, filters]);
  const allCycleRows = useMemo(() => rowsFromGpsSources(periodSources, playerMap, filters, true), [periodSources, playerMap, filters]);
  const rankingRows = useMemo(() => rankingConfig.scope === "selected" && selectedSourceIds.length ? rowsFromGpsSources(selectedSources, playerMap, filters) : cycleRows, [rankingConfig.scope, selectedSourceIds, selectedSources, periodSources, playerMap, filters, cycleRows]);
  const highlights = useMemo(() => buildHighlights(rankingRows, playerMap, rankingMetrics, { topCount: rankingConfig.topCount || 3, scope: rankingConfig.scope === "selected" ? "Cargas seleccionadas" : "Microciclo completo" }), [rankingRows, playerMap, rankingMetrics, rankingConfig.topCount, rankingConfig.scope]);

  const previousPeriodSources = useMemo(() => {
    if (!periodDateRange) return [];
    return filterSourcesByDateRange(gpsSources, addDays(periodDateRange.from, -7), addDays(periodDateRange.to, -7));
  }, [gpsSources, periodDateRange]);
  const comparison = useMemo(() => buildComparisonFromSources({ gpsSources: periodSources, previousSources: previousPeriodSources, playerMap, filters, metrics: visibleMetrics }), [periodSources, previousPeriodSources, playerMap, filters, visibleMetrics]);

  const isSavedMicrocycleView = (cycleMode === "historical" || cycleMode === "lastSaved") && selectedSummary;
  const shownDailySummaries = (isSavedMicrocycleView && selectedSummary?.snapshot?.dailySummaries) || (isSavedMicrocycleView && selectedSummary?.summary_snapshot?.daily) || dailySummaries;
  const shownHighlights = highlights;
  const shownComparison = (isSavedMicrocycleView && selectedSummary?.snapshot?.comparison) || comparison;
  const filterLabels = useMemo(() => getMicrocycleFilterLabels(filters, { players, gpsSources, metrics: MICRO_METRICS }), [filters, players, gpsSources]);

  const weekStart = shownDailySummaries[0]?.date || periodDateRange?.from || "";
  const weekEnd = shownDailySummaries[shownDailySummaries.length - 1]?.date || periodDateRange?.to || "";

  const matchContext = useMemo(() => {
    const matchSource = periodSources.find((s) => s.sourceType === "match");
    if (!matchSource) return null;
    return { match_id: matchSource.sourceId, rival: matchSource.rival, rival_logo_url: matchSource.rivalLogoUrl, competition: matchSource.competition, home_away: matchSource.homeAway, time: "" };
  }, [periodSources]);

  const cycleTitle = selectedSummary?.nombre_microciclo || selectedSummary?.microcycle_name || `Microciclo ${selectedPlan?.microcycle_number || nextMicrocycleNumber}`;

  async function saveMicrocycle(nextState, silent = false) {
    if (!squadId || !weekStart || !weekEnd) return;
    const existing = selectedSummary || summaries.find((s) => s.squad_id === squadId && s.fecha_inicio === weekStart && (!season || !s.season_id || s.season_id === season) && !["finalizado", "archivado", "cerrado", "congelado"].includes(s.estado));
    if (existing?.snapshot_locked && !silent) {
      const shouldUpdate = window.confirm("Este microciclo ya está finalizado. ¿Desea actualizar también el microciclo guardado?");
      if (!shouldUpdate) return;
    }
    if (!silent) { setSavingState(nextState); setSaveMessage(""); }
    const now = new Date().toISOString();
    const gpsVariables = Object.fromEntries(MICRO_METRICS.map((metric) => [metric.key, { label: metric.label, value: aggregateRows(cycleRows, metric), mode: metric.mode, unit: metric.unit }]));
    const rankings = Object.fromEntries(highlights.map((item) => [item.metric.key, { label: item.metric.label, top: item.top.map((p) => ({ player_id: p.player?.id || p.player_id || "", name: p.name, value: p.value, rank: p.rank })), top_count: rankingConfig.topCount, scope: rankingConfig.scope }]));
    const sourcesSnapshot = periodSources.map((s) => ({ id: s.id, sourceId: s.sourceId, sourceType: s.sourceType, date: s.date, title: s.title, md: s.md, objective: s.objective, rival: s.rival, playersCount: s.playersCount, excludedPlayersCount: s.excludedPlayersCount }));
    const payload = {
      squad_id: squadId, squad_name: squadName || "", season_id: season || "",
      microcycle_number: selectedSummary?.microcycle_number || existing?.microcycle_number || nextMicrocycleNumber,
      version_number: (selectedSummary?.version_number || existing?.version_number || 0) + (nextState === "finalizado" && !existing ? 1 : 0) || 1,
      microcycle_name: cycleTitle, nombre_microciclo: cycleTitle,
      fecha_inicio: weekStart, fecha_fin: weekEnd,
      rival: matchContext?.rival || selectedSummary?.rival || existing?.rival || "",
      rival_logo_url: matchContext?.rival_logo_url || selectedSummary?.rival_logo_url || existing?.rival_logo_url || "",
      partido_asociado: matchContext?.match_id || selectedSummary?.partido_asociado || existing?.partido_asociado || "",
      resultado: selectedSummary?.resultado || existing?.resultado || "",
      competencia: selectedSummary?.competencia || existing?.competencia || "",
      tags: selectedSummary?.tags || existing?.tags || [],
      cantidad_sesiones: periodSources.filter((s) => s.sourceType === "training").length,
      cantidad_partidos: periodSources.filter((s) => s.sourceType === "match").length,
      estado: nextState,
      created_at: selectedSummary?.created_at || existing?.created_at || now,
      updated_at: now,
      archived_at: nextState === "finalizado" || nextState === "archivado" ? now : selectedSummary?.archived_at || existing?.archived_at || "",
      finalized_at: nextState === "finalizado" ? now : selectedSummary?.finalized_at || existing?.finalized_at || "",
      snapshot_locked: nextState === "finalizado" || nextState === "archivado",
      pdf_url: selectedSummary?.pdf_url || existing?.pdf_url || "",
      pdf_generated_at: selectedSummary?.pdf_generated_at || existing?.pdf_generated_at || "",
      exports_snapshot: { pdf_url: selectedSummary?.pdf_url || existing?.pdf_url || "", cronograma_url: "", resumen_url: "", informes_gps_url: "" },
      days_snapshot: shownDailySummaries.map((d) => ({ date: d.date, md: d.md || "—", objective: d.objetivo || "—", sources: (d.sessions || []).map((s) => s.sourceId || s.id) })),
      sessions_snapshot: sourcesSnapshot,
      physical_objectives_snapshot: shownDailySummaries.map((d) => ({ date: d.date, objective: d.objetivo || "—" })),
      md_codes_snapshot: shownDailySummaries.map((d) => ({ date: d.date, md: d.md || "—" })),
      load_summary_snapshot: gpsVariables,
      ai_analysis_snapshot: selectedSummary?.ai_analysis_snapshot || existing?.ai_analysis_snapshot || {},
      reports_snapshot: { gps_rows_included: cycleRows.length, gps_rows_excluded: Math.max(0, allCycleRows.length - cycleRows.length), pdf_url: selectedSummary?.pdf_url || existing?.pdf_url || "" },
      summary_snapshot: { daily: dailySummaries, gps_rows_included: cycleRows.length, gps_rows_excluded: Math.max(0, allCycleRows.length - cycleRows.length), selectedSourceIds },
      charts_snapshot: { daily: dailySummaries, metrics: selectedChartMetrics, config: chartConfig },
      rankings_snapshot: rankings,
      ranking_config_snapshot: rankingConfig,
      match_snapshot: matchContext || {},
      gps_variables_snapshot: gpsVariables,
      promedios_snapshot: gpsVariables,
      highlighted_players_snapshot: { items: highlights },
      weekly_comparison_snapshot: { items: comparison },
      filters_snapshot: { ...filters, selectedSourceIds },
      snapshot: { sources: sourcesSnapshot, selectedSourceIds, dailySummaries, highlights, comparison, filters, metrics: visibleMetrics, chartMetrics: selectedChartMetrics, chartConfig, loadSummary: gpsVariables, rankingConfig, match: matchContext || {} },
    };
    if (existing) await base44.entities.MicrocycleSummary.update(existing.id, payload);
    else await base44.entities.MicrocycleSummary.create(payload);
    await loadSummaries();
    if (!silent) { setSavingState(""); setSaveMessage(nextState === "finalizado" ? "Informe semanal cerrado y guardado como snapshot histórico." : "Informe semanal guardado."); }
  }

  async function updateMicrocycleSummary(id, data) {
    await base44.entities.MicrocycleSummary.update(id, { ...data, snapshot_locked: data.estado === "cerrado", updated_at: new Date().toISOString() });
    await loadSummaries();
    setSaveMessage("Microciclo actualizado.");
  }
  async function deleteMicrocycleSummary(id) {
    await base44.entities.MicrocycleSummary.delete(id);
    if (selectedSummaryId === id) { setSelectedSummaryId(""); setCycleMode("current"); }
    await loadSummaries();
    setSaveMessage("Microciclo eliminado.");
  }

  function toggleSelectedSource(sourceId) {
    setSelectedSourceIds((current) => current.includes(sourceId) ? current.filter((id) => id !== sourceId) : [...current, sourceId]);
  }
  function selectAllSources() { setSelectedSourceIds(periodSources.map((s) => s.id)); }
  function clearSelectedSources() { setSelectedSourceIds([]); }

  const hasSources = periodSources.length > 0;
  const isHistorical = isSavedMicrocycleView;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <h2 className="text-xl font-black tracking-tight text-white">Carga del Microciclo</h2>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
            <GpsMicrocycleWeekNavigator weeklyPlans={weeklyPlans} selectedPlanId={selectedPlan?.id || selectedPlanId} onSelectPlan={(planId) => { setSelectedPlanId(planId); onSelectWeeklyPlan?.(planId); setCycleMode("current"); setSelectedSummaryId(""); setSelectedSourceIds([]); setFilters((current) => ({ ...current, selectedSourceIds: [] })); }} sessions={sessions} gpsBySession={gpsBySession} />
            <GpsMicrocycleFiltersPanel filters={filters} onApply={setFilters} players={players} gpsSources={gpsSources} metrics={MICRO_METRICS} />
            <GpsMicrocyclePdfButton squadName={squadName} season={season} dailySummaries={shownDailySummaries} highlights={shownHighlights} comparison={shownComparison} cycleDays={shownDailySummaries} selectedDates={selectedDates} visibleMetrics={selectedChartMetrics} chartMetrics={selectedChartMetrics} chartConfig={displayedChartConfig} rankingConfig={rankingConfig} matchContext={matchContext} cycleRows={rankingRows} />
          </div>
        </div>
        {saveMessage && <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-emerald-300"><CheckCircle2 size={13} />{saveMessage}</p>}
      </div>

      {showHistory && <GpsMicrocycleHistoryPanel summaries={summaries} selectedSummaryId={selectedSummaryId} onSelect={(id) => { setSelectedSummaryId(id); setCycleMode("historical"); setShowHistory(false); }} onUpdate={updateMicrocycleSummary} onDelete={deleteMicrocycleSummary} onClose={() => setShowHistory(false)} />}

      {isHistorical ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-8 text-center">
          <h3 className="text-lg font-black text-white">{cycleTitle}</h3>
          <p className="mt-2 text-sm text-zinc-500">Microciclo guardado · {weekStart} – {weekEnd}</p>
          <p className="mt-1 text-xs text-zinc-600">Visualizando snapshot histórico ({selectedSummary?.cantidad_sesiones || 0} sesiones, {selectedSummary?.cantidad_partidos || 0} partidos)</p>
        </div>
      ) : !hasSources ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-8 text-center">
          <h3 className="text-lg font-black text-white">No hay sesiones ni partidos con GPS cargado en este período</h3>
          <p className="mt-2 text-sm text-zinc-500">Las cargas aparecen automáticamente cuando se procesan datos GPS reales.</p>
        </div>
      ) : (
        <>
          <GpsMicrocycleSourceHeader gpsSources={periodSources} selectedSourceIds={selectedSourceIds} onToggleSource={toggleSelectedSource} onSelectAll={selectAllSources} onClear={clearSelectedSources} />
          <GpsDailyPlayerTable gpsSources={periodSources} selectedSourceIds={selectedSourceIds} playerMap={playerMap} microcycleProfiles={microcycleProfiles} competitionProfiles={competitionProfiles} squadId={squadId} season={season} />
          {selectedSourceIds.length > 0 && <div className="flex justify-end"><button onClick={() => setFilters((current) => ({ ...current, selectedSourceIds }))} className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white">Filtrar gráficos por cargas seleccionadas</button></div>}
        </>
      )}

      {hasSources && !isHistorical && <div ref={reportCaptureRef} className="space-y-5">
        {filterLabels.length > 0 && <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl p-4"><p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Filtros aplicados</p><div className="flex flex-wrap gap-2">{filterLabels.map((label) => <span key={label} className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs font-semibold">{label}</span>)}</div></div>}
        <GpsMicrocycleCharts data={shownDailySummaries} metrics={MICRO_METRICS} config={displayedChartConfig} onConfigChange={setChartConfig} />
        <GpsMicrocycleHighlights highlights={shownHighlights} metrics={MICRO_METRICS} config={rankingConfig} onConfigChange={setRankingConfig} />
      </div>}
    </div>
  );
}