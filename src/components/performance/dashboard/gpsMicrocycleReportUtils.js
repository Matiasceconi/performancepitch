import moment from "moment";
import { isGoalkeeper } from "@/components/squad/squadConstants";

export const MICRO_METRICS = [
  { key: "total_distance", label: "Distancia total", short: "Dist. total", unit: "m", color: "#22c55e", mode: "avg" },
  { key: "m_min", label: "m/min", short: "m/min", unit: "", color: "#60a5fa", mode: "avg" },
  { key: "distance_19_8", label: "D >19.8", short: "D >19.8", unit: "m", color: "#f97316", mode: "avg" },
  { key: "distance_25", label: "D >25", short: "D >25", unit: "m", color: "#ef4444", mode: "avg" },
  { key: "sprints", label: "Sprints", short: "Sprints", unit: "", color: "#f59e0b", mode: "avg" },
  { key: "acc_3", label: "ACC +3", short: "ACC +3", unit: "", color: "#a855f7", mode: "avg" },
  { key: "dec_3", label: "DEC +3", short: "DEC +3", unit: "", color: "#14b8a6", mode: "avg" },
  { key: "player_load", label: "Player Load", short: "PL", unit: "u", color: "#3b82f6", mode: "avg" },
  { key: "smax", label: "Smax máxima", short: "Smax", unit: "km/h", color: "#eab308", mode: "max" },
];

export const HIGHLIGHT_METRICS = [
  { key: "total_distance", label: "Mayor distancia acumulada", unit: "m", color: "#22c55e", mode: "sum" },
  { key: "player_load", label: "Mayor Player Load acumulado", unit: "u", color: "#3b82f6", mode: "sum" },
  { key: "smax", label: "Mayor Smax", unit: "km/h", color: "#eab308", mode: "max" },
  { key: "sprints", label: "Más sprints", unit: "", color: "#f59e0b", mode: "sum" },
  { key: "acc_3", label: "Más ACC +3", unit: "", color: "#a855f7", mode: "sum" },
  { key: "dec_3", label: "Más DEC +3", unit: "", color: "#14b8a6", mode: "sum" },
  { key: "distance_25", label: "Mayor D >25", unit: "m", color: "#ef4444", mode: "sum" },
];

export function fmt(value, unit = "") {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  const shown = unit === "km/h" ? n.toFixed(1) : Math.round(n).toLocaleString("es-AR");
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
  return cycleDays?.length ? cycleDays : Array.from({ length: 7 }, (_, i) => ({
    date: moment().startOf("isoWeek").add(i, "days").format("YYYY-MM-DD"),
    md: "—",
    objetivo: "—",
  }));
}

export function normalizeRows(rows, playerMap) {
  return rows
    .map((r) => ({ ...r, player: playerMap[r.player_id], player_name: r.player_name || playerMap[r.player_id]?.full_name || "Jugador" }))
    .filter((r) => !isGoalkeeper(r.player));
}

export function splitRows(rows, playerMap) {
  const normalized = normalizeRows(rows, playerMap);
  return {
    main: normalized.filter((r) => r.include_in_session_average !== false && (!r.gps_group || r.gps_group === "principal")),
    excluded: normalized.filter((r) => r.include_in_session_average === false || (r.gps_group && r.gps_group !== "principal")),
  };
}

export function buildDailySummaries({ sessions, gpsBySession, cycleDays, playerMap }) {
  return getCycleDays(cycleDays).map((day) => {
    const daySessions = sessions.filter((s) => s.date === day.date);
    const rawRows = daySessions.flatMap((s) => (gpsBySession[s.id] || []).map((r) => ({ ...r, session_title: s.title })));
    const { main, excluded } = splitRows(rawRows, playerMap);
    const metrics = Object.fromEntries(MICRO_METRICS.map((m) => [m.key, aggregate(main, m.key, m.mode)]));
    return {
      date: day.date,
      label: day.date ? moment(day.date).format("ddd DD/MM") : "—",
      md: day.md || "—",
      objetivo: day.objetivo || "—",
      observations: day.observaciones || "",
      sessions: daySessions,
      mainRows: main,
      excludedRows: excluded,
      gpsPlayers: new Set(main.map((r) => r.player_id)).size,
      excludedCount: new Set(excluded.map((r) => r.player_id)).size,
      ...metrics,
    };
  });
}

export function rowsForCycle({ sessions, gpsBySession, cycleDays, playerMap, includeExcluded = false }) {
  const dates = new Set(getCycleDays(cycleDays).map((d) => d.date).filter(Boolean));
  const rows = sessions.filter((s) => dates.has(s.date)).flatMap((s) => gpsBySession[s.id] || []);
  const split = splitRows(rows, playerMap);
  return includeExcluded ? [...split.main, ...split.excluded] : split.main;
}

export function buildHighlights(rows, playerMap) {
  return HIGHLIGHT_METRICS.map((metric) => {
    const byPlayer = {};
    rows.forEach((row) => {
      const value = Number(row[metric.key]);
      if (!Number.isFinite(value) || value <= 0) return;
      const player = playerMap[row.player_id];
      const current = byPlayer[row.player_id] || { player, name: row.player_name || player?.full_name || "Jugador", value: metric.mode === "max" ? 0 : 0 };
      current.value = metric.mode === "max" ? Math.max(current.value, value) : current.value + value;
      byPlayer[row.player_id] = current;
    });
    const best = Object.values(byPlayer).sort((a, b) => b.value - a.value)[0] || null;
    return { metric, best };
  });
}

export function buildComparison({ sessions, gpsBySession, cycleDays, playerMap }) {
  const days = getCycleDays(cycleDays);
  const start = moment(days[0]?.date).startOf("day");
  const end = moment(days[days.length - 1]?.date).endOf("day");
  const currentRows = rowsForCycle({ sessions, gpsBySession, cycleDays: days, playerMap });
  const pastWeeks = [];
  for (let i = 1; i <= 4; i++) {
    const from = start.clone().subtract(i * 7, "days");
    const to = end.clone().subtract(i * 7, "days");
    const weekSessions = sessions.filter((s) => s.date && moment(s.date).isBetween(from, to, "day", "[]"));
    const rows = normalizeRows(weekSessions.flatMap((s) => gpsBySession[s.id] || []), playerMap).filter((r) => r.include_in_session_average !== false && (!r.gps_group || r.gps_group === "principal"));
    if (rows.length) pastWeeks.push(rows);
  }
  const pastRows = pastWeeks.flat();
  return MICRO_METRICS.slice(0, 8).map((metric) => {
    const current = aggregate(currentRows, metric.key, metric.mode);
    const previous = aggregate(pastRows, metric.key, metric.mode);
    const diff = current != null && previous ? ((current - previous) / previous) * 100 : null;
    const trend = diff == null ? "Sin comparación" : diff > 8 ? "Sube" : diff < -8 ? "Baja" : "Estable";
    return { metric, current, previous, diff, trend, weeksAvailable: pastWeeks.length };
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