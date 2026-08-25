import React from "react";
import { BarChart3, Gauge, ListChecks, SlidersHorizontal, TableProperties } from "lucide-react";
import { REPORT_METRICS } from "@/lib/matchReportData";

const OPTIONS = [
  ["showKpis", "Resumen de KPIs", Gauge],
  ["showMinutesEvolution", "Evolución minutos + métrica", BarChart3],
  ["showProfileComparison", "Comparación con perfil competitivo", SlidersHorizontal],
  ["showMatchDetails", "Detalle completo por partido", TableProperties],
  ["showZoneCharts", "Gráficos de velocidad e intensidad", ListChecks],
];

export default function MatchReportConfigPanel({ config, onChange }) {
  const patch = (values) => onChange({ ...config, ...values });
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-4"><h3 className="text-sm font-bold text-white">Configurar informe</h3><p className="text-[11px] text-zinc-500">Elegí qué verá el staff, el jugador y qué se incluirá al exportar.</p></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {OPTIONS.map(([key, label, Icon]) => (
          <label key={key} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${config[key] ? "border-emerald-500/40 bg-emerald-500/10" : "border-zinc-800 bg-zinc-950/50"}`}>
            <input type="checkbox" checked={config[key]} onChange={(event) => patch({ [key]: event.target.checked })} className="h-4 w-4 accent-emerald-500" />
            <Icon size={15} className={config[key] ? "text-emerald-400" : "text-zinc-600"} />
            <span className="text-xs font-semibold text-zinc-200">{label}</span>
          </label>
        ))}
      </div>
      {config.showMinutesEvolution && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
          <label className="text-xs font-semibold text-zinc-400">Métrica junto a minutos</label>
          <select value={config.evolutionMetric} onChange={(event) => patch({ evolutionMetric: event.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500">
            {REPORT_METRICS.map((metric) => <option key={metric.key} value={metric.key}>{metric.label} ({metric.unit})</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
