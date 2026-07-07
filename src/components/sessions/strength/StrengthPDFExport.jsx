import React, { useMemo, useState } from "react";
import { FileText, Loader, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import jsPDF from "jspdf";

export default function StrengthPDFExport({ session, stations, blocks = [] }) {
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("complete");
  const [selected, setSelected] = useState([]);
  const { toast } = useToast();

  const exportBlocks = useMemo(() => blocks.filter(block => !block.hidden), [blocks]);

  function toggle(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  }

  function selectedBlocks() {
    if (mode === "complete" || mode === "separate") return exportBlocks;
    return exportBlocks.filter(block => selected.includes(block.id));
  }

  async function generate() {
    const blocksToExport = selectedBlocks();
    if (!blocksToExport.length) return;
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
        if (y + needed > pageH - 12) { doc.addPage(); y = margin; drawDocHeader(false); }
      }

      function drawDocHeader(first = true) {
        doc.setFillColor(...YELLOW);
        doc.rect(0, 0, pageW, 6, "F");
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...DARK);
        doc.text("Planilla de Fuerza", margin, y + 6);
        y += 12;
        if (first) {
          const infoLine = [`Sesión: ${session.title || "—"}`, `Fecha: ${moment(session.date).format("DD/MM/YYYY")}`, session.squad_name && `Plantel: ${session.squad_name}`, session.match_day_code && `MD: ${session.match_day_code}`].filter(Boolean).join("   ·   ");
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...GRAY);
          doc.text(infoLine, margin, y + 4, { maxWidth: contentW });
          y += 8;
        }
      }

      function drawBlock(block) {
        const blockRows = stations.filter(row => row.work_block_id === block.id).sort((a, b) => (a.order || 0) - (b.order || 0));
        addPageIfNeeded(22);
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, y, contentW, 12, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...DARK);
        doc.text(block.name || "Cuadro", margin + 3, y + 7);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...GRAY);
        doc.text(`${blockRows.length} ejercicios`, pageW - margin - 3, y + 7, { align: "right" });
        y += 15;
        if (block.description) {
          doc.setFontSize(7);
          doc.text(doc.splitTextToSize(block.description, contentW), margin, y);
          y += 7;
        }
        const cols = [{ label: "N°", w: 10 }, { label: "Ejercicio", w: 50 }, { label: "Volumen", w: 22 }, { label: "Series", w: 18 }, { label: "Reps", w: 18 }, { label: "Tiempo", w: 20 }, { label: "Método/Tipo", w: 34 }, { label: "Obs.", w: contentW - 172 }];
        doc.setFillColor(...DARK);
        doc.rect(margin, y, contentW, 6, "F");
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...WHITE);
        let hx = margin;
        cols.forEach(c => { doc.text(c.label, hx + 2, y + 4, { maxWidth: c.w - 3 }); hx += c.w; });
        y += 6;
        if (!blockRows.length) {
          doc.setTextColor(...GRAY);
          doc.text("Sin ejercicios cargados", margin, y + 5);
          y += 10;
          return;
        }
        blockRows.forEach((row, idx) => {
          const values = [String(idx + 1), row.exercise_name || "—", row.volume || "—", row.sets || "—", row.reps || "—", row.time || "—", [row.method, row.exercise_type].filter(Boolean).join(" / ") || "—", row.notes || "—"];
          const lineSets = values.map((value, i) => doc.splitTextToSize(value, cols[i].w - 3));
          const rowH = Math.max(6, Math.max(...lineSets.map(lines => lines.length)) * 4 + 2);
          addPageIfNeeded(rowH + 2);
          if (idx % 2 === 0) { doc.setFillColor(248, 248, 248); doc.rect(margin, y, contentW, rowH, "F"); }
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...DARK);
          let rx = margin;
          lineSets.forEach((lines, i) => { doc.text(lines, rx + 2, y + 4, { maxWidth: cols[i].w - 3 }); rx += cols[i].w; });
          y += rowH;
        });
        y += 6;
      }

      drawDocHeader(true);
      blocksToExport.forEach((block, idx) => {
        if (mode === "separate" && idx > 0) { doc.addPage(); y = margin; drawDocHeader(false); }
        drawBlock(block);
      });

      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(...YELLOW);
        doc.rect(0, pageH - 4, pageW, 4, "F");
        doc.setFontSize(6);
        doc.setTextColor(...GRAY);
        doc.text(`${p} / ${totalPages}`, pageW - margin, pageH - 6, { align: "right" });
      }
      doc.save(`fuerza_${moment(session.date).format("YYYY-MM-DD")}_${(session.title || "sesion").replace(/\s+/g, "_")}.pdf`);
      toast({ title: "✓ PDF de fuerza exportado" });
      setOpen(false);
    } catch (err) {
      toast({ title: "Error al generar el PDF: " + err.message, variant: "destructive" });
    } finally { setGenerating(false); }
  }

  return <>
    <button onClick={() => setOpen(true)} disabled={generating || exportBlocks.length === 0} className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 rounded-lg text-xs hover:bg-yellow-500/25 transition-colors disabled:opacity-50">{generating ? <Loader size={13} className="animate-spin" /> : <FileText size={13} />}{generating ? "Generando..." : "Exportar"}</button>
    {open && <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"><div className="w-full max-w-md rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl"><div className="flex items-center justify-between p-4 border-b border-zinc-800"><p className="text-sm font-semibold text-white">Exportar fuerza</p><button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white"><X size={16} /></button></div><div className="p-4 space-y-4"><div className="grid gap-2">{[{ id: "complete", label: "Exportar sesión completa" }, { id: "selected", label: "Exportar cuadros seleccionados" }, { id: "separate", label: "Todos los cuadros en hojas separadas" }].map(option => <button key={option.id} onClick={() => setMode(option.id)} className={`text-left rounded-lg border px-3 py-2 text-xs ${mode === option.id ? "bg-white text-zinc-900 border-white" : "bg-zinc-800 text-zinc-300 border-zinc-700"}`}>{option.label}</button>)}</div>{mode === "selected" && <div className="space-y-2"><p className="text-[10px] text-zinc-500 uppercase font-bold">Elegir cuadros</p>{exportBlocks.map(block => <label key={block.id} className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={selected.includes(block.id)} onChange={() => toggle(block.id)} />{block.name}</label>)}</div>}<div className="flex justify-end gap-2"><button onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs">Cancelar</button><button onClick={generate} disabled={generating || !selectedBlocks().length} className="px-4 py-2 rounded-lg bg-white text-zinc-950 text-xs font-bold disabled:opacity-40">Exportar PDF</button></div></div></div></div>}
  </>;
}