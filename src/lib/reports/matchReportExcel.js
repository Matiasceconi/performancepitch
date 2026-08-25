import * as XLSX from "xlsx";
import { CLUB_BRAND } from "@/lib/clubBrand";
import { getShieldForName } from "@/lib/clubShields";
import { normalizeMatchReportConfig, pctVs, REPORT_METRICS } from "@/lib/matchReportData";

const KPI_KEYS = ["total_distance", "m_min", "distance_19_8", "distance_25", "sprints", "smax"];
const dateLabel = (value) => value ? new Date(value + "T00:00:00").toLocaleDateString("es-AR") : "—";
const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

function addSection(rows, title) {
  rows.push([]);
  rows.push([title]);
}

function styleSheet(ws, widths = []) {
  ws["!cols"] = widths.map((wch) => ({ wch }));
  ws["!freeze"] = { xSplit: 0, ySplit: 6 };
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
      if (!cell) continue;
      cell.s = {
        font: { name: "Aptos", sz: row === 0 ? 18 : 11, bold: row === 0 },
        alignment: { vertical: "center", wrapText: true },
      };
    }
  }
}

export function exportMatchReportExcel({ reportData, reportMeta, staffComment, reportConfig }) {
  const config = normalizeMatchReportConfig(reportConfig || reportData?.reportConfig);
  const selected = reportData?.selected || [];
  const latest = selected[selected.length - 1];
  const profile = reportData?.competitionProfile || null;
  const profileMatches = Number(profile?.matches_used || 0);
  const hasProfile = profileMatches > 0;
  const evolutionCharts = (config.evolutionCharts || []).map((chart) => ({
    ...chart,
    definition: chart.metric === "minutes"
      ? { key: "minutes", label: "Minutos jugados", unit: "min" }
      : REPORT_METRICS.find((item) => item.key === chart.metric),
  })).filter((chart) => chart.definition);
  const player = reportData?.player || {};
  const rows = [
    ["INFORME INDIVIDUAL DE RENDIMIENTO"],
    [CLUB_BRAND.name, reportData?.player?.squad_name || reportMeta?.squadName || ""],
    ["Jugador", player.full_name || "Jugador"],
    ["Posición", player.position || "—"],
    ["Informe", reportMeta?.title || "Informe individual"],
    ["Generado", new Date().toLocaleString("es-AR")],
  ];

  if (config.showKpis && latest) {
    addSection(rows, "PARTIDO PRINCIPAL Y KPIs");
    rows.push(["Rival", latest.match?.rival || "Rival", "Fecha", dateLabel(latest.match?.date), "Minutos", numeric(latest.minutesPlayed ?? latest.gpsRow?.duration_minutes)]);
    rows.push(["Escudo rival", latest.match?.rival_logo_url || getShieldForName(latest.match?.rival)]);
    rows.push(["Métrica", "Valor", "Unidad", "Perfil competitivo", "Diferencia %"]);
    KPI_KEYS.forEach((key) => {
      const metric = REPORT_METRICS.find((item) => item.key === key);
      const reference = hasProfile ? numeric(profile?.[metric.profile]) : null;
      rows.push([metric.label, numeric(latest.gpsRow?.[key]), metric.unit, reference, pctVs(latest.gpsRow?.[key], reference)]);
    });
  }

  if (config.showMinutesEvolution) {
    addSection(rows, "EVOLUCIÓN DE CARGA Y RENDIMIENTO");
    rows.push(["Fecha", "Rival", "Escudo rival", ...evolutionCharts.map((chart) => `${chart.definition.label} (${chart.definition.unit})`)]);
    selected.forEach((item) => rows.push([
      dateLabel(item.match?.date),
      item.match?.rival || "Rival",
      item.match?.rival_logo_url || getShieldForName(item.match?.rival),
      ...evolutionCharts.map((chart) => numeric(chart.metric === "minutes" ? (item.minutesPlayed ?? item.gpsRow?.duration_minutes) : item.gpsRow?.[chart.metric])),
    ]));
    rows.push(["Estilos", "", "", ...evolutionCharts.map((chart) => chart.style === "bar" ? "Barras" : chart.style === "area" ? "Área" : "Línea")]);
  }

  if (config.showProfileComparison && hasProfile && latest) {
    addSection(rows, "ÚLTIMO PARTIDO VS PERFIL COMPETITIVO (>80 MIN)");
    rows.push(["Métrica", "Último partido", "Perfil competitivo", "Diferencia %", "Unidad"]);
    REPORT_METRICS.forEach((metric) => {
      const reference = numeric(profile?.[metric.profile]);
      rows.push([metric.label, numeric(latest.gpsRow?.[metric.key]), reference, pctVs(latest.gpsRow?.[metric.key], reference), metric.unit]);
    });
    rows.push(["Partidos utilizados", profileMatches]);
  }

  addSection(rows, "CONFIGURACIÓN DEL REPORTE");
  rows.push(["Resumen de KPIs", config.showKpis ? "Sí" : "No"]);
  rows.push(["Evolución minutos + métrica", config.showMinutesEvolution ? "Sí" : "No"]);
  rows.push(["Comparación perfil competitivo", config.showProfileComparison ? "Sí" : "No"]);
  rows.push(["Detalle de partidos", config.showMatchDetails ? "Sí" : "No"]);
  rows.push(["Gráficos de velocidad/intensidad", config.showZoneCharts ? "Sí" : "No"]);
  evolutionCharts.forEach((chart, index) => rows.push([`Gráfico ${index + 1}`, chart.definition.label, "Estilo", chart.style === "bar" ? "Barras" : chart.style === "area" ? "Área" : "Línea"]));

  addSection(rows, "CONCLUSIÓN DEL ÁREA DE RENDIMIENTO");
  rows.push([staffComment || "Sin comentario adicional."]);

  const wb = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet(rows);
  summary["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
  summary["!rows"] = [{ hpt: 30 }];
  styleSheet(summary, [30, 30, 20, 24, 20, 55]);
  XLSX.utils.book_append_sheet(wb, summary, "Informe");

  if (config.showMatchDetails) {
    const headers = ["Fecha", "Rival", "Competencia", "Condición", "Resultado", "Minutos", "Escudo rival", ...REPORT_METRICS.map((metric) => `${metric.label} (${metric.unit})`)];
    const detailRows = selected.map((item) => [
      dateLabel(item.match?.date),
      item.match?.rival || "Rival",
      item.match?.competition || "",
      item.match?.location || "",
      `${item.match?.our_score ?? "—"} - ${item.match?.rival_score ?? "—"}`,
      numeric(item.minutesPlayed ?? item.gpsRow?.duration_minutes),
      item.match?.rival_logo_url || getShieldForName(item.match?.rival),
      ...REPORT_METRICS.map((metric) => numeric(item.gpsRow?.[metric.key])),
    ]);
    const detail = XLSX.utils.aoa_to_sheet([headers, ...detailRows]);
    detail["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}${detailRows.length + 1}` };
    detail["!freeze"] = { xSplit: 2, ySplit: 1 };
    styleSheet(detail, [14, 22, 24, 14, 14, 12, 55, ...REPORT_METRICS.map(() => 16)]);
    detailRows.forEach((row, index) => {
      const urlCell = detail[XLSX.utils.encode_cell({ r: index + 1, c: 6 })];
      if (urlCell?.v) urlCell.l = { Target: String(urlCell.v), Tooltip: "Abrir escudo del rival" };
    });
    XLSX.utils.book_append_sheet(wb, detail, "Detalle partidos");
  }

  const safePlayer = (player.full_name || "jugador").replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]+/g, "_");
  XLSX.writeFile(wb, `${safePlayer}_informe_rendimiento.xlsx`, { compression: true });
}
