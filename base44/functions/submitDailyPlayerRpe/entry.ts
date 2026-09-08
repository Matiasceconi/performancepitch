import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hashToken, getTodayInTimezone } from "../../shared/playerAccessUtils.ts";
import { saveSessionPlayerRpe, internalLoadErrorResponse } from "../../shared/internalLoad.ts";

export default async function(req: Request) {
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
      return Response.json({ error: 'La sesión corresponde a otro día.' }, { status: 401 });
    }

    const playerId = tokenRecord.player_id;
    const sessionId = String(body.session_id || '');
    if (!sessionId) return Response.json({ error: 'Sesión requerida' }, { status: 400 });

    const wellnessRows = await base44.asServiceRole.entities.WellnessResponse.filter(
      { player_id: playerId, response_date: today },
      "-updated_at",
      1
    );
    if (!wellnessRows[0]) {
      return Response.json({ error: 'Primero completá tu Wellness de hoy para poder responder el RPE.' }, { status: 403 });
    }

    const session = await base44.asServiceRole.entities.TrainingSession.get(sessionId).catch(() => null);
    if (!session) return Response.json({ error: 'Sesión no encontrada' }, { status: 404 });
    if (session.date !== today) {
      return Response.json({ error: 'La sesión no corresponde al día de hoy' }, { status: 403 });
    }

    const spRows = await base44.asServiceRole.entities.SessionPlayer.filter(
      { session_id: sessionId, player_id: playerId },
      "-created_date",
      1
    );
    const sp = spRows[0];
    if (!sp) return Response.json({ error: 'No estás asignado a esta sesión' }, { status: 403 });

    const result = await saveSessionPlayerRpe(base44, {
      sp,
      session,
      rpe: body.rpe,
      comment: body.comment,
      source: 'player',
      now,
    });

    return Response.json({
      ok: true,
      session_player: result.updated,
      internal_load: result.internalLoad,
      internal_load_pending: result.internalLoadPending,
      minutes_used: result.minutesUsed,
      minutes_source: result.minutesSource,
    });
  } catch (error: any) {
    console.error('submitDailyPlayerRpe error:', error);
    return internalLoadErrorResponse(error);
  }
}