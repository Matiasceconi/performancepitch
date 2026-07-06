import moment from "moment";
import { isGoalkeeper, resolvePositionGroup } from "@/components/squad/squadConstants";

export const MICRO_METRICS = [
  { key: "total_distance", label: "Distancia total", short: "Dist. total", unit: "m", color: "#22c55e", mode: "avg" },
  { key: "m_min", label: "m/min", short: "m/min", unit: "", color: "#60a5fa", mode: "avg" },
  { key: "distance_19_8", label: "D >19.8", short: "D >19.8", unit: "m", color: "#f97316", mode: "avg" },
  { key: "distance_25", label: "D >25", short: "D >25", unit: "m", color: "#ef4444", mode: "avg" },
  { key: "sprints", label: "Sprints", short: "Sprints", unit: "", color: "#f59e0b", mode: "avg" },
  { key: "acc_3", label: "ACC +3", short: "ACC +3", unit: "", color: "#a855f7", mode: "avg" },
  { key: "dec_3", label: "DEC +3", short: "DEC +3", unit: "", color: "#14b8a6", mode: "avg" },
  { key: "player_load", label: "Player Load", short: "PL", unit: "u", color: "#3b82f6", mode: "avg" },
  { key: "smax", label: "Smax", short: "Smax", unit: "km/h", color: "#eab308", mode: "max" },
];

export const HIGHLIGHT_METRICS = [
  { key: "total_distance", label: "Distancia acumulada", unit: "m", color: "#22c55e", mode: "sum" },
  { key: "m_min", label: "m/min", unit: "", color: "#60a5fa", mode: "avg" },
  { key: "distance_19_8", label: "D >19.8", unit: "m", color: "#f97316", mode: "sum" },
  { key: "distance_25", label: "D >25", unit: "m", color: "#ef4444", mode: "sum" },
  { key: "sprints", label: "Sprints", unit: "", color: "#f59e0b", mode: "sum" },
  { key: "acc_3", label: "ACC +3", unit: "", color: "#a855f7", mode: "sum" },
  { key: "dec_3", label: "DEC +3", unit: "", color: "#14b8a6", mode: "sum" },
  { key: "player_load", label: "Player Load", unit: "u", color: "#3b82f6", mode: "sum" },
  { key: "smax", label: "Smax", unit: "km/h", color: "#eab308", mode: "max" },
];

export function fmt(value, unit = "") {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  const shown = unit === "km/h" || n < 100 ? n.toFixed(1) : Math.round(n).toLocaleString("es-AR");
  return `${shown} ${unit}`.trim();
}

