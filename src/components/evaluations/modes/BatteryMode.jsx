import React, { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { testColor, fmtVal, ChartTooltip } from "@/lib/evaluationChartUtils";

export default function BatteryMode({ data }) {
  const { results, sessions, metric_definitions } = data;
  const sessionList = sessions || [];
  const [sessionId, setSessionId] = useState(sessionList[0]?.session_id || "");

  const sessionResults = useMemo(() => (results || []).filter((r) => r.session_id === sessionId && r.is_primary), [results, sessionId]);
  const testKeys = useMemo(() => [...new Set(sessionResults.map((r) => r.test_key))].sort(), [sessionResults]);

  // Find comparable metrics (present in CMJ and SJ)
  const cmjMetrics = new Set(sessionResults.filter((r) => r.test_key === "cmj").flatMap((r) => Object.keys(r.metrics || {})));
  const sjMetrics = new Set(sessionResults.filter((r) => r.test_key === "sj").flatMap((r) => Object.keys(r.metrics || {})));
  const cmrjMetrics = new Set(sessionResults.filter((r) => r.test_key === "cmrj").flatMap((r) => Object.keys(r.metrics || {})));
  const commonMetrics = [...cmjMetrics].filter((m) => sjMetrics.has(m)).sort();

  const defMap = new Map((metric_definitions || []).map((m) => [m.metric_key, m]));

  // Build chart data: one bar per test for each common metric
  const [selectedMetric, setSelectedMetric] = useState(commonMetrics[0] || "");

  const chartData = useMemo(() => {
    if (!selectedMetric) return [];
    const getVal = (tk) => {
      const r = sessionResults.find((r) => r.test_key === tk && r.metrics?.[selectedMetric] != null);
      return r ? r.metrics[selectedMetric] : null;
    };
    return testKeys.map((tk) => ({
      name: tk.toUpperCase(),
      value: getVal(tk),
      test_key: tk,
    })).filter((d) => d.value != null);
  }, [sessionResults, testKeys, selectedMetric]);

  const def = defMap.get(selectedMetric) || {};
  const unit = def.unit || "";

  // CMJ-SJ difference
  const cmjVal = chartData.find((d) => d.test_key === "cmj")?.value;
  const sjVal = chartData.find((d) => d.test_key === "sj")?.value;
  const diff = cmjVal != null && sjVal != null ? cmjVal - sjVal : null;
  const ratio = cmjVal != null && sjVal != null && sjVal !== 0 ? cmjVal / sjVal : null;

  // Rebound conservation (CMRJ vs CMJ)
  const cmrjVal = chartData.find((d) => d.test_key === "cmrj")?.value;
  const reboundConservation = cmjVal != null && cmrjVal != null && cmjVal !== 0 ? (cmrjVal / cmjVal) * 100 : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
          {sessionList.map((s) => <option key={s.session_id} value={s.session_id}>{s.assessment_date} — {s.name || "Sesión"}</option>)}
        </select>
        {commonMetrics.length > 0 && (
          <select value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white max-w-[220px]">
            {commonMetrics.map((m) => <option key={m} value={m}>{defMap.get(m)?.metric_label || m}</option>)}
          </select>
        )}
        {unit && <span className="text-xs text-zinc-500">Unidad: {unit}</span>}
      </div>

      {testKeys.length < 2 ? (
        <EmptyState message="Se necesitan al menos 2 pruebas en la misma sesión para comparar la batería" />
      ) : chartData.length ? (
        <>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 20, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#71717a" fontSize={11} tick={{ fill: "#a1a1aa" }} />
                <YAxis stroke="#71717a" fontSize={11} tick={{ fill: "#a1a1aa" }} label={unit ? { value: unit, angle: -90, position: "insideLeft", fill: "#71717a", fontSize: 11 } : undefined} />
                <Tooltip content={<ChartTooltip unit={unit} />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={100}>
                  {chartData.map((d, i) => <Cell key={i} fill={testColor(d.test_key)} />)}
                  <LabelList dataKey="value" position="top" formatter={(v) => fmtVal(v)} style={{ fill: "#e4e4e7", fontSize: 12, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Derived metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {diff !== null && (
              <DerivedCard label="Diferencia CMJ − SJ" value={`${diff > 0 ? "+" : ""}${fmtVal(diff)} ${unit}`} tone={diff > 0 ? "pos" : "neg"} />
            )}
            {ratio !== null && (
              <DerivedCard label="Relación CMJ/SJ" value={fmtVal(ratio, 2)} sub=">1 = CMJ mayor que SJ" />
            )}
            {reboundConservation !== null && (
              <DerivedCard label="Conservación rebote" value={`${fmtVal(reboundConservation)}%`} sub="CMRJ / CMJ" />
            )}
          </div>
        </>
      ) : (
        <EmptyState message="Métrica no disponible para todas las pruebas en esta sesión" />
      )}
    </div>
  );
}

function DerivedCard({ label, value, sub, tone }) {
  const cls = tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : "text-white";
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${cls}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function EmptyState({ message }) {
  return <div className="py-10 text-center"><p className="text-zinc-500 text-sm">{message}</p></div>;
}