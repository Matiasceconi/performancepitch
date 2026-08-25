import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, CalendarDays, Download, FileSpreadsheet, FileText, Gauge, Loader2, Save, Send, Sparkles, TrendingUp, X } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { base44 } from "@/api/base44Client";
import PlayerPhoto from "@/components/player/PlayerPhoto";
import MatchReportPreview from "@/components/matchReports/MatchReportPreview";
import MatchReportConfigPanel from "@/components/matchReports/MatchReportConfigPanel";
import {
  DEFAULT_MATCH_REPORT_CONFIG,
  REPORT_METRICS,
  buildAnalysisFromOptions,
  buildCompetitionProfileFromOptions,
  buildEvolutionData,
  buildMatchOptionsFromData,
  buildReportSnapshot,
  fmtMetric,
  pctVs,
} from "@/lib/matchReportData";
import { exportMatchReportPdf } from "@/lib/reports/matchReportPdf";
import { exportMatchReportExcel } from "@/lib/reports/matchReportExcel";
import { getShieldForName } from "@/lib/clubShields";

const RANGE_OPTIONS = [
  ["last1", "Último"],
  ["last5", "Últimos 5"],
  ["last10", "Últimos 10"],
  ["season", "Temporada"],
];

const GROUPS = [
  { title: "Volumen", icon: Activity, keys: ["total_distance", "player_load"] },
  { title: "Intensidad", icon: Gauge, keys: ["m_min", "pl_min"] },
  { title: "Alta velocidad", icon: TrendingUp, keys: ["distance_19_8", "distance_25", "sprints", "smax"] },
  { title: "Neuromuscular", icon: BarChart3, keys: ["acc_3", "dec_3"] },
];

const PL_MIN = { key: "pl_min", label: "PL/min", unit: "au/min", decimals: 2 };

function metricDef(key) {
  return key === "pl_min" ? PL_MIN : REPORT_METRICS.find((metric) => metric.key === key);
}

function deltaTone(pct) {
  if (pct == null) return "text-zinc-500";
  if (Math.abs(pct) <= 5) return "text-sky-300";
  return pct > 0 ? "text-emerald-300" : "text-amber-300";
}

function formatDate(value) {
  return value ? new Date(value + "T00:00:00").toLocaleDateString("es-AR") : "—";
}

function calcAge(value) {
  if (!value) return null;
  const today = new Date();
  const birth = new Date(value);
  let age = today.getFullYear() - birth.getFullYear();
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age -= 1;
  return age;
}

