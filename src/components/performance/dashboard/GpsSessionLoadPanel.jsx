import React, { useEffect, useMemo, useState } from "react";
import moment from "moment";
import "moment/locale/es";
import { Link } from "react-router-dom";
import { AlertCircle, Upload, Users } from "lucide-react";
import GpsSessionSelector, { gpsStatus } from "./GpsSessionSelector";
import GpsDailyPlayerTable from "./GpsDailyPlayerTable";
import GpsMicrocycleHighlights from "./GpsMicrocycleHighlights";
import GpsMicrocycleCharts, { DEFAULT_CHART_CONFIG } from "./GpsMicrocycleCharts";
import GpsMicrocycleFiltersPanel, { getMicrocycleFilterLabels } from "./GpsMicrocycleFiltersPanel";
import GpsMicrocyclePdfButton from "./GpsMicrocyclePdfButton";
import { MICRO_METRICS, buildHighlights } from "./gpsMicrocycleReportUtils";
import { buildGpsSources, rowsFromGpsSources, buildDailySummariesFromSources, buildComparisonFromSources } from "./externalGpsSources";

moment.locale("es");

const RANKING_STORAGE_KEY = "gps_microcycle_ranking_metrics_v1";
const CHART_STORAGE_KEY = "gps_microcycle_chart_config_v1";
const DEFAULT_RANKING_CONFIG = { metricKeys: ["total_distance", "player_load", "sprints"], topCount: 3, scope: "full" };

function loadRankingConfig() {
  if (typeof window === "undefined") return DEFAULT_RANKING_CONFIG;
  try { return { ...DEFAULT_RANKING_CONFIG, ...(JSON.parse(window.localStorage.getItem(RANKING_STORAGE_KEY) || "{}")) }; } catch { return DEFAULT_RANKING_CONFIG; }
}
function loadChartConfig() {
  if (typeof window === "undefined") return DEFAULT_CHART_CONFIG;
  try { return { ...DEFAULT_CHART_CONFIG, ...(JSON.parse(window.localStorage.getItem(CHART_STORAGE_KEY) || "{}")) }; } catch { return DEFAULT_CHART_CONFIG; }
}

