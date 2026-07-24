// Adaptador para importar datos desde TrainingSession y FieldExerciseLibrary.

import { createElement } from "./tacticalElementFactory";

// Construye metadata del proyecto desde una sesión
export function buildProjectMetaFromSession(session) {
  return {
    name: `Sesión ${session?.title || ""}`.trim(),
    description: session?.session_objective || "",
    default_mode: "exercise",
  };
}

// Construye metadata de la pizarra desde una sesión
export function buildBoardMetaFromSession(session) {
  return {
    name: session?.title || "Sesión",
    mode: "exercise",
    objective: session?.session_objective || "",
    notes: `MD: ${session?.match_day_code || "—"} · ${session?.date || ""}`,
  };
}

// Construye elementos desde un ejercicio de la biblioteca de campo
export function buildElementsFromFieldExercise(exercise) {
  const elements = [];
  const playerCount = exercise?.player_count || 0;
  // Distribuir jugadores en dos líneas
  for (let i = 0; i < playerCount; i++) {
    const x = 400 + (i % 4) * 120;
    const y = 300 + Math.floor(i / 4) * 120;
    elements.push(createElement("player", { x, y, data: { color: "#3b82f6" } }));
  }
  if (exercise?.image_url) {
    // No sobrescribir automáticamente; solo referencia
  }
  return elements;
}

// Construye metadata del proyecto desde un ejercicio
export function buildProjectMetaFromExercise(exercise) {
  return {
    name: exercise?.name || "Ejercicio",
    description: exercise?.description || exercise?.objective || "",
    default_mode: "exercise",
  };
}

// Construye metadata de la pizarra desde un ejercicio
export function buildBoardMetaFromExercise(exercise) {
  return {
    name: exercise?.name || "Ejercicio",
    mode: "exercise",
    objective: exercise?.objective || "",
    notes: `Jugadores: ${exercise?.player_count || "—"} · ${exercise?.duration_minutes || "—"} min`,
  };
}

// Construye metadata desde un WeeklyPlanDay
export function buildProjectMetaFromPlanDay(day) {
  return {
    name: `Pizarra ${day?.md_code || day?.date || ""}`.trim(),
    description: day?.physical_objective || "",
    default_mode: "tactical",
  };
}

export function buildBoardMetaFromPlanDay(day) {
  return {
    name: day?.md_code || "Día",
    mode: "tactical",
    objective: day?.physical_objective || "",
    notes: day?.date || "",
  };
}