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
      return Response.json({ error: 'La sesión corresponde a otro día.' }, { status: 401 });
    }

    const playerId = tokenRecord.player_id;
    const squadId = tokenRecord.squad_id;
    const sessionId = String(body.session_id || '');
    if (!sessionId) return Response.json({ error: 'Sesión requerida' }, { status: 400 });

    const rpe = Number(body.rpe);
    if (!Number.isFinite(rpe) || rpe < 0 || rpe > 10) {
      return Response.json({ error: 'RPE inválido (0-10)' }, { status: 400 });
    }
    const comment = String(body.comment || '').slice(0, 1000);

    // Validar sesión
    const session = await base44.asServiceRole.entities.TrainingSession.get(sessionId).catch(() => null);
    if (!session) return Response.json({ error: 'Sesión no encontrada' }, { status: 404 });
    if (session.squad_id !== squadId) {
      return Response.json({ error: 'La sesión no pertenece a tu plantel' }, { status: 403 });
    }
    if (session.date !== today) {
      return Response.json({ error: 'La sesión no corresponde al día de hoy' }, { status: 403 });
    }
    if (!session.rpe_enabled) {
      return Response.json({ error: 'El RPE no está habilitado para esta sesión' }, { status: 403 });
    }
    if (session.status === 'cancelled') {
      return Response.json({ error: 'La sesión está cancelada' }, { status: 403 });
    }
    if (session.rpe_available_at && now < new Date(session.rpe_available_at)) {
      return Response.json({ error: 'El RPE todavía no está disponible' }, { status: 403 });
    }
    if (session.rpe_deadline && now > new Date(session.rpe_deadline)) {
      return Response.json({ error: 'El plazo para responder el RPE ya venció' }, { status: 403 });
    }

    // Validar SessionPlayer
    const spRows = await base44.asServiceRole.entities.SessionPlayer.filter(
      { session_id: sessionId, player_id: playerId },
      "-created_date",
      1
    );
    const sp = spRows[0];
    if (!sp) return Response.json({ error: 'No estás asignado a esta sesión' }, { status: 403 });
    if (sp.attendance === 'ausente' || sp.attendance === 'no_entrena') {
      return Response.json({ error: 'No estás registrado como presente en esta sesión' }, { status: 403 });
    }

    // Calcular minutos
    const individualMinutes = Number(sp.minutes) || 0;
    const sessionDuration = Number(session.duration_minutes) || 0;
    const minutes = individualMinutes || sessionDuration || 0;
    const internalLoad = minutes > 0 ? Math.round(rpe * minutes * 10) / 10 : null;
    const internalLoadPending = minutes === 0;

    const nowISO = now.toISOString();
    const wasFirstSubmission = sp.rpe == null;

    const updated = await base44.asServiceRole.entities.SessionPlayer.update(sp.id, {
      rpe: rpe,
      rpe_comment: comment,
      rpe_source: 'player',
      internal_load: internalLoad,
      internal_load_pending: internalLoadPending,
      rpe_submitted_at: wasFirstSubmission ? nowISO : (sp.rpe_submitted_at || nowISO),
      rpe_updated_at: nowISO,
    });

    return Response.json({
      ok: true,
      session_player: updated,
      internal_load: internalLoad,
      internal_load_pending: internalLoadPending,
      minutes_used: minutes,
    });
  } catch (error) {
    console.error('submitDailyPlayerRpe error:', error);
    return Response.json({ error: error.message || 'Error al guardar el RPE' }, { status: 500 });
  }
}