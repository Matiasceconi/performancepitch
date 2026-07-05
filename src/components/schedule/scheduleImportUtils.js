import moment from "moment";
import { base44 } from "@/api/base44Client";

export const EVENT_TYPES = ["Entrenamiento", "Partido", "Descanso", "Viaje", "Comida", "Video", "Gimnasio", "Cancha", "Reunión", "Otro"];
export const TYPE_COLORS = { Partido: "red", Descanso: "cyan", Viaje: "purple", Comida: "orange", Video: "blue", Gimnasio: "purple", Cancha: "green", Entrenamiento: "green", Reunión: "yellow", Otro: "blue" };

export function emptyPreviewEvent(date = moment().format("YYYY-MM-DD")) {
  return { title: "", date, start_time: "", end_time: "", event_type: "Otro", location: "", notes: "", rival: "", home_away: "", rival_logo_url: "" };
}

function cleanTime(value) {
  const text = String(value || "").trim();
  const match = text.match(/(\d{1,2})[:.](\d{2})/);
  if (!match) return "";
  return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
}

function durationMinutes(start, end) {
  if (!start || !end) return undefined;
  const a = moment(start, "HH:mm");
  const b = moment(end, "HH:mm");
  const diff = b.diff(a, "minutes");
  return diff > 0 ? diff : undefined;
}

function normalizeType(value, title = "") {
  const text = `${value || ""} ${title || ""}`.toLowerCase();
  if (text.includes("partido") || text.includes("vs ")) return "Partido";
  if (text.includes("descanso") || text.includes("libre")) return "Descanso";
  if (text.includes("viaje") || text.includes("traslado")) return "Viaje";
  if (text.includes("desayuno") || text.includes("almuerzo") || text.includes("cena") || text.includes("comida")) return "Comida";
  if (text.includes("video") || text.includes("auditorio")) return "Video";
  if (text.includes("gimnasio") || text.includes("gym")) return "Gimnasio";
  if (text.includes("cancha") || text.includes("entrenamiento")) return "Entrenamiento";
  if (text.includes("reunión") || text.includes("reunion") || text.includes("charla")) return "Reunión";
  return EVENT_TYPES.includes(value) ? value : "Otro";
}

function normalizeHomeAway(value) {
  const text = String(value || "").toLowerCase().trim();
  if (["local", "l", "casa"].includes(text)) return "Local";
  if (["visitante", "visita", "v", "away"].includes(text)) return "Visitante";
  if (["neutral", "n"].includes(text)) return "Neutral";
  return "";
}

export function normalizeAiEvents(rawEvents = [], fallbackDate) {
  return rawEvents.map((ev) => {
    const title = String(ev.title || ev.activity || ev.actividad || ev.name || "").trim();
    const event_type = normalizeType(ev.event_type || ev.type || ev.tipo, title);
    return {
      title: title || event_type,
      date: moment(ev.date || ev.fecha || fallbackDate).isValid() ? moment(ev.date || ev.fecha || fallbackDate).format("YYYY-MM-DD") : fallbackDate,
      start_time: cleanTime(ev.start_time || ev.time || ev.hora_inicio || ev.horario),
      end_time: cleanTime(ev.end_time || ev.hora_fin),
      event_type,
      location: ev.location || ev.lugar || "",
      notes: ev.notes || ev.observaciones || "",
      rival: ev.rival || "",
      home_away: normalizeHomeAway(ev.home_away || ev.condicion),
      rival_logo_url: ev.rival_logo_url || "",
    };
  }).filter((ev) => ev.title && ev.date);
}

export async function analyzeScheduleFile({ file, activeSquad }) {
  const upload = await base44.integrations.Core.UploadFile({ file });
  const schema = { type: "object", properties: { squad_name: { type: "string" }, week_start: { type: "string" }, week_end: { type: "string" }, events: { type: "array", items: { type: "object", properties: { title: { type: "string" }, date: { type: "string" }, day: { type: "string" }, start_time: { type: "string" }, end_time: { type: "string" }, event_type: { type: "string" }, location: { type: "string" }, notes: { type: "string" }, rival: { type: "string" }, home_away: { type: "string" } } } } } };
  const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({ file_url: upload.file_url, json_schema: schema });
  if (extracted.status === "error") throw new Error(extracted.details || "No se pudo leer el cronograma.");
  const output = Array.isArray(extracted.output) ? { events: extracted.output } : (extracted.output || {});
  const fallbackDate = moment(output.week_start || undefined).isValid() ? moment(output.week_start).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");
  return { source_file: upload.file_url, source_file_name: file.name, squad_name: output.squad_name || activeSquad?.name || "", events: normalizeAiEvents(output.events || [], fallbackDate) };
}

