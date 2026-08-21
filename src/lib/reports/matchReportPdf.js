import jsPDF from "jspdf";
import { CLUB_BRAND } from "@/lib/clubBrand";
import { REPORT_METRICS, fmtMetric, buildKpis, buildComparisonData, buildEvolutionData, buildComparisonTable, buildInsight } from "@/lib/matchReportData";
import { renderComparisonChartPng, renderEvolutionChartPng } from "./matchReportCharts.jsx";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;

function setColor(doc, fn, hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  doc[fn](r, g, b);
}

function drawHeader(doc, reportData, reportMeta) {
  const { selected, isMulti } = reportData;
  doc.setFillColor(0, 132, 61);
  doc.rect(0, 0, PAGE_W, 38, "F");
  setColor(doc, "setTextColor", "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("INFORME INDIVIDUAL DE RENDIMIENTO", MARGIN, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("PerformancePitch · Defensa y Justicia", MARGIN, 26);
  doc.setFontSize(9);
  const subtitle = isMulti
    ? `Últimos ${selected.length} partidos`
    : (reportMeta?.title || (selected[0]?.match?.rival ? `vs ${selected[0].match.rival}` : "Partido"));
  doc.text(subtitle, MARGIN, 33);
  try {
    doc.addImage(CLUB_BRAND.logoUrl, "PNG", PAGE_W - 34, 6, 22, 26);
  } catch {}
}

function drawInitials(doc, player, x, y, size) {
  doc.setFillColor(0, 132, 61);
  doc.roundedRect(x, y, size, size, 4, 4, "F");
  setColor(doc, "setTextColor", "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  const initials = (player?.first_name?.[0] || "") + (player?.last_name?.[0] || "");
  doc.text(initials || "?", x + size / 2, y + size / 2 + 3, { align: "center" });
}

function drawPlayerBlock(doc, reportData) {
  const { player, selected, isMulti } = reportData;
  let y = 46;
  const photoSize = 34;
  if (player?.photo_url) {
    try {
      doc.addImage(player.photo_url, "PNG", MARGIN, y, photoSize, photoSize, undefined, "FAST");
    } catch {
      drawInitials(doc, player, MARGIN, y, photoSize);
    }
  } else {
    drawInitials(doc, player, MARGIN, y, photoSize);
  }

  const textX = MARGIN + photoSize + 8;
  setColor(doc, "setTextColor", CLUB_BRAND.colors.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(player?.full_name || "Jugador", textX, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(doc, "setTextColor", "#6b7280");
  const posLine = [player?.position, player?.squad_name, player?.division].filter(Boolean).join(" · ");
  doc.text(posLine || "", textX, y + 16);
  if (player?.jersey_number) {
    doc.text(`Dorsal: ${player.jersey_number}`, textX, y + 23);
  }

  const match = selected[0]?.match;
  if (match) {
    const rightX = PAGE_W - MARGIN;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setColor(doc, "setTextColor", CLUB_BRAND.colors.ink);
    if (!isMulti) {
      doc.text(`Defensa y Justicia vs ${match.rival || "Rival"}`, rightX, y + 9, { align: "right" });
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setColor(doc, "setTextColor", "#6b7280");
    const dateStr = match.date ? new Date(match.date + "T00:00:00").toLocaleDateString("es-AR") : "—";
    if (!isMulti) {
      doc.text(`${dateStr} · ${match.competition || ""} · ${match.location || ""}`, rightX, y + 16, { align: "right" });
      doc.text(`Resultado: ${match.our_score ?? "?"} - ${match.rival_score ?? "?"}`, rightX, y + 23, { align: "right" });
    } else {
      const lastDate = selected[selected.length - 1]?.match?.date;
      const lastStr = lastDate ? new Date(lastDate + "T00:00:00").toLocaleDateString("es-AR") : "—";
      doc.text(`Período: ${dateStr} a ${lastStr}`, rightX, y + 9, { align: "right" });
      doc.text(`${selected.length} partidos analizados`, rightX, y + 16, { align: "right" });
    }
  }
  return y + photoSize + 6;
}

function drawKpis(doc, reportData, y) {
  const kpis = buildKpis(reportData);
  if (!kpis.length) return y;
  const cardW = (PAGE_W - 2 * MARGIN - 3 * 4) / 4;
  const cardH = 26;
  kpis.slice(0, 8).forEach((kpi, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = MARGIN + col * (cardW + 4);
    const cy = y + row * (cardH + 4);
    doc.setFillColor(246, 247, 243);
    doc.roundedRect(x, cy, cardW, cardH, 3, 3, "F");
    doc.setDrawColor(216, 222, 210);
    doc.roundedRect(x, cy, cardW, cardH, 3, 3, "S");
    setColor(doc, "setTextColor", "#6b7280");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(kpi.label.toUpperCase(), x + 3, cy + 6);
    setColor(doc, "setTextColor", CLUB_BRAND.colors.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(fmtMetric(kpi.value, kpi.decimals), x + 3, cy + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setColor(doc, "setTextColor", "#9ca3af");
    doc.text(kpi.unit, x + 3, cy + 19);
    const insight = buildInsight(kpi, reportData);
    if (insight) {
      const isPositive = insight.includes("marca") ? true : kpi.pct > 0;
      setColor(doc, "setTextColor", isPositive ? "#00843D" : "#dc2626");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.text(insight, x + 3, cy + 24);
    }
  });
  const rows = Math.ceil(Math.min(kpis.length, 8) / 4);
  return y + rows * (cardH + 4) + 4;
}

function drawChart(doc, png, x, y, w, h, title) {
  if (title) {
    setColor(doc, "setTextColor", CLUB_BRAND.colors.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, x, y);
    y += 4;
  }
  if (png) {
    try { doc.addImage(png, "PNG", x, y, w, h); } catch {}
  } else {
    doc.setFillColor(246, 247, 243);
    doc.roundedRect(x, y, w, h, 3, 3, "F");
  }
  return y + h + 6;
}

function drawTable(doc, reportData, y) {
  const { cols, rows } = buildComparisonTable(reportData);
  if (!rows.length) return y;
  const headers = ["Partido", "Min", ...cols.map((k) => REPORT_METRICS.find((m) => m.key === k).label)];
  const colWidths = [40, 14, ...cols.map(() => (PAGE_W - 2 * MARGIN - 54) / cols.length)];
  const rowH = 7;

  doc.setFillColor(0, 90, 52);
  doc.rect(MARGIN, y, PAGE_W - 2 * MARGIN, rowH, "F");
  setColor(doc, "setTextColor", "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  let cx = MARGIN;
  headers.forEach((h, i) => {
    doc.text(String(h), cx + 1, y + 5, { align: i === 0 ? "left" : "right" });
    cx += colWidths[i];
  });
  y += rowH;

  rows.forEach((row, ri) => {
    if (y + rowH > PAGE_H - MARGIN - 10) { doc.addPage(); y = MARGIN; }
    const isAvg = row.label === "PROMEDIO";
    if (ri % 2 === 0 || isAvg) {
      const fill = isAvg ? [230, 240, 230] : [246, 247, 243];
      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.rect(MARGIN, y, PAGE_W - 2 * MARGIN, rowH, "F");
    }
    setColor(doc, "setTextColor", isAvg ? CLUB_BRAND.colors.greenDeep : CLUB_BRAND.colors.ink);
    doc.setFont("helvetica", isAvg ? "bold" : "normal");
    doc.setFontSize(7);
    cx = MARGIN;
    const label = isAvg ? "PROMEDIO" : `${row.label} · ${row.date ? new Date(row.date + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : ""}`;
    doc.text(label, cx + 1, y + 5);
    cx += colWidths[0];
    doc.text(row.minutes != null ? String(row.minutes) : "—", cx + colWidths[1] - 1, y + 5, { align: "right" });
    cx += colWidths[1];
    cols.forEach((k, i) => {
      const metric = REPORT_METRICS.find((m) => m.key === k);
      doc.text(fmtMetric(row[k], metric.decimals), cx + colWidths[i + 2] - 1, y + 5, { align: "right" });
      cx += colWidths[i + 2];
    });
    y += rowH;
  });
  return y + 4;
}

function drawComment(doc, comment, y) {
  if (!comment || !comment.trim()) return y;
  if (y + 30 > PAGE_H - MARGIN - 10) { doc.addPage(); y = MARGIN; }
  setColor(doc, "setTextColor", CLUB_BRAND.colors.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Comentario del área de Rendimiento", MARGIN, y);
  y += 6;
  doc.setFillColor(246, 247, 243);
  doc.roundedRect(MARGIN, y, PAGE_W - 2 * MARGIN, 36, 3, 3, "F");
  setColor(doc, "setTextColor", "#374151");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(comment, PAGE_W - 2 * MARGIN - 6);
  doc.text(lines, MARGIN + 3, y + 6);
  return y + 40;
}

function drawFooter(doc) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    setColor(doc, "setTextColor", "#9ca3af");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`PerformancePitch · Defensa y Justicia · ${new Date().toLocaleDateString("es-AR")}`, MARGIN, PAGE_H - 6);
    doc.text(`Página ${i} de ${total}`, PAGE_W - MARGIN, PAGE_H - 6, { align: "right" });
  }
}

export async function exportMatchReportPdf({ reportData, reportMeta, staffComment, evolutionMetricKey }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  drawHeader(doc, reportData, reportMeta);
  let y = drawPlayerBlock(doc, reportData);
  y = drawKpis(doc, reportData, y);

  doc.addPage();
  setColor(doc, "setTextColor", CLUB_BRAND.colors.greenDeep);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("ANÁLISIS GPS", MARGIN, 18);
  y = 24;

  const { isMulti } = reportData;
  if (!isMulti) {
    const compData = buildComparisonData(reportData);
    const compPng = await renderComparisonChartPng(compData);
    y = drawChart(doc, compPng, MARGIN, y, PAGE_W - 2 * MARGIN, 80, "Comparación vs promedio personal");
  } else {
    const metric = REPORT_METRICS.find((m) => m.key === evolutionMetricKey) || REPORT_METRICS[0];
    const evoData = buildEvolutionData(reportData, evolutionMetricKey);
    const evoPng = await renderEvolutionChartPng(evoData, evolutionMetricKey, metric.color);
    y = drawChart(doc, evoPng, MARGIN, y, PAGE_W - 2 * MARGIN, 80, `Evolución · ${metric.label}`);
  }

  doc.addPage();
  setColor(doc, "setTextColor", CLUB_BRAND.colors.greenDeep);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("DETALLE DE MÉTRICAS", MARGIN, 18);
  y = 24;
  y = drawTable(doc, reportData, y);
  y = drawComment(doc, staffComment, y);

  drawFooter(doc);
  const fileName = `${reportData.player?.full_name || "jugador"}_informe_${reportData.isMulti ? "multipartido" : (reportData.selected[0]?.match?.date || "partido")}.pdf`.replace(/\s+/g, "_");
  doc.save(fileName);
}