import { base44 } from "@/api/base44Client";
import moment from "moment";

export const METHOD_OPTIONS = ["Dinámicos", "Balísticos", "Biseries", "Triseries", "Contrastes", "Excéntricos", "Isométricos", "Preventivos"];
export const TYPE_OPTIONS = ["Esfuerzos repetidos", "Esfuerzos dinámicos", "Antagonistas", "Potencia", "Fuerza máxima", "Pliométrico", "Preventivo", "Movilidad"];

function normalize(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// Crea o actualiza el ejercicio en la biblioteca cuando se carga un nombre nuevo manualmente
export async function syncToLibrary(stationData, sessionId, squadId, squadName) {
  const name = stationData.exercise_name || "";
  if (!name) return;
  const today = moment().format("YYYY-MM-DD");
  const existing = await base44.entities.StrengthExerciseLibrary.filter({}, "-times_used", 500);
  const match = existing.find(e => normalize(e.name) === normalize(name) && (e.global === true || e.squad_id === squadId));
  if (match) {
    await base44.entities.StrengthExerciseLibrary.update(match.id, {
      times_used: (match.times_used || 1) + 1,
      last_used_at: today,
    });
  } else {
    await base44.entities.StrengthExerciseLibrary.create({
      name,
      method: stationData.method || undefined,
      exercise_type: stationData.exercise_type || undefined,
      volume: stationData.volume || undefined,
      image_url: stationData.image_url || undefined,
      notes: stationData.notes || undefined,
      squad_id: squadId || undefined,
      squad_name: squadName || undefined,
      global: false,
      times_used: 1,
      first_created_at: today,
      last_used_at: today,
      created_from_session_id: sessionId,
    });
  }
}