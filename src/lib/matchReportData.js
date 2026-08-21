import { base44 } from "@/api/base44Client";
import { normalizeMatchGpsRows } from "@/components/performance/dashboard/matchGpsAdapter";

// Métricas reutilizadas desde el sistema GPS existente (CatapultReport normalizado)
export const REPORT_METRICS = [
  { key: "total_distance", label: "Distancia total", unit: "m", profile: "avg_total_distance", decimals: 0, color: "#22c55e" },
  { key: "m_min", label: "m/min", unit: "m/min", profile: "avg_m_min", decimals: 1, color: "#3b82f6" },
  { key: "distance_19_8", label: "D >19.8", unit: "m", profile: "avg_distance_19_8", decimals: 0, color: "#eab308" },
  { key: "distance_25", label: "D >25", unit: "m", profile: "avg_distance_25", decimals: 0, color: "#f97316" },
  { key: "sprints", label: "Sprints", unit: "n°", profile: "avg_sprints", decimals: 0, color: "#ef4444" },
  { key: "acc_3", label: "ACC +3", unit: "n°", profile: "avg_acc_3", decimals: 0, color: "#a855f7" },
  { key: "dec_3", label: "DEC -3", unit: "n°", profile: "avg_dec_3", decimals: 0, color: "#ec4899" },
  { key: "player_load", label: "Player Load", unit: "au", profile: "avg_player_load", decimals: 0, color: "#14b8a6" },
  { key: "smax", label: "Smax", unit: "km/h", profile: "avg_smax", decimals: 1, color: "#f59e0b" },
];

export const KPI_KEYS = ["total_distance", "m_min", "distance_19_8", "distance_25", "sprints", "smax"];

const avg = (vals) => {
  const nums = vals.filter((v) => Number.isFinite(Number(v))).map(Number);
  return nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : 0;
};

