import React, { useState } from "react";
import { Download } from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import moment from "moment";
import { fmt, MICRO_METRICS } from "./gpsMicrocycleReportUtils";

function drawHeader(doc, title) {
  doc.setFillColor(7, 18, 12); doc.rect(0, 0, 297, 210, "F");
  doc.setFillColor(252, 211, 77); doc.rect(0, 0, 297, 4, "F");
  doc.setFillColor(34, 197, 94); doc.roundedRect(14, 12, 22, 26, 4, 4, "F");
  doc.setTextColor(7, 18, 12); doc.setFontSize(12); doc.text("DyJ", 20, 28);
  doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.text(title, 44, 24);
  doc.setFontSize(9); doc.setTextColor(220, 220, 220); doc.text("PerformancePitch", 240, 24);
}

async function imageToDataUrl(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.readAsDataURL(blob); });
  } catch { return null; }
}

async function addRankingPage(doc, highlights) {
  doc.addPage("a4", "landscape"); drawHeader(doc, "Jugadores destacados");
  let y = 50;
  for (let i = 0; i < highlights.length; i++) {
    const h = highlights[i];
    const x = 14 + (i % 2) * 140;
    if (i > 0 && i % 2 === 0) y += 39;
    doc.setTextColor(252, 211, 77); doc.setFontSize(9); doc.text(h.metric.label.toUpperCase(), x, y);
    for (let idx = 0; idx < (h.top || []).length; idx++) {
      const p = h.top[idx];
      const yy = y + 8 + idx * 10;
      const img = await imageToDataUrl(p.player?.photo_url);
      if (img) doc.addImage(img, String(img).includes("image/png") ? "PNG" : "JPEG", x, yy - 5, 7, 7);
      else { doc.setFillColor(39, 39, 42); doc.circle(x + 3.5, yy - 1.5, 3.5, "F"); }
      doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.text(`${idx + 1}. ${p.name}`, x + 10, yy);
      doc.setTextColor(180, 180, 180); doc.text(`${p.player?.position || "—"} · ${fmt(p.value, h.metric.unit)}`, x + 70, yy);
    }
  }
}

export default function GpsMicrocyclePdfButton({ squadName, season, dailySummaries, highlights, comparison, captureRef }) {
  const [exporting, setExporting] = useState(false);
  async function exportPdf() {
    setExporting(true);
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const start = dailySummaries[0]?.date, end = dailySummaries[dailySummaries.length - 1]?.date;
    drawHeader(doc, "Informe profesional de microciclo GPS");
    doc.setTextColor(255, 255, 255); doc.setFontSize(24); doc.text("Defensa y Justicia", 24, 72);
    doc.setFontSize(14); doc.setTextColor(252, 211, 77); doc.text(squadName || "Plantel", 24, 86);
    doc.setTextColor(220, 220, 220); doc.setFontSize(11); doc.text(`Temporada ${season || "—"} · Semana ${start ? moment(start).format("DD/MM") : ""} - ${end ? moment(end).format("DD/MM/YYYY") : ""}`, 24, 98);
    doc.text(`Generado: ${moment().format("DD/MM/YYYY HH:mm")}`, 24, 110);

    doc.addPage("a4", "landscape"); drawHeader(doc, "Resumen semanal");
    if (captureRef?.current) {
      const canvas = await html2canvas(captureRef.current, { scale: 2, backgroundColor: "#09090b", useCORS: true });
      const img = canvas.toDataURL("image/png");
      doc.addImage(img, "PNG", 12, 44, 273, Math.min(140, (canvas.height * 273) / canvas.width));
    }
    let y = 188; doc.setTextColor(255, 255, 255); doc.setFontSize(8);
    comparison.slice(0, 5).forEach((c, i) => doc.text(`${c.metric.label}: ${fmt(c.current, c.metric.unit)} vs ${fmt(c.previous, c.metric.unit)} (${c.diff == null ? "—" : c.diff.toFixed(0) + "%"})`, 14 + i * 55, y));

    await addRankingPage(doc, highlights);
    doc.addPage("a4", "landscape"); drawHeader(doc, "Carga diaria"); y = 52;
    dailySummaries.forEach((d) => { doc.setTextColor(255,255,255); doc.setFontSize(8); doc.text(`${d.label} · ${d.md} · GPS ${d.gpsPlayers}`, 14, y); doc.setTextColor(190,190,190); doc.text(MICRO_METRICS.map((m) => `${m.short}: ${fmt(d[m.key], m.unit)}`).join("  |  ").slice(0, 170), 64, y); y += 9; });

    doc.addPage("a4", "landscape"); drawHeader(doc, "Resumen estadístico"); y = 52;
    highlights.slice(0, 8).forEach((h) => { doc.setTextColor(252,211,77); doc.setFontSize(8); doc.text(h.metric.label, 14, y); doc.setTextColor(255,255,255); doc.text((h.top || []).map((p, i) => `${i + 1}) ${p.name} ${fmt(p.value, h.metric.unit)}`).join("   "), 70, y); y += 8; });

    doc.addPage("a4", "landscape"); drawHeader(doc, "Observaciones del Preparador Físico");
    doc.setDrawColor(80, 80, 80); for (let yy = 58; yy < 178; yy += 12) doc.line(20, yy, 277, yy);
    doc.save(`informe-microciclo-${start || "gps"}.pdf`);
    setExporting(false);
  }
  return <button onClick={exportPdf} disabled={exporting} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white rounded-xl text-sm font-bold transition-colors"><Download size={16} /> {exporting ? "Generando..." : "Exportar informe de microciclo"}</button>;
}