export const MATCH_GPS_METRICS = [
  { key: "total_duration", label: "Duración", short: "Min", unit: "min", decimals: 1, aggregate: "avg" },
  { key: "total_distance", label: "Distancia total", short: "DT", unit: "m", decimals: 0, aggregate: "avg" },
  { key: "meters_per_minute", label: "Metros por minuto", short: "m/min", unit: "m/min", decimals: 1, aggregate: "avg" },
  { key: "distance_hsr", label: "Distancia 19.8–25", short: "D>19.8", unit: "m", decimals: 0, aggregate: "avg" },
  { key: "sprint_distance", label: "Distancia >25", short: "D>25", unit: "m", decimals: 0, aggregate: "avg" },
  { key: "sprint_efforts", label: "Sprints", short: "Sprints", unit: "", decimals: 0, aggregate: "avg" },
  { key: "accelerations", label: "Aceleraciones +3", short: "ACC+3", unit: "", decimals: 0, aggregate: "avg" },
  { key: "decelerations", label: "Desaceleraciones -3", short: "DEC-3", unit: "", decimals: 0, aggregate: "avg" },
  { key: "player_load", label: "Player Load", short: "PL", unit: "AU", decimals: 0, aggregate: "avg" },
  { key: "max_velocity", label: "Velocidad máxima", short: "Smax", unit: "km/h", decimals: 1, aggregate: "max" },
];

export function validNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatMatchGpsValue(metricOrKey, value) {
  const metric = typeof metricOrKey === "string" ? MATCH_GPS_METRICS.find((item) => item.key === metricOrKey) : metricOrKey;
  const n = validNumber(value);
  if (n == null) return "—";
  const decimals = metric?.decimals ?? 0;
  return n.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function average(values) {
  const clean = values.map(validNumber).filter((value) => value != null);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null;
}

export function aggregateMetric(rows, metric) {
  const values = rows.map((row) => row?.[metric.key]).map(validNumber).filter((value) => value != null);
  if (!values.length) return null;
  if (metric.aggregate === "max") return Math.max(...values);
  if (metric.aggregate === "sum") return values.reduce((sum, value) => sum + value, 0);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildMatchGpsReportModel({ data, minutesRows = [] }) {
  const summaries = data?.player_summaries || [];
  const minuteByPlayer = Object.fromEntries((minutesRows || []).map((row) => [row.player_id, row]));
  const players = summaries.map((row) => {
    const minute = minuteByPlayer[row.player_id] || null;
    return {
      ...row,
      official_minutes: validNumber(minute?.minutes_played ?? minute?.minutes_calculated),
      lineup_role: minute?.lineup_role || "",
      started: minute?.started === true || minute?.lineup_role === "titular",
      entered: minute?.entered === true,
    };
  });
  const resolved = players.filter((row) => !row.unresolved && row.player_id);
  const maxDuration = Math.max(0, ...resolved.map((row) => validNumber(row.total_duration) || 0));
  const highExposureThreshold = maxDuration > 0 ? Math.min(60, maxDuration * 0.7) : 0;
  const highExposure = resolved.filter((row) => (validNumber(row.total_duration) || 0) >= highExposureThreshold);
  const primarySample = highExposure.length >= 5 ? highExposure : resolved;
  const teamSummary = {};
  MATCH_GPS_METRICS.forEach((metric) => { teamSummary[metric.key] = aggregateMetric(primarySample, metric); });

  const maxima = MATCH_GPS_METRICS.slice(1).map((metric) => {
    const ranked = resolved
      .filter((row) => validNumber(row[metric.key]) != null)
      .sort((a, b) => Number(b[metric.key]) - Number(a[metric.key]));
    return ranked.length ? { metric, player: ranked[0], value: ranked[0][metric.key] } : null;
  }).filter(Boolean);

  const periodNames = Array.from(new Set(resolved.flatMap((row) => (row.period_breakdown || []).map((period) => period.period_name).filter(Boolean))));
  const periodOrder = Object.fromEntries(resolved.flatMap((row) => (row.period_breakdown || []).map((period) => [period.period_name, period.period_order ?? 99])));
  periodNames.sort((a, b) => (periodOrder[a] ?? 99) - (periodOrder[b] ?? 99));
  const periodTeamSummary = periodNames.map((periodName) => {
    const rows = resolved.map((player) => {
      const period = (player.period_breakdown || []).find((item) => item.period_name === periodName);
      return period ? { ...period, player_id: player.player_id, player_name: player.player_name } : null;
    }).filter(Boolean);
    const metrics = {};
    MATCH_GPS_METRICS.forEach((metric) => { metrics[metric.key] = aggregateMetric(rows, metric); });
    return { period_name: periodName, players: rows.length, metrics, rows };
  });

  return {
    players,
    resolved,
    unresolved: players.filter((row) => row.unresolved || !row.player_id),
    maxDuration,
    highExposureThreshold,
    primarySample,
    teamSummary,
    maxima,
    periodNames,
    periodTeamSummary,
  };
}

export function describeExposureSample(model) {
  if (!model?.resolved?.length) return "Sin jugadores resueltos";
  if (model.primarySample.length === model.resolved.length) return `${model.resolved.length} jugadores con GPS`;
  return `${model.primarySample.length} jugadores con ≥${Math.round(model.highExposureThreshold)} min GPS`;
}
