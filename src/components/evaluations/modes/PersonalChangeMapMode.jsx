import React from "react";
import { signalColor, SIGNAL_LABELS, fmtVal, fmtDate } from "@/lib/evaluationChartUtils";

export default function PersonalChangeMapMode({ data }) {
  const { signals, sessions, metric_definitions } = data;

  if (!signals?.length) {
    return <EmptyState message="Sin señales para construir el mapa personal de cambios" />;
  }

  // Build matrix: rows = metric_key (grouped by test_key), columns = sessions (dates)
  const sessionList = (sessions || []).slice().sort((a, b) => a.assessment_date.localeCompare(b.assessment_date));
  const sessionDates = sessionList.map((s) => s.assessment_date);

  // Group signals by test_key|metric_key
  const byMetric = new Map();
  for (const s of signals) {
    const k = `${s.test_key}|${s.metric_key}`;
    if (!byMetric.has(k)) byMetric.set(k, { test_key: s.test_key, metric_key: s.metric_key, byDate: new Map() });
    byMetric.get(k).byDate.set(s.assessment_date, s);
  }

  const rows = [...byMetric.values()];
  const defMap = new Map((metric_definitions || []).map((m) => [m.metric_key, m]));

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-zinc-950/50 border-b border-zinc-800">
              <th className="text-left p-2.5 font-semibold text-zinc-500 sticky left-0 bg-zinc-950/50">Métrica</th>
              {sessionDates.map((d) => (
                <th key={d} className="text-center p-2.5 font-semibold text-zinc-500 whitespace-nowrap">{fmtDate(d, true)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const def = defMap.get(row.metric_key) || {};
              const sc = signalColor("insufficient");
              return (
                <tr key={`${row.test_key}|${row.metric_key}`} className="border-b border-zinc-800/40 hover:bg-zinc-800/20">
                  <td className="p-2.5 sticky left-0 bg-zinc-900">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 text-[10px] font-bold uppercase shrink-0">{row.test_key}</span>
                      <span className="text-white font-medium truncate">{def.metric_label || row.metric_key}</span>
                    </div>
                  </td>
                  {sessionDates.map((d) => {
                    const s = row.byDate.get(d);
                    if (!s) return <td key={d} className="p-2.5 text-center text-zinc-700">—</td>;
                    const sc = signalColor(s.signal);
                    return (
                      <td key={d} className="p-2.5 text-center" title={`${fmtVal(s.current_value)} · ${SIGNAL_LABELS[s.signal]} · ${s.reason}`}>
                        <div className={`inline-flex flex-col items-center px-2 py-1 rounded border ${sc.bg} ${sc.border} cursor-help`}>
                          <span className="text-white font-semibold tabular-nums">{fmtVal(s.current_value)}</span>
                          <span className={`text-[10px] ${sc.text}`}>{s.z_score_individual != null ? `z=${fmtVal(s.z_score_individual, 1)}` : "sin base"}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-zinc-800 flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/15 border border-emerald-500/30" /> Esperado</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500/15 border border-yellow-500/30" /> Moderado</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/15 border border-red-500/30" /> Importante</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-zinc-700/30 border border-zinc-700" /> Sin base</span>
        <span className="ml-auto">Pasa el mouse sobre una celda para ver el detalle</span>
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return <div className="py-10 text-center"><p className="text-zinc-500 text-sm">{message}</p></div>;
}