import React from "react";
import { fmtVal, fmtPct, signalColor, SIGNAL_LABELS } from "@/lib/evaluationChartUtils";

export default function SummaryMode({ data }) {
  const { signals, baselines, metric_definitions } = data;
  const metricDefMap = new Map((metric_definitions || []).map((m) => [m.metric_key, m]));

  if (!signals?.length) {
    return <EmptyState message="Sin señales calculadas — no hay resultados primarios para este jugador" />;
  }

  // Group by test_key|metric_key, keep latest
  const byKey = new Map();
  for (const s of signals) {
    const k = `${s.test_key}|${s.metric_key}`;
    if (!byKey.has(k) || s.assessment_date > byKey.get(k).assessment_date) byKey.set(k, s);
  }
  const items = [...byKey.values()];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((s) => {
        const def = metricDefMap.get(s.metric_key) || {};
        const sc = signalColor(s.signal);
        const baseline = baselines[`${s.test_key}|${s.metric_key}`] || {};
        return (
          <div key={`${s.test_key}|${s.metric_key}`} className={`bg-zinc-900 border ${sc.border} rounded-xl p-3.5`}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 text-[10px] font-bold uppercase">{s.test_key}</span>
                <p className="text-sm font-medium text-white mt-1">{def.metric_label || s.metric_key}</p>
                <p className="text-xs text-zinc-500">{def.unit || ""}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${sc.bg} ${sc.text} ${sc.border}`}>{SIGNAL_LABELS[s.signal] || s.signal}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat label="Actual" value={fmtVal(s.current_value)} highlight />
              <Stat label="Base" value={baseline.sufficient ? fmtVal(baseline.value) : "Sin base"} />
              <Stat label="Δ Abs" value={s.change_abs !== null ? fmtVal(s.change_abs) : "—"} tone={s.change_abs > 0 ? "pos" : s.change_abs < 0 ? "neg" : undefined} />
              <Stat label="Δ %" value={fmtPct(s.change_pct)} tone={s.change_pct > 0 ? "pos" : s.change_pct < 0 ? "neg" : undefined} />
              <Stat label="Z ind." value={s.z_score_individual !== null ? fmtVal(s.z_score_individual, 2) : "—"} />
              <Stat label="Calidad" value={s.quality_status} />
            </div>
            <p className="text-xs text-zinc-500 mt-2 pt-2 border-t border-zinc-800/50">{s.reason}</p>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, highlight, tone }) {
  const cls = tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : highlight ? "text-white" : "text-zinc-300";
  return (
    <div>
      <p className="text-zinc-500">{label}</p>
      <p className={`font-semibold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

function EmptyState({ message }) {
  return <div className="py-10 text-center"><p className="text-zinc-500 text-sm">{message}</p></div>;
}