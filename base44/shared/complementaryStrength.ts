// Helpers compartidos para el módulo de Fuerza Complementaria.
// Todas las funciones del portal obtienen player_id desde el token de DNI,
// nunca desde el frontend.

import { hashToken, getTodayInTimezone } from "./playerAccessUtils.ts";
import { resolvePlayerContextForDate } from "./squadRosterResolver.ts";

const TZ = "America/Argentina/Buenos_Aires";

export const NOT_COMPLETED_REASONS = [
  "dolor_molestia",
  "indicacion_medica",
  "decision_cuerpo_tecnico",
  "falta_tiempo",
  "no_asistio",
  "sin_equipamiento",
  "otro",
];

export const NOT_COMPLETED_REASON_LABELS = {
  dolor_molestia: "Dolor o molestia",
  indicacion_medica: "Indicación médica o de kinesiología",
  decision_cuerpo_tecnico: "Decisión del cuerpo técnico",
  falta_tiempo: "Falta de tiempo",
  no_asistio: "No asistió",
  sin_equipamiento: "No tenía equipamiento",
  otro: "Otro",
};

// Resuelve el jugador desde el token de acceso diario.
// Verifica vigencia, fecha y devuelve el contexto operativo del plantel.
export async function resolvePlayerFromToken(base44, token) {
  if (!token) return { error: "Token requerido", status: 400 };
  const tokenHash = await hashToken(String(token));
  const rows = await base44.asServiceRole.entities.DailyCheckinToken.filter(
    { record_type: "token", token_hash: tokenHash, active: true },
    "-created_at",
    1
  );
  const tokenRecord = rows[0];
  if (!tokenRecord) return { error: "Sesión expirada. Ingresá tu DNI nuevamente.", status: 401 };

  const now = new Date();
  if (new Date(tokenRecord.expires_at) < now) {
    await base44.asServiceRole.entities.DailyCheckinToken.update(tokenRecord.id, { active: false });
    return { error: "Sesión expirada. Ingresá tu DNI nuevamente.", status: 401 };
  }

  const today = getTodayInTimezone(TZ);
  if (tokenRecord.checkin_date !== today) {
    await base44.asServiceRole.entities.DailyCheckinToken.update(tokenRecord.id, { active: false });
    return { error: "La sesión corresponde a otro día. Ingresá tu DNI nuevamente.", status: 401 };
  }

  const context = await resolvePlayerContextForDate(base44, tokenRecord.player_id, today);
  if (!context?.player) return { error: "Jugador no encontrado", status: 404 };

  return { tokenRecord, today, context };
}

// Construye la prescripción efectiva de un ejercicio para un jugador,
// aplicando el override individual si existe. Los campos sin override
// heredan el valor del plan base.
export function applyOverride(baseExercise, override) {
  if (!override) return { ...baseExercise, is_personalized: false, individual_note: "" };
  if (override.is_excluded) return null;
  const merged: any = {
    ...baseExercise,
    sets: override.sets != null ? override.sets : baseExercise.sets,
    repetitions: override.repetitions != null ? override.repetitions : baseExercise.repetitions,
    rest_seconds: override.rest_seconds != null ? override.rest_seconds : baseExercise.rest_seconds,
    prescribed_load_kg: override.prescribed_load_kg != null ? override.prescribed_load_kg : baseExercise.prescribed_load_kg,
    target_type: override.target_type != null ? override.target_type : baseExercise.target_type,
    target_value: override.target_value != null ? override.target_value : baseExercise.target_value,
    technical_instructions: override.technical_instructions != null ? override.technical_instructions : baseExercise.technical_instructions,
    is_personalized: true,
    individual_note: override.individual_note || "",
  };
  if (override.replacement_library_exercise_id) {
    merged.library_exercise_id = override.replacement_library_exercise_id;
    merged.library_exercise_name = override.replacement_library_exercise_name || merged.library_exercise_name;
  }
  return merged;
}

// Construye el snapshot completo y congelado de un entrenamiento para un jugador.
// Incluye plan, entrenamiento, bloques, ejercicios efectivos y metadatos.
export async function buildWorkoutSnapshot(base44, workout, blocks, exercises, overridesByExercise, player) {
  const visibleBlocks = blocks
    .filter((b) => b.workout_id === workout.id)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const snapshotBlocks = visibleBlocks.map((block) => {
    const blockExercises = exercises
      .filter((e) => e.block_id === block.id)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((ex) => applyOverride(ex, overridesByExercise[ex.id]))
      .filter(Boolean);
    return {
      id: block.id,
      block_type: block.block_type,
      name: block.name,
      instructions: block.instructions,
      sort_order: block.sort_order,
      exercises: blockExercises,
    };
  });

  return {
    workout: {
      id: workout.id,
      title: workout.title,
      objective: workout.objective,
      estimated_duration_minutes: workout.estimated_duration_minutes,
      instructions: workout.instructions,
      workout_date: workout.workout_date,
    },
    blocks: snapshotBlocks,
    player: { id: player.id, name: `${player.first_name} ${player.last_name}`.trim() },
    frozen_at: new Date().toISOString(),
  };
}

// Calcula el estado efectivo de una ejecución considerando la fecha local.
// Si el día pasó y no hay finalización válida → pending_expired.
export function computeEffectiveStatus(execution, workoutDate, today) {
  if (!execution) return null;
  const status = execution.status;
  if (status === "completed" || status === "not_completed") return status;
  if (status === "in_progress" || status === "rpe_pending") {
    // Si cambió el día, sigue en su estado (puede regularizar fuera de término)
    return status;
  }
  if (status === "available_today") {
    if (workoutDate < today) return "pending_expired";
    return "available_today";
  }
  return status;
}