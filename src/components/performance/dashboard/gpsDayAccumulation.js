import moment from "moment";
import "moment/locale/es";
import { MICRO_METRICS } from "./gpsMicrocycleReportUtils";
import { resolveDaySessions, dayGpsStatus, dayGpsPlayerCount } from "./gpsDayResolver";
import { getMatchRowsForDay } from "./matchGpsAdapter";

moment.locale("es");

function rowDuration(row) {
  const direct = Number(row.duration_minutes || row.minutes || row.duration || 0);
  if (direct) return direct;
  const distance = Number(row.total_distance || 0);
  const mMin = Number(row.m_min || 0);
  return distance && mMin ? distance / mMin : 0;
}

// Acumula filas GPS por jugador dentro de un día (suma aditivas, máx para máximas)
export function accumulateByPlayer(rows) {
  const byPlayer = {};
  rows.forEach((row) => {
    if (!row.player_id) return;
    const key = row.player_id;
    if (!byPlayer[key]) {
      byPlayer[key] = {
        player_id: row.player_id,
        player_name: row.player_name || "",
        position: row.position || "",
        include_in_session_average: row.include_in_session_average !== false,
        rows: [],
        total_distance: 0, player_load: 0, duration_minutes: 0,
        distance_14_19_8: 0, distance_19_8: 0, distance_25: 0,
        sprints: 0, acc_3: 0, dec_3: 0, hmld: 0, rhie_bouts: 0,
        smax: 0, max_vel_percent: 0,
      };
    }
    const p = byPlayer[key];
    p.rows.push(row);
    p.total_distance += Number(row.total_distance || 0);
    p.player_load += Number(row.player_load || 0);
    p.duration_minutes += rowDuration(row);
    p.distance_14_19_8 += Number(row.distance_14_19_8 || 0);
    p.distance_19_8 += Number(row.distance_19_8 || 0);
    p.distance_25 += Number(row.distance_25 || 0);
    p.sprints += Number(row.sprints || 0);
    p.acc_3 += Number(row.acc_3 || 0);
    p.dec_3 += Number(row.dec_3 || 0);
    p.hmld += Number(row.hmld || 0);
    p.rhie_bouts += Number(row.rhie_bouts || 0);
    p.smax = Math.max(p.smax, Number(row.smax || 0));
    p.max_vel_percent = Math.max(p.max_vel_percent, Number(row.max_vel_percent || 0));
  });
  Object.values(byPlayer).forEach((p) => {
    p.m_min = p.duration_minutes > 0 ? p.total_distance / p.duration_minutes : 0;
    p.player_load_per_min = p.duration_minutes > 0 ? p.player_load / p.duration_minutes : 0;
  });
  return byPlayer;
}

// Promedio del equipo desde la acumulación por jugador (solo incluidos)
export function teamAveragesFromAccumulated(byPlayer, metrics = MICRO_METRICS) {
  const included = Object.values(byPlayer).filter((p) => p.include_in_session_average);
  const result = {};
  metrics.forEach((metric) => {
    if (metric.key === "sessions_count") {
      const sessionIds = new Set();
      included.forEach((p) => p.rows.forEach((r) => r.session_id && sessionIds.add(r.session_id)));
      result[metric.key] = sessionIds.size || null;
      return;
    }
    const values = included.map((p) => Number(p[metric.key])).filter((v) => Number.isFinite(v) && v > 0);
    if (!values.length) { result[metric.key] = null; return; }
    if (metric.mode === "max") result[metric.key] = Math.max(...values);
    else result[metric.key] = values.reduce((a, b) => a + b, 0) / values.length;
  });
  return result;
}

// Construye resúmenes diarios desde cycleDays con acumulación por jugador
export function buildDailySummariesFromDays({ cycleDays, sessions, gpsBySession, matchReports = [], matchGpsByMatch = {}, squadId, seasonId, metrics = MICRO_METRICS }) {
  return (cycleDays || []).map((day) => {
    const daySessions = resolveDaySessions(day, sessions, squadId, seasonId);
    const status = dayGpsStatus(day, daySessions, gpsBySession, matchGpsByMatch);
    const isRest = day.day_type === "rest" || status === "free";

    const trainingRows = daySessions.flatMap((s) =>
      (gpsBySession[s.id] || []).map((r) => ({
        ...r, source_type: "training", session_id: s.id,
        session_date: s.date, session_title: s.title,
        md: day.display_md_label || day.md || day.md_code || s.match_day_code || "—",
        objective: s.session_objective || day.physical_objective || "—",
      }))
    );
    const matchRows = day.day_type === "match" ? getMatchRowsForDay(day, matchReports, matchGpsByMatch) : [];
    const allRows = [...trainingRows, ...matchRows];

    const byPlayer = isRest ? {} : accumulateByPlayer(allRows);
    const metricValues = isRest ? Object.fromEntries(metrics.map((m) => [m.key, null])) : teamAveragesFromAccumulated(byPlayer, metrics);

    const gpsPlayers = dayGpsPlayerCount(daySessions, gpsBySession);
    const label = day.date ? moment(day.date).locale("es").format("ddd DD/MM") : "—";

    return {
      date: day.date,
      label,
      md: day.display_md_label || day.md || day.md_code || "—",
      md_code: day.md_code || "",
      day_type: day.day_type || "training",
      objective: daySessions[0]?.session_objective || day.physical_objective || "—",
      status,
      sessions: daySessions,
      sessionsCount: daySessions.length,
      gpsPlayers,
      ...metricValues,
    };
  });
}