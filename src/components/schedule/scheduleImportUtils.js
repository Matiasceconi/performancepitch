import moment from "moment";
import { base44 } from "@/api/base44Client";
import { normalizeClubText, clubMatchesQuery, patchFromClub } from "@/lib/rivalClubs";

export const EVENT_TYPES = ["Entrenamiento", "Partido", "Descanso", "Viaje", "Comida", "Video", "Gimnasio", "Cancha", "Reunión", "Otro"];
export const TYPE_COLORS = { Partido: "red", Descanso: "cyan", Viaje: "purple", Comida: "orange", Video: "blue", Gimnasio: "purple", Cancha: "green", Entrenamiento: "green", Reunión: "yellow", Otro: "blue" };

export function emptyPreviewEvent(date = moment().format("YYYY-MM-DD")) {
  return { title: "", date, start_time: "", end_time: "", event_type: "Otro", location: "", notes: "", rival: "", rival_club_id: "", home_away: "", rival_logo_url: "", is_rest_day: false, warning: "" };
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
  if (text.includes("viaje") || text.includes("traslado") || text.includes("llegada")) return "Viaje";
  if (text.includes("desayuno") || text.includes("almuerzo") || text.includes("cena") || text.includes("comida")) return "Comida";
  if (text.includes("video") || text.includes("auditorio")) return "Video";
  if (text.includes("gimnasio") || text.includes("gym") || text.includes("fuerza")) return "Gimnasio";
  if (text.includes("cancha") || text.includes("entrenamiento")) return "Cancha";
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

const MONTHS_ES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function monthFromText(...values) {
  const text = normalizeText(values.filter(Boolean).join(" "));
  for (const [name, month] of Object.entries(MONTHS_ES)) if (text.includes(name)) return month;
  const numeric = text.match(/(?:\b|\/|-)(\d{1,2})(?:\/|-)(\d{2,4})?\b/);
  if (numeric) return Number(numeric[1]) <= 12 ? Number(numeric[1]) : undefined;
  return undefined;
}

function contextFromOutput(output = {}, fallbackDate) {
  const sourceText = [output.week_start, output.week_end, output.week_label, output.periodo, output.rango, output.title].filter(Boolean).join(" ");
  const yearMatch = sourceText.match(/\b(20\d{2})\b/);
  return {
    year: yearMatch ? Number(yearMatch[1]) : moment(fallbackDate).year(),
    month: monthFromText(sourceText) || moment(fallbackDate).month() + 1,
  };
}

function buildDateFromDay(day, context, fallbackDate) {
  const n = Number(day);
  if (!n || n < 1 || n > 31 || !context.month) return fallbackDate;
  return moment({ year: context.year, month: context.month - 1, day: n }).format("YYYY-MM-DD");
}

function parseAiDate(ev, fallbackDate, context) {
  const dayText = [ev.day, ev.dia, ev.día, ev.column, ev.columna].filter(Boolean).join(" ");
  const dayMatch = normalizeText(dayText).match(/\b(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)?\s*(\d{1,2})\b/);
  if (dayMatch) return buildDateFromDay(dayMatch[1], context, fallbackDate);

  const raw = String(ev.date || ev.fecha || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const slash = raw.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/);
  if (slash) {
    const year = slash[3] ? Number(String(slash[3]).padStart(4, "20")) : context.year;
    return moment({ year, month: Number(slash[2]) - 1, day: Number(slash[1]) }).format("YYYY-MM-DD");
  }
  const textDay = normalizeText(raw).match(/\b(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)?\s*(\d{1,2})\b/);
  if (textDay) return buildDateFromDay(textDay[1], context, fallbackDate);
  return fallbackDate;
}

// ── Regla fundamental de DESCANSO ──
// Si en una fecha aparece únicamente "DESCANSO" y no hay ninguna otra actividad → día LIBRE.
// Si aparece "DESCANSO" pero también hay otras actividades → NO es libre, se importan las actividades reales.
// Una celda vacía no significa descanso.
function applyRestDayRule(events) {
  const byDate = {};
  events.forEach((ev) => {
    if (!ev.date) return;
    (byDate[ev.date] ||= []).push(ev);
  });
  const result = [];
  Object.entries(byDate).forEach(([date, dayEvents]) => {
    const nonRest = dayEvents.filter((ev) => normalizeType(ev.event_type, ev.title) !== "Descanso");
    const restOnly = dayEvents.filter((ev) => normalizeType(ev.event_type, ev.title) === "Descanso");
    if (restOnly.length > 0 && nonRest.length === 0) {
      // Día libre: un único evento de descanso marcado como is_rest_day
      const rest = restOnly[0];
      result.push({
        ...rest,
        title: "Descanso",
        event_type: "Descanso",
        is_rest_day: true,
        start_time: "",
        end_time: "",
        location: "",
        warning: "",
      });
    } else {
      // Hay actividades reales: importar todas (ignorar descanso si hay otras actividades)
      nonRest.forEach((ev) => result.push({ ...ev, is_rest_day: false }));
    }
  });
  return result;
}

// ── Detección de rivales ──
// Busca el rival en la base de RivalClub y vincula opponent_club_id.
async function detectRival(rivalName, clubs = []) {
  if (!rivalName) return null;
  const normalized = normalizeClubText(rivalName);
  if (!normalized) return null;
  // Búsqueda exacta normalizada
  let match = clubs.find((c) => normalizeClubText(c.official_name) === normalized || normalizeClubText(c.short_name) === normalized);
  // Búsqueda por alias
  if (!match) {
    match = clubs.find((c) => (c.aliases || []).some((a) => normalizeClubText(a) === normalized));
  }
  // Búsqueda parcial (contains)
  if (!match) {
    match = clubs.find((c) => clubMatchesQuery(c, rivalName));
  }
  return match || null;
}

export function normalizeAiEvents(rawEvents = [], fallbackDate, output = {}) {
  const context = contextFromOutput(output, fallbackDate);
  const mapped = rawEvents.map((ev) => {
    const title = String(ev.title || ev.activity || ev.actividad || ev.name || "").trim();
    const event_type = normalizeType(ev.event_type || ev.type || ev.tipo, title);
    const rival = String(ev.rival || ev.rival_name || "").trim();
    const warning = ev.warning || (ev.time_missing ? "Horario no informado" : "");
    return {
      title: title || event_type,
      date: parseAiDate(ev, fallbackDate, context),
      start_time: cleanTime(ev.start_time || ev.time || ev.hora_inicio || ev.horario),
      end_time: cleanTime(ev.end_time || ev.hora_fin),
      event_type,
      location: ev.location || ev.lugar || "",
      notes: ev.notes || ev.observaciones || "",
      rival,
      rival_club_id: "",
      home_away: normalizeHomeAway(ev.home_away || ev.condicion),
      rival_logo_url: ev.rival_logo_url || "",
      is_rest_day: false,
      warning,
    };
  }).filter((ev) => ev.title && ev.date);
  return applyRestDayRule(mapped);
}

export async function analyzeScheduleFile({ file, activeSquad }) {
  const upload = await base44.integrations.Core.UploadFile({ file });
  const schema = {
    type: "object",
    properties: {
      squad_name: { type: "string" },
      week_label: { type: "string" },
      week_start: { type: "string" },
      week_end: { type: "string" },
      events: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            date: { type: "string" },
            day: { type: "string" },
            start_time: { type: "string" },
            end_time: { type: "string" },
            event_type: { type: "string" },
            location: { type: "string" },
            notes: { type: "string" },
            rival: { type: "string" },
            home_away: { type: "string" },
            time_missing: { type: "boolean" },
            warning: { type: "string" },
          }
        }
      }
    }
  };
  const prompt = `Extraé el cronograma deportivo del archivo y devolvé SOLO eventos reales visibles en la tabla.

REGLAS CRÍTICAS DE FECHAS:
- NO uses la fecha actual ni la fecha de carga del archivo.
- Cada evento debe heredar la fecha del encabezado de su columna (por ejemplo: "LUNES 6", "MARTES 7", "MIERCOLES 8", "JUEVES 23", "VIERNES 24").
- Si el encabezado trae solo número de día, usá el mes del título/rango del cronograma.
- Si el cronograma abarca dos meses (ej: julio-agosto), asigná el mes correcto a cada día.
- Si no aparece año, usá ${moment().year()}.
- En el campo day copiá el encabezado exacto de la columna.
- En el campo date usá formato YYYY-MM-DD.
- No crees eventos para celdas vacías. Una celda vacía NO significa descanso.

REGLA FUNDAMENTAL DE DESCANSO:
- Si en una fecha aparece únicamente "DESCANSO" y no hay ninguna otra actividad, ese día es LIBRE: creá un único evento con title="Descanso", event_type="Descanso".
- Si aparece "DESCANSO" pero también hay otras actividades en esa misma fecha, NO marques el día como libre. Importá las actividades reales y NO crees un evento de descanso.
- Ejemplo: si el viernes 24 tiene "Descanso" por la mañana pero también "Llegada 15:00", "Gimnasio 15:30", "Cancha 16:30", el día NO es libre: importá esas 3 actividades.

TIPOS DE ACTIVIDADES A RECONOCER:
- Desayuno, Almuerzo, Cena (Comida)
- Video, Charla (Video)
- Gimnasio, Fuerza (Gimnasio)
- Cancha, Entrenamiento (Cancha)
- Viaje, Llegada, Traslado (Viaje)
- Partido (Partido)
- Descanso (Descanso)
- Reunión (Reunión)
- Otras actividades escritas en el cronograma (Otro)

DETECCIÓN DE PARTIDOS Y RIVALES:
- Cuando veas textos como "FECHA 3 VS NEW", "PARTIDO VS NEWELL'S", "VS COLON", reconocé que es un partido.
- En el campo rival poné el nombre del rival (ej: "Newell's Old Boys", "Colón", "Estudiantes de Río Cuarto").
- En el campo event_type poné "Partido".
- Si aparece número de fecha o competencia, ponelo en notes.

NO INVENTAR DATOS:
- Si el documento no indica horario, dejá start_time vacío y poné time_missing=true.
- Si el documento no indica lugar, dejá location vacío.
- No inventes horarios ni lugares.

Plantel activo esperado: ${activeSquad?.name || ""}.`;

  const output = await base44.integrations.Core.InvokeLLM({
    file_urls: [upload.file_url],
    response_json_schema: schema,
    prompt,
    model: "gemini_3_flash",
  });
  const fallbackDate = moment(output.week_start, ["YYYY-MM-DD", "DD/MM/YYYY"], true).isValid() ? moment(output.week_start).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");
  const events = normalizeAiEvents(output.events || [], fallbackDate, output);

  // Detección de rivales: buscar en RivalClub
  const clubs = await base44.entities.RivalClub.list("official_name", 500).catch(() => []);
  const rivalEvents = events.filter((ev) => ev.event_type === "Partido" && ev.rival);
  await Promise.all(rivalEvents.map(async (ev) => {
    const club = await detectRival(ev.rival, clubs);
    if (club) {
      ev.rival_club_id = club.id;
      ev.rival = club.official_name || ev.rival;
      ev.rival_logo_url = club.shield_url || "";
    } else {
      ev.warning = `Rival no encontrado en base de clubes: "${ev.rival}". Confirmar manualmente.`;
    }
  }));

  return { source_file: upload.file_url, source_file_name: file.name, squad_name: output.squad_name || activeSquad?.name || "", events };
}

