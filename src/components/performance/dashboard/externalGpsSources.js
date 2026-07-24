import moment from "moment";
import "moment/locale/es";
import { normalizeMatchGpsRows } from "./matchGpsAdapter";
import { sessionMeta, splitRows, aggregateMetric, MICRO_METRICS } from "./gpsMicrocycleReportUtils";

moment.locale("es");

const GPS_NUMERIC_KEYS = [
  "total_distance", "m_min", "meters_per_minute",
  "distance_14_19_8", "distance_19_8", "distance_hsr",
  "distance_25", "sprint_distance",
  "sprints", "sprint_efforts",
  "acc_3", "accelerations", "dec_3", "decelerations",
  "player_load", "player_load_per_min",
  "hmld", "rhie_bouts",
  "smax", "max_velocity",
  "max_vel_percent", "max_velocity_percentage",
  "duration_minutes", "total_duration",
];

export function isUsableGpsRow(row) {
  if (!row) return false;
  const hasPlayer = Boolean(row.player_id || (row.player_name && String(row.player_name).trim()));
  if (!hasPlayer) return false;
  return GPS_NUMERIC_KEYS.some((key) => {
    const v = Number(row[key]);
    return Number.isFinite(v) && v !== 0;
  });
}

function normalizeName(name) {
  return String(name || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function rowTimestamp(row) {
  const candidates = [row.updated_at, row.created_date, row.created_at, row.updated_date];
  for (const c of candidates) {
    if (!c) continue;
    const t = Date.parse(c);
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

export function dedupeRows(rows) {
  const byKey = {};
  rows.forEach((row) => {
    const key = row.player_id || normalizeName(row.player_name);
    if (!key) return;
    const existing = byKey[key];
    if (!existing) { byKey[key] = row; return; }
    const aTime = rowTimestamp(row);
    const bTime = rowTimestamp(existing);
    if (aTime > bTime) byKey[key] = row;
    else if (aTime === bTime && String(row.player_id || "") > String(existing.player_id || "")) byKey[key] = row;
  });
  return Object.values(byKey);
}

export function buildGpsSources({ sessions = [], gpsBySession = {}, matchReports = [], matchGpsByMatch = {}, weeklyPlans = [], squadId, seasonId }) {
  const sources = [];
  sessions.forEach((session) => {
    const rawRows = gpsBySession[session.id] || [];
    const usable = rawRows.filter(isUsableGpsRow);
    if (!usable.length) return;
    const deduped = dedupeRows(usable);
    const meta = sessionMeta(session, weeklyPlans);
    const included = deduped.filter((r) => r.include_in_session_average !== false);
    const excluded = deduped.filter((r) => r.include_in_session_average === false);
    sources.push({
      id: `training:${session.id}`,
      sourceId: session.id,
      sourceType: "training",
      date: session.date,
      title: session.title || "Sesión",
      md: meta.md,
      objective: meta.objective,
      rival: meta.rival || "",
      rivalLogoUrl: "",
      competition: "",
      homeAway: "",
      squadId: session.squad_id || "",
      seasonId: session.season_id || "",
      weeklyPlanDayId: session.weekly_plan_day_id || "",
      rows: deduped,
      playersCount: new Set(included.map((r) => r.player_id).filter(Boolean)).size,
      excludedPlayersCount: excluded.length,
    });
  });
  matchReports.forEach((match) => {
    const rawRows = matchGpsByMatch[match.id] || [];
    if (!rawRows.length) return;
    const normalized = normalizeMatchGpsRows(match, rawRows, {});
    const usable = normalized.filter(isUsableGpsRow);
    if (!usable.length) return;
    const deduped = dedupeRows(usable);
    const included = deduped.filter((r) => r.include_in_session_average !== false);
    const excluded = deduped.filter((r) => r.include_in_session_average === false);
    sources.push({
      id: `match:${match.id}`,
      sourceId: match.id,
      sourceType: "match",
      date: match.date,
      title: `Partido vs ${match.rival || match.rival_name_backup || "Rival"}`,
      md: "MD",
      objective: "Partido",
      rival: match.rival || match.rival_name_backup || "",
      rivalLogoUrl: match.rival_logo_url || "",
      competition: match.competition || "",
      homeAway: match.location || "",
      squadId: match.squad_id || "",
      seasonId: match.season_id || "",
      weeklyPlanDayId: "",
      rows: deduped,
      playersCount: new Set(included.map((r) => r.player_id).filter(Boolean)).size,
      excludedPlayersCount: excluded.length,
    });
  });
  return sources
    .filter((s) => {
      if (squadId && s.squadId && s.squadId !== squadId) return false;
      if (seasonId && s.seasonId && s.seasonId !== seasonId) return false;
      return true;
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export function filterSourcesByDateRange(sources, dateFrom, dateTo) {
  return sources.filter((s) => {
    if (dateFrom && s.date < dateFrom) return false;
    if (dateTo && s.date > dateTo) return false;
    return true;
  });
}

export function filterGpsSources(sources, filters = {}) {
  return sources.filter((source) => {
    if (filters.dateFrom && source.date < filters.dateFrom) return false;
    if (filters.dateTo && source.date > filters.dateTo) return false;
    if (filters.date && source.date !== filters.date) return false;
    if (filters.md && source.md !== filters.md) return false;
    if (filters.objective && source.objective !== filters.objective) return false;
    if (filters.sessionType) {
      if (filters.sessionType === "Partido" && source.sourceType !== "match") return false;
      if (filters.sessionType !== "Partido" && source.sourceType === "match") return false;
    }
    if (filters.squadId && source.squadId && source.squadId !== filters.squadId) return false;
    if (filters.season && source.seasonId && source.seasonId !== filters.season) return false;
    if (filters.rival && !String(source.rival || "").toLowerCase().includes(String(filters.rival).toLowerCase())) return false;
    if (filters.selectedSourceIds?.length && !filters.selectedSourceIds.includes(source.id)) return false;
    return true;
  });
}

export function sourceRowsToCycleRows(source) {
  return source.rows.map((row) => ({
    ...row,
    source_type: source.sourceType,
    session_id: source.sourceType === "training" ? source.sourceId : "",
    match_id: source.sourceType === "match" ? source.sourceId : "",
    session_date: source.date,
    session_title: source.title,
    md: source.md,
    objective: source.objective,
    rival: source.rival || "",
    session_type: source.sourceType === "match" ? "Partido" : "",
    squad_id: source.squadId,
    squad_name: "",
    season_id: source.seasonId,
  }));
}

export function rowsFromGpsSources(gpsSources, playerMap, filters = {}, includeExcluded = false) {
  const filteredSources = filterGpsSources(gpsSources, filters);
  const rows = [];
  filteredSources.forEach((source) => { sourceRowsToCycleRows(source).forEach((row) => rows.push(row)); });
  const split = splitRows(rows, playerMap, filters);
  return includeExcluded ? [...split.main, ...split.excluded] : split.main;
}

export function buildDailySummariesFromSources({ gpsSources, playerMap, filters = {}, metrics = MICRO_METRICS }) {
  const filteredSources = filterGpsSources(gpsSources, filters);
  const byDate = {};
  filteredSources.forEach((source) => {
    if (!source.date) return;
    if (!byDate[source.date]) byDate[source.date] = [];
    byDate[source.date].push(source);
  });
  return Object.keys(byDate).sort().map((date) => {
    const daySources = byDate[date];
    const rows = rowsFromGpsSources(daySources, playerMap, filters);
    const { main, excluded } = splitRows(rows, playerMap, filters);
    const metricValues = Object.fromEntries(metrics.map((m) => [m.key, aggregateMetric(main, m.key, m.mode)]));
    const sessions = daySources.map((s) => ({ id: s.sourceId, sourceId: s.sourceId, sourceType: s.sourceType, title: s.title, date: s.date, source_type: s.sourceType }));
    return {
      date,
      label: moment(date).locale("es").format("ddd DD/MM"),
      md: daySources[0]?.md || "—",
      objetivo: daySources[0]?.objective || "—",
      sessions,
      mainRows: main,
      excludedRows: excluded,
      gpsPlayers: new Set(main.map((r) => r.player_id)).size,
      excludedCount: new Set(excluded.map((r) => r.player_id)).size,
      ...metricValues,
    };
  });
}

export function buildComparisonFromSources({ gpsSources, previousSources = [], playerMap, filters = {}, metrics = MICRO_METRICS }) {
  const currentRows = rowsFromGpsSources(gpsSources, playerMap, filters);
  const previousRows = rowsFromGpsSources(previousSources, playerMap, { ...filters, sessionId: "", date: "", dateFrom: "", dateTo: "", selectedDates: [], selectedSourceIds: [] });
  return metrics.map((metric) => {
    const current = aggregateMetric(currentRows, metric.key, metric.mode);
    const previous = aggregateMetric(previousRows, metric.key, metric.mode);
    const diffAbs = current != null && previous != null ? current - previous : null;
    const diff = current != null && previous ? ((current - previous) / previous) * 100 : null;
    const trend = diff == null ? "Sin comparación" : diff > 8 ? "Sube" : diff < -8 ? "Baja" : "Estable";
    return { metric, current, previous, diffAbs, diff, trend, weeksAvailable: previousRows.length ? 1 : 0 };
  });
}