export default function GpsPlayerMatchAnalysis({
  view = "summary",
  player,
  matchReports,
  matchGpsByMatch,
  squadName,
  squadId,
  seasonId,
}) {
  const [matchOptions, setMatchOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rangeMode, setRangeMode] = useState("last5");
  const [selectedMatchIds, setSelectedMatchIds] = useState([]);
  const [evolutionMetric, setEvolutionMetric] = useState("m_min");
  const [showPreview, setShowPreview] = useState(false);
  const [staffComment, setStaffComment] = useState("");
  const [reportConfig, setReportConfig] = useState(DEFAULT_MATCH_REPORT_CONFIG);
  const [savedReportId, setSavedReportId] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!player?.id) return;
    setLoading(true);
    setMessage("");
    base44.entities.MatchPlayerMinutes.filter({ player_id: player.id }, "-match_date", 500)
      .then((minutesRows) => {
        const options = buildMatchOptionsFromData({ matchReports, matchGpsByMatch, minutesRows, playerId: player.id });
        setMatchOptions(options);
        setSelectedMatchIds(options.slice(0, 5).map((option) => option.match.id));
        setRangeMode("last5");
        setSavedReportId(null);
      })
      .catch(() => setMatchOptions([]))
      .finally(() => setLoading(false));
  }, [player?.id, matchReports, matchGpsByMatch]);

  const applyRange = useCallback((mode) => {
    setRangeMode(mode);
    const limit = mode === "last1" ? 1 : mode === "last5" ? 5 : mode === "last10" ? 10 : matchOptions.length;
    setSelectedMatchIds(matchOptions.slice(0, limit).map((option) => option.match.id));
  }, [matchOptions]);

  const toggleMatch = (id) => {
    setRangeMode("custom");
    setSelectedMatchIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const competitiveProfile = useMemo(() => buildCompetitionProfileFromOptions(matchOptions), [matchOptions]);
  const reportData = useMemo(() => selectedMatchIds.length
    ? buildAnalysisFromOptions({ player, matchOptions, selectedMatchIds, competitionProfile: competitiveProfile })
    : null,
  [player, matchOptions, selectedMatchIds, competitiveProfile]);

  const latest = reportData?.selected?.[reportData.selected.length - 1] || null;
  const profile = reportData?.competitionProfile || null;
  const profileMatches = Number(profile?.matches_used || 0);
  const hasProfile = profileMatches > 0;
  const profileValue = (key) => {
    const definition = metricDef(key);
    return hasProfile && definition?.profile ? profile[definition.profile] : null;
  };
  const age = calcAge(player?.birth_date);

  function title() {
    if (!reportData) return "Informe individual";
    if (reportData.isMulti) return `Informe Individual · ${player.full_name} · ${reportData.selected.length} partidos`;
    return `Informe Individual · ${player.full_name} · vs ${latest?.match?.rival || "Rival"} · ${latest?.match?.date || ""}`;
  }

  function payload() {
    const snapshot = buildReportSnapshot(reportData, reportConfig);
    return {
      title: title(),
      player_id: player.id,
      player_name: player.full_name,
      squad_id: squadId,
      squad_name: squadName,
      season_id: seasonId || "",
      staff_comment: staffComment,
      report_snapshot: snapshot,
      metrics_snapshot: {
        latest_match: latest?.match || null,
        minutes: latest?.minutesPlayed ?? null,
        values: Object.fromEntries(REPORT_METRICS.map((metric) => [metric.key, latest?.gpsRow?.[metric.key] ?? null])),
      },
    };
  }

  async function saveDraft() {
    setBusy("save");
    setMessage("");
    try {
      const response = await base44.functions.invoke("managePlayerMatchReport", {
        operation: "save",
        id: savedReportId,
        payload: payload(),
      });
      const result = response.data || response;
      if (result.error) throw new Error(result.error);
      setSavedReportId(result.report?.id);
      setMessage("Borrador guardado con sus datos congelados.");
    } catch (error) {
      setMessage(error?.response?.data?.error || error.message || "No se pudo guardar el informe.");
    } finally {
      setBusy("");
    }
  }

  async function publish() {
    setBusy("publish");
    setMessage("");
    try {
      let reportId = savedReportId;
      if (!reportId) {
        const response = await base44.functions.invoke("managePlayerMatchReport", { operation: "save", payload: payload() });
        const result = response.data || response;
        if (result.error) throw new Error(result.error);
        reportId = result.report?.id;
        setSavedReportId(reportId);
      }
      const response = await base44.functions.invoke("managePlayerMatchReport", { operation: "publish", id: reportId });
      const result = response.data || response;
      if (result.error) throw new Error(result.error);
      setMessage("Informe publicado. El jugador ya puede verlo en su portal.");
    } catch (error) {
      setMessage(error?.response?.data?.error || error.message || "No se pudo publicar el informe.");
    } finally {
      setBusy("");
    }
  }

  async function downloadPdf() {
    setBusy("pdf");
    try {
      await exportMatchReportPdf({ reportData, reportMeta: { title: title(), squadName }, staffComment, reportConfig });
    } finally {
      setBusy("");
    }
  }

  function downloadExcel() {
    setBusy("excel");
    try {
      exportMatchReportExcel({ reportData, reportMeta: { title: title(), squadName }, staffComment, reportConfig });
    } finally {
      setBusy("");
    }
  }

  if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-emerald-400" /></div>;
  if (!matchOptions.length) return <div className="py-16 text-center text-sm text-zinc-500">No hay partidos con GPS cargado para este jugador.</div>;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 lg:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <PlayerPhoto player={player} className="h-20 w-20 rounded-2xl border border-zinc-700 object-cover" fallbackClassName="h-20 w-20 rounded-2xl border border-zinc-700 bg-zinc-800 flex items-center justify-center" textClassName="text-2xl font-black text-zinc-500" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-400">Carga externa · análisis individual</p>
            <h2 className="truncate text-2xl font-black text-white">{player.full_name}</h2>
            <p className="mt-1 text-sm text-zinc-400">{[player.position, squadName, player.jersey_number && `#${player.jersey_number}`, age != null && `${age} años`].filter(Boolean).join(" · ")}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-500">
              <span>{matchOptions.length} partidos con GPS</span><span>·</span>
              <span>{selectedMatchIds.length} seleccionados</span>
              {hasProfile && <><span>·</span><span>Perfil competitivo: {profileMatches} {profileMatches === 1 ? "partido" : "partidos"} de más de 80'</span></>}
            </div>
          </div>
          <button onClick={() => { setShowPreview(true); setMessage(""); }} disabled={!reportData} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-40">
            <FileText size={17} /> Generar informe
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Muestra</span>
        {RANGE_OPTIONS.map(([key, label]) => (
          <button key={key} onClick={() => applyRange(key)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${rangeMode === key ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>{label}</button>
        ))}
        <span className="text-xs text-zinc-500">{selectedMatchIds.length} partidos</span>
      </div>

      {latest && view === "summary" && (
        <>
          <div className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/80 via-zinc-900 to-zinc-900">
            <div className="grid gap-5 p-5 lg:grid-cols-[1.1fr_2fr]">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-400">Último partido de la selección</p>
                <div className="mt-2 flex items-center gap-3">{(latest.match.rival_logo_url || getShieldForName(latest.match.rival)) && <img src={latest.match.rival_logo_url || getShieldForName(latest.match.rival)} alt="" className="h-14 w-14 object-contain" />}<h3 className="text-3xl font-black text-white">vs {latest.match.rival || "Rival"}</h3></div>
                <p className="mt-1 text-sm text-zinc-400">{formatDate(latest.match.date)} · {latest.match.competition || "Competencia"}</p>
                <div className="mt-5 flex items-end gap-6">
                  <div><p className="text-xs text-zinc-500">Resultado</p><p className="text-2xl font-black text-white">{latest.match.our_score ?? "—"} - {latest.match.rival_score ?? "—"}</p></div>
                  <div><p className="text-xs text-zinc-500">Minutos</p><p className="text-2xl font-black text-emerald-300">{latest.minutesPlayed ?? latest.gpsRow.duration_minutes ?? "—"}'</p></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {["total_distance", "m_min", "distance_19_8", "distance_25", "sprints", "smax"].map((key) => {
                  const def = metricDef(key);
                  const pct = pctVs(latest.gpsRow[key], profileValue(key));
                  return <div key={key} className="rounded-xl border border-white/5 bg-black/20 p-3"><p className="text-[11px] text-zinc-400">{def.label}</p><p className="mt-1 text-xl font-black text-white">{fmtMetric(latest.gpsRow[key], def.decimals)} <span className="text-[10px] font-medium text-zinc-500">{def.unit}</span></p>{pct != null && <p className={`mt-1 text-[11px] font-bold ${deltaTone(pct)}`}>{pct > 0 ? "+" : ""}{pct}% vs perfil competitivo</p>}</div>;
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {GROUPS.map((group) => {
              const Icon = group.icon;
              return <div key={group.title} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="mb-3 flex items-center gap-2"><Icon size={15} className="text-emerald-400" /><h3 className="text-sm font-bold text-white">{group.title}</h3></div><div className="space-y-2">{group.keys.map((key) => { const def = metricDef(key); const pct = pctVs(latest.gpsRow[key], profileValue(key)); return <div key={key} className="flex items-end justify-between gap-2 border-t border-zinc-800/70 pt-2"><div><p className="text-[11px] text-zinc-500">{def.label}</p><p className="text-base font-black text-zinc-100">{fmtMetric(latest.gpsRow[key], def.decimals)} <span className="text-[10px] font-medium text-zinc-600">{def.unit}</span></p></div>{pct != null && <span className={`text-[10px] font-bold ${deltaTone(pct)}`}>{pct > 0 ? "+" : ""}{pct}%</span>}</div>; })}</div></div>;
            })}
          </div>
        </>
      )}

      {view === "matches" && (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-800 p-4"><div><h3 className="font-bold text-white">Partidos disponibles</h3><p className="text-xs text-zinc-500">Seleccioná uno o varios para analizar y generar el informe.</p></div><CalendarDays size={18} className="text-emerald-400" /></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-xs"><thead className="bg-zinc-950/60 text-zinc-500"><tr><th className="p-3"></th><th className="p-3 text-left">Partido</th><th className="p-3 text-right">Min</th>{REPORT_METRICS.map((metric) => <th key={metric.key} className="p-3 text-right">{metric.label}</th>)}</tr></thead><tbody>{matchOptions.map((option, index) => { const checked = selectedMatchIds.includes(option.match.id); return <tr key={option.match.id} onClick={() => toggleMatch(option.match.id)} className={`cursor-pointer border-t border-zinc-800/70 ${checked ? "bg-emerald-500/10" : "hover:bg-zinc-800/40"}`}><td className="p-3 text-center"><input type="checkbox" checked={checked} onChange={() => toggleMatch(option.match.id)} onClick={(event) => event.stopPropagation()} className="h-4 w-4 accent-emerald-500" /></td><td className="p-3"><div className="flex items-center gap-2">{(option.match.rival_logo_url || getShieldForName(option.match.rival)) && <img src={option.match.rival_logo_url || getShieldForName(option.match.rival)} alt="" className="h-8 w-8 shrink-0 object-contain" />}<div><p className="font-bold text-white">vs {option.match.rival || "Rival"} {index === 0 && <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-300">ÚLTIMO</span>}</p><p className="text-[10px] text-zinc-500">{formatDate(option.match.date)} · {option.match.competition || ""}</p></div></div></td><td className="p-3 text-right font-bold text-zinc-200">{option.minutesPlayed ?? "—"}</td>{REPORT_METRICS.map((metric) => <td key={metric.key} className="p-3 text-right tabular-nums text-zinc-300">{fmtMetric(option.gpsRow[metric.key], metric.decimals)}</td>)}</tr>; })}</tbody></table></div>
        </div>
      )}

      {view === "evolution" && reportData && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-4 flex items-center gap-2"><TrendingUp size={17} className="text-emerald-400" /><div><h3 className="font-bold text-white">Evolución reciente</h3><p className="text-xs text-zinc-500">Tendencia de los partidos seleccionados{hasProfile ? " y referencia del perfil competitivo." : "."}</p></div></div>
          <div className="mb-5 flex flex-wrap gap-1.5">{REPORT_METRICS.map((metric) => <button key={metric.key} onClick={() => setEvolutionMetric(metric.key)} className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${evolutionMetric === metric.key ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-300"}`}>{metric.label}</button>)}</div>
          <ResponsiveContainer width="100%" height={340}><LineChart data={buildEvolutionData(reportData, evolutionMetric)} margin={{ left: 0, right: 18, top: 10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} /><XAxis dataKey="shortDate" tick={{ fill: "#a1a1aa", fontSize: 11 }} /><YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} width={55} /><Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 10 }} />{hasProfile && <ReferenceLine y={profileValue(evolutionMetric)} stroke="#38bdf8" strokeDasharray="5 5" label={{ value: "Perfil competitivo", fill: "#7dd3fc", fontSize: 10 }} />}<Line type="monotone" dataKey={evolutionMetric} stroke="#22c55e" strokeWidth={3} dot={{ r: 4, fill: "#22c55e" }} /></LineChart></ResponsiveContainer>
        </div>
      )}

      {view === "comparison" && latest && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-4 flex items-center gap-2"><Sparkles size={17} className="text-emerald-400" /><div><h3 className="font-bold text-white">Último partido vs perfil competitivo</h3><p className="text-xs text-zinc-500">{hasProfile ? `Perfil calculado con ${profileMatches} ${profileMatches === 1 ? "partido" : "partidos"} de más de 80 minutos.` : "El jugador todavía no tiene partidos válidos para generar su perfil."}</p></div></div>
          {hasProfile ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-xs"><thead><tr className="border-b border-zinc-800 text-zinc-500"><th className="py-3 text-left">Métrica</th><th className="py-3 text-right">Último partido</th><th className="py-3 text-right">Perfil competitivo</th><th className="py-3 text-right">Diferencia</th></tr></thead><tbody>{REPORT_METRICS.map((metric) => { const reference = profileValue(metric.key); const difference = pctVs(latest.gpsRow[metric.key], reference); return <tr key={metric.key} className="border-b border-zinc-800/70"><td className="py-3 font-semibold text-zinc-200">{metric.label} <span className="text-[10px] font-normal text-zinc-600">{metric.unit}</span></td><td className="py-3 text-right font-black text-white">{fmtMetric(latest.gpsRow[metric.key], metric.decimals)}</td><td className="py-3 text-right text-sky-300">{fmtMetric(reference, metric.decimals)}</td><td className={`py-3 text-right font-bold ${deltaTone(difference)}`}>{difference == null ? "—" : `${difference > 0 ? "+" : ""}${difference}%`}</td></tr>; })}</tbody></table></div> : <div className="py-12 text-center"><p className="text-sm font-semibold text-zinc-400">Todavía no hay perfil competitivo</p><p className="mt-1 text-xs text-zinc-600">Se generará con el primer partido de más de 80 minutos que tenga datos GPS.</p></div>}
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-zinc-400">Contexto del último partido: <strong className="text-white">{latest.minutesPlayed ?? latest.gpsRow.duration_minutes ?? "—"} minutos</strong>. El perfil competitivo solo utiliza partidos con más de 80 minutos jugados.</div>
        </div>
      )}

      {showPreview && reportData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950">
            <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-950/95 p-4 backdrop-blur"><div><h2 className="font-bold text-white">Informe profesional individual</h2><p className="text-xs text-zinc-500">La vista, el PDF y el portal comparten los mismos datos.</p></div><div className="flex flex-wrap items-center gap-2"><button onClick={saveDraft} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200">{busy === "save" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar</button><button onClick={downloadPdf} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200">{busy === "pdf" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} PDF</button><button onClick={downloadExcel} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200">{busy === "excel" ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} Excel</button><button onClick={publish} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white">{busy === "publish" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Publicar</button><button onClick={() => setShowPreview(false)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800"><X size={18} /></button></div></div>
            {message && <div className={`mx-4 mt-4 rounded-xl border p-3 text-xs ${message.includes("No se") ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>{message}</div>}
            <div className="space-y-4 p-4"><MatchReportConfigPanel value={reportConfig} onChange={setReportConfig} /><MatchReportPreview reportData={reportData} staffComment={staffComment} onCommentChange={setStaffComment} reportConfig={reportConfig} /></div>
          </div>
        </div>
      )}
    </div>
  );
}
