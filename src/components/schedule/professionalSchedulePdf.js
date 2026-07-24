import { jsPDF } from "jspdf";
import { contrastText, darken, lighten } from "@/lib/clubBrandResolver";

const DAYS_ES = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
const MONTHS_ES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

const TYPE_STYLES = {
  Comida: { color: "#D97706", text: "#FFFFFF", label: "Comida" },
  Video: { color: "#EA580C", text: "#FFFFFF", label: "Video" },
  Gimnasio: { color: "#1D4ED8", text: "#FFFFFF", label: "Gimnasio / Fuerza" },
  Cancha: { color: "#16A34A", text: "#FFFFFF", label: "Cancha" },
  Viaje: { color: "#8B3FDB", text: "#FFFFFF", label: "Viaje" },
  Partido: { color: "#DC2626", text: "#FFFFFF", label: "Partido" },
  Descanso: { color: "#8D7AD9", text: "#FFFFFF", label: "Descanso" },
  Reunión: { color: "#D9A400", text: "#111827", label: "Reunión" },
  Otro: { color: "#64748B", text: "#FFFFFF", label: "Actividad" },
};

function rgb(hex) {
  const clean = String(hex || "#000000").replace("#", "");
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}
function setFill(doc, hex) { doc.setFillColor(...rgb(hex)); }
function setText(doc, hex) { doc.setTextColor(...rgb(hex)); }
function setStroke(doc, hex) { doc.setDrawColor(...rgb(hex)); }

async function loadSafeImage(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}
function imageFormat(dataUrl) {
  if (String(dataUrl).includes("image/jpeg") || String(dataUrl).includes("image/jpg")) return "JPEG";
  if (String(dataUrl).includes("image/webp")) return "WEBP";
  return "PNG";
}
function addImageSafe(doc, dataUrl, x, y, w, h) {
  try { doc.addImage(dataUrl, imageFormat(dataUrl), x, y, w, h, undefined, "FAST"); return true; } catch { return false; }
}

