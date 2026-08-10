import React, { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer, Scatter, ComposedChart } from "recharts";
import { testColor, fmtDate, fmtVal, ChartTooltip } from "@/lib/evaluationChartUtils";

export default function EvolutionMode({ data }) {
  const { results, baselines, metric_definitions, sessions } = data;
  const metricDefs = metric_definitions || [];
  const allMetrics = useMemo(() => {
    const set = new Set();
    (results || []).forEach((r) => Object.keys(r.metrics || {}).forEach((k) => set.add(k)));
    return [...set].sort();
  }, [results]);
  const allTests = useMemo(() => [...new Set((results || []).map((r) => r.test_key))].sort(), [results]);

  const [testKey, setTestKey] = useState(allTests[0] || "");
  const [metricKey, setMetricKey] = useState(allMetrics[0] || "");
  const [period, setPeriod] = useState("all");
  const [showAllAttempts, setShowAllAttempts] = useState(false);

  const def = metricDefs.find((m) => m.metric_key === metricKey) || {};
  const unit = def.unit || "";

  const chartData = useMemo(() => {
    if (!testKey || !metricKey) return [];
    const filtered = (results || []).filter((r) => r.test_key === testKey && r.metrics?.[metricKey] != null);
    let list = filtered;
    if (!showAllAttempts) list = list.filter((r) => r.is_primary);
    if (period !== "all") {
      const n = period === "last_5" ? 5 : 10;
      const dates = [...new Set(list.map((r) => r.assessment_date))].sort().reverse().slice(0, n);
      list = list.filter((r) => dates.includes(r.assessment_date));
    }
    return list
      .map((r) => ({
        date: r.assessment_date,
        value: r.metrics[metricKey],
        retest: r.retest,
        quality: r.quality_status,
        attempt: r.attempt_number,
        session_id: r.session_id,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [results, testKey, metricKey, showAllAttempts, period]);

  const baseline = baselines[`${testKey}|${metricKey}`] || {};
  const baselineValue = baseline.sufficient ? baseline.value : null;
  const std = baseline.std || 0;

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={testKey} onChange={(e) => setTestKey(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
          {allTests.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
        </select>
        <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white max-w-[220px]">
          {allMetrics.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
          <option value="all">Todas</option>
          <option value="last_5">Últimas 5</option>
          <option value="last_10">Últimas 10</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
          <input type="checkbox" checked={showAllAttempts} onChange={(e) => setShowAllAttempts(e.target.checked)} className="accent-blue-500" />
          Todos los intentos
        </label>
        {unit && <span className="text-xs text-zinc-500">Unidad: {unit}</span>}
      </div>

      {/* Chart */}
      {chartData.length ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, true)} stroke="#71717a" fontSize={11} tick={{ fill: "#a1a1aa" }} />
              <YAxis stroke="#71717a" fontSize={11} tick={{ fill: "#a1a1aa" }} label={unit ? { value: unit, angle: -90, position: "insideLeft", fill: "#71717a", fontSize: 11 } : undefined} />
              <Tooltip content={<ChartTooltip unit={unit} />} />
              {baselineValue != null && std > 0 && (
                <ReferenceArea y1={baselineValue - std} y2={baselineValue + std} fill="#3b82f6" fillOpacity={0.08} />
              )}
              {baselineValue != null && (
                <ReferenceLine y={baselineValue} stroke="#3b82f6" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "Base", fill: "#3b82f6", fontSize: 10, position: "right" }} />
              )}
              <Line type="monotone" dataKey="value" stroke={testColor(testKey)} strokeWidth={2} dot={(props) => {
                const { cx, cy, payload } = props;
                if (payload.retest) return <circle key={`r-${cx}`} cx={cx} cy={cy} r={4} fill="#f59e0b" stroke="#18181b" strokeWidth={1} />;
                if (payload.quality === "warning") return <circle key={`w-${cx}`} cx={cx} cy={cy} r={4} fill="#ef4444" stroke="#18181b" strokeWidth={1} />;
                return <circle key={`n-${cx}`} cx={cx} cy={cy} r={3} fill={testColor(testKey)} stroke="#18181b" strokeWidth={1} />;
              }} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: testColor(testKey) }} /> Principal</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Retest</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Calidad warn</span>
            <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-blue-500" /> Línea de base</span>
            <span className="flex items-center gap-1"><span className="w-4 h-2 bg-blue-500/20" /> Rango habitual (±1 SD)</span>
          </div>
        </div>
      ) : (
        <EmptyState message="Sin datos para esta combinación de prueba y métrica" />
      )}
    </div>
  );
}

function EmptyState({ message }) {
  return <div className="py-10 text-center"><p className="text-zinc-500 text-sm">{message}</p></div>;
}