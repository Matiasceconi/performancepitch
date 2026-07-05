import React, { useMemo, useRef } from "react";
import moment from "moment";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import GpsMicrocycleDailyTable from "./GpsMicrocycleDailyTable";
import GpsMicrocycleHighlights from "./GpsMicrocycleHighlights";
import GpsMicrocycleComparison from "./GpsMicrocycleComparison";
import GpsMicrocycleAiAnalysis from "./GpsMicrocycleAiAnalysis";
import GpsMicrocyclePdfButton from "./GpsMicrocyclePdfButton";
import {
  MICRO_METRICS,
  buildDailySummaries,
  rowsForCycle,
  buildHighlights,
  buildComparison,
} from "./gpsMicrocycleReportUtils";

function MetricChart({ metric, data }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <div className="mb-3">
        <h3 className="text-white font-bold text-sm">{metric.label}</h3>
        <p className="text-zinc-500 text-xs">Grupo principal por día</p>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 18, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="label" stroke="#71717a" fontSize={10} />
            <YAxis stroke="#71717a" fontSize={10} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12, color: "#fff" }} />
            <Bar dataKey={metric.key} name={metric.label} fill={metric.color} radius={[6, 6, 0, 0]}>
              <LabelList dataKey={metric.key} position="top" fill="#e4e4e7" fontSize={10} fontWeight={700} formatter={(v) => v == null ? "—" : Math.round(v)} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function GpsWeeklyEvolutionPanel({ sessions, gpsBySession, cycleDays, playerMap, squadName, season }) {
  const reportCaptureRef = useRef(null);
  const dailySummaries = useMemo(() => buildDailySummaries({ sessions, gpsBySession, cycleDays, playerMap }), [sessions, gpsBySession, cycleDays, playerMap]);
  const cycleRows = useMemo(() => rowsForCycle({ sessions, gpsBySession, cycleDays, playerMap }), [sessions, gpsBySession, cycleDays, playerMap]);
  const highlights = useMemo(() => buildHighlights(cycleRows, playerMap), [cycleRows, playerMap]);
  const comparison = useMemo(() => buildComparison({ sessions, gpsBySession, cycleDays, playerMap }), [sessions, gpsBySession, cycleDays, playerMap]);
  const weekStart = dailySummaries[0]?.date;
  const weekEnd = dailySummaries[dailySummaries.length - 1]?.date;

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Informe semanal de carga</p>
          <h2 className="text-2xl font-bold text-white mt-1">Resumen del microciclo</h2>
          <p className="text-zinc-400 text-sm mt-1">{squadName || "Plantel activo"} · {weekStart ? moment(weekStart).format("DD/MM") : ""} - {weekEnd ? moment(weekEnd).format("DD/MM/YYYY") : ""}</p>
        </div>
        <div className="flex gap-2 flex-wrap"><GpsMicrocycleAiAnalysis dailySummaries={dailySummaries} highlights={highlights} comparison={comparison} /><GpsMicrocyclePdfButton squadName={squadName} season={season} dailySummaries={dailySummaries} highlights={highlights} comparison={comparison} captureRef={reportCaptureRef} /></div>
      </div>

      <div ref={reportCaptureRef} className="space-y-5">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {MICRO_METRICS.map((metric) => <MetricChart key={metric.key} metric={metric} data={dailySummaries} />)}
        </div>

        <GpsMicrocycleDailyTable dailySummaries={dailySummaries} />
        <GpsMicrocycleHighlights highlights={highlights} />
        <GpsMicrocycleComparison comparison={comparison} />
      </div>
    </div>
  );
}