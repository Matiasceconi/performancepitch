import React, { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { fmtDate, fmtVal, fmtPct, testColor, ChartTooltip } from "@/lib/evaluationChartUtils";

export default function CompareSessionsMode({ data }) {
  const { results, baselines, sessions, metric_definitions } = data;
  const allMetrics = useMemo(() => {
    const set = new Set();
    (results || []).forEach((r) => Object.keys(r.metrics || {}).forEach((k) => set.add(k)));
    return [...set].sort();
  }, [results]);
  const allTests = useMemo(() => [...new Set((results || []).map((r) => r.test_key))].sort(), [results]);
  const sessionList = sessions || [];

  const [testKey, setTestKey] = useState(allTests[0] || "");
  const [metricKey, setMetricKey] = useState(allMetrics[0] || "");
  const [sessA, setSessA] = useState(sessionList[0]?.session_id || "");
  const [sessB, setSessB] = useState(sessionList[1]?.session_id || sessionList[0]?.session_id || "");

  const def = (metric_definitions || []).find((m) => m.metric_key === metricKey) || {};
  const unit = def.unit || "";
  const baseline = baselines[`${testKey}|${metricKey}`] || {};

  const chartData = useMemo(() => {
    if (!testKey || !metricKey || !sessA) return [];
    const getVal = (sid) => {
      const r = (results || []).find((r) => r.session_id === sid && r.test_key === testKey && r.is_primary && r.metrics?.[metricKey] != null);
      return r ? r.metrics[metricKey] : null;
    };
    const valA = getVal(sessA);
    const valB = sessB ? getVal(sessB) : null;
    const bars = [];
    if (valA != null) bars.push({ name: fmtDate(sessionList.find((s) => s.session_id === sessA)?.assessment_date, true), value: valA, session: "A" });
    if (valB != null) bars.push({ name: fmtDate(sessionList.find((s) => s.session_id === sessB)?.assessment_date, true), value: valB, session: "B" });
    if (baseline.sufficient && baseline.value != null) bars.push({ name: "Base", value: baseline.value, session: "base" });
    return bars;
  }, [results, testKey, metricKey, sessA, sessB, baseline, sessionList]);

  const valA = chartData.find((d) => d.session === "A")?.value;
  const valB = chartData.find((d) => d.session === "B")?.value;
  const changeAbs = valA != null && valB != null ? valA - valB : null;
  const changePct = valA != null && valB != null && valB !== 0 ? ((valA - valB) / Math.abs(valB)) * 100 : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={testKey} onChange={(e) => setTestKey(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
          {allTests.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
        </select>
        <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white max-w-[220px]">
          {allMetrics.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={sessA} onChange={(e) => setSessA(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
          {sessionList.map((s) => <option key={s.session_id} value={s.session_id}>{fmtDate(s.assessment_date)} — {s.name || "Sesión"}</option>)}
        </select>
        <span className="text-zinc-500 text-xs">vs</span>
        <select value={sessB} onChange={(e) => setSessB(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
          <option value="">—</option>
          {sessionList.map((s) => <option key={s.session_id} value={s.session_id}>{fmtDate(s.assessment_date)} — {s.name || "Sesión"}</option>)}
        </select>
        {unit && <span className="text-xs text-zinc-500">Unidad: {unit}</span>}
      </div>

      {chartData.length > 1 ? (
        <>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 20, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#71717a" fontSize={11} tick={{ fill: "#a1a1aa" }} />
                <YAxis stroke="#71717a" fontSize={11} tick={{ fill: "#a1a1aa" }} label={unit ? { value: unit, angle: -90, position: "insideLeft", fill: "#71717a", fontSize: 11 } : undefined} />
                <Tooltip content={<ChartTooltip unit={unit} />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={80}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.session === "base" ? "#3b82f6" : d.session === "A" ? testColor(testKey) : "#a855f7"} fillOpacity={d.session === "base" ? 0.5 : 1} />
                  ))}
                  <LabelList dataKey="value" position="top" formatter={(v) => fmtVal(v)} style={{ fill: "#e4e4e7", fontSize: 12, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {changeAbs !== null && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
                <p className="text-xs text-zinc-500">Cambio absoluto</p>
                <p className={`text-xl font-bold tabular-nums ${changeAbs > 0 ? "text-emerald-400" : changeAbs < 0 ? "text-red-400" : "text-zinc-300"}`}>{changeAbs > 0 ? "+" : ""}{fmtVal(changeAbs)} {unit}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
                <p className="text-xs text-zinc-500">Cambio porcentual</p>
                <p className={`text-xl font-bold tabular-nums ${changePct > 0 ? "text-emerald-400" : changePct < 0 ? "text-red-400" : "text-zinc-300"}`}>{fmtPct(changePct)}</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState message="Seleccioná dos sesiones con datos para esta métrica" />
      )}
    </div>
  );
}

function EmptyState({ message }) {
  return <div className="py-10 text-center"><p className="text-zinc-500 text-sm">{message}</p></div>;
}