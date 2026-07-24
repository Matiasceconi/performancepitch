import { jsPDF } from "jspdf";
import moment from "moment";
import "moment/locale/es";
import { contrastText, darken, lighten } from "@/lib/clubBrandResolver";

const DAYS = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];

function rgb(hex) {
  const clean = String(hex || "#000000").replace("#", "");
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}
function setFill(doc, hex) { doc.setFillColor(...rgb(hex)); }
function setStroke(doc, hex) { doc.setDrawColor(...rgb(hex)); }
function setText(doc, hex) { doc.setTextColor(...rgb(hex)); }

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
function eventKey(event) {
  const text = normalize(`${event.event_type || ""} ${event.type || ""} ${event.title || ""} ${event.location || ""}`);
  if (text.includes("desayuno") || text.includes("cafe") || text.includes("café")) return "coffee";
  if (text.includes("almuerzo") || text.includes("cena") || text.includes("comida") || text.includes("comedor")) return "plate";
  if (text.includes("gimnasio") || text.includes("fuerza") || text.includes("gym")) return "gym";
  if (text.includes("campo") || text.includes("cancha") || text.includes("entrenamiento")) return "field";
  if (text.includes("partido") || text.includes("vs ")) return "match";
  if (text.includes("viaje") || text.includes("llegada") || text.includes("traslado")) return "bus";
  if (text.includes("formulario") || text.includes("wellness") || text.includes("percepcion") || text.includes("rpe")) return "phone";
  return "activity";
}
function timeText(event) {
  const time = event.time || event.start_time || "";
  const end = event.end_time || "";
  const text = normalize(event.title || "");
  if (!time && !end) return "—";
  if ((text.includes("formulario") || text.includes("percepcion")) && time) return `HASTA\n${time} HS`;
  if (time && end) return `${time}\n${end} HS`;
  return `${time || end} HS`;
}

function drawPhone(doc, x, y, color) { setStroke(doc, color); setFill(doc, color); doc.setLineWidth(1.1); doc.roundedRect(x - 4.5, y - 8, 9, 16, 1.3, 1.3, "S"); doc.circle(x, y + 5.6, 0.7, "F"); doc.line(x - 2.3, y - 5.6, x + 2.3, y - 5.6); }
function drawCoffee(doc, x, y, color) { setStroke(doc, color); doc.setLineWidth(1.2); doc.roundedRect(x - 7, y - 1, 11, 8, 1.3, 1.3, "S"); doc.circle(x + 6, y + 3, 3, "S"); doc.line(x - 8, y + 8, x + 6, y + 8); doc.line(x - 4, y - 8, x - 4, y - 4); doc.line(x, y - 8, x, y - 4); doc.line(x + 4, y - 8, x + 4, y - 4); }
function drawPlate(doc, x, y, color) { setStroke(doc, color); setFill(doc, color); doc.setLineWidth(0.9); doc.circle(x, y, 8.2, "S"); doc.circle(x, y, 4.4, "S"); doc.line(x - 12, y - 6, x - 12, y + 6); doc.line(x - 13.8, y - 6, x - 13.8, y - 2.3); doc.line(x - 10.2, y - 6, x - 10.2, y - 2.3); doc.line(x + 12, y - 6, x + 12, y + 6); doc.line(x + 10.4, y - 6, x + 13.5, y - 1.3); }
function drawGym(doc, x, y, color) { setStroke(doc, color); setFill(doc, color); doc.setLineWidth(1.3); doc.line(x - 7.5, y, x + 7.5, y); doc.roundedRect(x - 11, y - 4, 3, 8, 0.6, 0.6, "F"); doc.roundedRect(x - 7.8, y - 3, 2.4, 6, 0.5, 0.5, "F"); doc.roundedRect(x + 5.4, y - 3, 2.4, 6, 0.5, 0.5, "F"); doc.roundedRect(x + 8, y - 4, 3, 8, 0.6, 0.6, "F"); }
function drawField(doc, x, y, color) { setStroke(doc, color); doc.setLineWidth(1); doc.roundedRect(x - 11, y - 7, 22, 14, 1.2, 1.2, "S"); doc.line(x, y - 7, x, y + 7); doc.circle(x, y, 2.4, "S"); doc.rect(x - 11, y - 3.5, 3.2, 7, "S"); doc.rect(x + 7.8, y - 3.5, 3.2, 7, "S"); }
function drawBus(doc, x, y, color) { setStroke(doc, color); setFill(doc, color); doc.setLineWidth(1); doc.roundedRect(x - 9, y - 6, 18, 12, 1.5, 1.5, "S"); doc.circle(x - 5, y + 6, 1.5, "F"); doc.circle(x + 5, y + 6, 1.5, "F"); doc.line(x - 7, y - 2, x + 7, y - 2); }
function drawMatch(doc, x, y, color) { setStroke(doc, color); setFill(doc, color); doc.setLineWidth(1); doc.circle(x, y, 7, "S"); doc.circle(x, y, 2, "F"); doc.line(x, y - 7, x, y + 7); doc.line(x - 7, y, x + 7, y); }
function drawActivityIcon(doc, key, x, y, color) {
  if (key === "coffee") return drawCoffee(doc, x, y, color);
  if (key === "plate") return drawPlate(doc, x, y, color);
  if (key === "gym") return drawGym(doc, x, y, color);
  if (key === "field") return drawField(doc, x, y, color);
  if (key === "match") return drawMatch(doc, x, y, color);
  if (key === "bus") return drawBus(doc, x, y, color);
  return drawPhone(doc, x, y, color);
}
function drawPin(doc, x, y, color) { setFill(doc, color); setStroke(doc, color); doc.circle(x, y - 1.5, 3.7, "F"); doc.triangle(x - 3.1, y + 0.5, x + 3.1, y + 0.5, x, y + 7, "F"); setFill(doc, "#FFFFFF"); doc.circle(x, y - 1.5, 1.45, "F"); }

