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
    const squadId = tokenRecord.squad_id;

    // 1. Wellness de hoy
    const wellnessRows = await base44.asServiceRole.entities.WellnessResponse.filter(
      { player_id: playerId, response_date: today },
      "-updated_at",
      1
    );
    const wellnessStatus = wellnessRows[0] ? 'completed' : 'pending';

    // 2. RPE: sesiones de hoy con RPE habilitado
    const sessions = await base44.asServiceRole.entities.TrainingSession.filter(
      { squad_id: squadId, date: today, rpe_enabled: true },
      "-created_date",
      50
    );

    const rpeSessions = [];
    for (const session of sessions) {
      if (session.status === 'cancelled') continue;
      // Ventana temporal
      if (session.rpe_available_at) {
        if (now < new Date(session.rpe_available_at)) continue;
      }
      if (session.rpe_deadline) {
        if (now > new Date(session.rpe_deadline)) continue;
      }
      // SessionPlayer del jugador
      const spRows = await base44.asServiceRole.entities.SessionPlayer.filter(
        { session_id: session.id, player_id: playerId },
        "-created_date",
        1
      );
      const sp = spRows[0];
      if (!sp) continue;
      if (sp.attendance === 'ausente' || sp.attendance === 'no_entrena') continue;
      if (sp.rpe != null) continue; // ya respondido

      rpeSessions.push({
        session_id: session.id,
        title: session.title || 'Sesión',
        date: session.date,
        match_day_code: session.match_day_code || '',
        session_type: session.session_type || '',
      });
    }

    return Response.json({
      ok: true,
      player_first_name: tokenRecord.player_first_name || '',
      wellness: { status: wellnessStatus },
      rpe_sessions: rpeSessions,
    });
  } catch (error) {
    console.error('getDailyCheckinData error:', error);
    return Response.json({ error: 'Error al cargar los datos del día' }, { status: 500 });
  }
}