function importKey({ squad_id, date, time, type, title }) { return [squad_id || "", date || "", time || "", type || "", normalizeText(title || "")].join("|"); }

export async function upsertImportedEvents({ previewEvents, activeSquad, activeSquadId, activeSeasonId, sourceFile, sourceFileName }) {
  const existingRaw = await base44.entities.DayEvent.filter({ squad_id: activeSquadId }, "date", 500);
  const existing = existingRaw.filter((ev) => !ev.season_id || !activeSeasonId || ev.season_id === activeSeasonId);
  const byKey = Object.fromEntries(existing.map((ev) => [importKey({ squad_id: ev.squad_id, date: ev.date, time: ev.time || ev.start_time || "", type: ev.type || ev.event_type || "", title: ev.title }), ev]));
  const saved = [];
  const duplicates = [];
  for (const ev of previewEvents) {
    const type = ev.event_type || ev.type || "Otro";
    const time = ev.start_time || ev.time || "";
    const payload = { ...ev, home_away: normalizeHomeAway(ev.home_away), squad_id: activeSquadId, squad_name: activeSquad?.name || "", season_id: activeSeasonId || activeSquad?.season || "", time, start_time: time, type, event_type: type, duration_minutes: durationMinutes(time, ev.end_time), color: TYPE_COLORS[type] || "blue", source_file: sourceFile, source_file_name: sourceFileName, created_by_ai: true };
    payload.import_key = importKey({ squad_id: activeSquadId, date: payload.date, time, type, title: payload.title });
    if (!payload.duration_minutes) delete payload.duration_minutes;
    if (!payload.rival_club_id) delete payload.rival_club_id;
    const current = byKey[payload.import_key];
    if (current) {
      duplicates.push({ ...payload, id: current.id });
      await base44.entities.DayEvent.update(current.id, payload);
      saved.push({ ...payload, id: current.id });
    } else {
      const created = await base44.entities.DayEvent.create(payload);
      saved.push(created || payload);
    }
  }
  await syncWeeklyPlanFromEvents({ events: saved, activeSquad, activeSquadId, activeSeasonId });
  return { saved, duplicates };
}

function plannerEmptyDay(date) { return { date, md: "— MD —", objetivo: "—", sesionGimnasio: "", trabajoCompensatorio: "—", vueltaCalma: [], observaciones: "", tareasTecnico: [""], calendar_events: [] }; }
function goalFromEvents(events) { if (events.some(e => e.event_type === "Partido")) return "Activación"; if (events.some(e => e.event_type === "Descanso")) return "Recuperación"; if (events.some(e => ["Entrenamiento", "Cancha"].includes(e.event_type))) return "Táctica"; return "—"; }

async function syncWeeklyPlanFromEvents({ events, activeSquad, activeSquadId, activeSeasonId }) {
  if (!events.length) return;
  const weekStart = moment.min(events.map(e => moment(e.date))).startOf("isoWeek").format("YYYY-MM-DD");
  const weekEventsRaw = await base44.entities.DayEvent.filter({ squad_id: activeSquadId }, "date", 500);
  const weekEvents = weekEventsRaw.filter(e => e.date >= weekStart && e.date <= moment(weekStart).add(6, "days").format("YYYY-MM-DD") && (!e.season_id || !activeSeasonId || e.season_id === activeSeasonId));
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