import React, { useEffect, useMemo, useState } from "react";
import moment from "moment";
import "moment/locale/es";
import { Activity, AlertTriangle, CheckCircle, ChevronRight, FileDown, FileSpreadsheet, Gauge, Timer, UserCheck, Users, Zap } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { base44 } from "@/api/base44Client";
import PlayerPhoto from "@/components/player/PlayerPhoto";
import { useToast } from "@/components/ui/use-toast";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { buildMatchGpsReportModel, describeExposureSample, formatMatchGpsValue, MATCH_GPS_METRICS, validNumber } from "./matchGpsReportUtils";
import { exportMatchGpsPdf } from "./matchGpsPdf";

moment.locale("es");

function UnresolvedNamesPanel({ unresolvedNames, playerOptions, onResolved, matchId, matchDate, csvUrl, csvLabel }) {
  const { toast } = useToast();
  const [selections, setSelections] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState({});

  async function saveMapping(csvName) {
    const playerId = selections[csvName];
    if (!playerId) return;
    setSaving(true);
    try {
      await base44.functions.invoke("resolveMatchGpsCSV", {
        mode: "save_mapping",
        csv_name: csvName,
        player_id: playerId,
        match_id: matchId,
        match_date: matchDate,
        csv_url: csvUrl,
        csv_label: csvLabel,
      });
      setSaved((current) => ({ ...current, [csvName]: true }));
      toast({ title: `"${csvName}" vinculado correctamente` });
      onResolved?.();
    } catch {
      toast({ title: "Error al guardar el vínculo", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const pending = unresolvedNames.filter((name) => !saved[name]);
  if (!pending.length) return null;

  return (
    <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={15} className="text-orange-400" />
        <div>
          <p className="text-sm font-bold text-orange-200">Jugadores del CSV pendientes de vinculación</p>
          <p className="text-xs text-orange-300/70">La carga no se interpreta como perfil individual hasta resolver la identidad.</p>
        </div>
      </div>
      <div className="space-y-2">
        {pending.map((csvName) => (
          <div key={csvName} className="flex flex-wrap items-center gap-2 rounded-xl border border-orange-500/10 bg-zinc-950/60 p-2">
            <span className="min-w-[150px] rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 font-mono text-xs text-zinc-300">{csvName}</span>
            <ChevronRight size={12} className="text-zinc-600" />
            <select value={selections[csvName] || ""} onChange={(event) => setSelections((current) => ({ ...current, [csvName]: event.target.value }))} className="min-w-[180px] flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white">
              <option value="">Seleccionar jugador</option>
              {playerOptions.map((player) => <option key={player.id} value={player.id}>{player.jersey_number ? `#${player.jersey_number} ` : ""}{player.full_name}{player.division ? ` · ${player.division}` : ""}</option>)}
            </select>
            <button onClick={() => saveMapping(csvName)} disabled={!selections[csvName] || saving} className="inline-flex items-center gap-1 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-200 disabled:opacity-40">
              <UserCheck size={12} /> Vincular
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, helper }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">{label}</p>
        {Icon && <Icon size={15} className="text-zinc-500" />}
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[11px] text-zinc-600">{helper}</p>
    </div>
  );
}

function MaximaPanel({ maxima }) {
  const wanted = ["meters_per_minute", "distance_hsr", "sprint_distance", "max_velocity"];
  const rows = wanted.map((key) => maxima.find((item) => item.metric.key === key)).filter(Boolean);
  if (!rows.length) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {rows.map(({ metric, player, value }) => (
        <div key={metric.key} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-3">
            <PlayerPhoto src={player.photo_url} alt={player.player_name} className="h-10 w-10 rounded-full object-cover" fallbackClassName="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800" textClassName="text-xs font-bold text-zinc-400" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Máximo · {metric.short}</p>
              <p className="truncate text-sm font-bold text-white">{player.player_name}</p>
              <p className="text-lg font-black text-zinc-100">{formatMatchGpsValue(metric, value)} <span className="text-xs font-normal text-zinc-500">{metric.unit}</span></p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PeriodAnalysis({ model, accent }) {
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const players = model.resolved.filter((player) => (player.period_breakdown || []).length);
  useEffect(() => {
    if (!players.length) return;
    if (!players.some((player) => player.player_id === selectedPlayerId)) setSelectedPlayerId(players[0].player_id);
  }, [players, selectedPlayerId]);
  if (!model.periodNames.length || !players.length) return null;
  const selected = players.find((player) => player.player_id === selectedPlayerId) || players[0];
  const metrics = ["total_duration", "total_distance", "meters_per_minute", "distance_hsr", "sprint_distance", "sprint_efforts", "player_load", "max_velocity"].map((key) => MATCH_GPS_METRICS.find((metric) => metric.key === key));

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Análisis por período</p>
          <h3 className="mt-1 text-base font-black text-white">1T / 2T y segmentos detectados en el archivo</h3>
          <p className="mt-1 text-xs text-zinc-500">Los totales del partido no duplican períodos. Las variables acumulativas se suman y la velocidad máxima conserva el máximo observado.</p>
        </div>
        <select value={selectedPlayerId} onChange={(event) => setSelectedPlayerId(event.target.value)} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white">
          {players.map((player) => <option key={player.player_id} value={player.player_id}>{player.player_name}</option>)}
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {model.periodTeamSummary.map((period) => (
          <div key={period.period_name} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
            <div className="mb-2 flex items-center justify-between"><p className="font-black text-white">{period.period_name}</p><span className="text-[10px] text-zinc-600">{period.players} jugadores</span></div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><p className="text-zinc-600">m/min</p><p className="font-bold text-zinc-200">{formatMatchGpsValue("meters_per_minute", period.metrics.meters_per_minute)}</p></div>
              <div><p className="text-zinc-600">D&gt;19.8</p><p className="font-bold text-zinc-200">{formatMatchGpsValue("distance_hsr", period.metrics.distance_hsr)} m</p></div>
              <div><p className="text-zinc-600">D&gt;25</p><p className="font-bold text-zinc-200">{formatMatchGpsValue("sprint_distance", period.metrics.sprint_distance)} m</p></div>
              <div><p className="text-zinc-600">Smax</p><p className="font-bold text-zinc-200">{formatMatchGpsValue("max_velocity", period.metrics.max_velocity)} km/h</p></div>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="min-w-[950px] w-full text-xs">
          <thead className="bg-zinc-950 text-zinc-500">
            <tr><th className="px-3 py-2 text-left">Período · {selected?.player_name}</th>{metrics.map((metric) => <th key={metric.key} className="px-3 py-2 text-right">{metric.short}</th>)}</tr>
          </thead>
          <tbody>
            {(selected?.period_breakdown || []).map((period) => (
              <tr key={`${selected.player_id}-${period.period_name}`} className="border-t border-zinc-800">
                <td className="px-3 py-2.5 font-bold text-white"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />{period.period_name}</td>
                {metrics.map((metric) => <td key={metric.key} className="px-3 py-2.5 text-right font-mono text-zinc-300">{formatMatchGpsValue(metric, period[metric.key])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function MatchGpsReport({ match }) {
  const { toast } = useToast();
  const { clubBrand, can } = useWorkspace();
  const [data, setData] = useState(null);
  const [minutesRows, setMinutesRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeMetric, setActiveMetric] = useState("total_distance");
  const [exporting, setExporting] = useState(false);
  const canExport = can?.("export", "/matches") !== false;
  const accent = clubBrand?.accent || clubBrand?.primary || "#84cc16";

  async function loadData() {
    if (!match.csv_url) return;
    setLoading(true);
    setError("");
    try {
      const [response, minutes] = await Promise.all([
        base44.functions.invoke("resolveMatchGpsCSV", {
          csv_url: match.csv_url,
          match_id: match.id,
          match_date: match.date,
          csv_label: match.csv_label,
        }),
        base44.entities.MatchPlayerMinutes.filter({ match_id: match.id }, "-updated_date", 200).catch(() => []),
      ]);
      setData(response.data);
      setMinutesRows(minutes || []);
    } catch (loadError) {
      setError(loadError?.message || "No se pudo procesar el archivo GPS.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [match.id, match.csv_url]);

  const model = useMemo(() => buildMatchGpsReportModel({ data, minutesRows }), [data, minutesRows]);
  const metric = MATCH_GPS_METRICS.find((item) => item.key === activeMetric) || MATCH_GPS_METRICS[1];
  const chartData = useMemo(() => model.resolved.filter((row) => validNumber(row[activeMetric]) != null).sort((a, b) => Number(b[activeMetric]) - Number(a[activeMetric])).map((row) => ({ ...row, value: Number(row[activeMetric]) })), [model.resolved, activeMetric]);
  const primaryReference = model.teamSummary[activeMetric];
  const tableMetrics = MATCH_GPS_METRICS;

  async function handleExport() {
    setExporting(true);
    try {
      await exportMatchGpsPdf({ match, model, clubBrand });
      toast({ title: "Informe GPS exportado" });
    } catch (exportError) {
      toast({ title: exportError?.message || "No se pudo exportar el informe", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  if (!match.csv_url) return null;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500"><FileSpreadsheet size={14} /> PerformancePitch · Match GPS</div>
              <h2 className="mt-2 text-xl font-black text-white">Informe GPS · {clubBrand?.shortName || clubBrand?.name || "Club"} vs {match.rival || "Rival"}</h2>
              <p className="mt-1 text-sm text-zinc-400">{moment(match.date).format("dddd DD [de] MMMM YYYY")}{match.competition ? ` · ${match.competition}` : ""}{match.location ? ` · ${match.location}` : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              {!loading && data && <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-400"><CheckCircle size={12} className="mr-1 inline text-emerald-400" />{model.resolved.length} jugadores resueltos</span>}
              {canExport && <button onClick={handleExport} disabled={exporting || loading || !model.resolved.length} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black text-zinc-950 disabled:opacity-40" style={{ backgroundColor: accent }}><FileDown size={14} />{exporting ? "Generando…" : "Exportar PDF"}</button>}
            </div>
          </div>
        </div>

        <div className="space-y-5 p-4 sm:p-5">
          {loading ? <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500"><div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />Procesando partido y períodos…</div> : error ? <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 text-center text-sm text-red-300">{error}</div> : !model.players.length ? <div className="py-10 text-center text-sm text-zinc-500">El CSV no contiene filas GPS válidas.</div> : <>
            {data?.unresolved_names?.length > 0 && <UnresolvedNamesPanel unresolvedNames={data.unresolved_names} playerOptions={data.player_options || []} onResolved={loadData} matchId={match.id} matchDate={match.date} csvUrl={match.csv_url} csvLabel={match.csv_label} />}

            <div>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Resumen físico del partido</p><p className="mt-1 text-xs text-zinc-600">Promedios calculados sobre {describeExposureSample(model)} para reducir el efecto de suplentes con pocos minutos. Smax muestra el máximo observado.</p></div></div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <KpiCard icon={Users} label="Jugadores GPS" value={model.resolved.length} helper={`${data?.unresolved || 0} pendiente(s) de identidad`} />
                <KpiCard icon={Timer} label="Duración GPS" value={`${formatMatchGpsValue("total_duration", model.teamSummary.total_duration)}'`} helper="promedio muestra principal" />
                <KpiCard icon={Activity} label="Distancia total" value={`${formatMatchGpsValue("total_distance", model.teamSummary.total_distance)} m`} helper="promedio muestra principal" />
                <KpiCard icon={Gauge} label="Intensidad" value={`${formatMatchGpsValue("meters_per_minute", model.teamSummary.meters_per_minute)} m/min`} helper="distancia / tiempo GPS" />
                <KpiCard icon={Zap} label="D >25 km/h" value={`${formatMatchGpsValue("sprint_distance", model.teamSummary.sprint_distance)} m`} helper="promedio muestra principal" />
                <KpiCard icon={Zap} label="Smax del equipo" value={`${formatMatchGpsValue("max_velocity", model.teamSummary.max_velocity)} km/h`} helper="máximo observado" />
              </div>
            </div>

            <div>
              <div className="mb-3"><p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Máximos observados</p><p className="mt-1 text-xs text-zinc-600">Son máximos descriptivos del partido, no una clasificación de riesgo ni un semáforo.</p></div>
              <MaximaPanel maxima={model.maxima} />
            </div>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Distribución por jugador</p><h3 className="mt-1 text-base font-black text-white">{metric.label}</h3><p className="mt-1 text-xs text-zinc-600">La línea punteada representa la referencia descriptiva de la muestra principal del partido.</p></div><div className="flex max-w-4xl flex-wrap gap-1.5">{MATCH_GPS_METRICS.slice(1).map((item) => <button key={item.key} onClick={() => setActiveMetric(item.key)} className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${activeMetric === item.key ? "text-zinc-950" : "border-zinc-800 bg-zinc-900 text-zinc-500"}`} style={activeMetric === item.key ? { backgroundColor: accent, borderColor: accent } : undefined}>{item.short}</button>)}</div></div>
              {chartData.length ? <ResponsiveContainer width="100%" height={Math.max(230, chartData.length * 30)}><BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 65, left: 10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} /><XAxis type="number" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="player_name" width={115} tick={{ fontSize: 10, fill: "#d4d4d8" }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 10, fontSize: 11 }} formatter={(value) => [`${formatMatchGpsValue(metric, value)} ${metric.unit}`, metric.label]} />{validNumber(primaryReference) != null && <ReferenceLine x={primaryReference} stroke={accent} strokeDasharray="5 4" strokeOpacity={0.8} label={{ value: "muestra", fill: accent, fontSize: 9, position: "insideTopRight" }} />}<Bar dataKey="value" fill={accent} fillOpacity={0.78} radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer> : <p className="py-10 text-center text-sm text-zinc-600">Sin datos para esta variable.</p>}
            </section>

            <PeriodAnalysis model={model} accent={accent} />

            <section className="space-y-3">
              <div><p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Planilla GPS del partido</p><p className="mt-1 text-xs text-zinc-600">Valores absolutos. Sin semáforo. Los minutos oficiales se muestran cuando están cargados en el partido.</p></div>
              <div className="overflow-x-auto rounded-2xl border border-zinc-800">
                <table className="min-w-[1380px] w-full text-xs">
                  <thead className="bg-zinc-950 text-zinc-500"><tr><th className="sticky left-0 z-10 bg-zinc-950 px-3 py-3 text-left">Jugador</th><th className="px-3 py-3 text-left">Pos.</th><th className="px-3 py-3 text-left">Rol</th><th className="px-3 py-3 text-right">Min. oficial</th>{tableMetrics.map((item) => <th key={item.key} className="px-3 py-3 text-right">{item.short}</th>)}</tr></thead>
                  <tbody>{model.resolved.slice().sort((a, b) => Number(b.total_duration || 0) - Number(a.total_duration || 0)).map((row, index) => <tr key={row.player_id} className={`border-t border-zinc-800 ${index % 2 ? "bg-zinc-950/20" : "bg-zinc-900"}`}><td className={`sticky left-0 z-10 px-3 py-2.5 ${index % 2 ? "bg-[#151517]" : "bg-zinc-900"}`}><div className="flex items-center gap-2"><PlayerPhoto src={row.photo_url} alt={row.player_name} className="h-7 w-7 rounded-full object-cover" fallbackClassName="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800" textClassName="text-[9px] font-bold text-zinc-500" /><span className="font-bold text-white">{row.player_name}</span>{(row.period_breakdown || []).length > 1 && <span className="rounded-full border border-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-500">{row.period_breakdown.length} períodos</span>}</div></td><td className="px-3 py-2.5 text-zinc-400">{row.position || "—"}</td><td className="px-3 py-2.5 text-zinc-400">{row.lineup_role || (row.started ? "Titular" : "—")}</td><td className="px-3 py-2.5 text-right font-mono text-zinc-300">{row.official_minutes != null ? Math.round(row.official_minutes) : "—"}</td>{tableMetrics.map((item) => <td key={item.key} className="px-3 py-2.5 text-right font-mono font-semibold text-zinc-200">{formatMatchGpsValue(item, row[item.key])}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-3 text-[10px] text-zinc-600"><span>{data?.rows?.length || 0} filas originales · {model.resolved.length} jugadores canónicos · {model.periodNames.length ? `${model.periodNames.length} período(s) detectado(s)` : "sin desglose de períodos en el CSV"}</span><span>Interpretación descriptiva de carga externa · no constituye diagnóstico médico</span></div>
          </>}
        </div>
      </section>
    </div>
  );
}
