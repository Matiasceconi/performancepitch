import React from "react";
import { BarChart3, MessageSquareText, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PlayerPhoto from "@/components/player/PlayerPhoto";
import MatchBlockCard from "@/components/matchReports/MatchBlockCard";
import { CLUB_BRAND } from "@/lib/clubBrand";
import { buildEvolutionData, fmtMetric, pctVs, REPORT_METRICS } from "@/lib/matchReportData";

const KPI_KEYS = ["total_distance", "m_min", "distance_19_8", "distance_25", "sprints", "smax"];

function dateLabel(value) {
  return value ? new Date(value + "T00:00:00").toLocaleDateString("es-AR") : "—";
}

function tone(value) {
  if (value == null) return "text-zinc-500";
  if (Math.abs(value) <= 5) return "text-sky-300";
  return value > 0 ? "text-emerald-300" : "text-amber-300";
}

export default function MatchReportPreview({ reportData, staffComment = "", onCommentChange, readOnly = false }) {
  const { player, selected, lastFiveAvg = {} } = reportData;
  const latest = selected[selected.length - 1];
  const evolution = buildEvolutionData(reportData, "m_min");

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-700 to-emerald-950 p-5 text-white">
        <img src={CLUB_BRAND.logoUrl} alt="" className="absolute right-4 top-4 h-20 w-20 object-contain opacity-25" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <PlayerPhoto player={player} className="h-24 w-24 rounded-2xl border-2 border-white/30 object-cover" fallbackClassName="h-24 w-24 rounded-2xl border-2 border-white/30 bg-white/10 flex items-center justify-center" textClassName="text-3xl font-black text-white" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-100">Informe individual de rendimiento</p>
            <h2 className="mt-1 text-3xl font-black leading-tight">{player?.full_name || "Jugador"}</h2>
            <p className="mt-1 text-sm text-emerald-100">{[player?.position, player?.squad_name, player?.division].filter(Boolean).join(" · ")}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-emerald-50">
              <span className="rounded-full bg-white/10 px-2.5 py-1">{selected.length} {selected.length === 1 ? "partido" : "partidos"}</span>
              {latest && <span className="rounded-full bg-white/10 px-2.5 py-1">Último: vs {latest.match?.rival || "Rival"} · {dateLabel(latest.match?.date)}</span>}
            </div>
          </div>
        </div>
      </div>

      {latest && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div><p className="text-[11px] font-black uppercase tracking-[0.15em] text-emerald-400">Partido principal</p><h3 className="text-2xl font-black text-white">vs {latest.match?.rival || "Rival"}</h3><p className="text-xs text-zinc-500">{dateLabel(latest.match?.date)} · {latest.match?.competition || ""}</p></div>
            <div className="text-left sm:text-right"><p className="text-xs text-zinc-500">Exposición</p><p className="text-2xl font-black text-emerald-300">{latest.minutesPlayed ?? latest.gpsRow?.duration_minutes ?? "—"} min</p></div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
            {KPI_KEYS.map((key) => {
              const metric = REPORT_METRICS.find((item) => item.key === key);
              const delta = pctVs(latest.gpsRow?.[key], lastFiveAvg?.[key]);
              return <div key={key} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"><p className="text-[10px] text-zinc-500">{metric.label}</p><p className="mt-1 text-lg font-black text-white">{fmtMetric(latest.gpsRow?.[key], metric.decimals)} <span className="text-[9px] font-medium text-zinc-600">{metric.unit}</span></p><p className={`mt-1 text-[10px] font-bold ${tone(delta)}`}>{delta == null ? "Sin base" : `${delta > 0 ? "+" : ""}${delta}% vs base`}</p></div>;
            })}
          </div>
        </div>
      )}

      {selected.length > 1 && (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center gap-2"><TrendingUp size={16} className="text-emerald-400" /><div><h3 className="text-sm font-bold text-white">Evolución de intensidad</h3><p className="text-[11px] text-zinc-500">m/min en los partidos seleccionados</p></div></div>
            <ResponsiveContainer width="100%" height={220}><LineChart data={evolution}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} /><XAxis dataKey="shortDate" tick={{ fill: "#a1a1aa", fontSize: 10 }} /><YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} width={40} /><Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 8 }} /><ReferenceLine y={lastFiveAvg.m_min} stroke="#38bdf8" strokeDasharray="5 5" /><Line type="monotone" dataKey="m_min" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center gap-2"><BarChart3 size={16} className="text-emerald-400" /><div><h3 className="text-sm font-bold text-white">Último vs base reciente</h3><p className="text-[11px] text-zinc-500">Media de 3 partidos previos</p></div></div>
            <div className="space-y-2">{KPI_KEYS.map((key) => { const metric = REPORT_METRICS.find((item) => item.key === key); const delta = pctVs(latest?.gpsRow?.[key], lastFiveAvg?.[key]); return <div key={key} className="flex items-center justify-between border-b border-zinc-800/70 pb-2"><span className="text-xs text-zinc-400">{metric.label}</span><span className={`text-xs font-black ${tone(delta)}`}>{delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta}%`}</span></div>; })}</div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white">Detalle de partidos seleccionados</h3>
        {selected.map((matchData) => <MatchBlockCard key={matchData.match.id} matchData={matchData} />)}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-2 flex items-center gap-2"><MessageSquareText size={16} className="text-emerald-400" /><h3 className="text-sm font-bold text-white">Conclusión del área de Rendimiento</h3></div>
        {readOnly ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{staffComment || "Sin comentario adicional."}</p>
        ) : (
          <>
            <textarea value={staffComment} onChange={(event) => onCommentChange?.(event.target.value)} placeholder="Contextualizá la carga, el rendimiento y las recomendaciones para el jugador." rows={4} className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-white outline-none focus:border-emerald-600" />
            <p className="mt-1.5 text-[11px] text-zinc-500">Este texto se congelará al guardar y aparecerá en el portal y en el PDF.</p>
          </>
        )}
      </div>
    </div>
  );
}
