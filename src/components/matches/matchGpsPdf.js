import { jsPDF } from "jspdf";
import moment from "moment";
import { MATCH_GPS_METRICS, formatMatchGpsValue, describeExposureSample } from "./matchGpsReportUtils";

function rgb(hex, fallback = [15, 23, 42]) {
  const clean = String(hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return fallback;
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

async function imageData(url) {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: "cors" });
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function safeName(value) {
  return String(value || "partido").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/_+/g, "_");
}

export async function exportMatchGpsPdf({ match, model, clubBrand }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const pageW = 297;
  const pageH = 210;
  const margin = 10;
  const contentW = pageW - margin * 2;
  const primary = rgb(clubBrand?.primary || clubBrand?.colors?.primary || "#1E293B");
  const accent = rgb(clubBrand?.accent || clubBrand?.colors?.accent || "#0EA5E9", [14, 165, 233]);
  const logo = await imageData(clubBrand?.logoUrl);
  let y = 0;

  function header(title = "INFORME GPS DE PARTIDO") {
    doc.setFillColor(...primary); doc.rect(0, 0, pageW, 24, "F");
    doc.setFillColor(...accent); doc.rect(0, 24, pageW, 1.2, "F");
    if (logo) {
      try { doc.addImage(logo, "PNG", margin, 4, 14, 14); } catch {}
    }
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text(title, margin + (logo ? 18 : 0), 10);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(`${clubBrand?.name || "Club"} · ${match?.squad_name || ""}`, margin + (logo ? 18 : 0), 16);
    doc.setTextColor(...accent); doc.setFont("helvetica", "bold");
    doc.text(`vs ${match?.rival || "Rival"}`, pageW - margin, 10, { align: "right" });
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "normal");
    doc.text(moment(match?.date).format("DD/MM/YYYY"), pageW - margin, 16, { align: "right" });
    y = 31;
  }

  function section(title) {
    if (y > pageH - 25) { doc.addPage(); header(); }
    doc.setFillColor(245, 247, 250); doc.roundedRect(margin, y, contentW, 7, 1.5, 1.5, "F");
    doc.setFillColor(...accent); doc.rect(margin, y, 2.5, 7, "F");
    doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
    doc.text(title.toUpperCase(), margin + 5, y + 4.8);
    y += 10;
  }

  header();
  doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  const result = match?.our_score != null && match?.rival_score != null ? `${match.our_score} – ${match.rival_score}` : "Partido";
  doc.text(`${clubBrand?.shortName || clubBrand?.name || "Club"} ${result} ${match?.rival || ""}`, margin, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
  const context = [match?.competition, match?.location, match?.venue, describeExposureSample(model)].filter(Boolean).join(" · ");
  doc.text(context || "Informe de carga externa del partido", margin, y + 5);
  y += 12;

  section("Resumen del partido");
  const summaryMetrics = ["total_duration", "total_distance", "meters_per_minute", "distance_hsr", "sprint_distance", "max_velocity"]
    .map((key) => MATCH_GPS_METRICS.find((metric) => metric.key === key));
  const cardW = (contentW - 10) / summaryMetrics.length;
  summaryMetrics.forEach((metric, index) => {
    const x = margin + index * (cardW + 2);
    doc.setFillColor(248, 250, 252); doc.roundedRect(x, y, cardW, 18, 1.8, 1.8, "F");
    doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
    doc.text(metric.label, x + 2.5, y + 5);
    doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text(formatMatchGpsValue(metric, model.teamSummary[metric.key]), x + 2.5, y + 12.5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(100, 116, 139);
    doc.text(metric.aggregate === "max" ? "máximo observado" : "promedio muestra principal", x + 2.5, y + 16);
  });
  y += 23;

  section("Jugadores · carga total");
  const tableMetrics = MATCH_GPS_METRICS;
  const nameW = 38;
  const metricW = (contentW - nameW) / tableMetrics.length;
  const drawTableHeader = () => {
    doc.setFillColor(30, 41, 59); doc.rect(margin, y, contentW, 7, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(5.8);
    doc.text("Jugador", margin + 2, y + 4.6);
    tableMetrics.forEach((metric, index) => doc.text(metric.short, margin + nameW + index * metricW + metricW - 1.5, y + 4.6, { align: "right" }));
    y += 7;
  };
  drawTableHeader();
  model.resolved.slice().sort((a, b) => Number(b.total_duration || 0) - Number(a.total_duration || 0)).forEach((row, index) => {
    if (y > pageH - 12) { doc.addPage(); header(); section("Jugadores · carga total (continuación)"); drawTableHeader(); }
    doc.setFillColor(...(index % 2 ? [255, 255, 255] : [248, 250, 252])); doc.rect(margin, y, contentW, 6, "F");
    doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "bold"); doc.setFontSize(6.2);
    doc.text(String(row.player_name || "Jugador").slice(0, 24), margin + 2, y + 4.1);
    doc.setFont("helvetica", "normal");
    tableMetrics.forEach((metric, metricIndex) => {
      doc.text(formatMatchGpsValue(metric, row[metric.key]), margin + nameW + metricIndex * metricW + metricW - 1.5, y + 4.1, { align: "right" });
    });
    y += 6;
  });
  y += 4;

  if (model.periodNames.length) {
    doc.addPage(); header("GPS DE PARTIDO · ANÁLISIS POR PERÍODO");
    section("Comparación de períodos");
    const periodMetrics = ["total_distance", "meters_per_minute", "distance_hsr", "sprint_distance", "sprint_efforts", "player_load", "max_velocity"]
      .map((key) => MATCH_GPS_METRICS.find((metric) => metric.key === key));
    const labelW = 28;
    const pMetricW = (contentW - labelW) / periodMetrics.length;
    doc.setFillColor(30, 41, 59); doc.rect(margin, y, contentW, 8, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
    doc.text("Período", margin + 2, y + 5.3);
    periodMetrics.forEach((metric, index) => doc.text(metric.short, margin + labelW + index * pMetricW + pMetricW - 2, y + 5.3, { align: "right" }));
    y += 8;
    model.periodTeamSummary.forEach((period, index) => {
      doc.setFillColor(...(index % 2 ? [255, 255, 255] : [248, 250, 252])); doc.rect(margin, y, contentW, 8, "F");
      doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
      doc.text(`${period.period_name} (${period.players} j.)`, margin + 2, y + 5.2);
      doc.setFont("helvetica", "normal");
      periodMetrics.forEach((metric, metricIndex) => doc.text(formatMatchGpsValue(metric, period.metrics[metric.key]), margin + labelW + metricIndex * pMetricW + pMetricW - 2, y + 5.2, { align: "right" }));
      y += 8;
    });
    y += 5;

    section("Detalle individual por período");
    model.resolved.filter((player) => (player.period_breakdown || []).length).forEach((player) => {
      const periods = player.period_breakdown || [];
      const needed = 8 + periods.length * 5.5;
      if (y + needed > pageH - 10) { doc.addPage(); header("GPS DE PARTIDO · ANÁLISIS POR PERÍODO"); }
      doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
      doc.text(player.player_name || "Jugador", margin, y + 4); y += 6;
      periods.forEach((period) => {
        doc.setFillColor(248, 250, 252); doc.roundedRect(margin, y, contentW, 5, 1, 1, "F");
        doc.setTextColor(71, 85, 105); doc.setFont("helvetica", "normal"); doc.setFontSize(6.2);
        const values = periodMetrics.map((metric) => `${metric.short}: ${formatMatchGpsValue(metric, period[metric.key])}`).join("   ·   ");
        doc.text(`${period.period_name}   ·   ${values}`, margin + 2, y + 3.5, { maxWidth: contentW - 4 });
        y += 5.5;
      });
      y += 2;
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setTextColor(148, 163, 184); doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
    doc.text(`PerformancePitch · Informe estructurado · Página ${page}/${totalPages}`, pageW - margin, pageH - 5, { align: "right" });
  }

  doc.save(`gps_partido_${moment(match?.date).format("YYYY-MM-DD")}_${safeName(match?.rival)}.pdf`);
}
