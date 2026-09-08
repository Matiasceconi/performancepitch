import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveStaffAccess } from "../../shared/playerPortalAuth.ts";
import { resolvePlayerSessionMinutes, calculateSessionRpeLoad, normalizeRpe, internalLoadErrorResponse } from "../../shared/internalLoad.ts";

function canAccessSquad(staff: any, squadId: string) {
  if (!staff) return false;
  if (staff.admin) return true;
  if (staff.all_squads) return true;
  const ids = Array.isArray(staff.squad_ids) ? staff.squad_ids : [];
  return ids.includes(squadId);
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "No autenticado" }, { status: 401 });
    const staff = await resolveStaffAccess(base44, user);
    if (!staff) return Response.json({ error: "Sin permisos de staff" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const sessionPlayerId = String(body.session_player_id || "");
    if (!sessionPlayerId) return Response.json({ error: "session_player_id requerido" }, { status: 400 });

    const sp = await base44.asServiceRole.entities.SessionPlayer.get(sessionPlayerId).catch(() => null);
    if (!sp) return Response.json({ error: "Jugador de sesión no encontrado" }, { status: 404 });
    const session = await base44.asServiceRole.entities.TrainingSession.get(sp.session_id).catch(() => null);
    if (!session) return Response.json({ error: "Sesión no encontrada" }, { status: 404 });
    if (!canAccessSquad(staff, session.squad_id)) return Response.json({ error: "No tenés acceso a este plantel" }, { status: 403 });

    const changes: any = {};
    if (body.minutes !== undefined) {
      const minutes = Number(body.minutes);
      if (!Number.isFinite(minutes) || minutes < 0 || minutes > 360) return Response.json({ error: "Minutos inválidos" }, { status: 400 });
      changes.minutes = minutes;
    }
    if (body.notes !== undefined) changes.notes = String(body.notes || "").slice(0, 3000);
    if (body.rpe !== undefined && body.rpe !== null && body.rpe !== "") changes.rpe = normalizeRpe(body.rpe);
    else if (body.rpe === null || body.rpe === "") changes.rpe = null;

    const merged = { ...sp, ...changes };
    const minutesResolution = resolvePlayerSessionMinutes(merged, session);
    const effectiveRpe = changes.rpe !== undefined ? changes.rpe : sp.rpe;
    const internalLoad = effectiveRpe == null ? null : calculateSessionRpeLoad(Number(effectiveRpe), minutesResolution);
    changes.internal_load = internalLoad;
    changes.internal_load_pending = effectiveRpe != null ? minutesResolution.pending : false;
    changes.internal_load_minutes = minutesResolution.minutes;
    changes.internal_load_minutes_source = minutesResolution.source;
    changes.load_details_updated_at = new Date().toISOString();
    changes.load_details_updated_by = user.id || user.email || "staff";
    if (changes.rpe !== undefined) {
      changes.rpe_source = "staff";
      changes.rpe_updated_at = new Date().toISOString();
    }

    const updated = await base44.asServiceRole.entities.SessionPlayer.update(sp.id, changes);
    return Response.json({
      ok: true,
      session_player: updated,
      internal_load: internalLoad,
      internal_load_pending: changes.internal_load_pending,
      minutes_used: minutesResolution.minutes,
      minutes_source: minutesResolution.source,
    });
  } catch (error: any) {
    console.error("updateSessionPlayerLoadDetails error", error);
    return internalLoadErrorResponse(error);
  }
}
