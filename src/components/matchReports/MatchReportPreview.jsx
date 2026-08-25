import React from "react";
import { BarChart3, MessageSquareText } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PlayerPhoto from "@/components/player/PlayerPhoto";
import MatchBlockCard from "@/components/matchReports/MatchBlockCard";
import { CLUB_BRAND } from "@/lib/clubBrand";
import { getShieldForName } from "@/lib/clubShields";
import { fmtMetric, normalizeMatchReportConfig, pctVs, REPORT_METRICS } from "@/lib/matchReportData";

const KPI_KEYS = ["total_distance", "m_min", "distance_19_8", "distance_25", "sprints", "smax"];
const dateLabel = (value) => value ? new Date(value + "T00:00:00").toLocaleDateString("es-AR") : "—";
const tone = (value) => value == null ? "text-zinc-500" : Math.abs(value) <= 5 ? "text-sky-300" : value > 0 ? "text-emerald-300" : "text-amber-300";

export default function MatchReportPreview({ reportData, staffComment = "", onCommentChange, readOnly = false, reportConfig }) {
  const config = normalizeMatchReportConfig(reportConfig || reportData?.reportConfig);
  const { player, selected, competitionProfile } = reportData;
  const latest = selected[selected.length - 1];
  const profileMatches = Number(competitionProfile?.matches_used || 0);
  const hasProfile = profileMatches > 0;
  const metric = REPORT_METRICS.find((item) => item.key === config.evolutionMetric) || REPORT_METRICS[1];
  const profileValue = (key) => {
    const definition = REPORT_METRICS.find((item) => item.key === key);
    return hasProfile ? competitionProfile?.[definition?.profile] : null;
  };
  const evolution = selected.map((item) => ({
    label: item.match?.rival || "Rival",
    date: dateLabel(item.match?.date),
    minutes: Number(item.minutesPlayed ?? item.gpsRow?.duration_minutes ?? 0),
    metricValue: Number(item.gpsRow?.[metric.key] || 0),
  }));
  const latestShield = latest?.match?.rival_logo_url || getShieldForName(latest?.match?.rival);

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-700 to-emerald-950 p-5 text-white">
        <img src={CLUB_BRAND.logoUrl} alt="" className="absolute right-4 top-4 h-20 w-20 object-contain opacity-25" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <PlayerPhoto player={player} className="h-24 w-24 rounded-2xl border-2 border-white/30 object-cover" fallbackClassName="h-24 w-24 rounded-2xl border-2 border-white/30 bg-white/10 flex items-center justify-center" textClassName="text-3xl font-black text-white" />
          <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-100">Informe individual de rendimiento</p><h2 className="mt-1 text-3xl font-black leading-tight">{player?.full_name || "Jugador"}</h2><p className="mt-1 text-sm text-emerald-100">{[player?.position, player?.squad_name, player?.division].filter(Boolean).join(" · ")}</p><div className="mt-3 flex flex-wrap gap-2 text-xs text-emerald-50"><span className="rounded-full bg-white/10 px-2.5 py-1">{selected.length} {selected.length === 1 ? "partido" : "partidos"}</span>{latest && <span className="rounded-full bg-white/10 px-2.5 py-1">Último: vs {latest.match?.rival || "Rival"} · {dateLabel(latest.match?.date)}</span>}{hasProfile && <span className="rounded-full bg-white/10 px-2.5 py-1">Perfil competitivo · {profileMatches} partidos &gt;80'</span>}</div></div>
        </div>
      </div>

      {latest && config.showKpis && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div className="flex items-center gap-3">{latestShield && <img src={latestShield} alt="" className="h-14 w-14 object-contain" />}<div><p className="text-[11px] font-black uppercase tracking-[0.15em] text-emerald-400">Partido principal</p><h3 className="text-2xl font-black text-white">vs {latest.match?.rival || "Rival"}</h3><p className="text-xs text-zinc-500">{dateLabel(latest.match?.date)} · {latest.match?.competition || ""}</p></div></div><div className="text-left sm:text-right"><p className="text-xs text-zinc-500">Exposición</p><p className="text-2xl font-black text-emerald-300">{latest.minutesPlayed ?? latest.gpsRow?.duration_minutes ?? "—"} min</p></div></div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">{KPI_KEYS.map((key) => { const def = REPORT_METRICS.find((item) => item.key === key); const delta = pctVs(latest.gpsRow?.[key], profileValue(key)); return <div key={key} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"><p className="text-[10px] text-zinc-500">{def.label}</p><p className="mt-1 text-lg font-black text-white">{fmtMetric(latest.gpsRow?.[key], def.decimals)} <span className="text-[9px] font-medium text-zinc-600">{def.unit}</span></p>{delta != null && <p className={`mt-1 text-[10px] font-bold ${tone(delta)}`}>{delta > 0 ? "+" : ""}{delta}% vs perfil</p>}</div>; })}</div>
        </div>
      )}

      {config.showMinutesEvolution && selected.length > 1 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex items-center gap-2"><BarChart3 size={16} className="text-emerald-400" /><div><h3 className="text-sm font-bold text-white">Evolución de minutos y {metric.label}</h3><p className="text-[11px] text-zinc-500">Barras: minutos jugados · línea: {metric.label} ({metric.unit})</p></div></div>
          <ResponsiveContainer width="100%" height={280}><ComposedChart data={evolution} margin={{ left: 0, right: 10, top: 12, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} /><XAxis dataKey="date" tick={{ fill: "#a1a1aa", fontSize: 10 }} /><YAxis yAxisId="minutes" domain={[0, "auto"]} tick={{ fill: "#a1a1aa", fontSize: 10 }} label={{ value: "Minutos", angle: -90, position: "insideLeft", fill: "#71717a", fontSize: 10 }} /><YAxis yAxisId="metric" orientation="right" tick={{ fill: "#a1a1aa", fontSize: 10 }} label={{ value: metric.unit, angle: 90, position: "insideRight", fill: "#71717a", fontSize: 10 }} /><Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 10 }} formatter={(value, name) => [fmtMetric(value, name === "Minutos" ? 0 : metric.decimals), name]} /><Legend wrapperStyle={{ fontSize: 11 }} />{hasProfile && <ReferenceLine yAxisId="metric" y={profileValue(metric.key)} stroke="#38bdf8" strokeDasharray="5 5" label={{ value: "Perfil", fill: "#7dd3fc", fontSize: 9 }} />}<Bar yAxisId="minutes" dataKey="minutes" name="Minutos" fill="#3f3f46" radius={[5, 5, 0, 0]} /><Line yAxisId="metric" type="monotone" dataKey="metricValue" name={metric.label} stroke="#22c55e" strokeWidth={3} dot={{ r: 4, fill: "#22c55e" }} /></ComposedChart></ResponsiveContainer>
        </div>
      )}

      {config.showProfileComparison && hasProfile && latest && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><h3 className="mb-1 text-sm font-bold text-white">Último partido vs perfil competitivo</h3><p className="mb-3 text-[11px] text-zinc-500">Perfil calculado con {profileMatches} partidos de más de 80 minutos.</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{KPI_KEYS.map((key) => { const def = REPORT_METRICS.find((item) => item.key === key); const delta = pctVs(latest.gpsRow?.[key], profileValue(key)); return <div key={key} className="flex items-center justify-between rounded-lg bg-zinc-950/60 p-2.5"><span className="text-xs text-zinc-400">{def.label}</span><span className={`text-xs font-black ${tone(delta)}`}>{delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta}%`}</span></div>; })}</div></div>
      )}

      {config.showMatchDetails && <div className="space-y-4"><h3 className="text-sm font-bold text-white">Detalle de partidos seleccionados</h3>{selected.map((matchData) => <MatchBlockCard key={matchData.match.id} matchData={matchData} showZoneChart={config.showZoneCharts} />)}</div>}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="mb-2 flex items-center gap-2"><MessageSquareText size={16} className="text-emerald-400" /><h3 className="text-sm font-bold text-white">Conclusión del área de Rendimiento</h3></div>{readOnly ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{staffComment || "Sin comentario adicional."}</p> : <><textarea value={staffComment} onChange={(event) => onCommentChange?.(event.target.value)} placeholder="Contextualizá la carga, el rendimiento y las recomendaciones para el jugador." rows={4} className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-white outline-none focus:border-emerald-600" /><p className="mt-1.5 text-[11px] text-zinc-500">Este texto se congelará al guardar y aparecerá en el portal, PDF y Excel.</p></>}</div>
    </div>
  );
}
