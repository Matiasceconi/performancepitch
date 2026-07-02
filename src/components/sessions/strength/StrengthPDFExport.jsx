import React, { useState } from "react";
import { FileText, Loader } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import jsPDF from "jspdf";

export default function StrengthPDFExport({ session, stations }) {
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  async function generate() {
    setGenerating(true);
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageW = 210;
      const pageH = 297;
      const margin = 14;
      const contentW = pageW - margin * 2;
      let y = margin;

      const DARK = [20, 20, 20];
      const GRAY = [100, 100, 100];
      const YELLOW = [240, 200, 0];
      const WHITE = [255, 255, 255];

      function addPageIfNeeded(needed = 10) {
        if (y + needed > pageH - 10) {
          doc.addPage();
          y = margin;
        }
      }

      // Header
      doc.setFillColor(...YELLOW);
      doc.rect(0, 0, pageW, 6, "F");
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text("Planilla de Fuerza", margin, y + 6);
      y += 12;

      const infoLine = [
        `Sesión: ${session.title || "—"}`,
        `Fecha: ${moment(session.date).format("DD/MM/YYYY")}`,
        session.squad_name && `Plantel: ${session.squad_name}`,
        session.match_day_code && `MD: ${session.match_day_code}`,
      ].filter(Boolean).join("   ·   ");
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);
      doc.text(infoLine, margin, y + 4, { maxWidth: contentW });
      y += 8;

      const strengthInfo = [
        session.strength_purpose && `Propósito mecánico: ${session.strength_purpose}`,
        session.strength_session_type && `Tipo de sesión: ${session.strength_session_type}`,
        session.strength_vector_pattern && `Patrón vectorial: ${session.strength_vector_pattern}`,
      ].filter(Boolean).join("   ·   ");
      if (strengthInfo) {
        doc.text(strengthInfo, margin, y + 4, { maxWidth: contentW });
        y += 8;
      }

      y += 2;

      // Table: N° | Método | Tipo | Ejercicio | Volumen | Observaciones
      const cols = [
        { label: "N°", w: 10 },
        { label: "Método", w: 28 },
        { label: "Tipo", w: 32 },
        { label: "Ejercicio", w: 48 },
        { label: "Volumen", w: 24 },
        { label: "Observaciones", w: contentW - (10 + 28 + 32 + 48 + 24) },
      ];

      function drawHeader() {
        addPageIfNeeded(8);
        doc.setFillColor(...DARK);
        doc.rect(margin, y, contentW, 6, "F");
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...WHITE);
        let hx = margin;
        cols.forEach(c => { doc.text(c.label, hx + 2, y + 4, { maxWidth: c.w - 3 }); hx += c.w; });
        y += 6;
      }

      drawHeader();

      if (stations.length === 0) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...GRAY);
        doc.text("Sin ejercicios cargados", margin, y + 5);
        y += 10;
      } else {
        stations.forEach((st, idx) => {
          const values = [String(idx + 1), st.method || "—", st.exercise_type || "—", st.exercise_name || "—", st.volume || "—", st.notes || "—"];
          const lineSets = values.map((v, i) => doc.splitTextToSize(v, cols[i].w - 3));
          const rowLines = Math.max(...lineSets.map(l => l.length));
          const rowH = Math.max(6, rowLines * 4 + 2);

          addPageIfNeeded(rowH + 2);
          if (idx % 2 === 0) {
            doc.setFillColor(248, 248, 248);
            doc.rect(margin, y, contentW, rowH, "F");
          }
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...DARK);
          let rx = margin;
          lineSets.forEach((lines, i) => {
            doc.text(lines, rx + 2, y + 4, { maxWidth: cols[i].w - 3 });
            rx += cols[i].w;
          });
          y += rowH;
        });
      }

      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(...YELLOW);
        doc.rect(0, pageH - 4, pageW, 4, "F");
        doc.setFontSize(6);
        doc.setTextColor(...GRAY);
        doc.text(`${p} / ${totalPages}`, pageW - margin, pageH - 6, { align: "right" });
      }

      const filename = `fuerza_${moment(session.date).format("YYYY-MM-DD")}_${session.title.replace(/\s+/g, "_")}.pdf`;
      doc.save(filename);
      toast({ title: "✓ PDF de fuerza exportado" });
    } catch (err) {
      toast({ title: "Error al generar el PDF: " + err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <button onClick={generate} disabled={generating}
      className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 rounded-lg text-xs hover:bg-yellow-500/25 transition-colors disabled:opacity-50">
      {generating ? <Loader size={13} className="animate-spin" /> : <FileText size={13} />}
      {generating ? "Generando..." : "Exportar PDF"}
    </button>
  );
}