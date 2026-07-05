import { jsPDF } from "jspdf";
import { CLUB_BRAND } from "@/lib/clubBrand";

const BRAND = CLUB_BRAND.colors;

const DAYS_ES = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
const MONTHS_ES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

const TYPE_STYLES = {
  Partido: { color: BRAND.green, soft: "#E7F6EC", text: "#FFFFFF", label: "Partido" },
  Descanso: { color: "#8B8FD6", soft: "#ECECFA", text: "#FFFFFF", label: "Descanso" },
  Viaje: { color: "#C061D8", soft: "#F8E8FB", text: "#FFFFFF", label: "Viaje" },
  Comida: { color: "#E8C600", soft: "#FFF8C7", text: "#111827", label: "Comida" },
  Video: { color: "#EA580C", soft: "#FFE8D4", text: "#FFFFFF", label: "Video" },
  Gimnasio: { color: "#111827", soft: "#E5E7EB", text: "#FFFFFF", label: "Gimnasio" },
  Cancha: { color: "#3AC533", soft: "#E7FADC", text: "#111827", label: "Cancha" },
  Entrenamiento: { color: "#3AC533", soft: "#E7FADC", text: "#111827", label: "Entrenamiento" },
  Reunión: { color: "#D6A600", soft: "#FFF4C2", text: "#111827", label: "Reunión" },
  Otro: { color: "#64748B", soft: "#EEF2F7", text: "#FFFFFF", label: "Actividad" },
};