function drawHeader(doc, day, squadName, logo, brand) {
  const colors = brand.colors;
  const pw = doc.internal.pageSize.getWidth();
  setFill(doc, colors.primaryDeep); doc.rect(0, 0, pw, 52, "F");
  setFill(doc, colors.primaryDark); doc.triangle(0, 0, pw * 0.62, 0, 0, 52, "F");
  setFill(doc, colors.primary); doc.triangle(pw * 0.58, 0, pw, 0, pw * 0.78, 52, "F");
  setFill(doc, colors.accent); doc.triangle(pw - 38, 0, pw, 0, pw, 18, "F");
  setFill(doc, colors.accent); doc.triangle(0, 52, 14, 52, 0, 66, "F");

  if (logo && addImageSafe(doc, logo, 7, 15, 28, 28)) {}
  else { setFill(doc, colors.primary); setStroke(doc, colors.accent); doc.setLineWidth(1.2); doc.circle(21, 29, 12.5, "FD"); setText(doc, contrastText(colors.primary)); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(brand.shortName, 21, 32, { align: "center" }); }

  setText(doc, "#FFFFFF"); doc.setFont("helvetica", "bolditalic"); doc.setFontSize(20);
  doc.text("CRONOGRAMA DIARIO", 43, 27);
  setFill(doc, colors.accent); doc.rect(43, 34, 43, 11, "F");
  setFill(doc, colors.primary); doc.triangle(86, 34, 124, 34, 116, 45, "F");
  setText(doc, colors.primaryDeep); doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
  doc.text(String(squadName || "PLANTEL").toUpperCase(), 49, 42);

  setFill(doc, colors.primaryDeep); doc.roundedRect(154, 8, 48, 28, 4, 4, "F");
  setStroke(doc, "#FFFFFF"); doc.setLineWidth(1); doc.roundedRect(163, 18, 8, 8, 1.2, 1.2, "S"); doc.line(163, 21, 171, 21); doc.line(165, 16, 165, 20); doc.line(169, 16, 169, 20);
  setText(doc, "#FFFFFF"); doc.setFont("helvetica", "bold"); doc.setFontSize(13.5);
  doc.text(day.format("DD/MM/YY"), 176, 23);
  setText(doc, colors.accent); doc.setFontSize(9);
  doc.text(DAYS[day.day()], 176, 32);
}

