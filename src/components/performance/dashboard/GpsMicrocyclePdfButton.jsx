import React, { useState } from "react";
import { Download } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { MICRO_METRICS } from "./gpsMicrocycleReportUtils";
import { generateMicrocyclePdf } from "./gpsMicrocyclePdfRenderer";

const DEFAULT_OPTIONS = {
  includeCharts: true,
  includeRankings: true,
  includeDailyTable: true,
  includeComparison: true,
  includeAi: false,
  includeHighlightedPlayers: true,
};

const OPTION_LABELS = [
  ["includeCharts", "Incluir gráficos"],
  ["includeRankings", "Incluir rankings"],
  ["includeDailyTable", "Incluir tabla diaria"],
  ["includeComparison", "Incluir comparación"],
  ["includeAi", "Incluir análisis IA"],
  ["includeHighlightedPlayers", "Incluir jugadores destacados"],
];

export default function GpsMicrocyclePdfButton({ squadName, season, dailySummaries, highlights, comparison, cycleDays }) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);

  async function buildAiText() {
    if (!options.includeAi) return "";
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Redacta conclusiones profesionales, breves y accionables para un informe de rendimiento de fútbol. Usa español técnico y claro. Datos: ${JSON.stringify({ dailySummaries, highlights, comparison }).slice(0, 12000)}`,
    });
    return typeof res === "string" ? res : String(res || "");
  }

  async function exportPdf() {
    setExporting(true);
    try {
      const aiText = await buildAiText();
      await generateMicrocyclePdf({ squadName, season, dailySummaries, highlights, comparison, metrics: MICRO_METRICS, cycleDays, options, aiText });
      setOpen(false);
    } finally { setExporting(false); }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} disabled={exporting} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white rounded-xl text-sm font-bold transition-colors"><Download size={16} /> {exporting ? "Generando..." : "Exportar informe"}</button>
      {open && <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"><div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-2xl"><h3 className="text-white text-lg font-bold">Opciones de exportación</h3><p className="text-zinc-400 text-sm mt-1">Informe PDF profesional sin capturas de pantalla.</p><div className="space-y-3 mt-5">{OPTION_LABELS.map(([key, label]) => <label key={key} className="flex items-center gap-3 text-zinc-200 text-sm"><input type="checkbox" checked={options[key]} onChange={(e) => setOptions((p) => ({ ...p, [key]: e.target.checked }))} className="w-4 h-4 accent-emerald-600" />{label}</label>)}</div><div className="flex justify-end gap-2 mt-6"><button onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm">Cancelar</button><button onClick={exportPdf} disabled={exporting} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white text-sm font-bold">{exporting ? "Generando..." : "Generar PDF"}</button></div></div></div>}
    </>
  );
}