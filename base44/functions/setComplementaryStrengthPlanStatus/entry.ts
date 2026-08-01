import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveStaffAccess } from "../../shared/playerPortalAuth.ts";

// Cambia el estado de un plan (publicar / cerrar) y de sus workouts.
// Publicar: plan + workouts draft → published. Cerrar: plan → closed.
// Cerrar nunca elimina historial ni ejecuciones.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
    const staff = await resolveStaffAccess(base44, user);
    if (!staff) return Response.json({ error: 'Sin permisos de staff' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const planId = String(body.plan_id || '');
    const action = String(body.action || ''); // 'publish' | 'close'
    if (!planId) return Response.json({ error: 'Plan requerido' }, { status: 400 });

    const plan = await base44.asServiceRole.entities.ComplementaryStrengthPlan.get(planId).catch(() => null);
    if (!plan) return Response.json({ error: 'Plan no encontrado' }, { status: 404 });

    const now = new Date().toISOString();
    if (action === 'publish') {
      await base44.asServiceRole.entities.ComplementaryStrengthPlan.update(planId, {
        status: 'published',
        published_at: now,
      });
      // Publicar workouts draft
      const workouts = await base44.asServiceRole.entities.ComplementaryStrengthWorkout.filter(
        { plan_id: planId, status: 'draft' },
        "workout_date",
        500
      );
      for (const w of workouts) {
        await base44.asServiceRole.entities.ComplementaryStrengthWorkout.update(w.id, { status: 'published', published_at: now });
      }
    } else if (action === 'close') {
      await base44.asServiceRole.entities.ComplementaryStrengthPlan.update(planId, {
        status: 'closed',
        closed_at: now,
      });
    } else {
      return Response.json({ error: 'Acción inválida' }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('setComplementaryStrengthPlanStatus error:', error);
    return Response.json({ error: error.message || 'Error' }, { status: 500 });
  }
}