export default function GpsSessionLoadPanel({ sessions, gpsBySession, matchGpsByMatch = {}, playerMap, squadName, season, squadId, competitionProfiles = [], microcycleProfiles = [], matchReports = [], onReload: _onReload }) {
  const [filters, setFilters] = useState({});
  const [selectedSessionIds, setSelectedSessionIds] = useState([]);
  const [rankingConfig, setRankingConfig] = useState(loadRankingConfig);
  const [chartConfig, setChartConfig] = useState(loadChartConfig);
  const players = useMemo(() => Object.values(playerMap || {}).filter(Boolean), [playerMap]);

  useEffect(() => { window.localStorage.setItem(RANKING_STORAGE_KEY, JSON.stringify(rankingConfig)); }, [rankingConfig]);
  useEffect(() => { window.localStorage.setItem(CHART_STORAGE_KEY, JSON.stringify(chartConfig)); }, [chartConfig]);

  const sortedSessions = useMemo(() => [...sessions].sort((a, b) => {
    const dc = (b.date || "").localeCompare(a.date || "");
    if (dc !== 0) return dc;
    return (b.start_time || "").localeCompare(a.start_time || "");
  }), [sessions]);

  function toggleSession(id) {
    setSelectedSessionIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  // Auto-select most recent session with GPS
  useEffect(() => {
    if (selectedSessionIds.length) return;
    const withGps = sortedSessions.filter((s) => (gpsBySession[s.id] || []).some((r) => r.include_in_session_average !== false));
    if (withGps.length) setSelectedSessionIds([withGps[0].id]);
    else if (sortedSessions.length) setSelectedSessionIds([sortedSessions[0].id]);
  }, [sortedSessions, gpsBySession, selectedSessionIds.length]);

  const selectedSessions = sortedSessions.filter((s) => selectedSessionIds.includes(s.id));
  const primarySession = selectedSessions[0] || null;
  const allSelectedGpsRows = selectedSessionIds.flatMap((id) => gpsBySession[id] || []);
  const includedRows = allSelectedGpsRows.filter((r) => r.include_in_session_average !== false);
  const hasGps = includedRows.length > 0;
  const statusInfo = primarySession ? gpsStatus(primarySession, gpsBySession) : null;

  const allGpsSources = useMemo(() => buildGpsSources({ sessions, gpsBySession, matchReports, matchGpsByMatch, squadId, seasonId: season }), [sessions, gpsBySession, matchReports, matchGpsByMatch, squadId, season]);

  const periodSources = useMemo(() => {
    return allGpsSources.filter((s) => s.sourceType === "training" && selectedSessionIds.includes(s.sourceId));
  }, [allGpsSources, selectedSessionIds]);

  const previousSession = useMemo(() => {
    if (!primarySession) return null;
    return sortedSessions.find((s) => s.date < primarySession.date && (gpsBySession[s.id] || []).some((r) => r.include_in_session_average !== false)) || null;
  }, [sortedSessions, primarySession, gpsBySession]);

  const previousSource = useMemo(() => {
    if (!previousSession) return null;
    return allGpsSources.find((s) => s.sourceId === previousSession.id && s.sourceType === "training") || null;
  }, [allGpsSources, previousSession]);

  const previousSources = previousSource ? [previousSource] : [];
  const selectedSourceIds = periodSources.map((s) => s.id);

  const visibleMetrics = useMemo(() => filters.metricKey ? MICRO_METRICS.filter((m) => m.key === filters.metricKey) : MICRO_METRICS, [filters.metricKey]);
  const selectedChartMetrics = useMemo(() => (chartConfig.metricKeys || []).map((key) => MICRO_METRICS.find((metric) => metric.key === key)).filter(Boolean), [chartConfig.metricKeys]);
  const reportMetrics = useMemo(() => {
    const map = new Map();
    [...visibleMetrics, ...selectedChartMetrics].forEach((metric) => { if (metric) map.set(metric.key, metric); });
    return Array.from(map.values());
  }, [visibleMetrics, selectedChartMetrics]);
  const rankingMetrics = useMemo(() => (rankingConfig.metricKeys || []).map((key) => MICRO_METRICS.find((metric) => metric.key === key)).filter(Boolean), [rankingConfig.metricKeys]);

  const cycleRows = useMemo(() => rowsFromGpsSources(periodSources, playerMap, filters), [periodSources, playerMap, filters]);
  const dailySummaries = useMemo(() => buildDailySummariesFromSources({ gpsSources: periodSources, playerMap, filters, metrics: reportMetrics }), [periodSources, playerMap, filters, reportMetrics]);
  const comparison = useMemo(() => buildComparisonFromSources({ gpsSources: periodSources, previousSources, playerMap, filters, metrics: visibleMetrics }), [periodSources, previousSources, playerMap, filters, visibleMetrics]);
  const highlights = useMemo(() => buildHighlights(cycleRows, playerMap, rankingMetrics, { topCount: rankingConfig.topCount || 3, scope: "Sesión seleccionada" }), [cycleRows, playerMap, rankingMetrics, rankingConfig.topCount]);
  const filterLabels = useMemo(() => getMicrocycleFilterLabels(filters, { players, gpsSources: allGpsSources, metrics: MICRO_METRICS }), [filters, players, allGpsSources]);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Seleccionar sesión</h3>
        <div className="flex flex-wrap items-center gap-3">
          <GpsMicrocycleFiltersPanel filters={filters} onApply={setFilters} players={players} gpsSources={allGpsSources} metrics={MICRO_METRICS} />
          <GpsMicrocyclePdfButton squadName={squadName} season={season} dailySummaries={dailySummaries} highlights={highlights} comparison={comparison} cycleDays={dailySummaries} selectedDates={selectedSessions.map((s) => s.date)} visibleMetrics={selectedChartMetrics} chartMetrics={selectedChartMetrics} chartConfig={chartConfig} rankingConfig={rankingConfig} cycleRows={cycleRows} playerMap={playerMap} />
        </div>
      </div>

      {/* Session grid */}
      <GpsSessionSelector sessions={sortedSessions} gpsBySession={gpsBySession} selectedSessionIds={selectedSessionIds} onToggle={toggleSession} />

      {/* Session header */}
      {primarySession && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-white">
                {selectedSessions.length > 1
                  ? `${selectedSessions.length} sesiones seleccionadas`
                  : (primarySession.title || `Sesión ${primarySession.session_number || ""}`)}
              </h3>
              <p className="text-sm text-zinc-400 capitalize">
                {selectedSessions.length > 1
                  ? selectedSessions.map((s) => moment(s.date).format("DD/MM")).join(" · ")
                  : moment(primarySession.date).format("dddd DD/MM/YYYY")}
              </p>
            </div>
            {statusInfo && selectedSessions.length === 1 && (
              <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${statusInfo.color} bg-zinc-950 border border-zinc-800`}>
                <statusInfo.Icon size={14} />
                {statusInfo.label}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5 text-zinc-300">
              <Users size={14} className="text-zinc-500" />
              <span className="text-zinc-500">Jugadores con GPS:</span>
              <span className="font-semibold text-white">{includedRows.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* No GPS state */}
      {primarySession && !hasGps && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 text-center">
          <AlertCircle size={32} className="mx-auto text-amber-400 mb-3" />
          <h3 className="text-lg font-bold text-white">Las sesiones seleccionadas no tienen datos GPS</h3>
          <p className="mt-2 text-sm text-zinc-400">Procesá el archivo GPS para ver los datos.</p>
          <Link to="/sessions" className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors">
            <Upload size={16} />
            Ir a Sesiones para cargar GPS
          </Link>
        </div>
      )}

      {/* GPS data */}
      {primarySession && hasGps && (
        <>
          {filterLabels.length > 0 && (
            <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl p-4">
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Filtros aplicados</p>
              <div className="flex flex-wrap gap-2">
                {filterLabels.map((label) => <span key={label} className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs font-semibold">{label}</span>)}
              </div>
            </div>
          )}
          <GpsDailyPlayerTable gpsSources={periodSources} selectedSourceIds={selectedSourceIds} playerMap={playerMap} microcycleProfiles={microcycleProfiles} competitionProfiles={competitionProfiles} squadId={squadId} season={season} />
          <GpsMicrocycleCharts data={dailySummaries} metrics={MICRO_METRICS} config={chartConfig} onConfigChange={setChartConfig} />
          <GpsMicrocycleHighlights highlights={highlights} metrics={MICRO_METRICS} config={rankingConfig} onConfigChange={setRankingConfig} />
        </>
      )}

      {/* No sessions */}
      {!primarySession && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-8 text-center">
          <h3 className="text-lg font-black text-white">No hay sesiones disponibles</h3>
          <p className="mt-2 text-sm text-zinc-500">Seleccioná un plantel y temporada para ver las sesiones.</p>
        </div>
      )}
    </div>
  );
}