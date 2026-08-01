import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlayerFromToken } from "../../shared/complementaryStrength.ts";

// Finaliza los ejercicios del entrenamiento complementario.
// Cambia el estado a "rpe_pending" (NO marca como realizado todavía).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const auth = await resolvePlayerFromToken(base44, body.token);
    if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

    const { tokenRecord } = auth;
    const playerId = tokenRecord.player_id;
    const executionId = String(body.execution_id || '');
    if (!executionId) return Response.json({ error: 'Ejecución requerida' }, { status: 400 });

    const execution = await base44.asServiceRole.entities.ComplementaryStrengthExecution.get(executionId).catch(() => null);
    if (!execution) return Response.json({ error: 'Ejecución no encontrada' }, { status: 404 });
    if (execution.player_id !== playerId) return Response.json({ error: 'Sin permiso' }, { status: 403 });
    if (execution.status !== 'in_progress') {
      return Response.json({ error: 'El entrenamiento ya fue finalizado o no está en curso' }, { status: 409 });
    }

    const updated = await base44.asServiceRole.entities.ComplementaryStrengthExecution.update(executionId, {
      status: 'rpe_pending',
      exercises_finished_at: new Date().toISOString(),
    });

    return Response.json({ ok: true, execution: updated });
  } catch (error) {
    console.error('finishComplementaryWorkout error:', error);
    return Response.json({ error: error.message || 'Error al finalizar el entrenamiento' }, { status: 500 });
  }
}