function rgb(hex) {
  const clean = hex.replace("#", "");
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

function setFill(doc, hex) { doc.setFillColor(...rgb(hex)); }
function setText(doc, hex) { doc.setTextColor(...rgb(hex)); }
function setStroke(doc, hex) { doc.setDrawColor(...rgb(hex)); }

async function imageData(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

async function drawLogo(doc, x, y, size) {
  try {
    const logo = await imageData(CLUB_BRAND.logoUrl);
    doc.addImage(logo, "PNG", x - size / 2, y - size / 2, size, size, undefined, "FAST");
  } catch {
    setFill(doc, BRAND.green);
    doc.circle(x, y, size / 2, "F");
    setText(doc, BRAND.yellow);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(CLUB_BRAND.shortName, x, y + 2, { align: "center" });
  }
}

function styleFor(ev) {
  const text = `${ev.event_type || ""} ${ev.type || ""} ${ev.title || ""} ${ev.location || ""}`.toLowerCase();
  if (text.includes("partido") || text.includes(" vs ")) return TYPE_STYLES.Partido;
  if (text.includes("descanso") || text.includes("libre")) return TYPE_STYLES.Descanso;
  if (text.includes("viaje") || text.includes("salida") || text.includes("traslado")) return TYPE_STYLES.Viaje;
  if (text.includes("desayuno") || text.includes("almuerzo") || text.includes("cena") || text.includes("comida")) return TYPE_STYLES.Comida;
  if (text.includes("video") || text.includes("auditorio")) return TYPE_STYLES.Video;
  if (text.includes("gimnasio") || text.includes("gym")) return TYPE_STYLES.Gimnasio;
  if (text.includes("cancha")) return TYPE_STYLES.Cancha;
  return TYPE_STYLES[ev.event_type || ev.type] || TYPE_STYLES.Otro;
}

function eventTime(ev) {
  return ev.time || ev.start_time || "";
}

function eventMinutes(ev) {
  const match = eventTime(ev).match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 9999;
}

function eventTitle(ev) {
  const title = String(ev.title || ev.event_type || ev.type || "Actividad").toUpperCase();
  const location = String(ev.location || "").trim().toUpperCase();
  if (location && title === "ENTRENAMIENTO") return location;
  return title;
}

function eventDetail(ev) {
  const parts = [];
  if (ev.rival) parts.push(`VS ${String(ev.rival).toUpperCase()}`);
  if (ev.home_away) parts.push(String(ev.home_away).toUpperCase());
  if (ev.location && eventTitle(ev) !== String(ev.location).toUpperCase()) parts.push(String(ev.location).toUpperCase());
  return parts.join(" · ");
}

function dayTitle(day) {
  return DAYS_ES[day.day()];
}

function rangeLabel(days) {
  const first = days[0];
  const last = days[days.length - 1];
  if (first.month() === last.month()) return `${dayTitle(first)} ${first.date()} AL ${dayTitle(last)} ${last.date()} DE ${MONTHS_ES[first.month()]}`;
  return `${dayTitle(first)} ${first.date()} ${MONTHS_ES[first.month()]} AL ${dayTitle(last)} ${last.date()} ${MONTHS_ES[last.month()]}`;
}

function drawStat(doc, x, y, value, label, color = BRAND.green) {
  setFill(doc, "#FFFFFF");
  doc.roundedRect(x, y, 28, 12, 3, 3, "F");
  setFill(doc, color);
  doc.roundedRect(x, y, 2.2, 12, 1, 1, "F");
  setText(doc, BRAND.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(String(value), x + 5, y + 7.4);
  setText(doc, BRAND.muted);
  doc.setFontSize(4.8);
  doc.text(label.toUpperCase(), x + 14, y + 7.2, { align: "center" });
}

function stats(events) {
  return {
    total: events.length,
    training: events.filter((e) => ["Entrenamiento", "Cancha", "Gimnasio"].includes(e.event_type || e.type)).length,
    match: events.filter((e) => (e.event_type || e.type) === "Partido").length,
    trip: events.filter((e) => (e.event_type || e.type) === "Viaje").length,
  };
}

function drawLegend(doc, x, y) {
  const keys = ["Comida", "Video", "Gimnasio", "Cancha", "Viaje", "Partido", "Descanso"];
  let cursor = x;
  keys.forEach((key) => {
    const st = TYPE_STYLES[key];
    setFill(doc, st.color);
    doc.circle(cursor + 2, y + 2, 2, "F");
    setText(doc, BRAND.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.3);
    doc.text(st.label.toUpperCase(), cursor + 5.8, y + 3.5);
    cursor += 23;
  });
}

function drawEventCard(doc, ev, x, y, w, h) {
  const st = styleFor(ev);
  setFill(doc, "#FFFFFF");
  setStroke(doc, "#E2E8D8");
  doc.roundedRect(x, y, w, h, 2.2, 2.2, "FD");
  setFill(doc, st.color);
  doc.roundedRect(x, y, 3.2, h, 1.6, 1.6, "F");

  const time = eventTime(ev);
  if (time) {
    setFill(doc, st.soft);
    doc.roundedRect(x + 5.5, y + 2, 12.5, 5.2, 1.8, 1.8, "F");
    setText(doc, BRAND.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.2);
    doc.text(time, x + 11.8, y + 5.7, { align: "center" });
  }

  setText(doc, BRAND.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.6);
  doc.text(doc.splitTextToSize(eventTitle(ev), w - 21).slice(0, 2), x + 20, y + 5.2);

  const detail = eventDetail(ev);
  if (detail) {
    setText(doc, BRAND.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.3);
    doc.text(doc.splitTextToSize(detail, w - 8).slice(0, 1), x + 5.5, y + h - 2.8);
  }
}

function drawDayCard(doc, day, events, x, y, w, h) {
  const sorted = [...events].sort((a, b) => eventMinutes(a) - eventMinutes(b));
  const isWeekend = [0, 6].includes(day.day());

  setFill(doc, "#FFFFFF");
  setStroke(doc, "#DCE6D2");
  doc.roundedRect(x, y, w, h, 4, 4, "FD");

  setFill(doc, isWeekend ? BRAND.greenDark : BRAND.green);
  doc.roundedRect(x, y, w, 18, 4, 4, "F");
  setFill(doc, BRAND.yellow);
  doc.roundedRect(x + w - 15, y + 4, 10, 10, 5, 5, "F");

  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.3);
  doc.text(dayTitle(day), x + 4, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.text(MONTHS_ES[day.month()], x + 4, y + 13.2);
  setText(doc, BRAND.greenDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(String(day.date()), x + w - 10, y + 11.2, { align: "center" });

  const bodyY = y + 21;
  const available = h - 25;
  const gap = 1.8;
  const maxVisible = Math.max(1, Math.floor((available + gap) / 14.2));
  const visible = sorted.slice(0, maxVisible);

  if (!visible.length) {
    setFill(doc, "#F6F8F2");
    doc.roundedRect(x + 4, bodyY + 18, w - 8, 18, 3, 3, "F");
    setText(doc, "#98A18E");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text("SIN ACTIVIDADES", x + w / 2, bodyY + 29, { align: "center" });
    return;
  }

  visible.forEach((ev, idx) => drawEventCard(doc, ev, x + 3.4, bodyY + idx * 14.2, w - 6.8, 12.7));

  if (sorted.length > visible.length) {
    setText(doc, BRAND.greenDark);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.7);
    doc.text(`+${sorted.length - visible.length} actividades más`, x + w / 2, y + h - 3.5, { align: "center" });
  }
}

export async function buildProfessionalWeekSchedulePDF({ days, eventsForDate, weekLabel, squadName, season }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 8;
  const events = days.flatMap((d) => eventsForDate(d.format("YYYY-MM-DD")));
  const info = stats(events);

  setFill(doc, "#F6F8F2");
  doc.rect(0, 0, pw, ph, "F");

  setFill(doc, BRAND.greenDark);
  doc.rect(0, 0, pw, 35, "F");
  setFill(doc, BRAND.green);
  doc.triangle(0, 0, pw * 0.62, 0, 0, 35, "F");
  setFill(doc, BRAND.yellow);
  doc.rect(0, 33.2, pw, 2.2, "F");

  await drawLogo(doc, margin + 12, 17.5, 20);

  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16.5);
  doc.text("AGENDA DEPORTIVA SEMANAL", margin + 27, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.text(`${String(squadName || "Plantel").toUpperCase()}${season ? ` · TEMPORADA ${season}` : ""}`, margin + 27, 20.2);
  setText(doc, BRAND.yellow);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.4);
  doc.text(rangeLabel(days) || weekLabel, margin + 27, 26.4);

  drawStat(doc, pw - 126, 9.5, info.total, "eventos", BRAND.yellow);
  drawStat(doc, pw - 95, 9.5, info.training, "cargas", "#3AC533");
  drawStat(doc, pw - 64, 9.5, info.match, "partidos", BRAND.green);
  drawStat(doc, pw - 33, 9.5, info.trip, "viajes", "#C061D8");

  drawLegend(doc, margin, 39.5);

  const cardGap = 2.5;
  const top = 48;
  const bottom = 15;
  const cardW = (pw - margin * 2 - cardGap * (days.length - 1)) / days.length;
  const cardH = ph - top - bottom;

  days.forEach((day, idx) => {
    const x = margin + idx * (cardW + cardGap);
    const dateKey = day.format("YYYY-MM-DD");
    drawDayCard(doc, day, eventsForDate(dateKey), x, top, cardW, cardH);
  });

  setFill(doc, BRAND.greenDark);
  doc.rect(0, ph - 8, pw, 8, "F");
  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text(`${CLUB_BRAND.name.toUpperCase()} · PERFORMANCEPITCH`, margin, ph - 3.2);
  doc.setFont("helvetica", "normal");
  doc.text("Documento operativo del cuerpo técnico — horarios sujetos a modificación", pw - margin, ph - 3.2, { align: "right" });

  return doc;
}