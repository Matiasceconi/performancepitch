import React from "react";
import { Download } from "lucide-react";
import { jsPDF } from "jspdf";
import moment from "moment";
import { fmt, MICRO_METRICS } from "./gpsMicrocycleReportUtils";

export default function GpsMicrocyclePdfButton({ squadName, season, dailySummaries, highlights, comparison, analysis }) {
  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const start = dailySummaries[0]?.date;
    const end = dailySummaries[dailySummaries.length - 1]?.date;
    doc.setFillColor(12, 18, 14); doc.rect(0, 0, 297, 24, "F");
    doc.setFillColor(34, 197, 94); doc.circle(16, 12, 8, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.text("DyJ", 11.5, 14);
    doc.setFontSize(16); doc.text("Informe de microciclo GPS", 30, 11);
    doc.setFontSize(9); doc.setTextColor(190, 190, 190);
    doc.text(`${squadName || "Plantel"} · ${season || "Temporada"} · ${start ? moment(start).format("DD/MM") : ""} - ${end ? moment(end).format("DD/MM/YYYY") : ""}`, 30, 18);

    let y = 34;
    doc.setTextColor(20, 20, 20); doc.setFontSize(11); doc.text("Carga por día", 12, y); y += 6;
    doc.setFontSize(7); doc.setTextColor(90, 90, 90);
    const headers = ["Día", "MD", "Sesiones", ...MICRO_METRICS.map((m) => m.short), "GPS", "Excl."];
    const widths = [18, 12, 42, 18, 14, 16, 14, 13, 13, 16, 14, 16, 12, 12];
    let x = 12;
    headers.forEach((h, i) => { doc.text(h, x, y); x += widths[i]; });
    y += 4;
    dailySummaries.forEach((d) => {
      x = 12; doc.setTextColor(35, 35, 35);
      const row = [d.label, d.md, d.sessions.map((s) => s.title).join(" / ").slice(0, 28), ...MICRO_METRICS.map((m) => fmt(d[m.key], m.unit)), String(d.gpsPlayers), String(d.excludedCount)];
      row.forEach((value, i) => { doc.text(String(value || "—").slice(0, 18), x, y); x += widths[i]; });
      y += 5;
    });

    y += 5; doc.setFontSize(11); doc.setTextColor(20, 20, 20); doc.text("Destacados", 12, y); y += 6;
    doc.setFontSize(8);
    highlights.forEach((h, i) => {
      const xPos = 12 + (i % 4) * 68;
      if (i > 0 && i % 4 === 0) y += 14;
      doc.setTextColor(90, 90, 90); doc.text(h.metric.label, xPos, y);
      doc.setTextColor(35, 35, 35); doc.text(`${h.best?.name || "—"} · ${h.best ? fmt(h.best.value, h.metric.unit) : "—"}`, xPos, y + 5);
    });

    y += 22; doc.setFontSize(11); doc.setTextColor(20, 20, 20); doc.text("Comparación 4 semanas", 12, y); y += 6;
    doc.setFontSize(8);
    comparison.slice(0, 6).forEach((c, i) => {
      const xPos = 12 + (i % 3) * 90;
      if (i > 0 && i % 3 === 0) y += 11;
      doc.setTextColor(90, 90, 90); doc.text(c.metric.label, xPos, y);
      doc.setTextColor(35, 35, 35); doc.text(`${fmt(c.current, c.metric.unit)} vs ${fmt(c.previous, c.metric.unit)} (${c.diff == null ? "—" : c.diff.toFixed(0) + "%"})`, xPos, y + 5);
    });

    doc.addPage("a4", "landscape"); y = 18;
    doc.setTextColor(20, 20, 20); doc.setFontSize(13); doc.text("Análisis IA", 12, y); y += 8;
    doc.setTextColor(40, 40, 40); doc.setFontSize(9);
    doc.splitTextToSize(analysis || "Sin análisis generado.", 270).forEach((line) => { doc.text(line, 12, y); y += 5; });
    y += 8; doc.setTextColor(20, 20, 20); doc.setFontSize(13); doc.text("Observaciones del PF", 12, y); y += 8;
    doc.setTextColor(80, 80, 80); doc.setFontSize(9);
    const obs = dailySummaries.map((d) => d.observations).filter(Boolean).join("\n") || "Sin observaciones cargadas.";
    doc.splitTextToSize(obs, 270).forEach((line) => { doc.text(line, 12, y); y += 5; });
    doc.save(`informe-microciclo-${start || "gps"}.pdf`);
  }

  return (
    <button onClick={exportPdf} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-colors">
      <Download size={16} /> Exportar informe de microciclo
    </button>
  );
}