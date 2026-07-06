import { base44 } from "@/api/base44Client";
import moment from "moment";

export function normalizeExerciseName(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function num(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function tags(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function calcArea(form) {
  const length = num(form.length_m);
  const width = num(form.width_m);
  const players = num(form.players_count);
  const total_area = length && width ? parseFloat((length * width).toFixed(1)) : undefined;
  const eii = total_area && players ? parseFloat((total_area / players).toFixed(2)) : undefined;
  return { total_area, eii };
}

export function buildFieldLibraryPayload(form, sessionId, squadId, squadName) {
  const { total_area, eii } = calcArea(form);
  return {
    name: form.name,
    normalized_name: normalizeExerciseName(form.name),
    type: form.type || undefined,
    category: form.category || undefined,
    objective: form.objective || undefined,
    description: form.description || undefined,
    length_m: num(form.length_m),
    width_m: num(form.width_m),
    total_area,
    eii,
    players_count: num(form.players_count),
    duration_min: num(form.duration_min),
    blocks: num(form.blocks),
    work_time: form.work_time || undefined,
    rest_time: form.rest_time || undefined,
    image_url: form.image_url || undefined,
    video_url: form.video_url || undefined,
    external_load_summary: form.external_load_summary || undefined,
    notes: form.notes || undefined,
    tags: tags(form.tags),
    squad_id: squadId || undefined,
    squad_name: squadName || undefined,
    global: false,
    created_from_session_id: sessionId,
  };
}

function sameFieldTemplate(item, form, squadId) {
  return (item.global === true || item.squad_id === squadId) &&
    normalizeExerciseName(item.name) === normalizeExerciseName(form.name) &&
    String(item.objective || "") === String(form.objective || "") &&
    String(item.type || "") === String(form.type || "") &&
    Number(item.length_m || 0) === Number(num(form.length_m) || 0) &&
    Number(item.width_m || 0) === Number(num(form.width_m) || 0);
}

export async function syncToFieldLibrary(form, sessionId, squadId, squadName, options = {}) {
  const today = moment().format("YYYY-MM-DD");
  const payload = buildFieldLibraryPayload(form, sessionId, squadId, squadName);
  if (options.updateExistingId) {
    const { global, squad_id, squad_name, created_from_session_id, ...updatePayload } = payload;
    await base44.entities.FieldExerciseLibrary.update(options.updateExistingId, { ...updatePayload, last_used_at: today });
    return options.updateExistingId;
  }
  const all = await base44.entities.FieldExerciseLibrary.list("-times_used", 500);
  const match = all.find((item) => sameFieldTemplate(item, form, squadId));
  if (match) {
    const matchUpdate = {
      times_used: (match.times_used || 1) + (options.incrementUsage === false ? 0 : 1),
      last_used_at: today,
    };
    if (!match.image_url && payload.image_url) matchUpdate.image_url = payload.image_url;
    await base44.entities.FieldExerciseLibrary.update(match.id, matchUpdate);
    return match.id;
  }
  const created = await base44.entities.FieldExerciseLibrary.create({ ...payload, times_used: 1, first_created_at: today, last_used_at: today });
  return created.id;
}

export function fieldImportantChanged(original, form) {
  if (!original) return false;
  return ["name", "image_url", "video_url", "description", "external_load_summary"].some((key) => String(original[key] || "") !== String(form[key] || ""));
}

export function buildStrengthLibraryPayload(station, sessionId, squadId, squadName) {
  const name = station.exercise_name || station.name || "";
  return {
    name,
    normalized_name: normalizeExerciseName(name),
    method: station.method || undefined,
    exercise_type: station.exercise_type || undefined,
    description: station.description || undefined,
    volume: station.volume || undefined,
    image_url: station.image_url || undefined,
    video_url: station.video_url || undefined,
    restore_exercise: station.restore_exercise || undefined,
    compensate_exercise: station.compensate_exercise || undefined,
    sets: station.sets || undefined,
    reps: station.reps || undefined,
    time: station.time || undefined,
    rest_time: station.rest_time || undefined,
    rir: station.rir || undefined,
    objective: station.objective || undefined,
    muscle_group: station.muscle_group || undefined,
    vector_pattern: station.vector_pattern || undefined,
    notes: station.notes || undefined,
    tags: tags(station.tags),
    squad_id: squadId || undefined,
    squad_name: squadName || undefined,
    global: false,
    created_from_session_id: sessionId,
  };
}

function sameStrengthTemplate(item, station, squadId) {
  const name = station.exercise_name || station.name || "";
  return (item.global === true || item.squad_id === squadId) &&
    normalizeExerciseName(item.name) === normalizeExerciseName(name) &&
    String(item.method || "") === String(station.method || "") &&
    String(item.exercise_type || "") === String(station.exercise_type || "");
}

export async function syncToStrengthLibrary(station, sessionId, squadId, squadName, options = {}) {
  const today = moment().format("YYYY-MM-DD");
  const payload = buildStrengthLibraryPayload(station, sessionId, squadId, squadName);
  const linkedId = options.updateExistingId || station.library_strength_exercise_id || station.library_exercise_id;
  if (options.updateExistingId) {
    const { global, squad_id, squad_name, created_from_session_id, ...updatePayload } = payload;
    await base44.entities.StrengthExerciseLibrary.update(options.updateExistingId, { ...updatePayload, last_used_at: today });
    return options.updateExistingId;
  }
  const all = await base44.entities.StrengthExerciseLibrary.list("-times_used", 500);
  const match = linkedId ? all.find((item) => item.id === linkedId) : all.find((item) => sameStrengthTemplate(item, station, squadId));
  if (match) {
    await base44.entities.StrengthExerciseLibrary.update(match.id, {
      times_used: (match.times_used || 1) + (options.incrementUsage === false ? 0 : 1),
      last_used_at: today,
    });
    return match.id;
  }
  const created = await base44.entities.StrengthExerciseLibrary.create({ ...payload, times_used: 1, first_created_at: today, last_used_at: today });
  return created.id;
}

export async function updateFieldLibraryGpsSummary(libraryExerciseId) {
  if (!libraryExerciseId) return;
  const rows = await base44.entities.LibraryExerciseGPSData.filter({ library_exercise_id: libraryExerciseId }, "-session_date", 1000);
  const metrics = ["total_distance", "m_min", "distance_19_8", "distance_25", "sprints", "acc_3", "dec_3", "player_load", "smax"];
  const summary = { records: rows.length, sessions: new Set(rows.map((row) => row.session_id).filter(Boolean)).size };
  metrics.forEach((key) => {
    const values = rows.map((row) => Number(row[key] || 0)).filter((value) => value > 0);
    summary[`avg_${key}`] = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    summary[`max_${key}`] = values.length ? Math.max(...values) : null;
  });
  await base44.entities.FieldExerciseLibrary.update(libraryExerciseId, {
    historical_gps_summary: summary,
    external_load_summary: summary,
    last_gps_sync_at: new Date().toISOString(),
  });
}