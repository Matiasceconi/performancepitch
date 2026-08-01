import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveStaffAccess, todayISO } from "../../shared/playerPortalAuth.ts";
import { resolveSquadRosterForDate } from "../../shared/squadRosterResolver.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const staff = await resolveStaffAccess(base44, user);
    if (!staff) return Response.json({ error: 'Sin permisos de staff' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const squadId = String(body.squad_id || '');
    const seasonId = String(body.season_id || '');
    const dateFrom = String(body.date_from || '');
    const dateTo = String(body.date_to || '');
    const targetDate = String(body.target_date || todayISO());

    if (!squadId) return Response.json({ error: 'Plantel requerido' }, { status: 400 });

    // ── Plantel operativo real para la fecha objetivo ───────────────────────
    const rosterRows = await resolveSquadRosterForDate(base44, squadId, targetDate);
    const roster = rosterRows.map((row) => row.player);
    const rosterPlayerIds = [...new Set(roster.map((p) => p.id))];

    // ── Wellness: buscar por player_id (no por squad_id) ───────────────────
    let filteredWellness = [];
    if (rosterPlayerIds.length > 0) {
      const batchSize = 50;
      const allWellness = [];
      for (let i = 0; i < rosterPlayerIds.length; i += batchSize) {
        const batch = rosterPlayerIds.slice(i, i + batchSize);
        const rows = await base44.asServiceRole.entities.WellnessResponse.filter(
          { player_id: { $in: batch } },
          "-response_date",
          2000
        );
        allWellness.push(...rows);
      }
      filteredWellness = allWellness;
      if (seasonId) filteredWellness = filteredWellness.filter((w) => !w.season_id || w.season_id === seasonId);
      if (dateFrom) filteredWellness = filteredWellness.filter((w) => w.response_date >= dateFrom);
      if (dateTo) filteredWellness = filteredWellness.filter((w) => w.response_date <= dateTo);
    }

    // ── Sesiones del plantel ───────────────────────────────────────────────
    const sessions = await base44.asServiceRole.entities.TrainingSession.filter({ squad_id: squadId }, "-date", 500);
    let filteredSessions = sessions;
    if (seasonId) filteredSessions = filteredSessions.filter((s) => !s.season_id || s.season_id === seasonId);
    if (dateFrom) filteredSessions = filteredSessions.filter((s) => s.date >= dateFrom);
    if (dateTo) filteredSessions = filteredSessions.filter((s) => s.date <= dateTo);

    const sessionIds = filteredSessions.map((s) => s.id);
    let sessionPlayers = [];
    if (sessionIds.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < sessionIds.length; i += batchSize) {
        const batch = sessionIds.slice(i, i + batchSize);
        const rows = await base44.asServiceRole.entities.SessionPlayer.filter({ session_id: { $in: batch } }, "-created_date", 5000);
        sessionPlayers.push(...rows);
      }
    }

    // ── Accesos de jugadores del plantel operativo ──────────────────────────
    let accesses = [];
    if (rosterPlayerIds.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < rosterPlayerIds.length; i += batchSize) {
        const batch = rosterPlayerIds.slice(i, i + batchSize);
        const rows = await base44.asServiceRole.entities.PlayerUserAccess.filter(
          { player_id: { $in: batch } },
          "-invited_at",
          500
        );
        accesses.push(...rows);
      }
    }

    return Response.json({
      wellness: filteredWellness,
      sessions: filteredSessions,
      sessionPlayers,
      roster,
      players: roster,
      accesses,
    });
  } catch (error) {
    console.error('getInternalLoadData error:', error);
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}