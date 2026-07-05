import moment from "moment";
import { jsPDF } from "jspdf";

const CLUB_LOGO_URL = "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/36f6c4008_defensa.png";
const PAGE = { w: 297, h: 210, m: 12, top: 40, bottom: 194 };

export async function imageToDataUrl(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

function fmt(value, unit = "") {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  const shown = unit === "km/h" || n < 100 ? n.toFixed(1) : Math.round(n).toLocaleString("es-AR");
  return `${shown} ${unit}`.trim();
}

function setText(doc, color = [40, 40, 40], size = 9, style = "normal") {
  doc.setTextColor(...color);
  doc.setFontSize(size);
  doc.setFont("helvetica", style);
}

function addImage(doc, dataUrl, x, y, w, h) {
  if (!dataUrl) return;
  const type = dataUrl.includes("image/png") ? "PNG" : "JPEG";
  doc.addImage(dataUrl, type, x, y, w, h);
}

function header(doc, logo, meta) {
  doc.setFillColor(248, 250, 248); doc.rect(0, 0, PAGE.w, PAGE.h, "F");
  doc.setFillColor(0, 114, 54); doc.rect(0, 0, PAGE.w, 10, "F");
  doc.setFillColor(250, 204, 21); doc.rect(0, 10, PAGE.w, 2.5, "F");
  addImage(doc, logo, 12, 16, 18, 18);
  setText(doc, [0, 80, 42], 14, "bold"); doc.text("PerformancePitch", 36, 22);
  setText(doc, [35, 35, 35], 10, "bold"); doc.text("Informe profesional de rendimiento · Resumen del microciclo", 36, 29);
  setText(doc, [90, 90, 90], 7.5);
  doc.text(`Plantel: ${meta.squadName || "Reserva"} · Temporada: ${meta.season || "—"} · Microciclo: ${meta.microcycle || "—"}`, 36, 35);
  doc.text(`Fechas: ${meta.start || "—"} - ${meta.end || "—"} · Rival: ${meta.rival || "—"} · Resultado: ${meta.result || "—"}`, 170, 22);
  doc.text("Generado automáticamente", 170, 29);
}

function footer(doc, page, total, generatedAt) {
  doc.setDrawColor(220, 225, 220); doc.line(PAGE.m, 198, PAGE.w - PAGE.m, 198);
  setText(doc, [95, 95, 95], 7);
  doc.text(`Página ${page} de ${total}`, PAGE.m, 203);
  doc.text(`Generado ${generatedAt}`, 122, 203);
  doc.text("PerformancePitch", 260, 203);
}

function addPage(doc, logo, meta) {
  if (doc.__started) doc.addPage("a4", "landscape");
  doc.__started = true;
  header(doc, logo, meta);
}

function hexToRgb(hex) {
  const clean = String(hex || "#22c55e").replace("#", "");
  const n = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function chunks(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function drawBarChart(doc, metric, data, x, y, w, h) {
  doc.setFillColor(255, 255, 255); doc.roundedRect(x, y, w, h, 3, 3, "F");
  doc.setDrawColor(220, 226, 220); doc.roundedRect(x, y, w, h, 3, 3, "S");
  setText(doc, [20, 20, 20], 10, "bold"); doc.text(metric.label, x + 5, y + 8);
  setText(doc, [105, 105, 105], 7); doc.text("Promedio diario del grupo principal", x + 5, y + 14);

  const plot = { x: x + 12, y: y + 22, w: w - 20, h: h - 38 };
  const values = data.map((d) => Number(d[metric.key])).filter(Number.isFinite);
  const max = Math.max(...values, 1) * 1.18;
  doc.setDrawColor(232, 235, 232);
  for (let i = 0; i <= 4; i++) {
    const gy = plot.y + (plot.h * i) / 4;
    doc.line(plot.x, gy, plot.x + plot.w, gy);
  }
  const gap = 3;
  const barW = Math.max(5, (plot.w - gap * (data.length + 1)) / Math.max(data.length, 1));
  data.forEach((d, i) => {
    const value = Number(d[metric.key]) || 0;
    const bh = Math.max(1.5, (value / max) * plot.h);
    const bx = plot.x + gap + i * (barW + gap);
    const by = plot.y + plot.h - bh;
    doc.setFillColor(...hexToRgb(metric.color)); doc.roundedRect(bx, by, barW, bh, 1.5, 1.5, "F");
    setText(doc, [40, 40, 40], 6.5, "bold");
    doc.text(fmt(value, metric.unit), bx + barW / 2, by - 2, { align: "center" });
    setText(doc, [90, 90, 90], 6);
    doc.text(String(d.md || d.label || "—"), bx + barW / 2, plot.y + plot.h + 5, { align: "center" });
    doc.text(moment(d.date).isValid() ? moment(d.date).format("DD/MM") : "", bx + barW / 2, plot.y + plot.h + 10, { align: "center" });
  });
}

function drawCharts(doc, logo, meta, metrics, dailySummaries) {
  const chartJobs = metrics.flatMap((metric) => chunks(dailySummaries, 8).map((data) => ({ metric, data })));
  chunks(chartJobs, 2).forEach((pair) => {
    addPage(doc, logo, meta);
    pair.forEach((job, i) => drawBarChart(doc, job.metric, job.data, i === 0 ? 12 : 153.5, 46, 131.5, 132));
  });
}

function drawDailyTable(doc, logo, meta, metrics, rows) {
  chunks(metrics, 5).forEach((metricSet) => {
    addPage(doc, logo, meta);
    setText(doc, [20, 20, 20], 12, "bold"); doc.text("Tabla diaria del microciclo", 12, 48);
    const headers = ["Día", "MD", "Ses.", "Jug.", "Exc.", ...metricSet.map((m) => m.short || m.label)];
    const widths = [34, 18, 52, 16, 16, ...metricSet.map(() => (PAGE.w - 24 - 136) / metricSet.length)];
    let x = 12, y = 56;
    doc.setFillColor(0, 114, 54); doc.rect(12, y, PAGE.w - 24, 8, "F");
    headers.forEach((h, i) => { setText(doc, [255, 255, 255], 7, "bold"); doc.text(h, x + widths[i] / 2, y + 5.2, { align: "center" }); x += widths[i]; });
    y += 8;
    rows.forEach((r, idx) => {
      x = 12; doc.setFillColor(idx % 2 ? 248 : 238, idx % 2 ? 250 : 244, idx % 2 ? 248 : 240); doc.rect(12, y, PAGE.w - 24, 9, "F");
      const cells = [moment(r.date).format("ddd DD/MM"), r.md || "—", (r.sessions || []).map((s) => s.title).join(" · ").slice(0, 42), r.gpsPlayers || 0, r.excludedCount || 0, ...metricSet.map((m) => fmt(r[m.key], m.unit))];
      cells.forEach((c, i) => { setText(doc, [35, 35, 35], 6.8, i < 2 ? "bold" : "normal"); doc.text(String(c), x + widths[i] / 2, y + 5.8, { align: "center", maxWidth: widths[i] - 2 }); x += widths[i]; });
      y += 9;
    });
  });
}

async function drawPlayerRow(doc, item, x, y, metric) {
  const photo = await imageToDataUrl(item.player?.photo_url || item.photo_url);
  if (photo) addImage(doc, photo, x, y - 4, 8, 8);
  else { doc.setFillColor(0, 114, 54); doc.circle(x + 4, y, 4, "F"); setText(doc, [255, 255, 255], 5.5, "bold"); doc.text((item.name || "J").slice(0, 1), x + 4, y + 1.8, { align: "center" }); }
  setText(doc, [20, 20, 20], 7, "bold"); doc.text(item.name || "Jugador", x + 11, y - 1, { maxWidth: 34 });
  setText(doc, [95, 95, 95], 6); doc.text(item.player?.position || "—", x + 11, y + 4, { maxWidth: 34 });
  setText(doc, [0, 114, 54], 7, "bold"); doc.text(fmt(item.value, metric.unit), x + 58, y + 1, { align: "right" });
}

async function drawRankings(doc, logo, meta, highlights) {
  for (const group of chunks(highlights || [], 4)) {
    addPage(doc, logo, meta);
    setText(doc, [20, 20, 20], 12, "bold"); doc.text("Rankings TOP 3", 12, 48);
    for (let i = 0; i < group.length; i++) {
      const h = group[i];
      const x = i % 2 === 0 ? 12 : 153.5;
      const y = i < 2 ? 56 : 122;
      doc.setFillColor(255, 255, 255); doc.roundedRect(x, y, 131.5, 56, 3, 3, "F");
      doc.setDrawColor(220, 226, 220); doc.roundedRect(x, y, 131.5, 56, 3, 3, "S");
      doc.setFillColor(...hexToRgb(h.metric.color)); doc.rect(x, y, 131.5, 4, "F");
      setText(doc, [20, 20, 20], 9, "bold"); doc.text(h.metric.label, x + 5, y + 12);
      for (let r = 0; r < 3; r++) {
        const player = h.top?.[r];
        if (!player) continue;
        setText(doc, [0, 114, 54], 8, "bold"); doc.text(`#${r + 1}`, x + 5, y + 24 + r * 10);
        await drawPlayerRow(doc, player, x + 17, y + 23 + r * 10, h.metric);
      }
    }
  }
}

function drawComparison(doc, logo, meta, comparison) {
  addPage(doc, logo, meta);
  setText(doc, [20, 20, 20], 12, "bold"); doc.text("Comparación semanal", 12, 48);
  (comparison || []).slice(0, 8).forEach((c, i) => {
    const x = 12 + (i % 4) * 69;
    const y = 58 + Math.floor(i / 4) * 54;
    const up = Number(c.diff) > 0;
    const stable = c.diff == null || Math.abs(Number(c.diff)) < 8;
    const color = stable ? [80, 80, 80] : up ? [220, 38, 38] : [0, 114, 54];
    doc.setFillColor(255, 255, 255); doc.roundedRect(x, y, 62, 44, 3, 3, "F");
    doc.setDrawColor(222, 226, 222); doc.roundedRect(x, y, 62, 44, 3, 3, "S");
    setText(doc, [25, 25, 25], 8, "bold"); doc.text(c.metric.label, x + 4, y + 7);
    setText(doc, [0, 114, 54], 12, "bold"); doc.text(fmt(c.current, c.metric.unit), x + 4, y + 18);
    setText(doc, [95, 95, 95], 6.5); doc.text(`Últ. 4 sem.: ${fmt(c.previous, c.metric.unit)}`, x + 4, y + 27, { maxWidth: 54 });
    setText(doc, color, 9, "bold"); doc.text(`${stable ? "→" : up ? "↑" : "↓"} ${c.diff == null ? "—" : `${Math.abs(c.diff).toFixed(1)}%`}`, x + 4, y + 37);
  });
}

async function drawFeaturedPlayers(doc, logo, meta, highlights) {
  const best = (highlights || []).map((h) => ({ ...h.best, metric: h.metric })).filter((x) => x?.name).slice(0, 6);
  if (!best.length) return;
  addPage(doc, logo, meta);
  setText(doc, [20, 20, 20], 12, "bold"); doc.text("Jugadores destacados del microciclo", 12, 48);
  for (let i = 0; i < best.length; i++) {
    const p = best[i];
    const x = 12 + (i % 3) * 92;
    const y = 60 + Math.floor(i / 3) * 52;
    doc.setFillColor(255, 255, 255); doc.roundedRect(x, y, 84, 42, 3, 3, "F");
    doc.setDrawColor(222, 226, 222); doc.roundedRect(x, y, 84, 42, 3, 3, "S");
    await drawPlayerRow(doc, p, x + 6, y + 15, p.metric);
    setText(doc, [95, 95, 95], 6.5); doc.text(p.metric.label, x + 6, y + 32);
  }
}

function drawAiAnalysis(doc, logo, meta, aiText) {
  if (!aiText) return;
  addPage(doc, logo, meta);
  setText(doc, [20, 20, 20], 12, "bold"); doc.text("Conclusiones automáticas del microciclo", 12, 48);
  setText(doc, [35, 35, 35], 9);
  doc.text(doc.splitTextToSize(aiText, 265), 12, 60);
}

export async function generateMicrocyclePdf({ squadName, season, dailySummaries, highlights, comparison, metrics, cycleDays, options, aiText }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const logo = await imageToDataUrl(CLUB_LOGO_URL);
  const firstDay = dailySummaries?.[0];
  const lastDay = dailySummaries?.[dailySummaries.length - 1];
  const context = (cycleDays || []).find((d) => d.rival || d.resultado || d.microcycle_name) || {};
  const meta = {
    squadName: squadName || "Reserva",
    season,
    microcycle: context.microcycle_name || `${firstDay?.md || ""} ${firstDay?.date ? moment(firstDay.date).format("DD/MM") : ""}`.trim(),
    start: firstDay?.date ? moment(firstDay.date).format("DD/MM/YYYY") : "—",
    end: lastDay?.date ? moment(lastDay.date).format("DD/MM/YYYY") : "—",
    rival: context.rival,
    result: context.resultado,
  };
  if (options.includeCharts) drawCharts(doc, logo, meta, metrics, dailySummaries || []);
  if (options.includeDailyTable) drawDailyTable(doc, logo, meta, metrics, dailySummaries || []);
  if (options.includeComparison) drawComparison(doc, logo, meta, comparison || []);
  if (options.includeRankings) await drawRankings(doc, logo, meta, highlights || []);
  if (options.includeHighlightedPlayers) await drawFeaturedPlayers(doc, logo, meta, highlights || []);
  if (options.includeAi) drawAiAnalysis(doc, logo, meta, aiText);
  if (!doc.__started) addPage(doc, logo, meta);
  const total = doc.getNumberOfPages();
  const generatedAt = moment().format("DD/MM/YYYY HH:mm");
  for (let p = 1; p <= total; p++) { doc.setPage(p); footer(doc, p, total, generatedAt); }
  doc.save(`informe-microciclo-${firstDay?.date || "gps"}.pdf`);
}