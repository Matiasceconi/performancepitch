import jsPDF from "jspdf";
import { CLUB_BRAND } from "@/lib/clubBrand";
import { REPORT_METRICS, fmtMetric, pctVs, buildZoneDistributionData, normalizeMatchReportConfig } from "@/lib/matchReportData";
import { getShieldForName } from "@/lib/clubShields";

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
  if (y + 62 > PAGE_H - MARGIN - 10) { doc.addPage(); y = MARGIN; }
  const keys = ["total_distance", "m_min", "distance_19_8", "distance_25", "sprints", "smax"];
  const profile = reportData.competitionProfile || null;
  const profileMatches = Number(profile?.matches_used || 0);
  const hasProfile = profileMatches > 0;
  const cardW = (PAGE_W - 2 * MARGIN - 6) / 3;

  setColor(doc, "setTextColor", CLUB_BRAND.colors.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Partido principal · vs ${latest.match?.rival || "Rival"}`, MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
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
    const cardY = y + row * 23;
    doc.setFillColor(246, 247, 243);
    doc.roundedRect(x, cardY, cardW, 20, 2.5, 2.5, "F");
    setColor(doc, "setTextColor", "#6b7280");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(metric.label, x + 3, cardY + 5);
    setColor(doc, "setTextColor", CLUB_BRAND.colors.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    const valueText = fmtMetric(latest.gpsRow?.[key], metric.decimals);
    doc.text(valueText, x + 3, cardY + 13);
    const valueWidth = doc.getTextWidth(valueText);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(doc, "setTextColor", "#6b7280");
    doc.text(metric.unit, x + 4 + valueWidth, cardY + 13);
    const delta = hasProfile ? pctVs(latest.gpsRow?.[key], profile?.[metric.profile]) : null;
    if (delta != null) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);
      setColor(doc, "setTextColor", delta >= 0 ? "#00843D" : "#b45309");
      doc.text(`${delta > 0 ? "+" : ""}${delta}% vs perfil competitivo`, x + 3, cardY + 18);
    }
  });
  return y + 49;
}

function drawEvolution(doc, reportData, config, y) {
  const selected = reportData.selected || [];
  if (selected.length < 2) return y;
  const charts = config.evolutionCharts || [];
  const styleLabel = { line: "Línea", area: "Área", bar: "Barras" };

  charts.forEach((chart) => {
    if (y + 88 > PAGE_H - MARGIN - 10) { doc.addPage(); y = MARGIN; }
    const metric = chart.metric === "minutes"
      ? { key: "minutes", label: "Minutos jugados", unit: "min", decimals: 0, color: "#6b7280" }
      : REPORT_METRICS.find((item) => item.key === chart.metric) || REPORT_METRICS[1];
    const values = selected.map((item) => Number(metric.key === "minutes" ? (item.minutesPlayed ?? item.gpsRow?.duration_minutes ?? 0) : (item.gpsRow?.[metric.key] || 0)));
    const profileValue = metric.profile ? Number(reportData.competitionProfile?.[metric.profile] || 0) : 0;
    const rawMax = Math.max(...values, profileValue, 1);
    const maxValue = rawMax * 1.18;
    const chartX = MARGIN + 8;
    const chartY = y + 10;
    const chartW = PAGE_W - 2 * MARGIN - 16;
    const chartH = 48;
    const step = chartW / selected.length;
    const points = [];

    setColor(doc, "setTextColor", CLUB_BRAND.colors.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Evolución · ${metric.label}`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(doc, "setTextColor", "#6b7280");
    doc.text(`${styleLabel[chart.style] || "Línea"} · ${metric.unit}${profileValue > 0 ? " · referencia celeste: perfil competitivo" : ""}`, MARGIN, y + 5);

    doc.setDrawColor(216, 222, 210);
    doc.rect(chartX, chartY, chartW, chartH);
    [0.25, 0.5, 0.75].forEach((ratio) => {
      const gridY = chartY + chartH * ratio;
      doc.setDrawColor(230, 233, 227);
      doc.line(chartX, gridY, chartX + chartW, gridY);
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    setColor(doc, "setTextColor", "#6b7280");
    doc.text(fmtMetric(rawMax, metric.decimals), chartX - 2, chartY + 2, { align: "right" });
    doc.text("0", chartX - 2, chartY + chartH, { align: "right" });
    if (profileValue > 0) {
      const py = chartY + chartH - (profileValue / maxValue) * chartH;
      doc.setDrawColor(56, 189, 248);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(chartX, py, chartX + chartW, py);
      doc.setLineDashPattern([], 0);
    }

    selected.forEach((item, index) => {
      const centerX = chartX + step * index + step / 2;
      const pointY = chartY + chartH - (values[index] / maxValue) * chartH;
      points.push([centerX, pointY]);
      if (chart.style === "bar") {
        const barH = chartY + chartH - pointY;
        doc.setFillColor(0, 132, 61);
        doc.rect(centerX - Math.min(5, step * 0.25), pointY, Math.min(10, step * 0.5), barH, "F");
      }
      const shield = item.match?.rival_logo_url || getShieldForName(item.match?.rival);
      if (shield) {
        try { doc.addImage(shield, "PNG", centerX - 3.5, chartY + chartH + 2, 7, 7, undefined, "FAST"); } catch {}
      }
      doc.setFontSize(6.5);
      setColor(doc, "setTextColor", "#6b7280");
      const date = item.match?.date ? new Date(item.match.date + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : String(index + 1);
      doc.text(date, centerX, chartY + chartH + 12, { align: "center" });
      doc.text(String(item.match?.rival || "Rival").slice(0, 12), centerX, chartY + chartH + 16, { align: "center" });
    });

    if (chart.style === "area") {
      doc.setFillColor(209, 240, 220);
      for (let index = 1; index < points.length; index += 1) {
        const [x1, y1] = points[index - 1];
        const [x2, y2] = points[index];
        doc.lines([[x2 - x1, y2 - y1], [0, chartY + chartH - y2], [x1 - x2, 0]], x1, y1, [1, 1], "F", true);
      }
    }
    if (chart.style !== "bar") {
      doc.setDrawColor(0, 132, 61);
      doc.setLineWidth(0.8);
      for (let index = 1; index < points.length; index += 1) doc.line(points[index - 1][0], points[index - 1][1], points[index][0], points[index][1]);
      points.forEach(([x, pointY]) => { doc.setFillColor(0, 132, 61); doc.circle(x, pointY, 1.3, "F"); });
    }
    points.forEach(([x, pointY], index) => {
      doc.setFillColor(255, 255, 255);
      const label = fmtMetric(values[index], metric.decimals);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      const labelW = doc.getTextWidth(label) + 3;
      const labelY = Math.max(chartY + 1.5, pointY - 5);
      doc.roundedRect(x - labelW / 2, labelY - 3.5, labelW, 5, 1, 1, "F");
      setColor(doc, "setTextColor", CLUB_BRAND.colors.ink);
      doc.text(label, x, labelY, { align: "center" });
    });
    y = chartY + chartH + 23;
  });
  return y;
}

function drawProfileComparison(doc, reportData, y) {
  const latest = reportData.selected?.[reportData.selected.length - 1];
  const profile = reportData.competitionProfile;
  if (!latest || Number(profile?.matches_used || 0) < 1) return y;
  if (y + 38 > PAGE_H - MARGIN - 10) { doc.addPage(); y = MARGIN; }
  const keys = ["total_distance", "m_min", "distance_19_8", "distance_25", "sprints", "smax"];
  setColor(doc, "setTextColor", CLUB_BRAND.colors.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Último partido vs perfil competitivo", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setColor(doc, "setTextColor", "#6b7280");
  doc.text(`Perfil calculado con ${profile.matches_used} partidos de más de 80 minutos.`, MARGIN, y + 5);
  y += 10;
  const cellW = (PAGE_W - 2 * MARGIN - 5) / 3;
  keys.forEach((key, index) => {
    const metric = REPORT_METRICS.find((item) => item.key === key);
    const delta = pctVs(latest.gpsRow?.[key], profile?.[metric.profile]);
    const x = MARGIN + (index % 3) * (cellW + 2.5);
    const rowY = y + Math.floor(index / 3) * 11;
    doc.setFillColor(246, 247, 243);
    doc.roundedRect(x, rowY, cellW, 9, 1.5, 1.5, "F");
    setColor(doc, "setTextColor", "#6b7280");
    doc.setFontSize(6.5);
    doc.text(metric.label, x + 2, rowY + 3.5);
    doc.setFont("helvetica", "bold");
    setColor(doc, "setTextColor", delta == null ? "#6b7280" : delta >= 0 ? "#00843D" : "#b45309");
    doc.text(delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta}%`, x + cellW - 2, rowY + 6.5, { align: "right" });
    doc.setFont("helvetica", "normal");
  });
  return y + 25;
}

function drawZoneBars(doc, gpsRow, x, y, width, height) {
  const rows = buildZoneDistributionData(gpsRow);
  const maxValue = Math.max(...rows.map((row) => Number(row.value || 0)), 1);
  const rowH = height / rows.length;
  const labelW = 24;
  const valueW = 19;
  const barX = x + labelW;
  const barW = width - labelW - valueW - 2;

  rows.forEach((row, index) => {
    const rowY = y + index * rowH;
    const value = Number(row.value || 0);
    setColor(doc, "setTextColor", "#4b5563");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(row.metric, x, rowY + rowH * 0.66);

    doc.setFillColor(235, 238, 233);
    doc.roundedRect(barX, rowY + 1.2, barW, Math.max(3.2, rowH - 2.4), 1.2, 1.2, "F");
    doc.setFillColor(0, 132, 61);
    const filledW = value > 0 ? Math.max(1.2, (value / maxValue) * barW) : 0;
    if (filledW > 0) doc.roundedRect(barX, rowY + 1.2, filledW, Math.max(3.2, rowH - 2.4), 1.2, 1.2, "F");

    setColor(doc, "setTextColor", CLUB_BRAND.colors.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`${fmtMetric(value, Number.isInteger(value) ? 0 : 1)} ${row.unit || ""}`.trim(), x + width, rowY + rowH * 0.66, { align: "right" });
  });
}

function fitText(doc, value, maxWidth) {
  const text = String(value || "");
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let shortened = text;
  while (shortened.length > 1 && doc.getTextWidth(`${shortened}...`) > maxWidth) shortened = shortened.slice(0, -1);
  return `${shortened}...`;
}

function drawMatchBlock(doc, matchData, y, contentW, showZoneChart = true) {
  const { match, gpsRow, minutesPlayed } = matchData;
  const blockH = 94;

  if (y + blockH > PAGE_H - MARGIN - 10) { doc.addPage(); y = MARGIN; }

  // Match header bar
  doc.setFillColor(0, 90, 52);
  doc.rect(MARGIN, y, contentW, 11, "F");
  setColor(doc, "setTextColor", "#FFFFFF");
  const rivalShield = match.rival_logo_url || getShieldForName(match.rival);
  if (rivalShield) {
    try { doc.addImage(rivalShield, "PNG", MARGIN + 1.5, y + 1.5, 8, 8, undefined, "FAST"); } catch {}
  }

  const rivalX = MARGIN + (rivalShield ? 11.5 : 3);
  const metaX = MARGIN + 58;
  const scoreX = PAGE_W - MARGIN - 2;
  const minutesX = scoreX - 22;
  const headerBaseline = y + 7.2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(fitText(doc, `vs ${match.rival || "Rival"}`, metaX - rivalX - 4), rivalX, headerBaseline);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  const dateStr = match.date ? new Date(match.date + "T00:00:00").toLocaleDateString("es-AR") : "—";
  const meta = [dateStr, match.competition, match.location].filter(Boolean).join(" · ");
  doc.text(fitText(doc, meta, minutesX - metaX - 8), metaX, headerBaseline);

  if (minutesPlayed != null) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(`${minutesPlayed}'`, minutesX, headerBaseline, { align: "right" });
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const rightText = `${match.our_score ?? "?"} - ${match.rival_score ?? "?"}`;
  doc.text(rightText, scoreX, headerBaseline, { align: "right" });
  y += 16;

  // Two columns: metrics table (left) + zone chart (right)
  const tableW = showZoneChart ? contentW * 0.46 : contentW;
  const chartX = MARGIN + tableW + 4;
  const chartW = contentW - tableW - 4;

  // Section titles
  setColor(doc, "setTextColor", CLUB_BRAND.colors.greenDeep);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Métricas GPS", MARGIN, y);
  if (showZoneChart) doc.text("Zonas de velocidad e intensidad", chartX, y);
  y += 7;

  // Metrics table rows
  const rowH = 6.6;
  REPORT_METRICS.forEach((m, i) => {
    const rowY = y + i * rowH;
    if (i % 2 === 0) {
      doc.setFillColor(246, 247, 243);
      doc.rect(MARGIN, rowY - 4.2, tableW, rowH, "F");
    }
    setColor(doc, "setTextColor", "#6b7280");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.text(m.label, MARGIN + 1.5, rowY);
    setColor(doc, "setTextColor", CLUB_BRAND.colors.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(fmtMetric(gpsRow[m.key], m.decimals), MARGIN + tableW - 14, rowY, { align: "right" });
    doc.setFont("helvetica", "normal");
    setColor(doc, "setTextColor", "#9ca3af");
    doc.setFontSize(6.5);
    doc.text(m.unit, MARGIN + tableW - 2, rowY, { align: "right" });
  });
  const tableH = REPORT_METRICS.length * rowH;

  // Vector chart: always visible in the PDF and includes an exact value label per bar.
  if (showZoneChart) drawZoneBars(doc, gpsRow, chartX, y - 4.5, chartW, tableH);

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
  if (config.showProfileComparison) y = drawProfileComparison(doc, reportData, y);

  const contentW = PAGE_W - 2 * MARGIN;
  if (config.showMatchDetails) {
    let detailPage = doc.getCurrentPageInfo().pageNumber;
    let blocksOnPage = 0;
    for (let i = 0; i < reportData.selected.length; i++) {
      if (blocksOnPage >= 2) {
        doc.addPage();
        y = MARGIN;
        detailPage = doc.getCurrentPageInfo().pageNumber;
        blocksOnPage = 0;
      }
      const pageBefore = doc.getCurrentPageInfo().pageNumber;
      y = drawMatchBlock(doc, reportData.selected[i], y, contentW, config.showZoneCharts);
      const pageAfter = doc.getCurrentPageInfo().pageNumber;
      if (pageAfter !== pageBefore || pageAfter !== detailPage) {
        detailPage = pageAfter;
        blocksOnPage = 1;
      } else {
        blocksOnPage += 1;
      }
    }
  }

  // Staff comment
  y = drawComment(doc, staffComment, y);

  drawFooter(doc);
  const fileName = `${reportData.player?.full_name || "jugador"}_informe_${reportData.isMulti ? "multipartido" : (reportData.selected[0]?.match?.date || "partido")}.pdf`.replace(/\s+/g, "_");
  doc.save(fileName);
}