function normalize(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function typeKey(ev) {
  const text = normalize(`${ev.event_type || ""} ${ev.type || ""} ${ev.title || ""} ${ev.location || ""}`);
  if (text.includes("partido") || text.includes(" vs ")) return "Partido";
  if (text.includes("descanso") || text.includes("libre")) return "Descanso";
  if (text.includes("viaje") || text.includes("salida") || text.includes("traslado") || text.includes("llegada")) return "Viaje";
  if (text.includes("desayuno") || text.includes("almuerzo") || text.includes("cena") || text.includes("comida")) return "Comida";
  if (text.includes("video") || text.includes("auditorio")) return "Video";
  if (text.includes("gimnasio") || text.includes("fuerza") || text.includes("gym")) return "Gimnasio";
  if (text.includes("cancha") || text.includes("entrenamiento")) return "Cancha";
  if (text.includes("reunion") || text.includes("charla")) return "Reunión";
  return TYPE_STYLES[ev.event_type || ev.type] ? (ev.event_type || ev.type) : "Otro";
}

function styleFor(ev) { return TYPE_STYLES[typeKey(ev)] || TYPE_STYLES.Otro; }
function eventTime(ev) { return ev.time || ev.start_time || ""; }
function minutesFromTime(time, fallback = 8 * 60) {
  const match = String(time || "").match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : fallback;
}
function eventStart(ev) { return minutesFromTime(eventTime(ev)); }
function eventDuration(ev) { const value = Number(ev.duration_minutes || 45); return Math.max(30, Math.min(value, 120)); }
function eventTitle(ev) {
  const title = String(ev.title || ev.event_type || ev.type || "Actividad").trim();
  const location = String(ev.location || "").trim();
  if (location && normalize(title) === "entrenamiento") return location;
  return title;
}
function dayName(day) { return DAYS_ES[day.day()]; }
function shortMonth(day) { return MONTHS_ES[day.month()]; }
function rangeLabel(days) {
  const first = days[0];
  const last = days[days.length - 1];
  if (first.month() === last.month()) return `${dayName(first)} ${first.date()} AL ${dayName(last)} ${last.date()} DE ${MONTHS_ES[first.month()]}`;
  return `${dayName(first)} ${first.date()} DE ${MONTHS_ES[first.month()]} AL ${dayName(last)} ${last.date()} DE ${MONTHS_ES[last.month()]}`;
}
function exportedDate() { const now = new Date(); return `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`; }

function extractMeta(ev) {
  const notes = String(ev.notes || "");
  const competition = ev.competition || (notes.match(/competencia\s*:?\s*([^\n·|]+)/i)?.[1] || "");
  const round = ev.round || ev.fecha_numero || ev.fecha || (notes.match(/fecha\s*:?\s*(\d+)/i)?.[1] || "");
  return { competition: String(competition || "").trim(), round: String(round || "").trim() };
}

function drawIcon(doc, key, x, y, color = "#111827") {
  setStroke(doc, color); setFill(doc, color); doc.setLineWidth(0.5);
  if (key === "Comida") { doc.line(x - 1.8, y - 2.2, x - 1.8, y + 2.3); doc.line(x - 2.5, y - 2.2, x - 2.5, y - 0.6); doc.line(x - 1.1, y - 2.2, x - 1.1, y - 0.6); doc.line(x + 1.6, y - 2.1, x + 1.6, y + 2.3); doc.line(x + 0.7, y - 2.1, x + 2.2, y - 0.4); }
  else if (key === "Video") { doc.circle(x, y, 2.5, "S"); doc.triangle(x - 0.8, y - 1.3, x - 0.8, y + 1.3, x + 1.4, y, "F"); }
  else if (key === "Gimnasio") { doc.line(x - 3, y, x + 3, y); doc.rect(x - 3.8, y - 1.4, 0.9, 2.8, "F"); doc.rect(x + 2.9, y - 1.4, 0.9, 2.8, "F"); doc.rect(x - 2.3, y - 1, 0.7, 2, "F"); doc.rect(x + 1.6, y - 1, 0.7, 2, "F"); }
  else if (key === "Cancha") { doc.rect(x - 3, y - 2, 6, 4, "S"); doc.line(x, y - 2, x, y + 2); doc.circle(x, y, 0.9, "S"); }
  else if (key === "Viaje") { doc.roundedRect(x - 3, y - 2, 6, 4, 0.8, 0.8, "S"); doc.circle(x - 1.8, y + 2, 0.45, "F"); doc.circle(x + 1.8, y + 2, 0.45, "F"); doc.line(x - 2, y - 0.4, x + 2, y - 0.4); }
  else if (key === "Partido") { doc.circle(x, y, 2.4, "S"); doc.circle(x, y, 0.75, "F"); doc.line(x, y - 2.4, x, y + 2.4); doc.line(x - 2.4, y, x + 2.4, y); }
  else if (key === "Descanso") { setFill(doc, color); doc.circle(x - 0.5, y, 2.5, "F"); setFill(doc, "#FFFFFF"); doc.circle(x + 0.7, y - 0.5, 2.4, "F"); }
  else { doc.circle(x, y, 2.2, "F"); }
}

function drawHeader(doc, days, squadName, season, brand) {
  const pw = doc.internal.pageSize.getWidth();
  const colors = brand.colors;
  setFill(doc, colors.primaryDeep);
  doc.rect(0, 0, pw, 31, "F");
  setFill(doc, colors.primary);
  doc.triangle(0, 0, pw * 0.58, 0, 0, 31, "F");
  setFill(doc, colors.accent);
  doc.rect(0, 31, pw, 2.2, "F");

  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15.5);
  doc.text("CRONOGRAMA SEMANAL", 29, 12);
  setText(doc, colors.accent);
  doc.setFontSize(8.5);
  doc.text(`${String(squadName || "Plantel").toUpperCase()} · TEMPORADA ${season || "—"}`, 29, 18.5);

  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.4);
  doc.text("PLANIFICACIÓN OPERATIVA · SEMANA", 29, 24.1);
  doc.setFont("helvetica", "bold");
  doc.text(rangeLabel(days), 76, 24.1);

  setStroke(doc, "#FFFFFF");
  doc.setLineWidth(0.2);
  doc.line(184, 9, 184, 23);
  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.text(brand.name.toUpperCase(), 192, 15);
  doc.setFontSize(6.2);
  doc.text("PERFORMANCEPITCH", 241, 15);
  setFill(doc, colors.accent);
  doc.roundedRect(281, 10.5, 5, 7, 1.2, 1.2, "F");
}

