import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlayerFromToken, buildWorkoutSnapshot } from "../../shared/complementaryStrength.ts";

// Inicia un entrenamiento complementario para el jugador autenticado.
// Verifica publicación, asignación, fecha = hoy, y crea la ejecución
// idempotentemente con un snapshot congelado de la prescripción efectiva.
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

    // 1. Obtener el entrenamiento
    const workout = await base44.asServiceRole.entities.ComplementaryStrengthWorkout.get(workoutId).catch(() => null);
    if (!workout) return Response.json({ error: 'Entrenamiento no encontrado' }, { status: 404 });
    if (workout.status !== 'published') return Response.json({ error: 'El entrenamiento no está publicado' }, { status: 403 });

    // 2. Verificar fecha = hoy (America/Argentina/Buenos_Aires)
    if (workout.workout_date !== today) {
      return Response.json({ error: 'Este entrenamiento no corresponde al día de hoy' }, { status: 403 });
    }

    // 3. Verificar asignación del jugador al plan
    const planId = workout.plan_id;
    const assignments = await base44.asServiceRole.entities.ComplementaryStrengthPlanAssignment.filter(
      { plan_id: planId, player_id: playerId, status: 'active' },
      "-assigned_at",
      1
    );
    if (!assignments[0]) return Response.json({ error: 'No estás asignado a este plan' }, { status: 403 });

    // 4. Verificar plan publicado
    const plan = await base44.asServiceRole.entities.ComplementaryStrengthPlan.get(planId).catch(() => null);
    if (!plan || plan.status !== 'published') return Response.json({ error: 'El plan no está publicado' }, { status: 403 });

    // 5. Idempotencia: si ya existe ejecución, devolverla
    const existing = await base44.asServiceRole.entities.ComplementaryStrengthExecution.filter(
      { workout_id: workoutId, player_id: playerId },
      "-created_date",
      1
    );
    if (existing[0]) {
      return Response.json({ ok: true, execution: existing[0], already_started: true });
    }

    // 6. Construir snapshot congelado
    const blocks = await base44.asServiceRole.entities.ComplementaryStrengthBlock.filter(
      { workout_id: workoutId },
      "sort_order",
      100
    );
    const exercises = await base44.asServiceRole.entities.ComplementaryStrengthPlanExercise.filter(
      { workout_id: workoutId },
      "sort_order",
      500
    );

    // Overrides del jugador
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
    const overridesByExercise = {};
    overrides.forEach((o) => { overridesByExercise[o.plan_exercise_id] = o; });

    const snapshot = await buildWorkoutSnapshot(base44, workout, blocks, exercises, overridesByExercise, context.player);

    // 7. Crear ejecución
    const now = new Date().toISOString();
    const execution = await base44.asServiceRole.entities.ComplementaryStrengthExecution.create({
      organization_id: plan.organization_id || context.organization_id || '',
      plan_id: planId,
      workout_id: workoutId,
      player_id: playerId,
      player_name: `${context.player.first_name} ${context.player.last_name}`.trim(),
      squad_id: context.squad_id || '',
      workout_date: workout.workout_date,
      status: 'in_progress',
      workout_snapshot: snapshot,
      snapshot_version: plan.version || 1,
      started_at: now,
    });

    return Response.json({ ok: true, execution });
  } catch (error) {
    console.error('startComplementaryWorkout error:', error);
    return Response.json({ error: error.message || 'Error al iniciar el entrenamiento' }, { status: 500 });
  }
}