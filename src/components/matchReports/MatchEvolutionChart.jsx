import React from "react";
import { Area, Bar, CartesianGrid, ComposedChart, LabelList, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getShieldForName } from "@/lib/clubShields";
import { fmtMetric, REPORT_METRICS } from "@/lib/matchReportData";

const STYLE_LABELS = { line: "Línea", area: "Área", bar: "Barras" };

function shortDate(value) {
  return value ? new Date(value + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "—";
}

function MatchAxisTick({ x, y, payload, rows }) {
  const row = rows.find((item) => item.axisKey === payload.value);
  if (!row) return null;
  return (
    <g transform={`translate(${x},${y})`}>
      {row.shield && <image href={row.shield} x={-12} y={7} width={24} height={24} preserveAspectRatio="xMidYMid meet" />}
      <text x={0} y={39} textAnchor="middle" fill="#d4d4d8" fontSize={10} fontWeight={700}>{row.date}</text>
      <text x={0} y={52} textAnchor="middle" fill="#71717a" fontSize={9}>{row.rival.length > 12 ? `${row.rival.slice(0, 11)}…` : row.rival}</text>
    </g>
  );
}

function EvolutionTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-3 shadow-xl">
      <div className="mb-2 flex items-center gap-2">
        {row.shield && <img src={row.shield} alt="" className="h-8 w-8 object-contain" />}
        <div><p className="text-xs font-bold text-white">vs {row.rival}</p><p className="text-[10px] text-zinc-500">{row.fullDate}</p></div>
      </div>
      <p className="text-xs text-zinc-300">{row.metricLabel}: <strong className="text-white">{fmtMetric(row.value, row.decimals)} {row.unit}</strong></p>
    </div>
  );
}

export default function MatchEvolutionChart({ selected = [], chart, competitionProfile, compact = false }) {
  const metric = chart?.metric === "minutes"
    ? { key: "minutes", label: "Minutos jugados", unit: "min", decimals: 0, color: "#a1a1aa" }
    : REPORT_METRICS.find((item) => item.key === chart?.metric) || REPORT_METRICS[1];
  const style = ["line", "area", "bar"].includes(chart?.style) ? chart.style : "line";
  const rows = selected.map((item, index) => ({
    axisKey: `${item.match?.date || index}-${index}`,
    date: shortDate(item.match?.date),
    fullDate: item.match?.date ? new Date(item.match.date + "T00:00:00").toLocaleDateString("es-AR") : "—",
    rival: item.match?.rival || "Rival",
    shield: item.match?.rival_logo_url || getShieldForName(item.match?.rival),
    value: Number(metric.key === "minutes" ? (item.minutesPlayed ?? item.gpsRow?.duration_minutes ?? 0) : (item.gpsRow?.[metric.key] || 0)),
    metricLabel: metric.label,
    unit: metric.unit,
    decimals: metric.decimals,
  }));
  const profileValue = metric.profile ? Number(competitionProfile?.[metric.profile] || 0) : 0;
  const color = metric.color || "#22c55e";
  const common = { dataKey: "value", name: metric.label, stroke: color, fill: color };
  const height = compact ? 310 : 330;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div><h4 className="text-xs font-bold text-white">{metric.label}</h4><p className="text-[10px] text-zinc-500">{STYLE_LABELS[style]} · {metric.unit}{profileValue > 0 ? " · perfil competitivo en celeste" : ""}</p></div>
        <span className="rounded-md bg-zinc-800 px-2 py-1 text-[9px] font-bold uppercase text-zinc-400">{STYLE_LABELS[style]}</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows} margin={{ left: 0, right: 18, top: 34, bottom: 10 }}>
          <defs><linearGradient id={`evolution-${metric.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color} stopOpacity={0.45} /><stop offset="95%" stopColor={color} stopOpacity={0.03} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="axisKey" height={72} interval={0} tick={<MatchAxisTick rows={rows} />} tickLine={false} axisLine={{ stroke: "#52525b" }} />
          <YAxis domain={[0, (dataMax) => Math.max(1, Math.ceil(Number(dataMax || 0) * 1.16))]} tick={{ fill: "#a1a1aa", fontSize: 10 }} width={52} unit={metric.unit === "m" ? "" : ""} />
          <Tooltip content={<EvolutionTooltip />} />
          {profileValue > 0 && <ReferenceLine y={profileValue} stroke="#38bdf8" strokeDasharray="5 5" label={{ value: "Perfil competitivo", fill: "#7dd3fc", fontSize: 9 }} />}
          {style === "bar" && <Bar {...common} radius={[5, 5, 0, 0]} fillOpacity={0.82}>
            <LabelList dataKey="value" position="top" offset={8} formatter={(value) => fmtMetric(value, metric.decimals)} fill="#f4f4f5" fontSize={12} fontWeight={800} />
          </Bar>}
          {style === "area" && <Area {...common} type="monotone" strokeWidth={3} fill={`url(#evolution-${metric.key})`}>
            <LabelList dataKey="value" position="top" offset={9} formatter={(value) => fmtMetric(value, metric.decimals)} fill="#f4f4f5" fontSize={12} fontWeight={800} />
          </Area>}
          {style === "line" && <Line {...common} type="monotone" strokeWidth={3} dot={{ r: 4, fill: color }} activeDot={{ r: 6 }}>
            <LabelList dataKey="value" position="top" offset={9} formatter={(value) => fmtMetric(value, metric.decimals)} fill="#f4f4f5" fontSize={12} fontWeight={800} />
          </Line>}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
