import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hashToken, getTodayInTimezone } from "../../shared/playerAccessUtils.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || '');
    if (!token) return Response.json({ error: 'Token requerido' }, { status: 400 });

    const tokenHash = await hashToken(token);
    const tokenRows = await base44.asServiceRole.entities.DailyCheckinToken.filter(
      { record_type: 'token', token_hash: tokenHash, active: true },
      "-created_at",
      1
    );
    const tokenRecord = tokenRows[0];
    if (!tokenRecord) {
      return Response.json({ error: 'Sesión expirada. Ingresá tu DNI nuevamente.' }, { status: 401 });
    }

    const now = new Date();
    if (new Date(tokenRecord.expires_at) < now) {
      await base44.asServiceRole.entities.DailyCheckinToken.update(tokenRecord.id, { active: false });
      return Response.json({ error: 'Sesión expirada. Ingresá tu DNI nuevamente.' }, { status: 401 });
    }

    const today = getTodayInTimezone();
    if (tokenRecord.checkin_date !== today) {
      await base44.asServiceRole.entities.DailyCheckinToken.update(tokenRecord.id, { active: false });
      return Response.json({ error: 'La sesión corresponde a otro día. Ingresá tu DNI nuevamente.' }, { status: 401 });
    }

    const playerId = tokenRecord.player_id;

    // 1. Wellness de hoy
    const wellnessRows = await base44.asServiceRole.entities.WellnessResponse.filter(
      { player_id: playerId, response_date: today },
      "-updated_at",
      1
    );
    const wellnessStatus = wellnessRows[0] ? 'completed' : 'pending';

    // 2. RPE: buscar sesiones del jugador mediante SessionPlayer (no por squad_id)
    const spRows = await base44.asServiceRole.entities.SessionPlayer.filter(
      { player_id: playerId },
      "-created_date",
      200
    );

    const sessionIds = [...new Set(spRows.map((sp) => sp.session_id))];
    const sessionMap: Record<string, any> = {};
    for (let i = 0; i < sessionIds.length; i += 50) {
      const batch = sessionIds.slice(i, i + 50);
      const rows = await base44.asServiceRole.entities.TrainingSession.filter(
        { id: { $in: batch } },
        "-date",
        200
      );
      rows.forEach((s) => { sessionMap[s.id] = s; });
    }

    const spBySession: Record<string, any> = {};
    spRows.forEach((sp) => { spBySession[sp.session_id] = sp; });

    const rpeSessions = [];
    const rpeCompletedSessions = [];

    for (const session of Object.values(sessionMap)) {
      if (session.date !== today) continue;
      if (session.status === 'cancelled') continue;
      const sp = spBySession[session.id];
      if (!sp) continue;
      if (sp.attendance === 'ausente' || sp.attendance === 'no_entrena') continue;

      const card = {
        session_id: session.id,
        title: session.title || 'Sesión',
        date: session.date,
        match_day_code: session.match_day_code || '',
        session_type: session.session_type || '',
      };

      if (sp.rpe != null) {
        rpeCompletedSessions.push({ ...card, rpe: sp.rpe, internal_load: sp.internal_load });
      } else {
        rpeSessions.push(card);
      }
    }

    return Response.json({
      ok: true,
      player_first_name: tokenRecord.player_first_name || '',
      wellness: { status: wellnessStatus },
      rpe_sessions: rpeSessions,
      rpe_completed_sessions: rpeCompletedSessions,
    });
  } catch (error) {
    console.error('getDailyCheckinData error:', error);
    return Response.json({ error: 'Error al cargar los datos del día' }, { status: 500 });
  }
}