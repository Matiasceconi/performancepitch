import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveStaffAccess } from "../../shared/playerPortalAuth.ts";

// Guarda (crea o actualiza) un plan complementario con toda su estructura anidada:
// asignaciones, workouts, bloques, ejercicios y overrides individuales.
// Upsert por id. No toca workouts con ejecuciones iniciadas al eliminar.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
    const staff = await resolveStaffAccess(base44, user);
    if (!staff) return Response.json({ error: 'Sin permisos de staff' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const planInput = body.plan || {};
    const assignmentsInput = body.assignments || [];
    const workoutsInput = body.workouts || [];
    const now = new Date().toISOString();

    if (!planInput.name) return Response.json({ error: 'Nombre del plan requerido' }, { status: 400 });

    // ── 1. Upsert plan header ──────────────────────────────────────────────
    let planId = planInput.id || '';
    const planPayload = {
      organization_id: planInput.organization_id || '',
      squad_id: planInput.squad_id || '',
      squad_name: planInput.squad_name || '',
      season_id: planInput.season_id || '',
      name: planInput.name,
      objective: planInput.objective || '',
      description: planInput.description || '',
      general_instructions: planInput.general_instructions || '',
      status: planInput.status || 'draft',
      is_template: !!planInput.is_template,
      source_plan_id: planInput.source_plan_id || '',
      created_by_name: user.full_name || user.email || '',
    };
    if (planId) {
      await base44.asServiceRole.entities.ComplementaryStrengthPlan.update(planId, planPayload);
    } else {
      planPayload.created_by = user.id || '';
      const created = await base44.asServiceRole.entities.ComplementaryStrengthPlan.create(planPayload);
      planId = created.id;
    }

    // ── 2. Asignaciones (full replace de activas) ──────────────────────────
    const existingAssignments = await base44.asServiceRole.entities.ComplementaryStrengthPlanAssignment.filter(
      { plan_id: planId, status: 'active' },
      "-assigned_at",
      500
    );
    const newPlayerIds = new Set(assignmentsInput.map((a) => a.player_id));
    for (const a of existingAssignments) {
      if (!newPlayerIds.has(a.player_id)) {
        await base44.asServiceRole.entities.ComplementaryStrengthPlanAssignment.update(a.id, { status: 'removed' });
      }
    }
    const existingPlayerIds = new Set(existingAssignments.map((a) => a.player_id));
    for (const a of assignmentsInput) {
      if (!existingPlayerIds.has(a.player_id)) {
        await base44.asServiceRole.entities.ComplementaryStrengthPlanAssignment.create({
          organization_id: planInput.organization_id || '',
          plan_id: planId,
          player_id: a.player_id,
          player_name: a.player_name || '',
          squad_id: planInput.squad_id || '',
          assigned_by: user.id || '',
          assigned_at: now,
          status: 'active',
        });
      }
    }

    // ── 3. Workouts / blocks / exercises / overrides (upsert + delete faltantes) ─
    const existingWorkouts = await base44.asServiceRole.entities.ComplementaryStrengthWorkout.filter(
      { plan_id: planId },
      "workout_date",
      500
    );
    const inputWorkoutIds = new Set(workoutsInput.map((w) => w.id).filter(Boolean));

    // Eliminar workouts no en el payload (solo si no tienen ejecuciones iniciadas)
    for (const w of existingWorkouts) {
      if (!inputWorkoutIds.has(w.id)) {
        const execs = await base44.asServiceRole.entities.ComplementaryStrengthExecution.filter(
          { workout_id: w.id, status: { $in: ['in_progress', 'rpe_pending'] } },
          "-created_date",
          1
        );
        if (!execs[0]) {
          // Borrar bloques y ejercicios huérfanos
          const wBlocks = await base44.asServiceRole.entities.ComplementaryStrengthBlock.filter({ workout_id: w.id }, "sort_order", 100);
          for (const b of wBlocks) {
            const bEx = await base44.asServiceRole.entities.ComplementaryStrengthPlanExercise.filter({ block_id: b.id }, "sort_order", 500);
            for (const e of bEx) {
              const ov = await base44.asServiceRole.entities.ComplementaryStrengthPlayerOverride.filter({ plan_exercise_id: e.id }, "-updated_date", 200);
              for (const o of ov) await base44.asServiceRole.entities.ComplementaryStrengthPlayerOverride.delete(o.id);
              await base44.asServiceRole.entities.ComplementaryStrengthPlanExercise.delete(e.id);
            }
            await base44.asServiceRole.entities.ComplementaryStrengthBlock.delete(b.id);
          }
          await base44.asServiceRole.entities.ComplementaryStrengthWorkout.delete(w.id);
        }
      }
    }

    for (let wi = 0; wi < workoutsInput.length; wi++) {
      const wInput = workoutsInput[wi];
      let workoutId = wInput.id || '';
      const workoutPayload = {
        organization_id: planInput.organization_id || '',
        plan_id: planId,
        workout_date: wInput.workout_date,
        title: wInput.title || '',
        objective: wInput.objective || '',
        estimated_duration_minutes: wInput.estimated_duration_minutes || null,
        instructions: wInput.instructions || '',
        status: wInput.status || 'draft',
        sort_order: wi,
      };
      if (workoutId) {
        await base44.asServiceRole.entities.ComplementaryStrengthWorkout.update(workoutId, workoutPayload);
      } else {
        const created = await base44.asServiceRole.entities.ComplementaryStrengthWorkout.create(workoutPayload);
        workoutId = created.id;
      }

      // Blocks
      const existingBlocks = await base44.asServiceRole.entities.ComplementaryStrengthBlock.filter({ workout_id: workoutId }, "sort_order", 100);
      const inputBlockIds = new Set((wInput.blocks || []).map((b) => b.id).filter(Boolean));
      for (const b of existingBlocks) {
        if (!inputBlockIds.has(b.id)) {
          const bEx = await base44.asServiceRole.entities.ComplementaryStrengthPlanExercise.filter({ block_id: b.id }, "sort_order", 500);
          for (const e of bEx) {
            const ov = await base44.asServiceRole.entities.ComplementaryStrengthPlayerOverride.filter({ plan_exercise_id: e.id }, "-updated_date", 200);
            for (const o of ov) await base44.asServiceRole.entities.ComplementaryStrengthPlayerOverride.delete(o.id);
            await base44.asServiceRole.entities.ComplementaryStrengthPlanExercise.delete(e.id);
          }
          await base44.asServiceRole.entities.ComplementaryStrengthBlock.delete(b.id);
        }
      }

      for (let bi = 0; bi < (wInput.blocks || []).length; bi++) {
        const bInput = wInput.blocks[bi];
        let blockId = bInput.id || '';
        const blockPayload = {
          organization_id: planInput.organization_id || '',
          workout_id: workoutId,
          block_type: bInput.block_type || 'main',
          name: bInput.name || '',
          instructions: bInput.instructions || '',
          sort_order: bi,
        };
        if (blockId) {
          await base44.asServiceRole.entities.ComplementaryStrengthBlock.update(blockId, blockPayload);
        } else {
          const created = await base44.asServiceRole.entities.ComplementaryStrengthBlock.create(blockPayload);
          blockId = created.id;
        }

        // Exercises
        const existingEx = await base44.asServiceRole.entities.ComplementaryStrengthPlanExercise.filter({ block_id: blockId }, "sort_order", 500);
        const inputExIds = new Set((bInput.exercises || []).map((e) => e.id).filter(Boolean));
        for (const e of existingEx) {
          if (!inputExIds.has(e.id)) {
            const ov = await base44.asServiceRole.entities.ComplementaryStrengthPlayerOverride.filter({ plan_exercise_id: e.id }, "-updated_date", 200);
            for (const o of ov) await base44.asServiceRole.entities.ComplementaryStrengthPlayerOverride.delete(o.id);
            await base44.asServiceRole.entities.ComplementaryStrengthPlanExercise.delete(e.id);
          }
        }

        for (let ei = 0; ei < (bInput.exercises || []).length; ei++) {
          const eInput = bInput.exercises[ei];
          let exId = eInput.id || '';
          const exPayload = {
            organization_id: planInput.organization_id || '',
            plan_id: planId,
            workout_id: workoutId,
            block_id: blockId,
            library_exercise_id: eInput.library_exercise_id || '',
            library_exercise_name: eInput.library_exercise_name || '',
            library_exercise_image: eInput.library_exercise_image || '',
            library_exercise_video: eInput.library_exercise_video || '',
            sort_order: ei,
            sets: eInput.sets != null ? Number(eInput.sets) : null,
            repetitions: eInput.repetitions || '',
            rest_seconds: eInput.rest_seconds != null ? Number(eInput.rest_seconds) : null,
            prescribed_load_kg: eInput.prescribed_load_kg != null ? Number(eInput.prescribed_load_kg) : null,
            target_type: eInput.target_type || 'none',
            target_value: eInput.target_value || '',
            technical_instructions: eInput.technical_instructions || '',
            general_note: eInput.general_note || '',
          };
          if (exId) {
            await base44.asServiceRole.entities.ComplementaryStrengthPlanExercise.update(exId, exPayload);
          } else {
            const created = await base44.asServiceRole.entities.ComplementaryStrengthPlanExercise.create(exPayload);
            exId = created.id;
          }

          // Overrides
          const existingOv = await base44.asServiceRole.entities.ComplementaryStrengthPlayerOverride.filter({ plan_exercise_id: exId }, "-updated_date", 200);
          const ovByKey = {};
          existingOv.forEach((o) => { ovByKey[o.player_id] = o; });
          for (const oInput of (eInput.overrides || [])) {
            const existing = ovByKey[oInput.player_id];
            const ovPayload = {
              organization_id: planInput.organization_id || '',
              plan_exercise_id: exId,
              workout_id: workoutId,
              player_id: oInput.player_id,
              sets: oInput.sets != null ? Number(oInput.sets) : null,
              repetitions: oInput.repetitions || null,
              rest_seconds: oInput.rest_seconds != null ? Number(oInput.rest_seconds) : null,
              prescribed_load_kg: oInput.prescribed_load_kg != null ? Number(oInput.prescribed_load_kg) : null,
              target_type: oInput.target_type || null,
              target_value: oInput.target_value || null,
              technical_instructions: oInput.technical_instructions || null,
              is_excluded: !!oInput.is_excluded,
              replacement_library_exercise_id: oInput.replacement_library_exercise_id || '',
              replacement_library_exercise_name: oInput.replacement_library_exercise_name || '',
              individual_note: oInput.individual_note || '',
            };
            if (existing) {
              await base44.asServiceRole.entities.ComplementaryStrengthPlayerOverride.update(existing.id, ovPayload);
            } else {
              await base44.asServiceRole.entities.ComplementaryStrengthPlayerOverride.create(ovPayload);
            }
          }
        }
      }
    }

    return Response.json({ ok: true, plan_id: planId });
  } catch (error) {
    console.error('saveComplementaryStrengthPlan error:', error);
    return Response.json({ error: error.message || 'Error al guardar el plan' }, { status: 500 });
  }
}