import React from "react";
import { BarChart3, Gauge, ListChecks, Plus, SlidersHorizontal, TableProperties, Trash2 } from "lucide-react";
import { normalizeMatchReportConfig, REPORT_METRICS } from "@/lib/matchReportData";

const OPTIONS = [
  ["showKpis", "Resumen de KPIs", Gauge],
  ["showMinutesEvolution", "Evolución y gráficos", BarChart3],
  ["showProfileComparison", "Comparación con perfil competitivo", SlidersHorizontal],
  ["showMatchDetails", "Detalle completo por partido", TableProperties],
  ["showZoneCharts", "Gráficos de velocidad e intensidad", ListChecks],
];
const CHART_METRICS = [{ key: "minutes", label: "Minutos jugados", unit: "min" }, ...REPORT_METRICS];
const STYLES = [["line", "Línea"], ["area", "Área"], ["bar", "Barras"]];

export default function MatchReportConfigPanel({ value, config: configProp, onChange }) {
  const safeConfig = normalizeMatchReportConfig(value || configProp);
  const patch = (values) => onChange?.({ ...safeConfig, ...values });
  const charts = safeConfig.evolutionCharts || [];

  const updateChart = (index, values) => {
    const next = charts.map((chart, chartIndex) => chartIndex === index ? { ...chart, ...values } : chart);
    patch({ evolutionCharts: next });
  };
  const removeChart = (index) => patch({ evolutionCharts: charts.filter((_, chartIndex) => chartIndex !== index) });
  const addChart = () => {
    const used = new Set(charts.map((chart) => chart.metric));
    const nextMetric = CHART_METRICS.find((metric) => !used.has(metric.key));
    if (nextMetric && charts.length < 6) patch({ evolutionCharts: [...charts, { metric: nextMetric.key, style: "line" }] });
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-4"><h3 className="text-sm font-bold text-white">Configurar informe</h3><p className="text-[11px] text-zinc-500">La configuración se guarda y será idéntica para staff, portal del jugador, PDF y Excel.</p></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {OPTIONS.map(([key, label, Icon]) => (
          <label key={key} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${safeConfig[key] ? "border-emerald-500/40 bg-emerald-500/10" : "border-zinc-800 bg-zinc-950/50"}`}>
            <input type="checkbox" checked={Boolean(safeConfig[key])} onChange={(event) => patch({ [key]: event.target.checked })} className="h-4 w-4 accent-emerald-500" />
            <Icon size={15} className={safeConfig[key] ? "text-emerald-400" : "text-zinc-600"} />
            <span className="text-xs font-semibold text-zinc-200">{label}</span>
          </label>
        ))}
      </div>

      {safeConfig.showMinutesEvolution && (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
          <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-zinc-200">Gráficos de evolución</p><p className="text-[10px] text-zinc-500">Agregá hasta 6 gráficos y elegí métrica y estilo.</p></div><button type="button" onClick={addChart} disabled={charts.length >= 6 || charts.length >= CHART_METRICS.length} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40"><Plus size={13} /> Agregar gráfico</button></div>
          <div className="space-y-2">
            {charts.map((chart, index) => (
              <div key={`${chart.metric}-${index}`} className="grid gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 sm:grid-cols-[1fr_150px_auto] sm:items-center">
                <select value={chart.metric} onChange={(event) => updateChart(index, { metric: event.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500">
                  {CHART_METRICS.map((metric) => <option key={metric.key} value={metric.key} disabled={charts.some((item, itemIndex) => itemIndex !== index && item.metric === metric.key)}>{metric.label} ({metric.unit})</option>)}
                </select>
                <select value={chart.style} onChange={(event) => updateChart(index, { style: event.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500">
                  {STYLES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <button type="button" onClick={() => removeChart(index)} disabled={charts.length === 1} title="Quitar gráfico" className="rounded-lg p-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-30"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