function drawMatchSection(doc, ev, x, y, w, logo, brand) {
  const colors = brand.colors;
  const h = 60;
  setFill(doc, colors.primaryDeep); setStroke(doc, "#FFFFFF"); doc.setLineWidth(0.5);
  doc.roundedRect(x, y, w, h, 3, 3, "FD");
  setFill(doc, colors.primary); doc.rect(x, y, w, 8, "F");
  setText(doc, "#FFFFFF"); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("PARTIDO", x + w / 2, y + 5.5, { align: "center" });

  if (logo && addImageSafe(doc, logo, x + w / 2 - 12, y + 12, 24, 24)) {}
  else { setFill(doc, "#FFFFFF"); doc.circle(x + w / 2, y + 24, 12, "F"); drawMatch(doc, x + w / 2, y + 24, colors.primaryDeep); }

  setText(doc, "#FFFFFF"); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text(doc.splitTextToSize((ev.rival ? `VS ${ev.rival}` : ev.title).toUpperCase(), w - 8).slice(0, 2), x + w / 2, y + 44, { align: "center" });
  doc.setFontSize(8);
  const details = [ev.home_away, ev.time || ev.start_time, ev.competition].filter(Boolean).join(" · ");
  if (details) doc.text(details.toUpperCase(), x + w / 2, y + 54, { align: "center" });
  return h + 4;
}

function drawTable(doc, events, brand) {
  const colors = brand.colors;
  const x = 7; const y = 66; const w = 196;
  const matchEvents = events.filter(e => normalize(`${e.event_type} ${e.type} ${e.title}`).includes("partido"));
  const otherEvents = events.filter(e => !normalize(`${e.event_type} ${e.type} ${e.title}`).includes("partido"));
  const rows = Math.max(otherEvents.length, 1);
  const rowH = events.length ? Math.max(20, Math.min(38, 185 / rows)) : 30;
  const h = 14 + rowH * rows;
  const cols = [24, 68, 48, 56];
  setFill(doc, "#FFFFFF"); setStroke(doc, "#DCDCDC"); doc.roundedRect(x, y, w, h, 2.2, 2.2, "FD");
  setFill(doc, colors.primaryDeep); doc.roundedRect(x, y, w, 14, 2.2, 2.2, "F");
  setText(doc, "#FFFFFF"); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  ["ACT.", "DESCRIPCIÓN", "HORA", "LUGAR"].forEach((label, i) => doc.text(label, x + cols.slice(0, i).reduce((a, b) => a + b, 0) + cols[i] / 2, y + 9.3, { align: "center" }));
  let cx = x;
  cols.slice(0, -1).forEach((cw) => { cx += cw; setStroke(doc, colors.accent); doc.setLineWidth(0.25); doc.line(cx, y, cx, y + h); });

  for (let i = 0; i < rows; i++) {
    const ev = otherEvents[i]; const ry = y + 14 + i * rowH;
    setStroke(doc, "#E2E2E2"); doc.setLineWidth(0.25); doc.line(x, ry, x + w, ry);
    if (!ev) continue;
    const key = eventKey(ev);
    drawActivityIcon(doc, key, x + cols[0] / 2, ry + rowH / 2, colors.primaryDeep);
    setText(doc, colors.primaryDeep); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(doc.splitTextToSize(String(ev.title || ev.event_type || ev.type || "ACTIVIDAD").toUpperCase(), cols[1] - 12).slice(0, 3), x + cols[0] + 7, ry + rowH / 2 - 1.5);
    setFill(doc, colors.primaryDeep); doc.roundedRect(x + cols[0] + cols[1] + 4, ry + rowH / 2 - 8, 40, 16, 3.5, 3.5, "F");
    setText(doc, "#FFFFFF"); doc.setFont("helvetica", "bold"); doc.setFontSize(String(timeText(ev)).includes("\n") ? 7.8 : 10);
    const t = String(timeText(ev)).split("\n");
    if (t.length > 1) { doc.text(t[0], x + cols[0] + cols[1] + 24, ry + rowH / 2 - 2.2, { align: "center" }); doc.text(t[1], x + cols[0] + cols[1] + 24, ry + rowH / 2 + 5.1, { align: "center" }); }
    else doc.text(t[0], x + cols[0] + cols[1] + 24, ry + rowH / 2 + 3.2, { align: "center" });
    drawPin(doc, x + cols[0] + cols[1] + cols[2] + cols[3] / 2, ry + rowH / 2 - 6, colors.accent);
    setText(doc, colors.primaryDeep); doc.setFont("helvetica", "bold"); doc.setFontSize(8.4);
    doc.text(doc.splitTextToSize(String(ev.location || "—").toUpperCase(), cols[3] - 10).slice(0, 3), x + cols[0] + cols[1] + cols[2] + cols[3] / 2, ry + rowH / 2 + 9, { align: "center" });
  }

  // Sección de partido destacada
  if (matchEvents.length) {
    const matchY = y + h + 6;
    matchEvents.forEach((ev, i) => {
      const logo = ev.rival_logo_url ? null : null; // se carga async fuera
      drawMatchSection(doc, ev, x, matchY + i * 64, w, null, brand);
    });
  }
}

