import { jsPDF } from "jspdf";
import { CLUB_BRAND } from "@/lib/clubBrand";

const BRAND = CLUB_BRAND.colors;

const SPANISH_DAYS = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
const SPANISH_MONTHS = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

const TYPE_STYLES = {
  Partido: { fill: BRAND.green, text: "#FFFFFF", label: "Partido" },
  Descanso: { fill: "#C7C5EA", text: "#111827", label: "Descanso" },
  Viaje: { fill: "#C661D9", text: "#111827", label: "Viaje" },
  Comida: { fill: "#EFFFBD", text: "#111827", label: "Comida" },
  Video: { fill: "#EA580C", text: "#111827", label: "Video" },
  Gimnasio: { fill: "#000000", text: "#FFFFFF", label: "Gimnasio" },
  Cancha: { fill: "#56D934", text: "#111827", label: "Cancha" },
  Entrenamiento: { fill: "#56D934", text: "#111827", label: "Entrenamiento" },
  Reunión: { fill: BRAND.yellow, text: "#111827", label: "Reunión" },
  Otro: { fill: "#F4F3EF", text: "#111827", label: "Actividad" },
};

function rgb(hex) {
  const clean = hex.replace("#", "");
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

function setFill(doc, hex) { doc.setFillColor(...rgb(hex)); }
function setText(doc, hex) { doc.setTextColor(...rgb(hex)); }
function setStroke(doc, hex) { doc.setDrawColor(...rgb(hex)); }

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

async function loadImageDataUrl(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

async function drawClubMark(doc, x, y, size) {
  try {
    const dataUrl = await loadImageDataUrl(CLUB_BRAND.logoUrl);
    doc.addImage(dataUrl, "PNG", x - size / 2, y - size / 2, size, size, undefined, "FAST");
  } catch {
    setFill(doc, "#FFFFFF");
    doc.circle(x, y, size / 2, "F");
    setFill(doc, BRAND.green);
    doc.circle(x, y, size / 2 - 1.5, "F");
    setText(doc, "#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(CLUB_BRAND.shortName, x, y + 1.8, { align: "center" });
  }
}

function spanishDayTitle(day) {
  return `${SPANISH_DAYS[day.day()]} ${day.date()}`;
}

function formatWeekRange(days) {
  const first = days[0];
  const last = days[days.length - 1];
  const sameMonth = first.month() === last.month();
  if (sameMonth) return `SEMANA ${SPANISH_DAYS[first.day()]} ${first.date()} AL ${SPANISH_DAYS[last.day()]} ${last.date()} DE ${SPANISH_MONTHS[first.month()]}`;
  return `SEMANA ${SPANISH_DAYS[first.day()]} ${first.date()} DE ${SPANISH_MONTHS[first.month()]} AL ${SPANISH_DAYS[last.day()]} ${last.date()} DE ${SPANISH_MONTHS[last.month()]}`;
}

function timeToMinutes(time) {
  const match = String(time || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function eventTime(ev) {
  return ev.time || ev.start_time || "";
}

function eventMainTitle(ev) {
  const title = String(ev.title || ev.event_type || ev.type || "ACTIVIDAD").toUpperCase();
  const location = String(ev.location || "").trim().toUpperCase();
  if (location && title === "ENTRENAMIENTO") return location;
  return title;
}

function eventSecondLine(ev) {
  const parts = [];
  const time = eventTime(ev);
  if (time) parts.push(`${time} HS`);
  if (ev.rival) parts.push(`VS ${String(ev.rival).toUpperCase()}`);
  if (ev.home_away) parts.push(String(ev.home_away).toUpperCase());
  if (ev.location && eventMainTitle(ev) !== String(ev.location).toUpperCase()) parts.push(String(ev.location).toUpperCase());
  return parts.join(" · ");
}

function splitByMoment(events) {
  const sorted = [...events].sort((a, b) => eventTime(a).localeCompare(eventTime(b)));
  return {
    morning: sorted.filter((ev) => !eventTime(ev) || timeToMinutes(eventTime(ev)) < 13 * 60),
    afternoon: sorted.filter((ev) => eventTime(ev) && timeToMinutes(eventTime(ev)) >= 13 * 60),
  };
}

function drawCenteredLabel(doc, text, x, y, w, h, color = "#111827") {
  setText(doc, color);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.8);
  const lines = doc.splitTextToSize(text, w - 4).slice(0, 3);
  const startY = y + h / 2 - ((lines.length - 1) * 4.2) / 2 + 1.5;
  lines.forEach((line, idx) => doc.text(line, x + w / 2, startY + idx * 4.2, { align: "center" }));
}

function drawEvents(doc, events, x, y, w, h) {
  if (!events.length) return;
  const gap = 1.2;
  const maxVisible = Math.max(1, Math.floor((h + gap) / 11));
  const visible = events.slice(0, maxVisible);
  const cardH = Math.min(18, Math.max(10, (h - gap * (visible.length - 1)) / visible.length));

  visible.forEach((ev, idx) => {
    const yy = y + idx * (cardH + gap);
    const st = styleFor(ev);
    setFill(doc, st.fill);
    setStroke(doc, "#000000");
    doc.roundedRect(x + 1.1, yy, w - 2.2, cardH, 0.8, 0.8, "FD");
    drawCenteredLabel(doc, eventMainTitle(ev), x + 1.1, yy + 1.4, w - 2.2, Math.max(5.5, cardH * 0.5), st.text);
    const second = eventSecondLine(ev);
    if (second) {
      setText(doc, st.text);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(cardH < 12 ? 6.2 : 7.2);
      doc.text(doc.splitTextToSize(second, w - 5).slice(0, 2), x + w / 2, yy + cardH - (cardH < 12 ? 2.4 : 3.4), { align: "center" });
    }
  });

  if (events.length > visible.length) {
    setText(doc, BRAND.greenDark);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text(`+${events.length - visible.length} ACTIVIDADES`, x + w / 2, y + h - 2, { align: "center" });
  }
}

function drawLegend(doc, x, y) {
  const items = ["Comida", "Video", "Gimnasio", "Cancha", "Viaje", "Partido", "Descanso"];
  let cursor = x;
  items.forEach((key) => {
    const st = TYPE_STYLES[key];
    setFill(doc, st.fill);
    setStroke(doc, "#000000");
    doc.roundedRect(cursor, y, 4, 4, 0.7, 0.7, "FD");
    setText(doc, BRAND.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.text(st.label.toUpperCase(), cursor + 5.2, y + 3.2);
    cursor += 24;
  });
}

function buildEventStats(events) {
  return {
    total: events.length,
    trainings: events.filter((e) => ["Entrenamiento", "Cancha", "Gimnasio"].includes(e.event_type || e.type)).length,
    matches: events.filter((e) => (e.event_type || e.type) === "Partido").length,
    trips: events.filter((e) => (e.event_type || e.type) === "Viaje").length,
  };
}

function drawStat(doc, x, y, value, label) {
  setFill(doc, "#FFFFFF");
  setStroke(doc, BRAND.yellow);
  doc.roundedRect(x, y, 24, 11, 2, 2, "FD");
  setText(doc, BRAND.greenDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(String(value), x + 4, y + 6.5);
  setText(doc, BRAND.muted);
  doc.setFontSize(4.7);
  doc.text(label.toUpperCase(), x + 4, y + 9.5);
}

export async function buildProfessionalWeekSchedulePDF({ days, eventsForDate, weekLabel, squadName, season }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 8;
  const allEvents = days.flatMap((d) => eventsForDate(d.format("YYYY-MM-DD")));
  const stats = buildEventStats(allEvents);
  const rangeLabel = formatWeekRange(days) || weekLabel;

  setFill(doc, "#FFFFFF");
  doc.rect(0, 0, pw, ph, "F");

  setFill(doc, BRAND.greenDark);
  doc.roundedRect(margin, 6, pw - margin * 2, 28, 2, 2, "F");
  setFill(doc, BRAND.green);
  doc.roundedRect(margin + 1.5, 7.5, pw - margin * 2 - 3, 23, 2, 2, "F");
  setFill(doc, BRAND.yellow);
  doc.rect(margin + 1.5, 29.2, pw - margin * 2 - 3, 2.2, "F");

  await drawClubMark(doc, margin + 15, 19, 21);
  setText(doc, BRAND.yellow);
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(17);
  doc.text(`· ${CLUB_BRAND.shortName} SEMANA PLANTEL ${String(squadName || "").toUpperCase() || "EQUIPO"} ·`, pw / 2, 18.5, { align: "center" });

  setFill(doc, "#92861D");
  setStroke(doc, "#2B2608");
  doc.roundedRect(pw - 83, 12, 64, 13, 2.5, 2.5, "FD");
  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.4);
  doc.text(rangeLabel.replace("SEMANA ", "Semana "), pw - 51, 20.3, { align: "center", maxWidth: 58 });

  drawLegend(doc, margin + 28, 38);
  drawStat(doc, pw - 109, 36, stats.total, "eventos");
  drawStat(doc, pw - 82, 36, stats.trainings, "cargas");
  drawStat(doc, pw - 55, 36, stats.matches, "partidos");
  drawStat(doc, pw - 28, 36, stats.trips, "viajes");

  const gridX = margin;
  const gridY = 50;
  const labelW = 18;
  const gridW = pw - margin * 2;
  const dayW = (gridW - labelW) / days.length;
  const headerH = 15;
  const bodyH = ph - gridY - 20;
  const morningH = bodyH * 0.58;
  const afternoonH = bodyH - morningH;

  setStroke(doc, "#000000");
  doc.setLineWidth(0.55);
  doc.rect(gridX, gridY, gridW, headerH + bodyH, "S");

  setFill(doc, BRAND.yellow);
  doc.rect(gridX, gridY, labelW, headerH + bodyH, "F");
  doc.rect(gridX, gridY + headerH + morningH, labelW, afternoonH, "F");
  setStroke(doc, "#000000");
  doc.rect(gridX, gridY, labelW, headerH + bodyH, "S");
  doc.line(gridX, gridY + headerH + morningH, gridX + labelW, gridY + headerH + morningH);

  setText(doc, "#000000");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2);
  doc.text("MAÑANA", gridX + labelW / 2, gridY + headerH + morningH / 2, { align: "center", angle: 0 });
  doc.text("TARDE", gridX + labelW / 2, gridY + headerH + morningH + afternoonH / 2, { align: "center", angle: 0 });

  days.forEach((day, idx) => {
    const x = gridX + labelW + idx * dayW;
    const events = eventsForDate(day.format("YYYY-MM-DD"));
    const groups = splitByMoment(events);

    setFill(doc, BRAND.greenDark);
    doc.rect(x, gridY, dayW, headerH, "F");
    setStroke(doc, "#000000");
    doc.rect(x, gridY, dayW, headerH + bodyH, "S");
    doc.line(x, gridY + headerH, x + dayW, gridY + headerH);
    doc.line(x, gridY + headerH + morningH, x + dayW, gridY + headerH + morningH);

    setText(doc, "#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(days.length > 7 ? 8.8 : 9.8);
    doc.text(spanishDayTitle(day), x + dayW / 2, gridY + 9.5, { align: "center" });

    setFill(doc, "#F6F5F0");
    doc.rect(x, gridY + headerH, dayW, morningH, "F");
    doc.rect(x, gridY + headerH + morningH, dayW, afternoonH, "F");
    setStroke(doc, "#000000");
    doc.rect(x, gridY + headerH, dayW, morningH, "S");
    doc.rect(x, gridY + headerH + morningH, dayW, afternoonH, "S");

    drawEvents(doc, groups.morning, x + 0.5, gridY + headerH + 2, dayW - 1, morningH - 4);
    drawEvents(doc, groups.afternoon, x + 0.5, gridY + headerH + morningH + 2, dayW - 1, afternoonH - 4);

    if (!events.length) {
      setText(doc, "#9CA3AF");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("SIN ACTIVIDADES", x + dayW / 2, gridY + headerH + bodyH / 2, { align: "center" });
    }
  });

  setFill(doc, BRAND.greenDark);
  doc.rect(0, ph - 8, pw, 8, "F");
  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.2);
  doc.text(`${CLUB_BRAND.name.toUpperCase()} · PERFORMANCEPITCH`, margin, ph - 3.2);
  doc.setFont("helvetica", "normal");
  doc.text(`${season ? `Temporada ${season} · ` : ""}Documento operativo — horarios sujetos a modificación`, pw - margin, ph - 3.2, { align: "right" });

  return doc;
}