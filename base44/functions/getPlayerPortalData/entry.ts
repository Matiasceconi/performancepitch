import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlayerAccess, todayISO } from "../../shared/playerPortalAuth.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const access = await resolvePlayerAccess(base44, user);
    if (!access) return Response.json({ error: 'Acceso de jugador no vinculado' }, { status: 403 });

    const playerId = access.player_id;
    const squadId = access.squad_id;
    const seasonId = access.season_id || '';
    const today = todayISO();

    // Actualizar último acceso (fire and forget)
    base44.asServiceRole.entities.PlayerUserAccess.update(access.id, { last_access_at: new Date().toISOString() }).catch(() => {});

    // Datos del jugador
    const player = await base44.asServiceRole.entities.Player.get(playerId).catch(() => null);

    // Wellness de hoy
    const todayWellnessRows = await base44.asServiceRole.entities.WellnessResponse.filter(
      { player_id: playerId, response_date: today },
      "-updated_at",
      1
    );
    const todayWellness = todayWellnessRows[0] || null;

    // Última respuesta wellness (cualquier fecha)
    const recentWellness = await base44.asServiceRole.entities.WellnessResponse.filter(
      { player_id: playerId },
      "-response_date",
      8
    );

    // Sesiones del plantel con RPE habilitado donde el jugador está vinculado
    const sessionPlayers = await base44.asServiceRole.entities.SessionPlayer.filter(
      { player_id: playerId },
      "-created_date",
      200
    );
    const sessionIds = sessionPlayers.map((sp) => sp.session_id);
    let sessions = [];
    if (sessionIds.length > 0) {
      const batchSize = 50;
      const allSessions = [];
      for (let i = 0; i < sessionIds.length; i += batchSize) {
        const batch = sessionIds.slice(i, i + batchSize);
        const rows = await base44.asServiceRole.entities.TrainingSession.filter({ id: { $in: batch } }, "-date", 200);
        allSessions.push(...rows);
      }
      sessions = allSessions.filter((s) => s.squad_id === squadId);
    }

    // RPE pendientes: sesiones con rpe_enabled, ya comenzó, y el jugador no respondió
    const now = new Date();
    const pendingRpe = sessions
      .filter((s) => {
        if (!s.rpe_enabled) return false;
        if (s.status === "cancelled") return false;
        const availableAt = s.rpe_available_at ? new Date(s.rpe_available_at) : null;
        if (availableAt && now < availableAt) return false;
        const sp = sessionPlayers.find((sp) => sp.session_id === s.id);
        return sp && sp.rpe == null;
      })
      .map((s) => {
        const sp = sessionPlayers.find((sp) => sp.session_id === s.id);
        return {
          session_id: s.id,
          title: s.title,
          date: s.date,
          start_time: s.start_time,
          session_type: s.session_type,
          match_day_code: s.match_day_code,
          session_player_id: sp?.id,
          minutes: sp?.minutes,
          rpe_deadline: s.rpe_deadline,
        };
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    // RPE ya respondidas (historial reciente)
    const answeredRpe = sessionPlayers
      .filter((sp) => sp.rpe != null)
      .slice(0, 20)
      .map((sp) => {
        const s = sessions.find((sess) => sess.id === sp.session_id);
        return {
          session_player_id: sp.id,
          session_id: sp.session_id,
          title: s?.title || "",
          date: s?.date || "",
          rpe: sp.rpe,
          internal_load: sp.internal_load,
          rpe_submitted_at: sp.rpe_submitted_at,
        };
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    return Response.json({
      player: player ? {
        id: player.id,
        first_name: player.first_name,
        last_name: player.last_name,
        full_name: player.full_name,
        photo_url: player.photo_url,
        position: player.position,
        jersey_number: player.jersey_number,
      } : null,
      squad_name: access.squad_name || '',
      today: today,
      todayWellness: todayWellness,
      recentWellness: recentWellness.slice(0, 7),
      pendingRpe: pendingRpe,
      answeredRpe: answeredRpe,
      lastResponse: recentWellness[0] || null,
    });
  } catch (error) {
    console.error('getPlayerPortalData error:', error);
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}