function drawFooter(doc, logo, brand) {
  const colors = brand.colors;
  const pw = doc.internal.pageSize.getWidth(); const ph = doc.internal.pageSize.getHeight();
  setStroke(doc, colors.primary); doc.setLineWidth(0.5); doc.line(64, ph - 32, 94, ph - 32); doc.line(116, ph - 32, 146, ph - 32);
  if (logo && addImageSafe(doc, logo, 98, ph - 39, 14, 14)) {}
  else { setFill(doc, colors.primary); setStroke(doc, colors.accent); doc.setLineWidth(1); doc.circle(105, ph - 32, 6.5, "FD"); setText(doc, contrastText(colors.primary)); doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.text(brand.shortName, 105, ph - 30, { align: "center" }); }
  setText(doc, colors.primaryDeep); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.text(brand.name.toUpperCase(), pw / 2, ph - 18, { align: "center" });
  setText(doc, colors.primary); doc.setFontSize(5.5); doc.text(String(brand.squadName || "").toUpperCase(), pw / 2, ph - 13.5, { align: "center" });
  setFill(doc, colors.primaryDeep); doc.rect(0, ph - 8, pw, 8, "F");
  setFill(doc, colors.primary); doc.triangle(0, ph - 8, 76, ph - 8, 54, ph, "F");
  setFill(doc, colors.accent); doc.triangle(pw - 28, ph - 8, pw, ph - 8, pw, ph, "F");
}

export async function buildDailySchedulePDF({ day, events, squadName, brand }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const logo = await loadSafeImage(brand.logoUrl);
  // Precargar escudos de rivales
  const matchEvents = events.filter(e => normalize(`${e.event_type} ${e.type} ${e.title}`).includes("partido"));
  const rivalLogos = await Promise.all(matchEvents.map(e => loadSafeImage(e.rival_logo_url)));
  setFill(doc, "#F7F7F5"); doc.rect(0, 0, 210, 297, "F");
  drawHeader(doc, day, squadName, logo, brand);
  const sorted = [...events].sort((a, b) => (a.time || a.start_time || "").localeCompare(b.time || b.start_time || ""));
  drawTable(doc, sorted, brand);
  // Dibujar escudos de partidos sobre la sección de partido
  matchEvents.forEach((ev, i) => {
    const logo = rivalLogos[i];
    if (logo) {
      const matchY = 66 + 14 + Math.max(20, Math.min(38, 185 / Math.max(sorted.filter(e => !normalize(`${e.event_type} ${e.type} ${e.title}`).includes("partido")).length, 1))) * sorted.filter(e => !normalize(`${e.event_type} ${e.type} ${e.title}`).includes("partido")).length + 6 + i * 64;
      addImageSafe(doc, logo, 7 + 196 / 2 - 12, matchY + 12, 24, 24);
    }
  });
  drawFooter(doc, logo, brand);
  return doc;
}