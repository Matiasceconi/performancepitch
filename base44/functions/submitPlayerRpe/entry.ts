import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlayerAccess } from "../../shared/playerPortalAuth.ts";
import { saveSessionPlayerRpe, internalLoadErrorResponse } from "../../shared/internalLoad.ts";

export default async function(req: Request) {
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

    const spRows = await base44.asServiceRole.entities.SessionPlayer.filter(
      { session_id: sessionId, player_id: playerId },
      "-created_date",
      1
    );
    const sp = spRows[0];
    if (!sp) return Response.json({ error: 'No estás asignado a esta sesión' }, { status: 403 });

    const session = await base44.asServiceRole.entities.TrainingSession.get(sessionId).catch(() => null);
    if (!session) return Response.json({ error: 'Sesión no encontrada' }, { status: 404 });
    if (session.squad_id !== access.squad_id) {
      return Response.json({ error: 'La sesión no pertenece a tu plantel' }, { status: 403 });
    }

    const result = await saveSessionPlayerRpe(base44, {
      sp,
      session,
      rpe: body.rpe,
      comment: body.comment,
      source: 'player',
      now: new Date(),
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
    console.error('submitPlayerRpe error:', error);
    return internalLoadErrorResponse(error);
  }
}