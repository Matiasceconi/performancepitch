import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveStaffAccess } from "../../shared/playerPortalAuth.ts";
import { resolveSquadRosterForDate } from "../../shared/squadRosterResolver.ts";
import { getTodayInTimezone } from "../../shared/playerAccessUtils.ts";
import { computeEffectiveStatus } from "../../shared/complementaryStrength.ts";

// Devuelve todos los planes complementarios de un plantel con su estructura
// completa (workouts, blocks, exercises, assignments, executions) para el PF.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
    const staff = await resolveStaffAccess(base44, user);
    if (!staff) return Response.json({ error: 'Sin permisos de staff' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const squadId = String(body.squad_id || '');
    const includeTemplates = body.include_templates !== false;
    if (!squadId) return Response.json({ error: 'Plantel requerido' }, { status: 400 });

    const today = getTodayInTimezone();

    // Planes del plantel (no plantillas) + plantillas globales si se piden
    const planFilter = { squad_id: squadId };
    let plans = await base44.asServiceRole.entities.ComplementaryStrengthPlan.filter(
      planFilter,
      "-updated_date",
      500
    );
    if (includeTemplates) {
      const templates = await base44.asServiceRole.entities.ComplementaryStrengthPlan.filter(
        { is_template: true },
        "-updated_date",
        200
      );
      plans = [...plans, ...templates];
    }

    const planIds = plans.map((p) => p.id);

    // Asignaciones, workouts, bloques, ejercicios, overrides, ejecuciones
    let assignments = [], workouts = [], blocks = [], exercises = [], overrides = [], executions = [];
    for (let i = 0; i < planIds.length; i += 50) {
      const batch = planIds.slice(i, i + 50);
      const [a, w, o] = await Promise.all([
        base44.asServiceRole.entities.ComplementaryStrengthPlanAssignment.filter({ plan_id: { $in: batch }, status: 'active' }, "-assigned_at", 500),
        base44.asServiceRole.entities.ComplementaryStrengthWorkout.filter({ plan_id: { $in: batch } }, "workout_date", 500),
        base44.asServiceRole.entities.ComplementaryStrengthExecution.filter({ plan_id: { $in: batch } }, "-created_date", 1000),
      ]);
      assignments.push(...a); workouts.push(...w); executions.push(...o);
    }

    const workoutIds = workouts.map((w) => w.id);
    for (let i = 0; i < workoutIds.length; i += 50) {
      const batch = workoutIds.slice(i, i + 50);
      const [b, e] = await Promise.all([
        base44.asServiceRole.entities.ComplementaryStrengthBlock.filter({ workout_id: { $in: batch } }, "sort_order", 500),
        base44.asServiceRole.entities.ComplementaryStrengthPlanExercise.filter({ workout_id: { $in: batch } }, "sort_order", 2000),
      ]);
      blocks.push(...b); exercises.push(...e);
    }

    const exerciseIds = exercises.map((e) => e.id);
    for (let i = 0; i < exerciseIds.length; i += 50) {
      const batch = exerciseIds.slice(i, i + 50);
      const rows = await base44.asServiceRole.entities.ComplementaryStrengthPlayerOverride.filter(
        { plan_exercise_id: { $in: batch } },
        "-updated_date",
        2000
      );
      overrides.push(...rows);
    }

    // Jugadores del plantel operativo para el "Hoy"
    const rosterRows = await resolveSquadRosterForDate(base44, squadId, today);
    const roster = rosterRows.map((r) => r.player);

    // Mapear ejecuciones por workout+player
    const execByKey = {};
    executions.forEach((e) => { execByKey[`${e.workout_id}:${e.player_id}`] = e; });

    // Construir estructura anidada por plan
    const plansStructured = plans.map((plan) => {
      const planWorkouts = workouts
        .filter((w) => w.plan_id === plan.id)
        .sort((a, b) => (a.workout_date || '').localeCompare(b.workout_date || ''))
        .map((w) => {
          const wBlocks = blocks
            .filter((b) => b.workout_id === w.id)
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map((b) => {
              const bEx = exercises
                .filter((e) => e.block_id === b.id)
                .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                .map((e) => ({
                  ...e,
                  overrides: overrides.filter((o) => o.plan_exercise_id === e.id),
                }));
              return { ...b, exercises: bEx };
            });
          return { ...w, blocks: wBlocks };
        });
      return {
        ...plan,
        assignments: assignments.filter((a) => a.plan_id === plan.id),
        workouts: planWorkouts,
      };
    });

    // ── Tabla "Hoy": un registro por jugador × workout de hoy ───────────────
    const todayWorkouts = workouts.filter((w) => w.workout_date === today && w.status === 'published');
    const todayRows = [];
    for (const w of todayWorkouts) {
      const plan = plans.find((p) => p.id === w.plan_id);
      if (!plan || plan.status !== 'published') continue;
      const planAssignments = assignments.filter((a) => a.plan_id === w.plan_id);
      const assignedPlayerIds = new Set(planAssignments.map((a) => a.player_id));
      const rosterForWorkout = roster.filter((p) => assignedPlayerIds.has(p.id));
      for (const p of rosterForWorkout) {
        const exec = execByKey[`${w.id}:${p.id}`];
        const status = exec
          ? computeEffectiveStatus(exec, w.workout_date, today)
          : 'available_today';
        todayRows.push({
          player_id: p.id,
          player_name: `${p.first_name} ${p.last_name}`.trim(),
          photo_url: p.photo_url || '',
          position: p.position || '',
          squad_id: squadId,
          plan_id: w.plan_id,
          plan_name: plan.name,
          workout_id: w.id,
          workout_title: w.title || plan.name,
          status,
          started_at: exec?.started_at || null,
          exercises_finished_at: exec?.exercises_finished_at || null,
          rpe: exec?.rpe ?? null,
          not_completed_reason: exec?.not_completed_reason || null,
          completed_late: exec?.completed_late || false,
        });
      }
    }

    return Response.json({
      ok: true,
      plans: plansStructured,
      today_rows: todayRows,
      roster,
      today,
    });
  } catch (error) {
    console.error('getComplementaryStrengthData error:', error);
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}