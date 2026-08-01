import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlayerFromToken } from "../../shared/complementaryStrength.ts";

// Envía el RPE complementario (0-10). Es obligatorio para completar el entrenamiento.
// Queda completamente separado del RPE principal (SessionPlayer.rpe).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const auth = await resolvePlayerFromToken(base44, body.token);
    if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

    const { tokenRecord, today } = auth;
    const playerId = tokenRecord.player_id;
    const executionId = String(body.execution_id || '');
    const rpe = Number(body.rpe);
    const comment = String(body.comment || '').slice(0, 1000);

    if (!executionId) return Response.json({ error: 'Ejecución requerida' }, { status: 400 });
    if (!Number.isFinite(rpe) || rpe < 0 || rpe > 10) {
      return Response.json({ error: 'El RPE debe ser un valor entre 0 y 10' }, { status: 400 });
    }

    const execution = await base44.asServiceRole.entities.ComplementaryStrengthExecution.get(executionId).catch(() => null);
    if (!execution) return Response.json({ error: 'Ejecución no encontrada' }, { status: 404 });
    if (execution.player_id !== playerId) return Response.json({ error: 'Sin permiso' }, { status: 403 });
    if (execution.status !== 'rpe_pending' && execution.status !== 'completed') {
      return Response.json({ error: 'Primero finalizá el entrenamiento' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const completedLate = execution.workout_date < today;

    const updated = await base44.asServiceRole.entities.ComplementaryStrengthExecution.update(executionId, {
      status: 'completed',
      rpe: Math.round(rpe),
      rpe_comment: comment,
      rpe_submitted_at: now,
      completed_at: now,
      completed_late: completedLate,
    });

    return Response.json({ ok: true, execution: updated });
  } catch (error) {
    console.error('submitComplementaryRpe error:', error);
    return Response.json({ error: error.message || 'Error al guardar el RPE' }, { status: 500 });
  }
}