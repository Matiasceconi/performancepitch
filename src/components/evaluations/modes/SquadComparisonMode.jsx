import React, { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ErrorBar, LabelList, Cell } from "recharts";
import { fmtVal, ChartTooltip, testColor } from "@/lib/evaluationChartUtils";

export default function SquadComparisonMode({ data }) {
  const { squad_comparison, metric_definitions, player } = data;
  const defMap = new Map((metric_definitions || []).map((m) => [m.metric_key, m]));
  const keys = Object.keys(squad_comparison || {}).sort();

  const [selectedKey, setSelectedKey] = useState(keys[0] || "");
  const [viewMode, setViewMode] = useState("boxplot"); // boxplot | bar

  const cmp = selectedKey ? squad_comparison[selectedKey] : null;
  const [testKey, metricKey] = selectedKey.split("|");
  const def = defMap.get(metricKey) || {};
  const unit = def.unit || "";

  // Box plot data
  const boxData = useMemo(() => {
    if (!cmp) return [];
    return [{
      name: "Plantel",
      min: cmp.squad_min,
      q1: cmp.squad_q1,
      median: cmp.squad_median,
      q3: cmp.squad_q3,
      max: cmp.squad_max,
      player: cmp.player_value,
    }];
  }, [cmp]);

  // Bar comparison data
  const barData = useMemo(() => {
    if (!cmp) return [];
    return [
      { name: "Jugador", value: cmp.player_value, color: testColor(testKey) },
      { name: "Mediana", value: cmp.squad_median, color: "#71717a" },
      { name: "Promedio", value: cmp.squad_mean, color: "#52525b" },
    ];
  }, [cmp, testKey]);

  if (!keys.length) {
    return <EmptyState message="Sin datos de comparación con el plantel — no hay resultados en la última sesión" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white max-w-[280px]">
          {keys.map((k) => {
            const [tk, mk] = k.split("|");
            const label = defMap.get(mk)?.metric_label || mk;
            return <option key={k} value={k}>{tk.toUpperCase()} · {label}</option>;
          })}
        </select>
        {unit && <span className="text-xs text-zinc-500">Unidad: {unit}</span>}
        <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-0.5 ml-auto">
          <button onClick={() => setViewMode("boxplot")} className={`px-2.5 py-1 rounded text-xs font-medium ${viewMode === "boxplot" ? "bg-blue-500 text-white" : "text-zinc-400"}`}>Box plot</button>
          <button onClick={() => setViewMode("bar")} className={`px-2.5 py-1 rounded text-xs font-medium ${viewMode === "bar" ? "bg-blue-500 text-white" : "text-zinc-400"}`}>Barras</button>
        </div>
      </div>

      {cmp && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            <StatCard label="Jugador" value={fmtVal(cmp.player_value)} unit={unit} highlight />
            <StatCard label="Percentil" value={`${cmp.player_percentile ?? "—"}%`} />
            <StatCard label="Z squad" value={cmp.z_score_squad != null ? fmtVal(cmp.z_score_squad, 2) : "—"} />
            <StatCard label="Mediana" value={fmtVal(cmp.squad_median)} unit={unit} />
            <StatCard label="Q1–Q3" value={cmp.squad_q1 != null ? `${fmtVal(cmp.squad_q1)}–${fmtVal(cmp.squad_q3)}` : "—"} unit={unit} />
            <StatCard label="N" value={cmp.squad_count} />
          </div>

          {viewMode === "bar" ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} margin={{ top: 20, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" stroke="#71717a" fontSize={11} tick={{ fill: "#a1a1aa" }} />
                  <YAxis stroke="#71717a" fontSize={11} tick={{ fill: "#a1a1aa" }} label={unit ? { value: unit, angle: -90, position: "insideLeft", fill: "#71717a", fontSize: 11 } : undefined} />
                  <Tooltip content={<ChartTooltip unit={unit} />} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={80}>
                    {barData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    <LabelList dataKey="value" position="top" formatter={(v) => fmtVal(v)} style={{ fill: "#e4e4e7", fontSize: 12, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <BoxPlotViz data={boxData[0]} unit={unit} testKey={testKey} />
            </div>
          )}
          <p className="text-xs text-zinc-600 text-center">El Z-score del plantel mide la posición del jugador respecto a la distribución de su grupo. Es distinto del Z-score individual (vs su propia línea de base).</p>
        </>
      )}
    </div>
  );
}

function BoxPlotViz({ data, unit, testKey }) {
  if (!data) return null;
  const { min, q1, median, q3, max, player } = data;
  const range = max - min;
  const pad = range * 0.1;
  const width = 100; // percentage
  const toPct = (v) => ((v - (min - pad)) / (range + 2 * pad)) * width;

  return (
    <div className="space-y-3">
      <div className="relative h-16 flex items-center">
        {/* Whisker line */}
        <div className="absolute h-0.5 bg-zinc-700" style={{ left: `${toPct(min)}%`, right: `${width - toPct(max)}%` }} />
        {/* Min cap */}
        <div className="absolute h-4 w-0.5 bg-zinc-700" style={{ left: `${toPct(min)}%` }} />
        {/* Max cap */}
        <div className="absolute h-4 w-0.5 bg-zinc-700" style={{ left: `${toPct(max)}%` }} />
        {/* Box Q1-Q3 */}
        <div className="absolute h-10 bg-zinc-700/40 border border-zinc-600 rounded" style={{ left: `${toPct(q1)}%`, width: `${toPct(q3) - toPct(q1)}%` }} />
        {/* Median line */}
        <div className="absolute h-10 w-0.5 bg-white" style={{ left: `${toPct(median)}%` }} />
        {/* Player dot */}
        <div className="absolute w-4 h-4 rounded-full border-2 border-white shadow-lg" style={{ left: `calc(${toPct(player)}% - 8px)`, background: testColor(testKey) }} />
      </div>
      <div className="flex justify-between text-xs text-zinc-500 tabular-nums">
        <span>Min: {fmtVal(min)}</span>
        <span>Q1: {fmtVal(q1)}</span>
        <span>Med: {fmtVal(median)}</span>
        <span>Q3: {fmtVal(q3)}</span>
        <span>Max: {fmtVal(max)}</span>
      </div>
      <div className="text-center text-sm">
        <span className="text-zinc-500">Jugador: </span>
        <span className="font-bold text-white tabular-nums">{fmtVal(player)} {unit}</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, highlight }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-center">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${highlight ? "text-blue-400" : "text-white"}`}>{value}{unit ? ` ${unit}` : ""}</p>
    </div>
  );
}

function EmptyState({ message }) {
  return <div className="py-10 text-center"><p className="text-zinc-500 text-sm">{message}</p></div>;
}