function drawScheduleGrid(doc, days, eventsForDate, imageCache, brand) {
  const colors = brand.colors;
  const margin = 7;
  const top = 39;
  const gridW = 283;
  const gap = 3;
  const rowGap = 4;
  const rowH = 66;
  const headerH = 17;
  const topDays = days.slice(0, 4);
  const bottomDays = days.slice(4);

  function drawDay(day, idx, row, total) {
    const dayW = (gridW - gap * (total - 1)) / total;
    const x = margin + idx * (dayW + gap);
    const y0 = top + row * (rowH + rowGap);
    const isWeekend = [0, 6].includes(day.day());
    const events = [...eventsForDate(day.format("YYYY-MM-DD"))].sort((a, b) => eventStart(a) - eventStart(b));
    const bodyY = y0 + headerH;
    const bodyH = rowH - headerH;

    setFill(doc, "#FFFFFF");
    setStroke(doc, "#D7E2CF");
    doc.setLineWidth(0.45);
    doc.roundedRect(x, y0, dayW, rowH, 3.2, 3.2, "FD");

    setFill(doc, isWeekend ? colors.primaryDeep : colors.primary);
    doc.roundedRect(x, y0, dayW, headerH, 3.2, 3.2, "F");
    setFill(doc, colors.accent);
    doc.rect(x, y0 + headerH - 1.8, dayW, 1.8, "F");

    setText(doc, "#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(dayName(day), x + 5, y0 + 6);
    setText(doc, colors.accent);
    doc.setFontSize(13.8);
    doc.text(String(day.date()), x + dayW - 7, y0 + 9.5, { align: "right" });
    setText(doc, "#FFFFFF");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.8);
    doc.text(shortMonth(day), x + dayW - 7, y0 + 14, { align: "right" });

    if (!events.length) {
      setFill(doc, "#F4F7F1");
      doc.roundedRect(x + 3, bodyY + 5, dayW - 6, 31, 2.3, 2.3, "F");
      drawIcon(doc, "Descanso", x + dayW / 2, bodyY + 17, "#8D7AD9");
      setText(doc, "#6B7280");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.text("SIN ACTIVIDADES", x + dayW / 2, bodyY + 28, { align: "center" });
      return;
    }

    const visibleLimit = total === 4 ? 4 : 5;
    const visible = events.slice(0, visibleLimit);
    const cardGap = 1.8;
    const cardH = Math.max(8.8, Math.min(11.2, (bodyH - 5 - cardGap * (visible.length - 1)) / visible.length));
    visible.forEach((ev, j) => {
      const cardY = bodyY + 3 + j * (cardH + cardGap);
      drawActivityCard(doc, ev, x + 3, cardY, dayW - 6, cardH, imageCache, brand);
    });
    if (events.length > visible.length) {
      setFill(doc, "#EEF2F7");
      doc.roundedRect(x + 3, y0 + rowH - 6.4, dayW - 6, 4.8, 1.3, 1.3, "F");
      setText(doc, colors.muted);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(4.7);
      doc.text(`+${events.length - visible.length} actividades más`, x + dayW / 2, y0 + rowH - 3, { align: "center" });
    }
  }

  topDays.forEach((day, idx) => drawDay(day, idx, 0, topDays.length));
  bottomDays.forEach((day, idx) => drawDay(day, idx, 1, bottomDays.length));
}

function drawActivityCard(doc, ev, x, y, w, h, imageCache, brand) {
  const key = typeKey(ev);
  if (key === "Partido") return drawMatchCard(doc, ev, x, y, w, h, imageCache, brand);
  const st = styleFor(ev);
  setFill(doc, st.color);
  setStroke(doc, "#FFFFFF");
  doc.roundedRect(x, y, w, h, 1.6, 1.6, "FD");
  const iconBg = st.text === "#FFFFFF" ? "#FFFFFF" : "#111827";
  const iconColor = st.text === "#FFFFFF" ? st.color : "#FFFFFF";
  setFill(doc, iconBg);
  doc.roundedRect(x + 1.5, y + 1.5, 6.5, 6.5, 1.4, 1.4, "F");
  drawIcon(doc, key, x + 4.75, y + 4.75, iconColor);
  setText(doc, st.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(h < 11 ? 5.2 : 6.2);
  doc.text(doc.splitTextToSize(eventTitle(ev).toUpperCase(), w - 12).slice(0, 2), x + 9.5, y + 4.6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.8);
  const time = eventTime(ev);
  if (time) doc.text(`${time} HS`, x + 9.5, y + h - 2.4);
  if (ev.location && h > 12) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.1);
    doc.text(doc.splitTextToSize(String(ev.location).toUpperCase(), w - 12).slice(0, 1), x + 9.5, y + h - 7.1);
  }
}

