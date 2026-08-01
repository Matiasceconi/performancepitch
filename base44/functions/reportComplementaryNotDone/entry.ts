import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlayerFromToken, NOT_COMPLETED_REASONS } from "../../shared/complementaryStrength.ts";

// Registra que el jugador no pudo realizar el entrenamiento complementario.
// Requiere motivo obligatorio. Si motivo = "otro", comentario obligatorio.
// No solicita RPE. Permite regularizar entrenamientos vencidos.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const auth = await resolvePlayerFromToken(base44, body.token);
    if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

    const { tokenRecord } = auth;
    const playerId = tokenRecord.player_id;
    const executionId = String(body.execution_id || '');
    const workoutId = String(body.workout_id || '');
    const reason = String(body.reason || '');
    const comment = String(body.comment || '').slice(0, 1000);

    if (!NOT_COMPLETED_REASONS.includes(reason)) {
      return Response.json({ error: 'Seleccioná un motivo válido' }, { status: 400 });
    }
    if (reason === 'otro' && !comment.trim()) {
      return Response.json({ error: 'Cuando elegís "Otro" tenés que agregar un comentario' }, { status: 400 });
    }

    let execution = null;
    if (executionId) {
      execution = await base44.asServiceRole.entities.ComplementaryStrengthExecution.get(executionId).catch(() => null);
      if (!execution) return Response.json({ error: 'Ejecución no encontrada' }, { status: 404 });
      if (execution.player_id !== playerId) return Response.json({ error: 'Sin permiso' }, { status: 403 });
      if (execution.status === 'completed') {
        return Response.json({ error: 'El entrenamiento ya fue realizado' }, { status: 409 });
      }
    } else if (workoutId) {
      // Crear ejecución si no existe (caso vencido sin iniciar)
      const existing = await base44.asServiceRole.entities.ComplementaryStrengthExecution.filter(
        { workout_id: workoutId, player_id: playerId },
        "-created_date",
        1
      );
      execution = existing[0];
      if (!execution) {
        const workout = await base44.asServiceRole.entities.ComplementaryStrengthWorkout.get(workoutId).catch(() => null);
        if (!workout) return Response.json({ error: 'Entrenamiento no encontrado' }, { status: 404 });
        const plan = await base44.asServiceRole.entities.ComplementaryStrengthPlan.get(workout.plan_id).catch(() => null);
        const player = await base44.asServiceRole.entities.Player.get(playerId).catch(() => null);
        execution = await base44.asServiceRole.entities.ComplementaryStrengthExecution.create({
          organization_id: plan?.organization_id || '',
          plan_id: workout.plan_id,
          workout_id: workoutId,
          player_id: playerId,
          player_name: player ? `${player.first_name} ${player.last_name}`.trim() : '',
          squad_id: tokenRecord.squad_id || '',
          workout_date: workout.workout_date,
          status: 'not_completed',
        });
      }
    } else {
      return Response.json({ error: 'Ejecución o entrenamiento requerido' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const updated = await base44.asServiceRole.entities.ComplementaryStrengthExecution.update(execution.id, {
      status: 'not_completed',
      not_completed_reason: reason,
      not_completed_comment: comment,
      not_completed_at: now,
      not_completed_source: 'player',
    });

    return Response.json({ ok: true, execution: updated });
  } catch (error) {
    console.error('reportComplementaryNotDone error:', error);
    return Response.json({ error: error.message || 'Error al registrar' }, { status: 500 });
  }
}