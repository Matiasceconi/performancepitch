import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlayerFromToken, applyOverride } from "../../shared/complementaryStrength.ts";

// Devuelve el detalle completo de un entrenamiento complementario para el jugador
// autenticado, con los overrides individuales aplicados. Verifica asignación al plan.
// Si ya existe ejecución iniciada, devuelve el snapshot congelado en su lugar.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const auth = await resolvePlayerFromToken(base44, body.token);
    if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

    const { tokenRecord, today, context } = auth;
    const playerId = tokenRecord.player_id;
    const workoutId = String(body.workout_id || '');
    if (!workoutId) return Response.json({ error: 'Entrenamiento requerido' }, { status: 400 });

    const workout = await base44.asServiceRole.entities.ComplementaryStrengthWorkout.get(workoutId).catch(() => null);
    if (!workout) return Response.json({ error: 'Entrenamiento no encontrado' }, { status: 404 });

    const plan = await base44.asServiceRole.entities.ComplementaryStrengthPlan.get(workout.plan_id).catch(() => null);
    if (!plan) return Response.json({ error: 'Plan no encontrado' }, { status: 404 });

    // Verificar asignación
    const assignments = await base44.asServiceRole.entities.ComplementaryStrengthPlanAssignment.filter(
      { plan_id: workout.plan_id, player_id: playerId, status: 'active' },
      "-assigned_at",
      1
    );
    if (!assignments[0]) return Response.json({ error: 'No estás asignado a este plan' }, { status: 403 });

    // Si hay ejecución iniciada, devolver el snapshot congelado
    const execs = await base44.asServiceRole.entities.ComplementaryStrengthExecution.filter(
      { workout_id: workoutId, player_id: playerId },
      "-created_date",
      1
    );
    const execution = execs[0];

    const isToday = workout.workout_date === today;
    const isPast = workout.workout_date < today;
    const isFuture = workout.workout_date > today;

    let blocks, snapshotUsed;
    if (execution?.workout_snapshot && (execution.status === 'in_progress' || execution.status === 'rpe_pending' || execution.status === 'completed')) {
      // Usar snapshot congelado
      blocks = execution.workout_snapshot.blocks;
      snapshotUsed = true;
    } else {
      // Construir prescripción efectiva en vivo
      const rawBlocks = await base44.asServiceRole.entities.ComplementaryStrengthBlock.filter(
        { workout_id: workoutId },
        "sort_order",
        100
      );
      const exercises = await base44.asServiceRole.entities.ComplementaryStrengthPlanExercise.filter(
        { workout_id: workoutId },
        "sort_order",
        500
      );
      const exerciseIds = exercises.map((e) => e.id);
      let overrides = [];
      for (let i = 0; i < exerciseIds.length; i += 50) {
        const batch = exerciseIds.slice(i, i + 50);
        const rows = await base44.asServiceRole.entities.ComplementaryStrengthPlayerOverride.filter(
          { plan_exercise_id: { $in: batch }, player_id: playerId },
          "-updated_date",
          500
        );
        overrides.push(...rows);
      }
      const ovByEx = {};
      overrides.forEach((o) => { ovByEx[o.plan_exercise_id] = o; });

      blocks = rawBlocks
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((block) => ({
          id: block.id,
          block_type: block.block_type,
          name: block.name,
          instructions: block.instructions,
          sort_order: block.sort_order,
          exercises: exercises
            .filter((e) => e.block_id === block.id)
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map((ex) => applyOverride(ex, ovByEx[ex.id]))
            .filter(Boolean),
        }));
      snapshotUsed = false;
    }

    return Response.json({
      ok: true,
      workout: {
        id: workout.id,
        plan_id: workout.plan_id,
        plan_name: plan.name,
        title: workout.title || plan.name,
        workout_date: workout.workout_date,
        objective: workout.objective || '',
        estimated_duration_minutes: workout.estimated_duration_minutes || null,
        instructions: workout.instructions || '',
        general_instructions: plan.general_instructions || '',
      },
      blocks,
      execution: execution ? {
        id: execution.id,
        status: execution.status,
        started_at: execution.started_at,
        rpe: execution.rpe,
        not_completed_reason: execution.not_completed_reason,
      } : null,
      snapshot_used: snapshotUsed,
      is_today: isToday,
      is_future: isFuture,
      is_past: isPast,
    });
  } catch (error) {
    console.error('getComplementaryWorkoutDetail error:', error);
    return Response.json({ error: error.message || 'Error al cargar el entrenamiento' }, { status: 500 });
  }
}