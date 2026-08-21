import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, FileText, Save, Download, Send, X, ChevronDown } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart, Legend } from "recharts";
import { base44 } from "@/api/base44Client";
import PlayerPhoto from "@/components/player/PlayerPhoto";
import {
  REPORT_METRICS, KPI_KEYS, fmtMetric, pctVs,
  buildMatchOptionsFromData, buildAnalysisFromOptions,
  buildKpis, buildInsight, buildLastMatchVsAvgData,
} from "@/lib/matchReportData";
import { exportMatchReportPdf } from "@/lib/reports/matchReportPdf";
import MatchReportPreview from "@/components/matchReports/MatchReportPreview";

const RANGE_OPTIONS = [
  { key: "last1", label: "Último partido" },
  { key: "last5", label: "Últimos 5" },
  { key: "last10", label: "Últimos 10" },
  { key: "season", label: "Temporada" },
];

const EVOLUTION_METRICS = REPORT_METRICS;

const COMPARE_METRICS = ["total_distance", "m_min", "distance_19_8", "sprints", "player_load", "smax"];

function calcAge(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

export default function GpsPlayerMatchAnalysis({
  player,
  matchReports,
  matchGpsByMatch,
  competitionProfile,
  squadName,
  squadId,
  seasonId,
}) {
  const [matchOptions, setMatchOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [rangeMode, setRangeMode] = useState("last5");
  const [selectedMatchIds, setSelectedMatchIds] = useState([]);
  const [evolutionMetricKey, setEvolutionMetricKey] = useState("total_distance");
  const [showPreview, setShowPreview] = useState(false);
  const [staffComment, setStaffComment] = useState("");
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedReportId, setSavedReportId] = useState(null);

  // Load match options when player changes
  useEffect(() => {
    if (!player?.id) return;
    setLoadingOptions(true);
    base44.entities.MatchPlayerMinutes.filter({ player_id: player.id }, "-match_date", 500)
      .then((minutesRows) => {
        const options = buildMatchOptionsFromData({
          matchReports,
          matchGpsByMatch,
          minutesRows,
          playerId: player.id,
        });
        setMatchOptions(options);
        // Default: last 5
        const defaultIds = options.slice(0, 5).map((o) => o.match.id);
        setSelectedMatchIds(defaultIds);
        setRangeMode("last5");
      })
      .catch(() => setMatchOptions([]))
      .finally(() => setLoadingOptions(false));
  }, [player?.id, matchReports, matchGpsByMatch]);

  const applyRange = useCallback((mode) => {
    setRangeMode(mode);
    if (mode === "last1") setSelectedMatchIds(matchOptions.slice(0, 1).map((o) => o.match.id));
    else if (mode === "last5") setSelectedMatchIds(matchOptions.slice(0, 5).map((o) => o.match.id));
    else if (mode === "last10") setSelectedMatchIds(matchOptions.slice(0, 10).map((o) => o.match.id));
    else if (mode === "season") setSelectedMatchIds(matchOptions.map((o) => o.match.id));
  }, [matchOptions]);

  function toggleMatch(matchId) {
    setRangeMode("custom");
    setSelectedMatchIds((prev) => prev.includes(matchId) ? prev.filter((id) => id !== matchId) : [...prev, matchId]);
  }

  const reportData = useMemo(() => {
    if (!player || selectedMatchIds.length === 0) return null;
    return buildAnalysisFromOptions({
      player,
      matchOptions,
      selectedMatchIds,
      competitionProfile,
    });
  }, [player, matchOptions, selectedMatchIds, competitionProfile]);

  const kpis = reportData ? buildKpis(reportData) : [];

  // KPIs: último partido vs promedio de últimos 5
  const extendedKpis = useMemo(() => {
    if (!reportData) return [];
    const { selected, lastFiveAvg, personalAvg } = reportData;
    const last = selected[selected.length - 1];
    const metricKpis = KPI_KEYS.map((key) => {
      const metric = REPORT_METRICS.find((m) => m.key === key);
      const value = Number(last.gpsRow[key] || 0);
      const base = (lastFiveAvg && lastFiveAvg[key]) || personalAvg[key] || competitionProfile?.[metric.profile];
      return { ...metric, value, base, pct: pctVs(value, base) };
    });
    return [
      { key: "_matches", label: "Partidos", value: selected.length, unit: "", decimals: 0 },
      { key: "_minutes", label: "Minutos", value: last?.minutesPlayed ?? 0, unit: "'", decimals: 0 },
      ...metricKpis,
    ];
  }, [reportData, competitionProfile]);

  // Evolution chart data
  const evolutionData = useMemo(() => {
    if (!reportData) return [];
    return reportData.selected.map((s) => ({
      rival: s.match.rival || "Partido",
      shortDate: s.match.date ? new Date(s.match.date + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "—",
      [evolutionMetricKey]: Number(s.gpsRow[evolutionMetricKey] || 0),
      average: Number(reportData.personalAvg[evolutionMetricKey] || 0),
      profile: Number(competitionProfile?.[REPORT_METRICS.find((m) => m.key === evolutionMetricKey)?.profile] || 0),
    }));
  }, [reportData, evolutionMetricKey, competitionProfile]);

  const evolutionMetric = REPORT_METRICS.find((m) => m.key === evolutionMetricKey);

  // Comparison data (per metric, per match)
  const comparisonData = useMemo(() => {
    if (!reportData || reportData.selected.length < 2) return [];
    return COMPARE_METRICS.map((key) => {
      const metric = REPORT_METRICS.find((m) => m.key === key);
      const data = reportData.selected.map((s) => ({
        label: s.match.rival || s.match.date?.slice(5) || "Partido",
        value: Number(s.gpsRow[key] || 0),
      }));
      return { metric, data };
    });
  }, [reportData]);

  const generateLabel = useMemo(() => {
    if (selectedMatchIds.length === 0) return "Generar reporte";
    if (rangeMode === "custom" || (rangeMode !== "last1" && rangeMode !== "last5" && rangeMode !== "last10" && rangeMode !== "season")) {
      return `Generar reporte · ${selectedMatchIds.length} ${selectedMatchIds.length === 1 ? "partido" : "partidos"}`;
    }
    const rangeLabel = RANGE_OPTIONS.find((r) => r.key === rangeMode)?.label || "";
    return `Generar reporte · ${rangeLabel}`;
  }, [selectedMatchIds, rangeMode]);

  function handleGenerate() {
    setSavedReportId(null);
    setStaffComment("");
    setShowPreview(true);
  }

  function buildTitle() {
    if (!reportData) return "Informe";
    const name = reportData.player?.full_name || "Jugador";
    if (reportData.isMulti) return `Informe Individual · ${name} · Últimos ${reportData.selected.length} partidos`;
    const m = reportData.selected[0]?.match;
    return `Informe Individual · ${name} · vs ${m?.rival || "Rival"} · ${m?.date || ""}`;
  }

  async function handleSaveDraft() {
    setSaving(true);
    try {
      const payload = {
        title: buildTitle(),
        report_type: reportData.isMulti ? "multi_match" : "single_match",
        status: "draft",
        player_id: player.id,
        player_name: player.full_name,
        squad_id: squadId,
        squad_name: squadName,
        season_id: seasonId || "",
        match_ids: selectedMatchIds,
        match_labels: reportData.selected.map((s) => `vs ${s.match.rival} (${s.match.date})`),
        match_dates: reportData.selected.map((s) => s.match.date),
        staff_comment: staffComment,
      };
      const record = await base44.entities.PlayerMatchReport.create(payload);
      setSavedReportId(record.id);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handlePublish() {
    setSaving(true);
    try {
      const payload = {
        title: buildTitle(),
        report_type: reportData.isMulti ? "multi_match" : "single_match",
        status: "published",
        player_id: player.id,
        player_name: player.full_name,
        squad_id: squadId,
        squad_name: squadName,
        season_id: seasonId || "",
        match_ids: selectedMatchIds,
        match_labels: reportData.selected.map((s) => `vs ${s.match.rival} (${s.match.date})`),
        match_dates: reportData.selected.map((s) => s.match.date),
        staff_comment: staffComment,
        published_at: new Date().toISOString(),
      };
      let record;
      if (savedReportId) {
        record = await base44.entities.PlayerMatchReport.update(savedReportId, { ...payload, status: "published", published_at: new Date().toISOString() });
      } else {
        record = await base44.entities.PlayerMatchReport.create(payload);
        setSavedReportId(record.id);
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleDownloadPdf() {
    setExporting(true);
    try {
      await exportMatchReportPdf({ reportData, reportMeta: { title: buildTitle() }, staffComment, evolutionMetricKey });
    } catch (e) { console.error(e); }
    finally { setExporting(false); }
  }

  const age = player ? calcAge(player.birth_date) : null;

  if (loadingOptions) {
    return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div>;
  }

  if (matchOptions.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-500 text-sm">No hay partidos con GPS cargado para este jugador.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Player header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4">
        <PlayerPhoto
          player={player}
          className="w-16 h-16 rounded-xl object-cover border border-zinc-700 shrink-0"
          fallbackClassName="w-16 h-16 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0"
          textClassName="text-xl font-bold text-zinc-500"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-black text-white leading-tight truncate">{player?.full_name}</h2>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-400 mt-1">
            <span>{player?.position || "Sin posición"}</span>
            {squadName && <span>· {squadName}</span>}
            {player?.jersey_number && <span>· #{player.jersey_number}</span>}
            {age != null && <span>· {age} años</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-emerald-400 font-medium">Disponible</span>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={selectedMatchIds.length === 0}
          className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50 hover:bg-emerald-500 transition-colors shrink-0"
        >
          <FileText size={16} /> <span className="hidden sm:inline">{generateLabel}</span><span className="sm:hidden">Reporte</span>
        </button>
      </div>

      {/* Match range selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-500 font-semibold uppercase">Partidos analizados:</span>
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r.key}
            onClick={() => applyRange(r.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              rangeMode === r.key ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {r.label}
          </button>
        ))}
        <span className="text-xs text-zinc-500 ml-1">· {selectedMatchIds.length} seleccionados</span>
      </div>

      {/* KPIs del último partido */}
      <div>
        <p className="text-xs text-zinc-500 font-semibold uppercase mb-2">Métricas del último partido vs promedio de 5</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {extendedKpis.map((kpi) => (
            <div key={kpi.key} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
              <p className="text-[10px] text-zinc-500 uppercase font-semibold truncate">{kpi.label}</p>
              <p className="text-xl font-black text-white mt-1">{fmtMetric(kpi.value, kpi.decimals)}</p>
              {kpi.unit && <p className="text-[10px] text-zinc-500">{kpi.unit}</p>}
              {kpi.base != null && kpi.key !== "_matches" && kpi.key !== "_minutes" && (
                <p className="text-[10px] text-zinc-500 mt-0.5">vs prom. 5: {fmtMetric(kpi.base, kpi.decimals)}</p>
              )}
              {kpi.pct != null && (
                <p className={`text-[10px] font-bold mt-0.5 ${kpi.pct > 0 ? "text-emerald-400" : kpi.pct < 0 ? "text-red-400" : "text-zinc-500"}`}>
                  {kpi.pct > 0 ? "+" : ""}{kpi.pct}%
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Evolution chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-white">Evolución por partido</h3>
          <select
            value={evolutionMetricKey}
            onChange={(e) => setEvolutionMetricKey(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white"
          >
            {EVOLUTION_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
        {evolutionData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={evolutionData} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="rival" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={44} />
              <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 12, color: "#fff" }} />
              <ReferenceLine y={reportData?.personalAvg[evolutionMetricKey]} stroke="#71717a" strokeDasharray="5 5" label={{ value: "Promedio", fill: "#71717a", fontSize: 9, position: "right" }} />
              {competitionProfile?.[evolutionMetric?.profile] && (
                <ReferenceLine y={competitionProfile[evolutionMetric.profile]} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: "Perfil", fill: "#3b82f6", fontSize: 9, position: "left" }} />
              )}
              <Line
                type="monotone"
                dataKey={evolutionMetricKey}
                stroke={evolutionMetric?.color || "#22c55e"}
                strokeWidth={2.5}
                dot={(props) => {
                  const { cx, cy, index } = props;
                  const isLast = index === evolutionData.length - 1;
                  return isLast
                    ? <circle cx={cx} cy={cy} r={6} fill="#fbbf24" stroke="#fff" strokeWidth={2} />
                    : <circle cx={cx} cy={cy} r={4} fill={evolutionMetric?.color || "#22c55e"} strokeWidth={0} />;
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-zinc-500 text-sm text-center py-8">Seleccioná partidos para ver la evolución</p>
        )}
      </div>

      {/* Last match vs average */}
      {reportData && buildLastMatchVsAvgData(reportData).length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-white mb-3">Último partido vs promedio de 5</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={buildLastMatchVsAvgData(reportData)} layout="vertical" margin={{ left: 8, right: 16 }}>
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

      {/* Match table with checkboxes */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-zinc-800">
          <h3 className="text-sm font-bold text-white">Tabla de partidos</h3>
          <span className="text-xs text-zinc-400">{selectedMatchIds.length} partido{selectedMatchIds.length === 1 ? "" : "s"} seleccionado{selectedMatchIds.length === 1 ? "" : "s"}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-zinc-950/50 text-zinc-400 border-b border-zinc-800">
                <th className="p-2.5 w-8"></th>
                <th className="text-left p-2.5 font-semibold">Partido</th>
                <th className="text-right p-2.5 font-semibold">Min</th>
                {REPORT_METRICS.map((m) => (
                  <th key={m.key} className="text-right p-2.5 font-semibold whitespace-nowrap">{m.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matchOptions.map((opt) => {
                const checked = selectedMatchIds.includes(opt.match.id);
                return (
                  <tr
                    key={opt.match.id}
                    onClick={() => toggleMatch(opt.match.id)}
                    className={`border-b border-zinc-800/40 cursor-pointer transition-colors ${checked ? "bg-emerald-500/10" : "hover:bg-zinc-800/30"}`}
                  >
                    <td className="p-2.5 text-center">
                      <input type="checkbox" checked={checked} onChange={() => toggleMatch(opt.match.id)} onClick={(e) => e.stopPropagation()} className="accent-emerald-500 w-4 h-4" />
                    </td>
                    <td className="p-2.5">
                      <p className="text-white font-medium">vs {opt.match.rival || "Rival"}</p>
                      <p className="text-zinc-500 text-[10px]">{opt.match.date ? new Date(opt.match.date + "T00:00:00").toLocaleDateString("es-AR") : "—"} · {opt.match.competition || ""}</p>
                    </td>
                    <td className="p-2.5 text-right text-zinc-300">{opt.minutesPlayed ?? "—"}</td>
                    {REPORT_METRICS.map((m) => (
                      <td key={m.key} className="p-2.5 text-right text-zinc-300 tabular-nums">{fmtMetric(opt.gpsRow[m.key], m.decimals)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comparison (2+ matches) */}
      {comparisonData.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white">Comparación de partidos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {comparisonData.map(({ metric, data }) => (
              <div key={metric.key} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3">
                <p className="text-xs font-bold text-white mb-2">{metric.label} <span className="text-zinc-500 font-normal">({metric.unit})</span></p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 9 }} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 9 }} width={36} />
                    <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 8, color: "#fff", fontSize: 11 }} />
                    <Bar dataKey="value" fill={metric.color} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report preview modal */}
      {showPreview && reportData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-20">
              <h2 className="text-base font-bold text-white">Vista previa del reporte</h2>
              <div className="flex items-center gap-2">
                <button onClick={handleSaveDraft} disabled={saving} className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar borrador
                </button>
                <button onClick={handleDownloadPdf} disabled={exporting} className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
                  {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} PDF
                </button>
                <button onClick={handlePublish} disabled={saving} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Publicar
                </button>
                <button onClick={() => setShowPreview(false)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400"><X size={18} /></button>
              </div>
            </div>
            {savedReportId && (
              <div className="mx-4 mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                Reporte guardado. El jugador lo verá en su portal cuando esté publicado.
              </div>
            )}
            <div className="p-4">
              <MatchReportPreview
                reportData={reportData}
                staffComment={staffComment}
                onCommentChange={setStaffComment}
                evolutionMetricKey={evolutionMetricKey}
                onEvolutionMetricChange={setEvolutionMetricKey}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}