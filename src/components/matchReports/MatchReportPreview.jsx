import React, { useState, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import PlayerPhoto from "@/components/player/PlayerPhoto";
import { REPORT_METRICS, fmtMetric, buildKpis, buildComparisonData, buildEvolutionData, buildComparisonTable, buildInsight, buildLastMatchVsAvgData } from "@/lib/matchReportData";
import { CLUB_BRAND } from "@/lib/clubBrand";

export default function MatchReportPreview({ reportData, staffComment, onCommentChange, evolutionMetricKey, onEvolutionMetricChange }) {
  const { player, selected, isMulti } = reportData;
  const kpis = buildKpis(reportData);
  const compData = buildComparisonData(reportData);
  const table = buildComparisonTable(reportData);
  const match = selected[0]?.match;
  const evoData = buildEvolutionData(reportData, evolutionMetricKey);
  const lastVsAvgData = buildLastMatchVsAvgData(reportData);
  const lastMatchIndex = isMulti ? table.rows.length - 2 : 0;

  return (
    <div className="space-y-4">
      {/* Header del informe */}
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute right-4 top-4 opacity-30">
          <img src={CLUB_BRAND.logoUrl} alt="" className="w-16 h-16 object-contain" />
        </div>
        <div className="relative flex items-start gap-4">
          <PlayerPhoto
            player={player}
            className="w-20 h-20 rounded-xl object-cover border-2 border-white/30 shrink-0"
            fallbackClassName="w-20 h-20 rounded-xl bg-white/10 border-2 border-white/30 flex items-center justify-center"
            textClassName="text-2xl font-bold text-white"
          />
          <div className="flex-1 min-w-0">
            <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wide">Informe individual de rendimiento</p>
            <h2 className="text-2xl font-black leading-tight mt-0.5">{player?.full_name || "Jugador"}</h2>
            <p className="text-emerald-100 text-sm mt-1">{[player?.position, player?.squad_name, player?.division].filter(Boolean).join(" · ")}</p>
            {match && (
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2 text-xs text-emerald-50">
                {!isMulti ? (
                  <>
                    <span className="font-semibold">vs {match.rival}</span>
                    <span>{match.date ? new Date(match.date + "T00:00:00").toLocaleDateString("es-AR") : "—"}</span>
                    <span>{match.competition}</span>
                    <span>{match.location}</span>
                    <span className="font-bold">Resultado: {match.our_score ?? "?"} - {match.rival_score ?? "?"}</span>
                  </>
                ) : (
                  <span className="font-semibold">Últimos {selected.length} partidos</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => {
          const insight = buildInsight(kpi, reportData);
          const isPositive = insight ? (insight.includes("marca") ? true : kpi.pct > 0) : null;
          return (
            <div key={kpi.key} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
              <p className="text-[10px] text-zinc-500 uppercase font-semibold truncate">{kpi.label}</p>
              <p className="text-2xl font-black text-white mt-1">{fmtMetric(kpi.value, kpi.decimals)}</p>
              <p className="text-[10px] text-zinc-500">{kpi.unit}</p>
              {kpi.base != null && (
                <p className="text-[10px] text-zinc-500 mt-0.5">vs prom. 5: {fmtMetric(kpi.base, kpi.decimals)}</p>
              )}
              {insight && (
                <p className={`text-[10px] font-bold mt-1 ${isPositive ? "text-emerald-400" : "text-red-400"}`}>{insight}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Gráficos */}
      {!isMulti ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-white mb-3">Comparación vs promedio personal</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={compData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#71717a", fontSize: 10 }} />
              <YAxis type="category" dataKey="metric" tick={{ fill: "#d4d4d8", fontSize: 11 }} width={110} />
              <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 12, color: "#fff" }} />
              <Bar dataKey="Partido" fill="#00843D" radius={[0, 6, 6, 0]} />
              <Bar dataKey="Promedio personal" fill="#52525b" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">Evolución en partidos</h3>
            <select value={evolutionMetricKey} onChange={(e) => onEvolutionMetricChange(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white">
              {REPORT_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={evoData} margin={{ left: 0, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="shortDate" tick={{ fill: "#71717a", fontSize: 10 }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={44} />
              <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 12, color: "#fff" }} />
              <ReferenceLine y={reportData.personalAvg[evolutionMetricKey]} stroke="#71717a" strokeDasharray="5 5" />
              <Line
                type="monotone"
                dataKey={evolutionMetricKey}
                stroke={REPORT_METRICS.find((m) => m.key === evolutionMetricKey)?.color || "#22c55e"}
                strokeWidth={2.5}
                dot={(props) => {
                  const { cx, cy, index } = props;
                  const isLast = index === evoData.length - 1;
                  return isLast
                    ? <circle cx={cx} cy={cy} r={6} fill="#fbbf24" stroke="#fff" strokeWidth={2} />
                    : <circle cx={cx} cy={cy} r={4} fill={REPORT_METRICS.find((m) => m.key === evolutionMetricKey)?.color || "#22c55e"} strokeWidth={0} />;
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Último partido vs promedio */}
      {lastVsAvgData.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-white mb-3">Último partido vs promedio de 5</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={lastVsAvgData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#71717a", fontSize: 10 }} />
              <YAxis type="category" dataKey="metric" tick={{ fill: "#d4d4d8", fontSize: 11 }} width={110} />
              <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 12, color: "#fff" }} />
              <Legend />
              <Bar dataKey="Último partido" fill="#00843D" radius={[0, 6, 6, 0]} />
              <Bar dataKey="Promedio 5" fill="#52525b" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla comparativa */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-zinc-950/50 text-zinc-400 border-b border-zinc-800">
                <th className="text-left p-2.5 font-semibold">Partido</th>
                <th className="text-right p-2.5 font-semibold">Min</th>
                {table.cols.map((k) => {
                  const m = REPORT_METRICS.find((mm) => mm.key === k);
                  return <th key={k} className="text-right p-2.5 font-semibold whitespace-nowrap">{m.label}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => {
                const isAvg = row.label === "PROMEDIO";
                return (
                  <tr key={i} className={`border-b border-zinc-800/40 ${isAvg ? "bg-emerald-500/10" : i === lastMatchIndex ? "bg-amber-500/10 border-l-2 border-l-amber-500" : ""}`}>
                    <td className="p-2.5 text-white font-medium">
                      {isAvg ? "PROMEDIO" : `${row.label} · ${row.date ? new Date(row.date + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : ""}`}
                    </td>
                    <td className="p-2.5 text-right text-zinc-300">{row.minutes ?? "—"}</td>
                    {table.cols.map((k) => {
                      const m = REPORT_METRICS.find((mm) => mm.key === k);
                      return <td key={k} className="p-2.5 text-right text-zinc-300 tabular-nums">{fmtMetric(row[k], m.decimals)}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comentario del staff */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <label className="text-sm font-bold text-white block mb-2">Comentario del área de Rendimiento</label>
        <textarea
          value={staffComment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Ej: Buen volumen total y valores altos de alta intensidad. Mantiene una tendencia positiva respecto de los últimos encuentros."
          rows={4}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white resize-none focus:outline-none focus:border-emerald-600"
        />
        <p className="text-[11px] text-zinc-500 mt-1.5">Este comentario se incluirá en el PDF si fue completado.</p>
      </div>
    </div>
  );
}