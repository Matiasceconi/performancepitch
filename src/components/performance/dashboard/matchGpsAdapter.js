export function findMatchForDay(day, matchReports = []) {
  if (!day) return null;
  const directId = day.match_id || day.match_report_id;
  if (directId) {
    const direct = matchReports.find((match) => match.id === directId);
    if (direct) return direct;
  }
  const eventId = day.calendar_event_id;
  if (eventId) {
    const byEvent = matchReports.find((match) => match.calendar_event_id === eventId);
    if (byEvent) return byEvent;
  }
  if ((day.day_type === "match" || day.md === "MD" || day.md_code === "MD") && day.date) {
    return matchReports.find((match) => match.date === day.date) || null;
  }
  return null;
}

function keepNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeMatchGpsRows(match, rows = [], day = {}) {
  if (!match || !rows?.length) return [];
  const rival = match.rival || match.rival_name_backup || day.rival || "Rival";
  return rows.map((row) => ({
    ...row,
    source_type: "match",
    match_id: match.id,
    session_id: match.id,
    session_date: match.date,
    session_title: `Partido vs ${rival} — MD`,
    session_type: "Partido",
    md: "MD",
    match_day_code: "MD",
    rival,
    squad_id: match.squad_id || day.squad_id || "",
    squad_name: match.squad_name || day.squad_name || "",
    season_id: match.season_id || day.season_id || "",
    player_id: row.player_id || "",
    player_name: row.player_name || "Jugador",
    total_distance: keepNumber(row.total_distance),
    m_min: keepNumber(row.meters_per_minute),
    distance_19_8: keepNumber(row.distance_hsr),
    distance_25: keepNumber(row.sprint_distance),
    sprints: keepNumber(row.sprint_efforts),
    acc_3: keepNumber(row.accelerations),
    dec_3: keepNumber(row.decelerations),
    player_load: keepNumber(row.player_load),
    smax: keepNumber(row.max_velocity),
    max_vel_percent: keepNumber(row.max_velocity_percentage),
    duration_minutes: keepNumber(row.total_duration),
    include_in_session_average: true,
    gps_group: "principal",
  }));
}

export function getMatchRowsForDay(day, matchReports = [], matchGpsByMatch = {}) {
  const match = findMatchForDay(day, matchReports);
  if (!match) return [];
  return normalizeMatchGpsRows(match, matchGpsByMatch[match.id] || [], day);
}

export function matchGpsStatus(match, rows = []) {
  if (!match) return { label: "Partido", state: "match", players: 0 };
  if (rows.length > 0) return { label: `GPS completo — ${rows.length} jugadores`, state: "complete", players: rows.length };
  if (match.csv_url) return { label: "GPS parcial", state: "partial", players: 0 };
  return { label: "GPS pendiente", state: "pending", players: 0 };
}