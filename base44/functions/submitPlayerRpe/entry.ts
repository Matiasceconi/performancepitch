import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlayerAccess } from "../../shared/playerPortalAuth.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const access = await resolvePlayerAccess(base44, user);
    if (!access) return Response.json({ error: 'Acceso de jugador no vinculado' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const playerId = access.player_id;
    const sessionId = String(body.session_id || '');
    if (!sessionId) return Response.json({ error: 'Sesión requerida' }, { status: 400 });

    const rpe = Number(body.rpe);
    if (!Number.isFinite(rpe) || rpe < 0 || rpe > 10) {
      return Response.json({ error: 'RPE inválido (0-10)' }, { status: 400 });
    }
    const comment = String(body.comment || '').slice(0, 1000);

    // Verificar que el jugador está vinculado a la sesión
    const spRows = await base44.asServiceRole.entities.SessionPlayer.filter(
      { session_id: sessionId, player_id: playerId },
      "-created_date",
      1
    );
    const sp = spRows[0];
    if (!sp) return Response.json({ error: 'No estás asignado a esta sesión' }, { status: 403 });

    // Verificar que la sesión pertenece al plantel del jugador y RPE habilitado
    const session = await base44.asServiceRole.entities.TrainingSession.get(sessionId).catch(() => null);
    if (!session) return Response.json({ error: 'Sesión no encontrada' }, { status: 404 });
    if (session.squad_id !== access.squad_id) {
      return Response.json({ error: 'La sesión no pertenece a tu plantel' }, { status: 403 });
    }
    if (!session.rpe_enabled) {
      return Response.json({ error: 'El RPE no está habilitado para esta sesión' }, { status: 403 });
    }
    // Verificar disponibilidad temporal
    const now = new Date();
    if (session.rpe_available_at) {
      const availableAt = new Date(session.rpe_available_at);
      if (now < availableAt) return Response.json({ error: 'El RPE todavía no está disponible' }, { status: 403 });
    }
    if (session.status === 'cancelled') {
      return Response.json({ error: 'La sesión está cancelada' }, { status: 403 });
    }

    // Calcular minutos: prioridad 1) minutos individuales, 2) duración real sesión, 3) duración planificada
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
    console.error('submitPlayerRpe error:', error);
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}