function aggregate(rows, key, mode = "avg") {
  const values = rows.map((r) => Number(r[key])).filter((v) => Number.isFinite(v));
  if (!values.length) return null;
  if (mode === "sum") return values.reduce((a, b) => a + b, 0);
  if (mode === "max") return Math.max(...values);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function getCycleDays(cycleDays) {
  return cycleDays?.length ? cycleDays : Array.from({ length: 7 }, (_, i) => ({ date: moment().startOf("isoWeek").add(i, "days").format("YYYY-MM-DD"), md: "—", objetivo: "—" }));
}

function rowStatus(row) {
  const group = String(row.gps_group || row.exclusion_reason || "").toLowerCase();
  if (group.includes("kinesiologia")) return "kinesiologia";
  if (group.includes("diferenciado")) return "diferenciado";
  if (row.include_in_session_average === false || (row.gps_group && row.gps_group !== "principal")) return "excluidos";
  return "incluidos";
}

export function normalizeRows(rows, playerMap) {
  return rows.map((r) => {
    const player = playerMap[r.player_id];
    const duration = r.m_min && r.total_distance ? r.total_distance / r.m_min : 0;
    return {
      ...r,
      player,
      player_name: r.player_name || player?.full_name || "Jugador",
      position: player?.position || r.position || "",
      position_group: player?.position_group || resolvePositionGroup(player?.position) || "",
      player_type: isGoalkeeper(player) ? "arqueros" : "campo",
      row_status: rowStatus(r),
      player_load_per_min: r.player_load_per_min || (duration ? r.player_load / duration : 0),
    };
  });
}

export function applyMicrocycleDayFilters(days, filters = {}) {
  const selectedWeekdays = filters.selectedWeekdays || [];
  const selectedDates = filters.selectedDates || [];
  return days.filter((day) => {
    if (filters.md && day.md !== filters.md) return false;
    if (filters.date && day.date !== filters.date) return false;
    if (filters.dateFrom && day.date < filters.dateFrom) return false;
    if (filters.dateTo && day.date > filters.dateTo) return false;
    if (selectedWeekdays.length && !selectedWeekdays.includes(String(moment(day.date).isoWeekday()))) return false;
    if (selectedDates.length && !selectedDates.includes(day.date)) return false;
    return true;
  });
}

export function applyMicrocycleFilters(rows, filters = {}) {
  const selectedWeekdays = filters.selectedWeekdays || [];
  const selectedDates = filters.selectedDates || [];
  return rows.filter((row) => {
    if (filters.playerId && row.player_id !== filters.playerId) return false;
    if (filters.position && row.position !== filters.position) return false;
    if (filters.positionGroup && row.position_group !== filters.positionGroup) return false;
    if (filters.playerType && row.player_type !== filters.playerType) return false;
    if (filters.status && row.row_status !== filters.status) return false;
    if (filters.md && row.md !== filters.md) return false;
    if (filters.sessionId && row.session_id !== filters.sessionId) return false;
    if (filters.date && row.session_date !== filters.date) return false;
    if (filters.dateFrom && row.session_date < filters.dateFrom) return false;
    if (filters.dateTo && row.session_date > filters.dateTo) return false;
    if (selectedWeekdays.length && !selectedWeekdays.includes(String(moment(row.session_date).isoWeekday()))) return false;
    if (selectedDates.length && !selectedDates.includes(row.session_date)) return false;
    return true;
  });
}

export function splitRows(rows, playerMap, filters = {}) {
  const status = filters.status || "";
  const filtered = applyMicrocycleFilters(normalizeRows(rows, playerMap), { ...filters, status: "" });
  const main = filtered.filter((r) => r.row_status === "incluidos");
  const excluded = filtered.filter((r) => r.row_status !== "incluidos");
  if (status === "incluidos") return { main, excluded: [] };
  if (status) return { main: [], excluded: excluded.filter((r) => r.row_status === status) };
  return { main, excluded };
}

export function buildDailySummaries({ sessions, gpsBySession, cycleDays, playerMap, filters = {}, metrics = MICRO_METRICS }) {
  return applyMicrocycleDayFilters(getCycleDays(cycleDays), filters).map((day) => {
    const daySessions = sessions.filter((s) => s.date === day.date && (!filters.sessionId || s.id === filters.sessionId));
    const rawRows = daySessions.flatMap((s) => (gpsBySession[s.id] || []).map((r) => ({ ...r, session_id: s.id, session_date: s.date, session_title: s.title, md: day.md || "—" })));
    const { main, excluded } = splitRows(rawRows, playerMap, filters);
    const metricValues = Object.fromEntries(metrics.map((m) => [m.key, aggregate(main, m.key, m.mode)]));
    return { date: day.date, label: day.date ? moment(day.date).format("ddd DD/MM") : "—", md: day.md || "—", objetivo: day.objetivo || "—", observations: day.observaciones || "", sessions: daySessions, mainRows: main, excludedRows: excluded, gpsPlayers: new Set(main.map((r) => r.player_id)).size, excludedCount: new Set(excluded.map((r) => r.player_id)).size, ...metricValues };
  });
}

export function rowsForCycle({ sessions, gpsBySession, cycleDays, playerMap, filters = {}, includeExcluded = false }) {
  const days = applyMicrocycleDayFilters(getCycleDays(cycleDays), filters);
  const dayByDate = Object.fromEntries(days.map((d) => [d.date, d]));
  const rows = sessions
    .filter((s) => dayByDate[s.date] && (!filters.sessionId || s.id === filters.sessionId))
    .flatMap((s) => (gpsBySession[s.id] || []).map((r) => ({ ...r, session_id: s.id, session_date: s.date, session_title: s.title, md: dayByDate[s.date]?.md || "—" })));
  const split = splitRows(rows, playerMap, filters);
  return includeExcluded ? [...split.main, ...split.excluded] : split.main;
}

export function buildHighlights(rows, playerMap, metrics = HIGHLIGHT_METRICS) {
  return metrics.map((metric) => {
    const byPlayer = {};
    rows.forEach((row) => {
      const value = Number(row[metric.key]);
      if (!Number.isFinite(value) || value <= 0) return;
      const player = playerMap[row.player_id];
      const current = byPlayer[row.player_id] || { player, name: row.player_name || player?.full_name || "Jugador", values: [], value: metric.mode === "max" ? 0 : 0 };
      current.values.push(value);
      current.value = metric.mode === "max" ? Math.max(current.value, value) : metric.mode === "avg" ? current.values.reduce((a, b) => a + b, 0) / current.values.length : current.value + value;
      byPlayer[row.player_id] = current;
    });
    const top = Object.values(byPlayer).sort((a, b) => b.value - a.value).slice(0, 3);
    return { metric, top, best: top[0] || null };
  });
}

export function buildComparison({ sessions, gpsBySession, cycleDays, playerMap, filters = {}, metrics = MICRO_METRICS }) {
  const days = applyMicrocycleDayFilters(getCycleDays(cycleDays), filters);
  const currentRows = rowsForCycle({ sessions, gpsBySession, cycleDays: days, playerMap, filters });
  const previousDays = days.map((d) => ({ ...d, date: moment(d.date).subtract(7, "days").format("YYYY-MM-DD") }));
  const previousRows = rowsForCycle({ sessions, gpsBySession, cycleDays: previousDays, playerMap, filters: { ...filters, sessionId: "", date: "", dateFrom: "", dateTo: "", selectedDates: [] } });
  return metrics.map((metric) => {
    const current = aggregate(currentRows, metric.key, metric.mode);
    const previous = aggregate(previousRows, metric.key, metric.mode);
    const diffAbs = current != null && previous != null ? current - previous : null;
    const diff = current != null && previous ? ((current - previous) / previous) * 100 : null;
    const trend = diff == null ? "Sin comparación" : diff > 8 ? "Sube" : diff < -8 ? "Baja" : "Estable";
    return { metric, current, previous, diffAbs, diff, trend, weeksAvailable: previousRows.length ? 1 : 0 };
  });
}

export function loadColorClass(value, average) {
  if (value == null) return "bg-zinc-700/40 text-zinc-400 border-zinc-700";
  if (!average) return "bg-blue-500/15 text-blue-300 border-blue-500/30";
  const pct = value / average;
  if (pct >= 1.18) return "bg-red-500/15 text-red-300 border-red-500/30";
  if (pct >= 1.05) return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
  if (pct < 0.75) return "bg-blue-500/15 text-blue-300 border-blue-500/30";
  return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
}