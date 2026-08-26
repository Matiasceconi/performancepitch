import React from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { REPORT_METRICS, fmtMetric, buildZoneDistributionData } from "@/lib/matchReportData";
import { getShieldForName } from "@/lib/clubShields";

export default function MatchBlockCard({ matchData, showZoneChart = true }) {
  const { match, gpsRow, minutesPlayed } = matchData;
  const zoneData = buildZoneDistributionData(gpsRow);
  const rivalShield = match?.rival_logo_url || getShieldForName(match?.rival);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      {/* Match header */}
      <div className="bg-zinc-950/50 px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex min-w-0 items-center gap-3">
            {rivalShield && <img src={rivalShield} alt="" className="h-10 w-10 shrink-0 object-contain" />}
            <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">vs {match?.rival || "Rival"}</p>
            <p className="text-xs text-zinc-500">
              {match?.date ? new Date(match.date + "T00:00:00").toLocaleDateString("es-AR") : "—"}
              {match?.competition ? ` · ${match.competition}` : ""}
              {match?.location ? ` · ${match.location}` : ""}
            </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs shrink-0">
            {minutesPlayed != null && <span className="text-zinc-400">{minutesPlayed}'</span>}
            <span className="font-bold text-white bg-zinc-800 px-2 py-0.5 rounded">
              {match?.our_score ?? "?"} - {match?.rival_score ?? "?"}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics table + zone chart */}
      <div className={`p-4 grid grid-cols-1 ${showZoneChart ? "lg:grid-cols-2" : ""} gap-4`}>
        {/* Metrics table */}
        <div>
          <p className="text-xs text-zinc-500 font-semibold uppercase mb-2">Métricas GPS</p>
          <div className="space-y-0.5">
            {REPORT_METRICS.map((m) => (
              <div key={m.key} className="flex items-center justify-between py-1.5 border-b border-zinc-800/40">
                <span className="text-xs text-zinc-400">{m.label}</span>
                <span className="text-sm font-bold text-white tabular-nums">
                  {fmtMetric(gpsRow[m.key], m.decimals)}
                  <span className="text-zinc-500 font-normal text-[10px] ml-1">{m.unit}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Zone chart */}
        {showZoneChart && <div>
          <p className="text-xs text-zinc-500 font-semibold uppercase mb-2">Zonas de velocidad e intensidad</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={zoneData} layout="vertical" margin={{ left: 8, right: 72, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis type="number" domain={[0, (dataMax) => Math.max(1, Math.ceil(Number(dataMax || 0) * 1.18))]} tick={{ fill: "#71717a", fontSize: 10 }} />
              <YAxis type="category" dataKey="metric" tick={{ fill: "#d4d4d8", fontSize: 10 }} width={90} />
              <Tooltip
                contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 12, color: "#fff" }}
                formatter={(value, name, props) => [`${fmtMetric(value, 0)} ${props.payload.unit}`, "Valor"]}
              />
              <Bar dataKey="value" fill="#00843D" radius={[0, 6, 6, 0]}>
                <LabelList dataKey="value" position="right" offset={8} formatter={(value, entry) => `${fmtMetric(value, 0)} ${entry?.payload?.unit || ""}`.trim()} fill="#f4f4f5" fontSize={11} fontWeight={800} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>}
      </div>
    </div>
  );
}