function importKey({ squad_id, date, time, type }) { return [squad_id || "", date || "", time || "", type || ""].join("|"); }

export async function upsertImportedEvents({ previewEvents, activeSquad, activeSquadId, activeSeasonId, sourceFile, sourceFileName }) {
  const existingRaw = await base44.entities.DayEvent.filter({ squad_id: activeSquadId }, "date", 500);
  const existing = existingRaw.filter((ev) => !ev.season_id || !activeSeasonId || ev.season_id === activeSeasonId);
  const byKey = Object.fromEntries(existing.map((ev) => [importKey({ squad_id: ev.squad_id, date: ev.date, time: ev.time || ev.start_time || "", type: ev.type || ev.event_type || "" }), ev]));
  const saved = [];
  for (const ev of previewEvents) {
    const type = ev.event_type || ev.type || "Otro";
    const time = ev.start_time || ev.time || "";
    const payload = { ...ev, home_away: normalizeHomeAway(ev.home_away), squad_id: activeSquadId, squad_name: activeSquad?.name || "", season_id: activeSeasonId || activeSquad?.season || "", time, start_time: time, type, event_type: type, duration_minutes: durationMinutes(time, ev.end_time), color: TYPE_COLORS[type] || "blue", source_file: sourceFile, source_file_name: sourceFileName, created_by_ai: true };
    payload.import_key = importKey({ squad_id: activeSquadId, date: payload.date, time, type });
    const current = byKey[payload.import_key];
    if (!payload.duration_minutes) delete payload.duration_minutes;
    if (current) {
      await base44.entities.DayEvent.update(current.id, payload);
      saved.push({ ...payload, id: current.id });
    } else {
      const created = await base44.entities.DayEvent.create(payload);
      saved.push(created || payload);
    }
  }
  await syncWeeklyPlanFromEvents({ events: saved, activeSquad, activeSquadId, activeSeasonId });
  return saved;
}

function plannerEmptyDay(date) { return { date, md: "— MD —", objetivo: "—", sesionGimnasio: "", trabajoCompensatorio: "—", vueltaCalma: [], observaciones: "", tareasTecnico: [""], calendar_events: [] }; }
function goalFromEvents(events) { if (events.some(e => e.event_type === "Partido")) return "Activación"; if (events.some(e => e.event_type === "Descanso")) return "Recuperación"; if (events.some(e => ["Entrenamiento", "Cancha"].includes(e.event_type))) return "Táctica"; return "—"; }

async function syncWeeklyPlanFromEvents({ events, activeSquad, activeSquadId, activeSeasonId }) {
  if (!events.length) return;
  const weekStart = moment.min(events.map(e => moment(e.date))).startOf("isoWeek").format("YYYY-MM-DD");
  const weekEnd = moment(weekStart).add(6, "days").format("YYYY-MM-DD");
  const weekEventsRaw = await base44.entities.DayEvent.filter({ squad_id: activeSquadId }, "date", 500);
  const weekEvents = weekEventsRaw.filter(e => e.date >= weekStart && e.date <= weekEnd && (!e.season_id || !activeSeasonId || e.season_id === activeSeasonId));
  const records = await base44.entities.WeeklyPlan.filter({ week_start: weekStart });
  const current = records.find(r => r.squad_id === activeSquadId && (!r.season_id || !activeSeasonId || r.season_id === activeSeasonId));
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = moment(weekStart).add(i, "days").format("YYYY-MM-DD");
    const previous = current?.days_data?.find(d => d.date === date) || plannerEmptyDay(date);
    const dayEvents = weekEvents.filter(e => e.date === date).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    if (!dayEvents.length) return previous;
    const summary = dayEvents.map(e => `${e.time ? e.time + " " : ""}${e.title}`).join(" · ");
    return { ...previous, date, objetivo: previous.objetivo && previous.objetivo !== "—" ? previous.objetivo : goalFromEvents(dayEvents), calendar_events: dayEvents.map(e => ({ id: e.id, title: e.title, time: e.time, type: e.event_type, location: e.location })), has_match: dayEvents.some(e => e.event_type === "Partido"), has_trip: dayEvents.some(e => e.event_type === "Viaje"), has_rest: dayEvents.some(e => e.event_type === "Descanso"), has_training: dayEvents.some(e => ["Entrenamiento", "Cancha", "Gimnasio"].includes(e.event_type)), observaciones: [previous.observaciones, `Calendario: ${summary}`].filter(Boolean).join("\n") };
  });
  const payload = { week_start: weekStart, squad_id: activeSquadId, squad_name: activeSquad?.name || "", season_id: activeSeasonId || activeSquad?.season || "", days_data: days };
  if (current) await base44.entities.WeeklyPlan.update(current.id, payload); else await base44.entities.WeeklyPlan.create(payload);
}