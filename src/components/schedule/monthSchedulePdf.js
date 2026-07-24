import { jsPDF } from "jspdf";
import moment from "moment";
import "moment/locale/es";
import { contrastText, darken, lighten } from "@/lib/clubBrandResolver";

const DAYS_ES = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
const MONTHS_ES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
const DAY_HEADER = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

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

function typeColor(ev, brand) {
  const text = normalize(`${ev.event_type || ""} ${ev.type || ""} ${ev.title || ""}`);
  if (text.includes("partido") || text.includes(" vs ")) return brand.colors.accent;
  if (text.includes("descanso") || text.includes("libre")) return "#8D7AD9";
  if (text.includes("viaje")) return "#8B3FDB";
  if (text.includes("comida") || text.includes("desayuno") || text.includes("almuerzo") || text.includes("cena")) return "#D97706";
  if (text.includes("video")) return "#EA580C";
  if (text.includes("gimnasio") || text.includes("fuerza")) return "#1D4ED8";
  if (text.includes("cancha") || text.includes("entrenamiento")) return brand.colors.primary;
  return brand.colors.muted;
}

function eventTime(ev) { return ev.time || ev.start_time || ""; }

export async function buildMonthSchedulePDF({ month, eventsForDate, squadName, season, brand, includeEmpty = true }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const colors = brand.colors;

  // Fondo
  setFill(doc, "#FFFFFF");
  doc.rect(0, 0, pw, ph, "F");

  // Encabezado
  setFill(doc, colors.primaryDeep);
  doc.rect(0, 0, pw, 26, "F");
  setFill(doc, colors.accent);
  doc.rect(0, 26, pw, 1.5, "F");

  // Logo
  const logo = await loadSafeImage(brand.logoUrl);
  if (logo && addImageSafe(doc, logo, 10, 5, 16, 16)) {}
  else {
    setFill(doc, colors.primary);
    doc.circle(18, 13, 8, "F");
    setText(doc, contrastText(colors.primary));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(brand.shortName, 18, 15, { align: "center" });
  }

  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("CRONOGRAMA MENSUAL", 32, 12);
  setText(doc, colors.accent);
  doc.setFontSize(8);
  doc.text(`${String(squadName || "Plantel").toUpperCase()} · TEMPORADA ${season || "—"}`, 32, 18);
  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(MONTHS_ES[month.month()] + " " + month.year(), pw - 10, 12, { align: "right" });

  // Grilla del mes
  const startOfMonth = month.clone().startOf("month");
  const gridStart = startOfMonth.clone().startOf("isoWeek");
  const gridEnd = month.clone().endOf("month").endOf("isoWeek");
  const days = [];
  let d = gridStart.clone();
  while (d.isSameOrBefore(gridEnd, "day")) { days.push(d.clone()); d.add(1, "day"); }

  const gridTop = 34;
  const gridBottom = ph - 12;
  const gridH = gridBottom - gridTop;
  const headerH = 7;
  const rows = Math.ceil(days.length / 7);
  const rowH = (gridH - headerH) / rows;
  const colW = (pw - 10) / 7;
  const today = moment().format("YYYY-MM-DD");

  // Encabezado de días
  DAY_HEADER.forEach((label, i) => {
    setFill(doc, colors.primary);
    doc.rect(5 + i * colW, gridTop, colW - 0.5, headerH, "F");
    setText(doc, contrastText(colors.primary));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(label, 5 + i * colW + colW / 2, gridTop + 4.8, { align: "center" });
  });

  // Días
  days.forEach((day, i) => {
    const col = i % 7;
    const row = Math.floor(i / 7);
    const x = 5 + col * colW;
    const y = gridTop + headerH + row * rowH;
    const isCurrentMonth = day.isSame(month, "month");
    const dateStr = day.format("YYYY-MM-DD");
    const isToday = dateStr === today;
    const dayEvents = eventsForDate(dateStr) || [];

    setFill(doc, isCurrentMonth ? "#FFFFFF" : "#F8FAFC");
    setStroke(doc, colors.line);
    doc.setLineWidth(0.2);
    doc.rect(x, y, colW - 0.5, rowH - 0.5, "FD");

    if (isToday) {
      setFill(doc, colors.accent);
      doc.circle(x + 5, y + 4, 3.2, "F");
      setText(doc, contrastText(colors.accent));
    } else {
      setText(doc, isCurrentMonth ? colors.ink : colors.muted);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(String(day.date()), x + 5, y + 5.5, { align: "center" });

    if (isCurrentMonth && dayEvents.length) {
      const maxEvents = Math.floor((rowH - 8) / 4);
      dayEvents.slice(0, maxEvents).forEach((ev, j) => {
        const ey = y + 8 + j * 4;
        const c = typeColor(ev, brand);
        setFill(doc, c);
        doc.roundedRect(x + 1.5, ey - 1.5, 1.2, 1.2, 0.3, 0.3, "F");
        setText(doc, colors.ink);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5);
        const label = `${eventTime(ev) ? eventTime(ev) + " " : ""}${ev.rival ? "vs " + ev.rival : ev.title}`.toUpperCase();
        doc.text(doc.splitTextToSize(label, colW - 5).slice(0, 1), x + 3.5, ey);
      });
      if (dayEvents.length > maxEvents) {
        setText(doc, colors.muted);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5);
        doc.text(`+${dayEvents.length - maxEvents}`, x + colW - 3, y + rowH - 2, { align: "right" });
      }
    } else if (isCurrentMonth && !dayEvents.length && !includeEmpty) {
      // no mostrar nada
    }
  });

  // Pie
  setFill(doc, colors.primaryDeep);
  doc.rect(0, ph - 8, pw, 8, "F");
  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.text("Documento operativo del cuerpo técnico", 6, ph - 3.2);
  doc.text(`Exportado el ${moment().format("DD/MM/YYYY")} por PerformancePitch`, pw - 6, ph - 3.2, { align: "right" });

  return doc;
}