export function fmtMetric(value, decimals) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString("es-AR", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

export function pctVs(value, base) {
  if (!base || !Number.isFinite(Number(value)) || Number(base) === 0) return null;
  return Math.round((Number(value) / Number(base)) * 100 - 100);
}

// Calcula PL/min (Player Load por minuto)
function withPlMin(row) {
  const dur = Number(row.duration_minutes || row.total_duration || 0);
  const pl = Number(row.player_load || 0);
  return { ...row, pl_min: dur > 0 ? pl / dur : null };
}

// Reúne todos los partidos con GPS disponible para un jugador en un plantel
export async function loadPlayerMatchGpsOptions({ playerId, squadId, seasonId }) {
  const [matchReports, catapultRows, minutesRows] = await Promise.all([
    base44.entities.MatchReport.filter({ squad_id: squadId }, "-date", 500).catch(() => []),
    base44.entities.CatapultReport.list("-date", 5000).catch(() => []),
    base44.entities.MatchPlayerMinutes.filter({ player_id: playerId }, "-match_date", 500).catch(() => []),
  ]);

  const scopedMatches = matchReports.filter((m) => !seasonId || !m.season_id || m.season_id === seasonId);
  const matchById = new Map(scopedMatches.map((m) => [m.id, m]));
  const minutesByMatch = new Map(minutesRows.map((r) => [r.match_id, r]));

  const rowsByMatch = {};
  catapultRows.forEach((row) => {
    if (row.player_id !== playerId) return;
    if (!matchById.has(row.session_id)) return;
    if (!rowsByMatch[row.session_id]) rowsByMatch[row.session_id] = [];
    rowsByMatch[row.session_id].push(row);
  });

  const options = scopedMatches
    .map((match) => {
      const rows = rowsByMatch[match.id] || [];
      const normalized = withPlMin(normalizeMatchGpsRows(match, rows, {})[0] || {});
      const minutes = minutesByMatch.get(match.id);
      return {
        match,
        hasGps: rows.length > 0,
        gpsRow: normalized,
        minutesPlayed: minutes?.minutes_played ?? null,
      };
    })
    .filter((opt) => opt.hasGps)
    .sort((a, b) => (b.match.date || "").localeCompare(a.match.date || ""));

  return options;
}

// Construye el dataset completo del informe para un jugador + partidos seleccionados
export async function buildMatchReportData({ playerId, matchIds }) {
  const player = await base44.entities.Player.get(playerId).catch(() => null);

  const matchReports = await Promise.all(
    matchIds.map((id) => base44.entities.MatchReport.get(id).catch(() => null))
  );
  const validMatches = matchReports.filter(Boolean);

  const allCatapult = await base44.entities.CatapultReport.list("-date", 5000).catch(() => []);
  const playerRows = allCatapult.filter((r) => r.player_id === playerId);

  const [minutesRows, competitionProfiles] = await Promise.all([
    base44.entities.MatchPlayerMinutes.filter({ player_id: playerId }, "-match_date", 500).catch(() => []),
    base44.entities.PlayerCompetitionProfile.filter({ player_id: playerId }, "-updated_at", 10).catch(() => []),
  ]);
  const minutesByMatch = new Map(minutesRows.map((r) => [r.match_id, r]));
  const competitionProfile = competitionProfiles[0] || null;

  // Todos los partidos del jugador con GPS (para promedio personal histórico)
  const allPlayerMatchIds = new Set(
    playerRows.map((r) => r.session_id).filter((sid) => validMatches.some((m) => m.id === sid) || true)
  );
  const allMatchReports = await base44.entities.MatchReport.list("-date", 500).catch(() => []);
  const allMatchById = new Map(allMatchReports.map((m) => [m.id, m]));
  const historicalRows = playerRows
    .filter((r) => allMatchById.has(r.session_id))
    .map((r) => withPlMin(normalizeMatchGpsRows(allMatchById.get(r.session_id), [r], {})[0] || {}));

  const personalAvg = {};
  REPORT_METRICS.forEach((m) => {
    personalAvg[m.key] = avg(historicalRows.map((r) => r[m.key]));
  });
  personalAvg.pl_min = avg(historicalRows.map((r) => r.pl_min));

  // Partidos seleccionados con métricas
  const selected = validMatches
    .map((match) => {
      const rows = playerRows.filter((r) => r.session_id === match.id);
      const normalized = withPlMin(normalizeMatchGpsRows(match, rows, {})[0] || {});
      const minutes = minutesByMatch.get(match.id);
      return {
        match,
        gpsRow: normalized,
        minutesPlayed: minutes?.minutes_played ?? null,
        hasGps: rows.length > 0,
      };
    })
    .filter((s) => s.hasGps)
    .sort((a, b) => (a.match.date || "").localeCompare(b.match.date || ""));

  // Insights: mejores marcas de la temporada
  const seasonBests = {};
  REPORT_METRICS.forEach((m) => {
    const vals = historicalRows.map((r) => Number(r[m.key])).filter((v) => Number.isFinite(v));
    seasonBests[m.key] = vals.length ? Math.max(...vals) : null;
  });

  // Ranking de smax en la temporada (para "2ª mejor marca")
  const smaxSorted = [...historicalRows].sort((a, b) => Number(b.smax || 0) - Number(a.smax || 0));

  return {
    player,
    competitionProfile,
    selected,
    personalAvg,
    historicalRows,
    seasonBests,
    smaxSorted,
    isMulti: selected.length > 1,
  };
}

// Construye datos de análisis directamente desde opciones pre-cargadas (sin llamadas extra)
export function buildAnalysisFromOptions({ player, matchOptions, selectedMatchIds, competitionProfile }) {
  const selected = matchOptions
    .filter((o) => selectedMatchIds.includes(o.match.id))
    .sort((a, b) => (a.match.date || "").localeCompare(b.match.date || ""));

  const historicalRows = matchOptions.map((o) => o.gpsRow);

  const personalAvg = {};
  REPORT_METRICS.forEach((m) => {
    personalAvg[m.key] = avg(historicalRows.map((r) => r[m.key]));
  });
  personalAvg.pl_min = avg(historicalRows.map((r) => r.pl_min));

  // Promedio de los últimos 5 partidos (referencia para comparar el último partido)
  const lastFiveRows = matchOptions.slice(0, 5).map((o) => o.gpsRow);
  const lastFiveAvg = {};
  REPORT_METRICS.forEach((m) => {
    lastFiveAvg[m.key] = avg(lastFiveRows.map((r) => r[m.key]));
  });
  lastFiveAvg.pl_min = avg(lastFiveRows.map((r) => r.pl_min));

  const seasonBests = {};
  REPORT_METRICS.forEach((m) => {
    const vals = historicalRows.map((r) => Number(r[m.key])).filter((v) => Number.isFinite(v));
    seasonBests[m.key] = vals.length ? Math.max(...vals) : null;
  });

  const smaxSorted = [...historicalRows].sort((a, b) => Number(b.smax || 0) - Number(a.smax || 0));

  return {
    player,
    competitionProfile,
    selected,
    personalAvg,
    lastFiveAvg,
    historicalRows,
    seasonBests,
    smaxSorted,
    isMulti: selected.length > 1,
  };
}

// Construye opciones de partido desde datos pre-cargados del dashboard
export function buildMatchOptionsFromData({ matchReports, matchGpsByMatch, minutesRows, playerId }) {
  const minutesByMatch = new Map((minutesRows || []).map((r) => [r.match_id, r]));
  return matchReports
    .map((match) => {
      const rows = (matchGpsByMatch[match.id] || []).filter((r) => r.player_id === playerId);
      if (!rows.length) return null;
      const normalized = withPlMin(normalizeMatchGpsRows(match, rows, {})[0] || {});
      const minutes = minutesByMatch.get(match.id);
      return {
        match,
        hasGps: true,
        gpsRow: normalized,
        minutesPlayed: minutes?.minutes_played ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.match.date || "").localeCompare(a.match.date || ""));
}

// Calcula KPIs principales con comparación vs promedio personal
export function buildKpis(reportData) {
  const { selected, lastFiveAvg, personalAvg, competitionProfile } = reportData;
  if (!selected.length) return [];

  // KPIs siempre muestran el último partido, comparado vs promedio de últimos 5
  const last = selected[selected.length - 1];
  return KPI_KEYS.map((key) => {
    const metric = REPORT_METRICS.find((m) => m.key === key);
    const value = last.gpsRow[key];
    const base = (lastFiveAvg && lastFiveAvg[key]) || personalAvg[key] || competitionProfile?.[metric.profile];
    return {
      ...metric,
      value,
      base,
      pct: pctVs(value, base),
    };
  });
}

// Datos para gráfico de comparación (partido actual vs promedio personal)
export function buildComparisonData(reportData) {
  const { selected, personalAvg } = reportData;
  if (!selected.length) return [];
  const last = selected[selected.length - 1];
  const compareMetrics = ["total_distance", "m_min", "distance_19_8", "distance_25", "sprints", "player_load", "smax"];
  return compareMetrics.map((key) => {
    const metric = REPORT_METRICS.find((m) => m.key === key);
    return {
      metric: metric.label,
      "Partido": Number(last.gpsRow[key] || 0),
      "Promedio personal": Number(personalAvg[key] || 0),
    };
  });
}

// Datos para gráfico de evolución (multi-partido)
export function buildEvolutionData(reportData, metricKey) {
  const { selected, personalAvg } = reportData;
  return selected.map((s) => ({
    label: s.match.rival || "Partido",
    shortDate: s.match.date ? new Date(s.match.date + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "—",
    [metricKey]: Number(s.gpsRow[metricKey] || 0),
    average: Number(personalAvg[metricKey] || 0),
  }));
}

// Datos para tabla comparativa
export function buildComparisonTable(reportData) {
  const { selected, isMulti } = reportData;
  const cols = ["total_distance", "m_min", "distance_19_8", "distance_25", "sprints", "acc_3", "dec_3", "player_load", "smax"];
  const rows = selected.map((s) => {
    const row = {
      label: isMulti ? (s.match.rival || "Partido") : "Partido",
      date: s.match.date,
      minutes: s.minutesPlayed,
    };
    cols.forEach((k) => { row[k] = s.gpsRow[k]; });
    return row;
  });
  if (isMulti) {
    const avgRow = { label: "PROMEDIO", date: null, minutes: avg(selected.map((s) => s.minutesPlayed)) };
    cols.forEach((k) => { avgRow[k] = avg(selected.map((s) => s.gpsRow[k])); });
    rows.push(avgRow);
  }
  return { cols, rows };
}

// Texto de insight automático por KPI
export function buildInsight(kpi, reportData) {
  const { selected, seasonBests, smaxSorted, isMulti } = reportData;
  if (isMulti) return null;
  const { key, value, base, pct } = kpi;
  if (pct == null) return null;
  const sign = pct > 0 ? "+" : "";
  if (key === "smax" && smaxSorted.length >= 2) {
    const rank = smaxSorted.findIndex((r) => Number(r.smax) <= Number(value)) + 1;
    if (rank === 1) return "Mejor marca de la temporada";
    if (rank === 2) return "2ª mejor marca de la temporada";
    if (rank === 3) return "3ª mejor marca de la temporada";
  }
  if (Math.abs(pct) < 3) return "En línea con el promedio personal";
  return `${sign}${pct}% vs promedio personal`;
}

const COMPARISON_METRIC_KEYS = ["total_distance", "m_min", "distance_19_8", "distance_25", "sprints", "smax"];

const INTENSITY_METRIC_DEFS = [
  { key: "player_load", label: "Player Load", unit: "au", color: "#14b8a6" },
  { key: "acc_3", label: "ACC +3", unit: "n°", color: "#a855f7" },
  { key: "dec_3", label: "DEC -3", unit: "n°", color: "#ec4899" },
  { key: "rhie_bouts", label: "RHIE", unit: "n°", color: "#f97316" },
];

function matchShortLabel(match) {
  if (match.date) return new Date(match.date + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  return match.rival || "P";
}

// Datos para grilla de comparación de métricas clave (multi-partido)
export function buildMultiComparisonData(reportData) {
  const { selected } = reportData;
  return COMPARISON_METRIC_KEYS.map((key) => {
    const metric = REPORT_METRICS.find((m) => m.key === key);
    const data = selected.map((s) => ({
      label: matchShortLabel(s.match),
      value: Number(s.gpsRow[key] || 0),
    }));
    return { metric, data };
  });
}

// Datos para grilla de intensidad y carga (multi-partido)
export function buildIntensityData(reportData) {
  const { selected } = reportData;
  return INTENSITY_METRIC_DEFS.map((metricDef) => {
    const data = selected.map((s) => ({
      label: matchShortLabel(s.match),
      value: Number(s.gpsRow[metricDef.key] || 0),
    }));
    return { metric: metricDef, data };
  }).filter((item) => item.data.some((d) => d.value > 0));
}

// Datos para grilla de distribución de métricas (partido único)
export function buildSingleDistributionData(reportData) {
  const { selected, personalAvg } = reportData;
  if (!selected.length) return [];
  const last = selected[selected.length - 1];
  const keys = ["total_distance", "m_min", "distance_25", "smax", "player_load"];
  return keys.map((key) => {
    const metric = REPORT_METRICS.find((m) => m.key === key);
    return {
      key,
      label: metric.label,
      unit: metric.unit,
      color: metric.color,
      value: Number(last.gpsRow[key] || 0),
      average: Number(personalAvg[key] || 0),
    };
  });
}

// Datos para gráfico "Último partido vs promedio de 5"
export function buildLastMatchVsAvgData(reportData) {
  const { selected, lastFiveAvg, personalAvg } = reportData;
  if (!selected.length) return [];
  const last = selected[selected.length - 1];
  const keys = ["total_distance", "m_min", "distance_19_8", "distance_25", "sprints", "smax"];
  return keys.map((key) => {
    const metric = REPORT_METRICS.find((m) => m.key === key);
    return {
      metric: metric.label,
      unit: metric.unit,
      "Último partido": Number(last.gpsRow[key] || 0),
      "Promedio 5": Number((lastFiveAvg && lastFiveAvg[key]) || personalAvg[key] || 0),
    };
  });
}