function drawMatchCard(doc, ev, x, y, w, h, imageCache, brand) {
  const colors = brand.colors;
  const logo = imageCache[ev.rival_logo_url];
  setFill(doc, colors.primaryDeep);
  setStroke(doc, "#FFFFFF");
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
  setFill(doc, colors.primary);
  doc.rect(x, y, w, 5.2, "F");
  if (logo && addImageSafe(doc, logo, x + w / 2 - 4.8, y + 6, 9.6, 9.6)) {}
  else { setFill(doc, "#FFFFFF"); doc.circle(x + w / 2, y + 11, 5, "F"); drawIcon(doc, "Partido", x + w / 2, y + 11, colors.primaryDeep); }
  const meta = extractMeta(ev);
  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.8);
  doc.text("PARTIDO", x + w / 2, y + 3.7, { align: "center" });
  doc.setFontSize(6.2);
  doc.text(doc.splitTextToSize((ev.rival ? `VS ${ev.rival}` : eventTitle(ev)).toUpperCase(), w - 4).slice(0, 2), x + w / 2, y + 20, { align: "center" });
  doc.setFontSize(5.4);
  const details = [ev.home_away, eventTime(ev) && `${eventTime(ev)} HS`, meta.competition, meta.round && `FECHA ${meta.round}`].filter(Boolean).join(" · ");
  if (details) doc.text(doc.splitTextToSize(details.toUpperCase(), w - 4).slice(0, 2), x + w / 2, y + h - 4.3, { align: "center" });
}

function drawLegend(doc, x, y, w, brand) {
  const colors = brand.colors;
  setFill(doc, "#FFFFFF");
  setStroke(doc, "#D8E1D1");
  doc.roundedRect(x, y, w, 10, 3, 3, "FD");
  const keys = ["Comida", "Gimnasio", "Cancha", "Viaje", "Partido", "Descanso"];
  const gap = w / keys.length;
  keys.forEach((key, idx) => {
    const st = TYPE_STYLES[key];
    const cx = x + idx * gap + 6;
    setFill(doc, st.color);
    doc.roundedRect(cx, y + 2.2, 5.5, 5.5, 1.2, 1.2, "F");
    drawIcon(doc, key, cx + 2.75, y + 4.95, st.text === "#FFFFFF" ? "#FFFFFF" : "#111827");
    setText(doc, colors.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5);
    doc.text(st.label.toUpperCase(), cx + 7.5, y + 6);
  });
}

function drawFooter(doc, brand) {
  const colors = brand.colors;
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  setFill(doc, colors.primaryDeep);
  doc.rect(0, ph - 8, pw, 8, "F");
  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.7);
  doc.text("Documento operativo del cuerpo técnico", 6, ph - 3.2);
  doc.text(`Exportado el ${exportedDate()} por PerformancePitch`, pw - 6, ph - 3.2, { align: "right" });
}

async function buildImageCache(events) {
  const urls = [...new Set(events.map((e) => e.rival_logo_url).filter(Boolean))];
  const entries = await Promise.all(urls.map(async (url) => [url, await loadSafeImage(url)]));
  return Object.fromEntries(entries.filter(([, value]) => value));
}

export async function buildProfessionalWeekSchedulePDF({ days, eventsForDate, weekLabel, squadName, season, brand, includeEmpty = true }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const allEvents = days.flatMap((d) => eventsForDate(d.format("YYYY-MM-DD")));
  const imageCache = await buildImageCache(allEvents);

  setFill(doc, "#F6F8F2");
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), "F");
  drawHeader(doc, days, squadName, season || "", brand);
  const logo = await loadSafeImage(brand.logoUrl);
  if (logo && addImageSafe(doc, logo, 4, 4.5, 22, 22)) {}
  else {
    setFill(doc, brand.colors.primary);
    doc.circle(15, 15.5, 11, "F");
    setText(doc, contrastText(brand.colors.primary));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(brand.shortName, 15, 18, { align: "center" });
  }
  drawScheduleGrid(doc, days, eventsForDate, imageCache, brand);
  drawLegend(doc, 22, 180, 253, brand);
  drawFooter(doc, brand);

  return doc;
}