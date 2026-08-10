import React from "react";
import { fmtDate, fmtVal, signalColor, SIGNAL_LABELS } from "@/lib/evaluationChartUtils";

export default function FullDataMode({ data }) {
  const { results, metric_definitions } = data;
  const defMap = new Map((metric_definitions || []).map((m) => [m.metric_key, m]));

  if (!results?.length) {
    return <EmptyState message="Sin resultados para este jugador" />;
  }

  // Flatten: one row per result per metric
  const rows = [];
  for (const r of results) {
    const metrics = r.metrics || {};
    const asyms = r.asymmetries || {};
    const allMetricKeys = [...new Set([...Object.keys(metrics), ...Object.keys(asyms)])].sort();
    for (const mk of allMetricKeys) {
      const def = defMap.get(mk) || {};
      const asym = asyms[mk];
      rows.push({
        assessment_date: r.assessment_date,
        test_key: r.test_key,
        test_side: r.test_side,
        attempt: r.attempt_number,
        retest: r.retest,
        is_primary: r.is_primary,
        metric_key: mk,
        metric_label: def.metric_label || mk,
        unit: def.unit || "",
        value: metrics[mk] != null ? metrics[mk] : null,
        asym_magnitude: asym?.magnitude,
        asym_direction: asym?.direction,
        quality: r.quality_status,
        file_name: r.file_name,
      });
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-zinc-950/50 border-b border-zinc-800">
              <th className="text-left p-2.5 font-semibold text-zinc-500 sticky left-0 bg-zinc-950/50">Fecha</th>
              <th className="text-left p-2.5 font-semibold text-zinc-500">Prueba</th>
              <th className="text-left p-2.5 font-semibold text-zinc-500">Lado</th>
              <th className="text-center p-2.5 font-semibold text-zinc-500">Intento</th>
              <th className="text-left p-2.5 font-semibold text-zinc-500">Métrica</th>
              <th className="text-right p-2.5 font-semibold text-zinc-500">Valor</th>
              <th className="text-left p-2.5 font-semibold text-zinc-500">Unidad</th>
              <th className="text-left p-2.5 font-semibold text-zinc-500">Asim. mag.</th>
              <th className="text-center p-2.5 font-semibold text-zinc-500">Dir.</th>
              <th className="text-center p-2.5 font-semibold text-zinc-500">Calidad</th>
              <th className="text-left p-2.5 font-semibold text-zinc-500">Archivo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-zinc-800/40 hover:bg-zinc-800/20">
                <td className="p-2.5 text-zinc-300 sticky left-0 bg-zinc-900 whitespace-nowrap">{fmtDate(r.assessment_date, true)}</td>
                <td className="p-2.5"><span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 font-bold uppercase text-[10px]">{r.test_key}</span></td>
                <td className="p-2.5 text-zinc-400">{r.test_side}</td>
                <td className="p-2.5 text-center text-zinc-400">{r.attempt}{r.retest ? " (R)" : ""}</td>
                <td className="p-2.5 text-zinc-300">{r.metric_label}</td>
                <td className="p-2.5 text-right text-white font-semibold tabular-nums">{r.value != null ? fmtVal(r.value) : "—"}</td>
                <td className="p-2.5 text-zinc-500">{r.unit}</td>
                <td className="p-2.5 text-right text-zinc-300 tabular-nums">{r.asym_magnitude != null ? fmtVal(r.asym_magnitude) : "—"}</td>
                <td className="p-2.5 text-center text-zinc-400">{r.asym_direction || "—"}</td>
                <td className="p-2.5 text-center">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    r.quality === "ok" ? "bg-emerald-500/15 text-emerald-300" :
                    r.quality === "warning" ? "bg-yellow-500/15 text-yellow-300" :
                    "bg-red-500/15 text-red-300"
                  }`}>{r.quality || "—"}</span>
                </td>
                <td className="p-2.5 text-zinc-500 truncate max-w-[120px]" title={r.file_name}>{r.file_name || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return <div className="py-10 text-center"><p className="text-zinc-500 text-sm">{message}</p></div>;
}