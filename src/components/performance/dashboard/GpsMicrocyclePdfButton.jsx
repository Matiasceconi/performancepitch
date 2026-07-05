import React, { useState } from "react";
import { Download } from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import moment from "moment";

const CLUB_LOGO_URL = "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/36f6c4008_defensa.png";

async function imageToDataUrl(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.readAsDataURL(blob); });
  } catch { return null; }
}

async function drawClubHeader(doc, logo, squadName, season, start, end) {
  doc.setFillColor(3, 20, 11); doc.rect(0, 0, 297, 210, "F");
  doc.setFillColor(0, 128, 62); doc.rect(0, 0, 297, 12, "F");
  doc.setFillColor(255, 214, 0); doc.rect(0, 12, 297, 3, "F");
  if (logo) doc.addImage(logo, "PNG", 14, 18, 20, 20);
  doc.setTextColor(255, 255, 255); doc.setFontSize(15); doc.text("Informe de microciclo GPS", 42, 27);
  doc.setTextColor(255, 214, 0); doc.setFontSize(9); doc.text(`${squadName || "Plantel"} · Temporada ${season || "—"}`, 42, 34);
  doc.setTextColor(210, 210, 210); doc.setFontSize(8); doc.text(`${start ? moment(start).format("DD/MM") : ""} - ${end ? moment(end).format("DD/MM/YYYY") : ""}`, 240, 27);
}

export default function GpsMicrocyclePdfButton({ squadName, season, dailySummaries, captureRef }) {
  const [exporting, setExporting] = useState(false);
  async function exportPdf() {
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const start = dailySummaries[0]?.date, end = dailySummaries[dailySummaries.length - 1]?.date;
      const logo = await imageToDataUrl(CLUB_LOGO_URL);
      await drawClubHeader(doc, logo, squadName, season, start, end);

      if (captureRef?.current) {
        const canvas = await html2canvas(captureRef.current, { scale: 2, backgroundColor: "#09090b", useCORS: true });
        const pageW = 269;
        const pageH = 156;
        const fullImgH = (canvas.height * pageW) / canvas.width;
        const pagesNeeded = Math.min(2, Math.max(1, Math.ceil(fullImgH / pageH)));
        const sourceH = Math.min(canvas.height, Math.ceil((canvas.width * pageH * pagesNeeded) / pageW));
        for (let page = 0; page < pagesNeeded; page++) {
          if (page > 0) { doc.addPage("a4", "landscape"); await drawClubHeader(doc, logo, squadName, season, start, end); }
          const sliceY = Math.floor((sourceH / pagesNeeded) * page);
          const sliceH = Math.min(Math.floor(sourceH / pagesNeeded), canvas.height - sliceY);
          if (sliceH <= 0) break;
          const slice = document.createElement("canvas");
          slice.width = canvas.width; slice.height = sliceH;
          slice.getContext("2d").drawImage(canvas, 0, sliceY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          const img = slice.toDataURL("image/png");
          const imgH = Math.min(pageH, (sliceH * pageW) / canvas.width);
          doc.addImage(img, "PNG", 14, 44, pageW, imgH);
        }
      }
      doc.setTextColor(150, 150, 150); doc.setFontSize(7); doc.text(`Generado ${moment().format("DD/MM/YYYY HH:mm")}`, 14, 202);
      doc.save(`informe-microciclo-${start || "gps"}.pdf`);
    } finally { setExporting(false); }
  }
  return <button onClick={exportPdf} disabled={exporting} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white rounded-xl text-sm font-bold transition-colors"><Download size={16} /> {exporting ? "Generando..." : "Exportar informe"}</button>;
}