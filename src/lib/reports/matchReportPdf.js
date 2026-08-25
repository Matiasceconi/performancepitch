import jsPDF from "jspdf";
import { CLUB_BRAND } from "@/lib/clubBrand";
import { REPORT_METRICS, fmtMetric, pctVs, buildZoneDistributionData, normalizeMatchReportConfig } from "@/lib/matchReportData";
import { getShieldForName } from "@/lib/clubShields";
import { renderZoneDistributionChartPng } from "./matchReportCharts.jsx";

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
  const { selected } = reportData;
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
  const subtitle = selected.length > 1
    ? `${selected.length} partidos analizados`
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
  const { player, selected } = reportData;
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

  const rightX = PAGE_W - MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setColor(doc, "setTextColor", CLUB_BRAND.colors.ink);
  doc.text(`${selected.length} ${selected.length === 1 ? "partido" : "partidos"}`, rightX, y + 9, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(doc, "setTextColor", "#6b7280");
  doc.text("Análisis puntual GPS", rightX, y + 16, { align: "right" });

  return y + photoSize + 6;
}

function drawKpiSummary(doc, reportData, y) {
  const latest = reportData.selected[reportData.selected.length - 1];
  if (!latest) return y;
  if (y + 48 > PAGE_H - MARGIN - 10) { doc.addPage(); y = MARGIN; }
  const keys = ["total_distance", "m_min", "distance_19_8", "distance_25", "sprints", "smax"];
  const profile = reportData.competitionProfile || null;
  const profileMatches = Number(profile?.matches_used || 0);
  const hasProfile = profileMatches > 0;
  const cardW = (PAGE_W - 2 * MARGIN - 6) / 3;

  setColor(doc, "setTextColor", CLUB_BRAND.colors.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Partido principal · vs ${latest.match?.rival || "Rival"}`, MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setColor(doc, "setTextColor", "#6b7280");
  const date = latest.match?.date ? new Date(latest.match.date + "T00:00:00").toLocaleDateString("es-AR") : "—";
  const context = `${date} · ${latest.minutesPlayed ?? latest.gpsRow?.duration_minutes ?? "—"} minutos${hasProfile ? ` · perfil competitivo: ${profileMatches} partido${profileMatches === 1 ? "" : "s"} >80'` : ""}`;
  doc.text(context, MARGIN, y + 5);
  y += 9;

  keys.forEach((key, index) => {
    const metric = REPORT_METRICS.find((item) => item.key === key);
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = MARGIN + col * (cardW + 3);
    const cardY = y + row * 17;
    doc.setFillColor(246, 247, 243);
    doc.roundedRect(x, cardY, cardW, 14, 2, 2, "F");
    setColor(doc, "setTextColor", "#6b7280");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(metric.label, x + 2, cardY + 4);
    setColor(doc, "setTextColor", CLUB_BRAND.colors.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${fmtMetric(latest.gpsRow?.[key], metric.decimals)} ${metric.unit}`, x + 2, cardY + 9);
    const delta = hasProfile ? pctVs(latest.gpsRow?.[key], profile?.[metric.profile]) : null;
    if (delta != null) {
      doc.setFontSize(6.5);
      setColor(doc, "setTextColor", delta >= 0 ? "#00843D" : "#b45309");
      doc.text(`${delta > 0 ? "+" : ""}${delta}% vs perfil competitivo`, x + 2, cardY + 12.5);
    }
  });
  return y + 36;
}

