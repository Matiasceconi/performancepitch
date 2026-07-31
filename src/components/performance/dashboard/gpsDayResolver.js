// Resuelve las sesiones de un día usando la prioridad de IDs reales
// Prioridad:
// 1. TrainingSession.weekly_plan_day_id === WeeklyPlanDay.id
// 2. WeeklyPlanDay.linked_session_ids contiene el ID de la sesión
// 3. La sesión tiene el mismo weekly_plan_id y la misma fecha
// 4. Solo legado: coincidencia por fecha, plantel y temporada

function sortSessions(a, b) {
  const ta = a.start_time || "", tb = b.start_time || "";
  if (ta !== tb) return ta.localeCompare(tb);
  if ((a.session_number || 0) !== (b.session_number || 0)) return (a.session_number || 0) - (b.session_number || 0);
  return String(a.created_date || "").localeCompare(String(b.created_date || ""));
}

export function resolveDaySessions(day, sessions, squadId, seasonId) {
  if (!day) return [];
  const dayId = day.weekly_plan_day_id || day.id || day.day_id || "";
  const linkedIds = Array.isArray(day.linked_session_ids) ? day.linked_session_ids : [];
  const planId = day.weekly_plan_id || "";
  const dayDate = day.date || "";

  // Filtrar sesiones del mismo plantel y temporada
  const scoped = sessions.filter((s) => {
    if (squadId && s.squad_id && s.squad_id !== squadId) return false;
    if (seasonId && s.season_id && s.season_id !== seasonId) return false;
    return true;
  });

  // Prioridad 1: weekly_plan_day_id === day.id
  if (dayId) {
    const byDayId = scoped.filter((s) => s.weekly_plan_day_id && s.weekly_plan_day_id === dayId);
    if (byDayId.length) return byDayId.sort(sortSessions);
  }

  // Prioridad 2: linked_session_ids contiene el ID
  if (linkedIds.length) {
    const byLinked = scoped.filter((s) => linkedIds.includes(s.id));
    if (byLinked.length) return byLinked.sort(sortSessions);
  }

  // Prioridad 3: mismo weekly_plan_id y misma fecha
  if (planId && dayDate) {
    const byPlanAndDate = scoped.filter((s) => s.weekly_plan_id === planId && s.date === dayDate);
    if (byPlanAndDate.length) return byPlanAndDate.sort(sortSessions);
  }

  // Prioridad 4 (legado): misma fecha, plantel, temporada
  if (dayDate) {
    const byDate = scoped.filter((s) => s.date === dayDate);
    if (byDate.length) return byDate.sort(sortSessions);
  }

  return [];
}

// Determina el estado GPS de un día
export function dayGpsStatus(day, daySessions, gpsBySession, matchGpsByMatch) {
  if (day.day_type === "rest") return "free";
  if (day.day_type === "match") {
    const matchId = day.match_id || "";
    const matchRows = (matchGpsByMatch[matchId] || []);
    if (matchRows.length) return "match_with_gps";
    return "match_no_gps";
  }
  if (!daySessions.length) return "no_session";
  const sessionsWithGps = daySessions.filter((s) => {
    const rows = (gpsBySession[s.id] || []).filter((r) => r.include_in_session_average !== false);
    return rows.length > 0;
  });
  if (sessionsWithGps.length === daySessions.length) return "gps_complete";
  if (sessionsWithGps.length > 0) return "gps_partial";
  return "gps_pending";
}

// Cuenta jugadores con GPS en un día
export function dayGpsPlayerCount(daySessions, gpsBySession) {
  const playerIds = new Set();
  daySessions.forEach((s) => {
    (gpsBySession[s.id] || []).forEach((r) => {
      if (r.include_in_session_average !== false && r.player_id) playerIds.add(r.player_id);
    });
  });
  return playerIds.size;
}