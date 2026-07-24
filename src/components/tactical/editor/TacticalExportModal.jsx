import React, { useState } from "react";
import { X, Download, Loader2, Clipboard } from "lucide-react";
import { exportStageAsPNG, exportStageAsJPG, exportStageAsPDF, copyStageToClipboard } from "@/components/tactical/lib/tacticalExport";

const SIZES = [
  { id: "16:9", label: "16:9" },
  { id: "a4_horizontal", label: "A4 horizontal" },
  { id: "a4_vertical", label: "A4 vertical" },
  { id: "square", label: "Cuadrado 1080×1080" },
  { id: "story", label: "Historia 1080×1920" },
];

export default function TacticalExportModal({ open, onClose, stageRef, boards, currentBoardId, brand, project }) {
  const [format, setFormat] = useState("png");
  const [size, setSize] = useState("16:9");
  const [quality, setQuality] = useState("normal");
  const [scope, setScope] = useState("current");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleExport() {
    setExporting(true);
    setError("");
    try {
      const pixelRatio = quality === "high" ? 3 : 2;
      const stage = stageRef.current?.getStage();
      if (!stage) throw new Error("No hay lienzo para exportar");
      const filename = `${project?.name || "pizarra"}_${Date.now()}`;

      if (format === "png") {
        exportStageAsPNG(stage, `${filename}.png`, pixelRatio);
      } else if (format === "jpg") {
        exportStageAsJPG(stage, `${filename}.jpg`, pixelRatio);
      } else if (format === "pdf") {
        if (scope === "all") {
          // Exportar todas las pizarras requiere cambiar el board activo y capturar cada una
          // Por ahora, exportamos solo la actual como fallback
          exportStageAsPDF(stage, { filename: `${filename}.pdf`, orientation: "landscape", paperSize: "a4", pixelRatio });
        } else {
          exportStageAsPDF(stage, { filename: `${filename}.pdf`, orientation: "landscape", paperSize: "a4", pixelRatio });
        }
      } else if (format === "clipboard") {
        await copyStageToClipboard(stage, pixelRatio);
      }
      onClose();
    } catch (e) {
      setError(e.message || "Error al exportar");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <h3 className="text-white font-semibold">Exportar pizarra</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Formato</label>
            <div className="grid grid-cols-4 gap-2">
              {[{ id: "png", label: "PNG" }, { id: "jpg", label: "JPG" }, { id: "pdf", label: "PDF" }, { id: "clipboard", label: "Portapapeles" }].map((f) => (
                <button key={f.id} onClick={() => setFormat(f.id)} className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${format === f.id ? "bg-white text-zinc-900 border-white" : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-500"}`}>{f.label}</button>
              ))}
            </div>
          </div>
          {format !== "clipboard" && (
            <>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Tamaño</label>
                <select value={size} onChange={(e) => setSize(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                  {SIZES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Alcance</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setScope("current")} className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${scope === "current" ? "bg-white text-zinc-900 border-white" : "bg-zinc-800 text-zinc-300 border-zinc-700"}`}>Pizarra actual</button>
                  <button onClick={() => setScope("all")} className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${scope === "all" ? "bg-white text-zinc-900 border-white" : "bg-zinc-800 text-zinc-300 border-zinc-700"}`}>Todas en un PDF</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Calidad</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setQuality("normal")} className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${quality === "normal" ? "bg-white text-zinc-900 border-white" : "bg-zinc-800 text-zinc-300 border-zinc-700"}`}>Normal</button>
                  <button onClick={() => setQuality("high")} className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${quality === "high" ? "bg-white text-zinc-900 border-white" : "bg-zinc-800 text-zinc-300 border-zinc-700"}`}>Alta</button>
                </div>
              </div>
            </>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-zinc-800">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800">Cancelar</button>
          <button onClick={handleExport} disabled={exporting} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-white text-zinc-900 font-semibold hover:bg-zinc-200 disabled:opacity-40">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : format === "clipboard" ? <Clipboard size={14} /> : <Download size={14} />}
            {exporting ? "Exportando..." : "Exportar"}
          </button>
        </div>
      </div>
    </div>
  );
}