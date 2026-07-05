import { jsPDF } from "jspdf";
import { CLUB_BRAND } from "@/lib/clubBrand";

const BRAND = CLUB_BRAND.colors;

const TYPE_STYLES = {
  Partido: { fill: "#D71920", label: "Partido" },
  Descanso: { fill: "#0694A2", label: "Descanso" },
  Viaje: { fill: "#6D28D9", label: "Viaje" },
  Comida: { fill: "#F97316", label: "Comida" },
  Gimnasio: { fill: "#7C3AED", label: "Gimnasio" },
  Cancha: { fill: "#16A34A", label: "Cancha" },
  Entrenamiento: { fill: "#16A34A", label: "Entrenamiento" },
  Video: { fill: "#2563EB", label: "Video" },
  Reunión: { fill: "#CA8A04", label: "Reunión" },
  Otro: { fill: "#64748B", label: "Actividad" },
};

function rgb(hex) {
  const clean = hex.replace("#", "");
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

function setFill(doc, hex) { doc.setFillColor(...rgb(hex)); }
function setText(doc, hex) { doc.setTextColor(...rgb(hex)); }

function styleFor(ev) {
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
    setFill(doc, "#FFFFFF");
    doc.circle(x, y, size / 2 - 4, "F");
    setText(doc, BRAND.green);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(CLUB_BRAND.shortName, x, y + 1.8, { align: "center" });
  }
}

function eventSubtitle(ev) {
  return [
    ev.time || ev.start_time,
    ev.end_time ? `a ${ev.end_time}` : "",
    ev.location,
    ev.rival ? `vs ${ev.rival}` : "",
    ev.home_away,
  ].filter(Boolean).join(" · ");
}

function drawMetric(doc, x, y, value, label, color = BRAND.green) {
  setFill(doc, "#FFFFFF");
  doc.roundedRect(x, y, 35, 13, 2, 2, "F");
  setText(doc, color);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(String(value), x + 4, y + 7.5);
  setText(doc, BRAND.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.6);
  doc.text(label.toUpperCase(), x + 4, y + 11);
}

export async function buildProfessionalWeekSchedulePDF({ days, eventsForDate, weekLabel, squadName, season }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 8;
  const allEvents = days.flatMap((d) => eventsForDate(d.format("YYYY-MM-DD")));
  const matches = allEvents.filter((e) => (e.event_type || e.type) === "Partido").length;
  const trainings = allEvents.filter((e) => ["Entrenamiento", "Cancha", "Gimnasio"].includes(e.event_type || e.type)).length;
  const trips = allEvents.filter((e) => (e.event_type || e.type) === "Viaje").length;

  setFill(doc, "#FFFFFF");
  doc.rect(0, 0, pw, ph, "F");
  setFill(doc, BRAND.greenDark);
  doc.rect(0, 0, pw, 31, "F");
  setFill(doc, BRAND.green);
  doc.rect(0, 0, pw, 24, "F");
  setFill(doc, BRAND.yellow);
  doc.rect(0, 24, pw, 2.2, "F");
  await drawClubMark(doc, 18, 13, 18);

  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("CRONOGRAMA SEMANAL", 31, 11.5);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`${squadName || "Plantel"}${season ? ` · Temporada ${season}` : ""}`, 31, 17);
  doc.text(weekLabel, 31, 21.5);

  const metricX = pw - 158;
  drawMetric(doc, metricX, 6, allEvents.length, "eventos", BRAND.green);
  drawMetric(doc, metricX + 38, 6, trainings, "cargas", "#16A34A");
  drawMetric(doc, metricX + 76, 6, matches, "partidos", "#D71920");
  drawMetric(doc, metricX + 114, 6, trips, "viajes", "#6D28D9");

  const legend = ["Partido", "Entrenamiento", "Gimnasio", "Comida", "Descanso", "Viaje"];
  let lx = 118;
  legend.forEach((key) => {
    const st = TYPE_STYLES[key] || TYPE_STYLES.Otro;
    setFill(doc, st.fill);
    doc.roundedRect(lx, 34.5, 4, 4, 1, 1, "F");
    setText(doc, BRAND.muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.text(st.label.toUpperCase(), lx + 5.5, 37.8);
    lx += 25;
  });

  setFill(doc, BRAND.panel);
  doc.roundedRect(margin, 32, pw - margin * 2, ph - 43, 3, 3, "F");
  doc.setDrawColor(...rgb(BRAND.line));
  doc.roundedRect(margin, 32, pw - margin * 2, ph - 43, 3, 3, "S");

  const gridX = margin + 5;
  const gridY = 43;
  const gridW = pw - margin * 2 - 10;
  const colGap = 2;
  const colW = (gridW - colGap * 6) / 7;
  const colH = ph - gridY - 17;

  days.forEach((d, i) => {
    const x = gridX + i * (colW + colGap);
    const dateKey = d.format("YYYY-MM-DD");
    const evs = eventsForDate(dateKey);
    setFill(doc, "#FFFFFF");
    doc.roundedRect(x, gridY, colW, colH, 2, 2, "F");
    doc.setDrawColor(...rgb("#E5E7EB"));
    doc.roundedRect(x, gridY, colW, colH, 2, 2, "S");

    setFill(doc, i >= 5 ? "#EEF7F1" : "#F3F4F6");
    doc.roundedRect(x + 1.2, gridY + 1.2, colW - 2.4, 13, 1.6, 1.6, "F");
    setText(doc, BRAND.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.text(d.format("dddd").toUpperCase(), x + colW / 2, gridY + 6, { align: "center" });
    setText(doc, BRAND.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text(d.format("DD/MM/YYYY"), x + colW / 2, gridY + 10.5, { align: "center" });

    const areaY = gridY + 17;
    const available = colH - 20;
    const maxVisible = Math.max(1, Math.min(evs.length, 6));
    const cardH = evs.length > 4 ? 14 : 17;
    const visible = evs.slice(0, Math.floor(available / cardH));

    if (!visible.length) {
      setText(doc, "#9CA3AF");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.text("SIN ACTIVIDADES", x + colW / 2, areaY + 12, { align: "center" });
    }

    visible.forEach((ev, idx) => {
      const y = areaY + idx * cardH;
      const st = styleFor(ev);
      setFill(doc, st.fill);
      doc.roundedRect(x + 1.8, y, colW - 3.6, cardH - 1.6, 2, 2, "F");
      setText(doc, "#FFFFFF");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.7);
      const title = String(ev.title || st.label).toUpperCase();
      doc.text(title, x + 4, y + 5.2, { maxWidth: colW - 8 });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.4);
      const sub = eventSubtitle(ev);
      if (sub) doc.text(sub, x + 4, y + 9.5, { maxWidth: colW - 8 });
      if (ev.notes && cardH >= 16) {
        doc.setFontSize(4.8);
        doc.text(String(ev.notes), x + 4, y + 13, { maxWidth: colW - 8 });
      }
    });

    if (evs.length > visible.length) {
      setText(doc, BRAND.green);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.6);
      doc.text(`+${evs.length - visible.length} actividades más`, x + colW / 2, gridY + colH - 3, { align: "center" });
    }
  });

  setFill(doc, BRAND.green);
  doc.rect(0, ph - 8, pw, 8, "F");
  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.2);
  doc.text(`PERFORMANCEPITCH · ${CLUB_BRAND.name.toUpperCase()}`, margin, ph - 3.2);
  doc.setFont("helvetica", "normal");
  doc.text("Documento operativo — horarios sujetos a modificación", pw - margin, ph - 3.2, { align: "right" });

  return doc;
}