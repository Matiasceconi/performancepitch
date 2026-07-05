import React from "react";
import { fmt } from "./gpsMicrocycleReportUtils";

function trendClass(trend) {
  if (trend === "Sube") return "text-red-300";
  if (trend === "Baja") return "text-blue-300";
  if (trend === "Estable") return "text-emerald-300";
  return "text-zinc-500";
}

export default function GpsMicrocycleComparison({ comparison }) {
  const weeks = comparison[0]?.weeksAvailable || 0;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="text-white font-bold text-lg">Comparación con semanas anteriores</h3>
        <p className="text-zinc-500 text-sm">{weeks >= 4 ? "Comparación contra promedio de últimas 4 semanas." : `Comparación basada en ${weeks} semana${weeks === 1 ? "" : "s"} disponible${weeks === 1 ? "" : "s"}.`}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {comparison.map((item) => (
          <div key={item.metric.key} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
            <p className="text-xs text-zinc-500 mb-1">{item.metric.label}</p>
            <p className="text-white text-lg font-bold">{fmt(item.current, item.metric.unit)}</p>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-zinc-500">Prom. 4 sem.</span>
              <span className="text-zinc-300">{fmt(item.previous, item.metric.unit)}</span>
            </div>
            <div className="flex items-center justify-between mt-1 text-xs">
              <span className="text-zinc-500">Diferencia</span>
              <span className={trendClass(item.trend)}>{item.diff == null ? "—" : `${item.diff > 0 ? "+" : ""}${item.diff.toFixed(0)}% · ${item.trend}`}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}