function drawEvolution(doc, reportData, config, y) {
  const selected = reportData.selected || [];
  if (selected.length < 2) return y;
  if (y + 65 > PAGE_H - MARGIN - 10) { doc.addPage(); y = MARGIN; }
  const metric = REPORT_METRICS.find((item) => item.key === config.evolutionMetric) || REPORT_METRICS[1];
  const profile = reportData.competitionProfile;
  const profileValue = Number(profile?.[metric.profile] || 0);
  const values = selected.map((item) => Number(item.gpsRow?.[metric.key] || 0));
  const minutes = selected.map((item) => Number(item.minutesPlayed ?? item.gpsRow?.duration_minutes ?? 0));
  const maxMetric = Math.max(...values, profileValue, 1);
  const maxMinutes = Math.max(...minutes, 90, 1);
  const chartX = MARGIN + 10;
  const chartY = y + 11;
  const chartW = PAGE_W - 2 * MARGIN - 20;
  const chartH = 40;
  const step = chartW / selected.length;

  setColor(doc, "setTextColor", CLUB_BRAND.colors.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Evolución de minutos y ${metric.label}`, MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setColor(doc, "setTextColor", "#6b7280");
  doc.text(`Barras: minutos · línea verde: ${metric.label} (${metric.unit}) · referencia celeste: perfil competitivo`, MARGIN, y + 5);

  doc.setDrawColor(216, 222, 210);
  doc.rect(chartX, chartY, chartW, chartH);
  if (profileValue > 0) {
    const py = chartY + chartH - (profileValue / maxMetric) * chartH;
    doc.setDrawColor(56, 189, 248);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(chartX, py, chartX + chartW, py);
    doc.setLineDashPattern([], 0);
  }

  const points = [];
  selected.forEach((item, index) => {
    const centerX = chartX + step * index + step / 2;
    const barH = (minutes[index] / maxMinutes) * chartH;
    doc.setFillColor(82, 82, 91);
    doc.rect(centerX - Math.min(5, step * 0.25), chartY + chartH - barH, Math.min(10, step * 0.5), barH, "F");
    const pointY = chartY + chartH - (values[index] / maxMetric) * chartH;
    points.push([centerX, pointY]);
    doc.setFontSize(6);
    setColor(doc, "setTextColor", "#6b7280");
    const label = item.match?.date ? new Date(item.match.date + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : String(index + 1);
    doc.text(label, centerX, chartY + chartH + 4, { align: "center" });
  });
  doc.setDrawColor(0, 132, 61);
  doc.setLineWidth(0.8);
  for (let index = 1; index < points.length; index += 1) doc.line(points[index - 1][0], points[index - 1][1], points[index][0], points[index][1]);
  points.forEach(([x, pointY]) => { doc.setFillColor(0, 132, 61); doc.circle(x, pointY, 1.4, "F"); });
  return chartY + chartH + 10;
}

function drawMatchBlock(doc, matchData, zonePng, y, contentW, showZoneChart = true) {
  const { match, gpsRow, minutesPlayed } = matchData;
  const blockH = 68;

  if (y + blockH > PAGE_H - MARGIN - 10) { doc.addPage(); y = MARGIN; }

  // Match header bar
  doc.setFillColor(0, 90, 52);
  doc.rect(MARGIN, y, contentW, 9, "F");
  setColor(doc, "setTextColor", "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const rivalShield = match.rival_logo_url || getShieldForName(match.rival);
  if (rivalShield) {
    try { doc.addImage(rivalShield, "PNG", MARGIN + 1, y + 1, 7, 7, undefined, "FAST"); } catch {}
  }
  doc.text(`vs ${match.rival || "Rival"}`, MARGIN + (rivalShield ? 10 : 2), y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const dateStr = match.date ? new Date(match.date + "T00:00:00").toLocaleDateString("es-AR") : "—";
  const meta = [dateStr, match.competition, match.location].filter(Boolean).join(" · ");
  doc.text(meta, MARGIN + 50, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const rightText = `${match.our_score ?? "?"} - ${match.rival_score ?? "?"}`;
  doc.text(rightText, PAGE_W - MARGIN - 2, y + 6, { align: "right" });
  if (minutesPlayed != null) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`${minutesPlayed}'`, PAGE_W - MARGIN - 25, y + 6, { align: "right" });
  }
  y += 11;

  // Two columns: metrics table (left) + zone chart (right)
  const tableW = showZoneChart ? contentW * 0.42 : contentW;
  const chartX = MARGIN + tableW + 4;
  const chartW = contentW - tableW - 4;

  // Section titles
  setColor(doc, "setTextColor", CLUB_BRAND.colors.greenDeep);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Métricas GPS", MARGIN, y);
  if (showZoneChart) doc.text("Zonas de velocidad e intensidad", chartX, y);
  y += 3;

  // Metrics table rows
  const rowH = 5;
  REPORT_METRICS.forEach((m, i) => {
    const rowY = y + i * rowH;
    if (i % 2 === 0) {
      doc.setFillColor(246, 247, 243);
      doc.rect(MARGIN, rowY - 3, tableW, rowH, "F");
    }
    setColor(doc, "setTextColor", "#6b7280");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(m.label, MARGIN + 1, rowY);
    setColor(doc, "setTextColor", CLUB_BRAND.colors.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(fmtMetric(gpsRow[m.key], m.decimals), MARGIN + tableW - 12, rowY, { align: "right" });
    doc.setFont("helvetica", "normal");
    setColor(doc, "setTextColor", "#9ca3af");
    doc.setFontSize(6);
    doc.text(m.unit, MARGIN + tableW - 2, rowY, { align: "right" });
  });
  const tableH = REPORT_METRICS.length * rowH;

  // Zone chart
  if (showZoneChart && zonePng) {
    try { doc.addImage(zonePng, "PNG", chartX, y, chartW, tableH); } catch {}
  }

  y += tableH + 4;

  // Divider
  doc.setDrawColor(200, 205, 195);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;

  return y;
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

export async function exportMatchReportPdf({ reportData, reportMeta, staffComment, reportConfig }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const config = normalizeMatchReportConfig(reportConfig || reportData?.reportConfig);
  drawHeader(doc, reportData, reportMeta);
  let y = drawPlayerBlock(doc, reportData);
  y += 4;
  if (config.showKpis) {
    y = drawKpiSummary(doc, reportData, y);
    y += 3;
  }
  if (config.showMinutesEvolution) y = drawEvolution(doc, reportData, config, y);

  const contentW = PAGE_W - 2 * MARGIN;
  const zonePngs = config.showMatchDetails && config.showZoneCharts
    ? await Promise.all(reportData.selected.map((matchData) => renderZoneDistributionChartPng(buildZoneDistributionData(matchData.gpsRow), 400, 240)))
    : reportData.selected.map(() => null);

  if (config.showMatchDetails) {
    for (let i = 0; i < reportData.selected.length; i++) {
      y = drawMatchBlock(doc, reportData.selected[i], zonePngs[i], y, contentW, config.showZoneCharts);
    }
  }

  // Staff comment
  y = drawComment(doc, staffComment, y);

  drawFooter(doc);
  const fileName = `${reportData.player?.full_name || "jugador"}_informe_${reportData.isMulti ? "multipartido" : (reportData.selected[0]?.match?.date || "partido")}.pdf`.replace(/\s+/g, "_");
  doc.save(fileName);
}