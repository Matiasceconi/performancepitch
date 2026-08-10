import React, { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList } from "recharts";
import { fmtDate, fmtVal, ChartTooltip } from "@/lib/evaluationChartUtils";

export default function AsymmetryMode({ data }) {
  const { results, sessions, metric_definitions } = data;
  const sessionList = sessions || [];
  const [sessionId, setSessionId] = useState(sessionList[0]?.session_id || "");

  // Collect all asymmetry metric keys
  const asymKeys = useMemo(() => {
    const set = new Set();
    (results || []).forEach((r) => Object.keys(r.asymmetries || {}).forEach((k) => set.add(k)));
    return [...set].sort();
  }, [results]);
  const [selectedAsym, setSelectedAsym] = useState(asymKeys[0] || "");

  const defMap = new Map((metric_definitions || []).map((m) => [m.metric_key, m]));

  // Build chart data: one bar per test_key with asymmetry magnitude (signed by direction)
  const chartData = useMemo(() => {
    if (!selectedAsym) return [];
    const sessionResults = (results || []).filter((r) => r.session_id === sessionId && r.is_primary);
    return sessionResults
      .map((r) => {
        const asym = r.asymmetries?.[selectedAsym];
        if (!asym) return null;
        const signedValue = asym.direction === "L" ? -asym.magnitude : asym.magnitude;
        return {
          name: r.test_key.toUpperCase(),
          test_key: r.test_key,
          value: signedValue,
          magnitude: asym.magnitude,
          direction: asym.direction,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.value - a.value); // L (negative) on left, R (positive) on right
  }, [results, sessionId, selectedAsym]);

  // Previous session for direction change
  const sessionIdx = sessionList.findIndex((s) => s.session_id === sessionId);
  const prevSession = sessionIdx > 0 ? sessionList[sessionIdx - 1] : null;
  const prevData = useMemo(() => {
    if (!prevSession || !selectedAsym) return null;
    const prevResults = (results || []).filter((r) => r.session_id === prevSession.session_id && r.is_primary);
    for (const r of prevResults) {
      const asym = r.asymmetries?.[selectedAsym];
      if (asym) return asym;
    }
    return null;
  }, [results, prevSession, selectedAsym]);

  const def = defMap.get(selectedAsym) || {};
  const unit = "%";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
          {sessionList.map((s) => <option key={s.session_id} value={s.session_id}>{fmtDate(s.assessment_date)} — {s.name || "Sesión"}</option>)}
        </select>
        {asymKeys.length > 0 && (
          <select value={selectedAsym} onChange={(e) => setSelectedAsym(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white max-w-[240px]">
            {asymKeys.map((k) => <option key={k} value={k}>{defMap.get(k)?.metric_label || k}</option>)}
          </select>
        )}
        <span className="text-xs text-zinc-500">Unidad: {unit}</span>
      </div>

      {chartData.length ? (
        <>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis type="number" stroke="#71717a" fontSize={11} tick={{ fill: "#a1a1aa" }} tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}%`} />
                <YAxis type="category" dataKey="name" stroke="#71717a" fontSize={11} tick={{ fill: "#a1a1aa" }} width={60} />
                <Tooltip content={<CustomAsymTooltip />} />
                <ReferenceLine x={0} stroke="#52525b" strokeWidth={1.5} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={40}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.direction === "L" ? "#3b82f6" : d.direction === "R" ? "#a855f7" : "#71717a"} />
                  ))}
                  <LabelList dataKey="value" position="right" formatter={(v) => `${v > 0 ? "+" : ""}${fmtVal(v)}%`} style={{ fill: "#e4e4e7", fontSize: 11, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-2 text-xs text-zinc-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-500" /> L (izquierdo)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-purple-500" /> R (derecho)</span>
            </div>
          </div>

          {/* Direction change */}
          {prevData && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center text-xs">
              <span className="text-zinc-500">Dirección sesión anterior: </span>
              <span className="font-semibold text-white">{prevData.direction || "—"}</span>
              <span className="text-zinc-500"> ({fmtVal(prevData.magnitude)}%)</span>
              {prevData.direction && chartData[0]?.direction && prevData.direction !== chartData[0].direction && (
                <span className="ml-2 text-yellow-400 font-medium">⚠ Cambió de dirección</span>
              )}
            </div>
          )}
          <p className="text-xs text-zinc-600 text-center">La dirección L/R indica el lado de mayor magnitud. No implica lado débil o lesionado.</p>
        </>
      ) : (
        <EmptyState message="Sin asimetrías registradas en esta sesión" />
      )}
    </div>
  );
}

function CustomAsymTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-xs shadow-xl">
      <p className="text-white font-semibold">{d.name}</p>
      <p className="text-zinc-300">Magnitud: <span className="text-white font-semibold">{fmtVal(d.magnitude)}%</span></p>
      <p className="text-zinc-300">Dirección: <span className="text-white font-semibold">{d.direction || "—"}</span></p>
    </div>
  );
}

function EmptyState({ message }) {
  return <div className="py-10 text-center"><p className="text-zinc-500 text-sm">{message}</p></div>;
}