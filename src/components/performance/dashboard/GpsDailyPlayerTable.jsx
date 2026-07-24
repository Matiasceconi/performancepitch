import React, { useMemo, useState } from "react";
import moment from "moment";
import "moment/locale/es";

moment.locale("es");
import { ChevronDown, ChevronRight } from "lucide-react";
import PlayerPhoto from "@/components/player/PlayerPhoto";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

const STORAGE_KEY = "gps_daily_metric_config_v1";
const DEFAULT_GROUPS = [
  { id: "volumen", label: "Volumen", metrics: [{ key: "total_distance", label: "Distancia total", unit: "m" }, { key: "player_load", label: "Player Load", unit: "" }, { key: "duration_minutes", label: "Minutos", unit: "min" }, { key: "sessions_count", label: "Sesiones", unit: "" }] },
  { id: "intensidad", label: "Intensidad", metrics: [{ key: "m_min", label: "m/min", unit: "" }, { key: "distance_14_19_8", label: "D 14–19,8", unit: "m" }, { key: "distance_19_8", label: "D 19,8–25", unit: "m" }, { key: "distance_25", label: "D +25", unit: "m" }, { key: "sprints", label: "Sprints", unit: "" }, { key: "smax", label: "Vel. máxima", unit: "km/h", mode: "max" }] },
  { id: "neuromuscular", label: "Neuromuscular", metrics: [{ key: "acc_3", label: "ACC +3", unit: "" }, { key: "dec_3", label: "DEC +3", unit: "" }] },
];
const OPTIONAL = [{ key: "acc_2_3", label: "Acc 2–3 m/s²" }, { key: "dec_2_3", label: "Dec 2–3 m/s²" }, { key: "player_load_per_min", label: "Player Load/min" }, { key: "hmld", label: "HMLD" }, { key: "rhie_bouts", label: "RHIE" }, { key: "smax_pct", label: "% Vel. máxima", mode: "max" }, { key: "gps_days", label: "Días con GPS" }, { key: "days_without_data", label: "Cargas sin datos" }];
const SUM_KEYS = new Set(["total_distance", "player_load", "distance_14_19_8", "distance_19_8", "distance_25", "sprints", "acc_3", "dec_3", "hmld", "rhie_bouts"]);
const MAX_KEYS = new Set(["smax", "smax_pct"]);
const REF_KEYS = { total_distance: "avg_total_distance", m_min: "avg_m_min", distance_14_19_8: "avg_distance_14_19_8", distance_19_8: "avg_distance_19_8", distance_25: "avg_distance_25", sprints: "avg_sprints", acc_3: "avg_acc_3", dec_3: "avg_dec_3", player_load: "avg_player_load", smax: "avg_smax" };
const EXCLUDED = ["diferenciado", "kinesiologia", "reintegro", "individual", "lesion", "error_gps", "carga_parcial"];

function fmt(v, unit = "") { if (v == null || Number.isNaN(Number(v))) return "—"; const n = Number(v); return `${unit === "km/h" || n < 100 ? n.toFixed(1) : Math.round(n).toLocaleString("es-AR")} ${unit}`.trim(); }
function validRow(row) { const text = `${row.gps_group || ""} ${row.exclusion_reason || ""} ${row.status || ""}`.toLowerCase(); return row.include_in_session_average !== false && !EXCLUDED.some((x) => text.includes(x)); }
function lightClass(pct, refMode) { if (refMode === "none") return "bg-zinc-800/80 text-zinc-200"; if (!pct) return "bg-zinc-700/50 text-zinc-300"; if (pct < 85) return "bg-blue-500/20 text-blue-200"; if (pct < 95) return "bg-yellow-500/20 text-yellow-200"; if (pct <= 105) return "bg-emerald-500/20 text-emerald-200"; if (pct <= 115) return "bg-orange-500/20 text-orange-200"; return "bg-red-500/20 text-red-200"; }
function posGroup(player) { return player?.position_group || player?.position || "Sin posición"; }
function rowDuration(row) { const explicit = Number(row.duration_minutes || row.minutes || row.session_duration_minutes); if (Number.isFinite(explicit) && explicit > 0) return explicit; const d = Number(row.total_distance); const mm = Number(row.m_min || row.meters_per_minute); return d > 0 && mm > 0 ? d / mm : 0; }
function metricValueFromRow(row, key) { if (key === "m_min") return Number(row.total_distance || 0); if (key === "player_load_per_min") return Number(row.player_load || 0); if (row[key] == null || row[key] === "") return NaN; return Number(row[key]); }

export default function GpsDailyPlayerTable({ gpsSources = [], selectedSourceIds = [], playerMap = {}, microcycleProfiles = [], competitionProfiles = [], squadId, season }) {
  const [sourceId, setSourceId] = useState("all");
  const [refMode, setRefMode] = useState("none");
  const [viewMode, setViewMode] = useState("sum");
  const [panelOpen, setPanelOpen] = useState(false);
  const [expanded, setExpanded] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("desc");
  const [groups, setGroups] = useState(() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_GROUPS; } catch { return DEFAULT_GROUPS; } });

  const selectedSources = useMemo(() => gpsSources.filter((s) => selectedSourceIds.includes(s.id)), [gpsSources, selectedSourceIds]);
  const selectedDates = useMemo(() => [...new Set(selectedSources.map((s) => s.date))].sort(), [selectedSources]);
  const selectedMds = useMemo(() => [...new Set(selectedSources.map((s) => s.md).filter(Boolean))], [selectedSources]);
  const periodItems = useMemo(() => selectedSources.map((s) => ({
    id: s.sourceId, sourceId: s.sourceId, sourceType: s.sourceType,
    title: s.title, date: s.date, match_day_code: s.md, microcycle_day: s.md, md: s.md,
    objective: s.objective, rival: s.rival, source_type: s.sourceType,
  })), [selectedSources]);
  const gpsByItem = useMemo(() => {
    const map = {};
    selectedSources.forEach((s) => { map[s.sourceId] = s.rows; });
    return map;
  }, [selectedSources]);
  const activeItems = sourceId === "all" ? periodItems : periodItems.filter((s) => s.sourceId === sourceId);
  const metrics = groups.flatMap((g) => g.metrics.map((m) => ({ ...m, group: g.label })));
  const rows = useMemo(() => aggregateRows(activeItems, gpsByItem, playerMap, metrics, selectedSources.length, viewMode), [activeItems, gpsByItem, playerMap, metrics, selectedSources.length, viewMode]);

  function toggleSort(key) { if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDir("desc"); } }
  const sortedRows = useMemo(() => { if (!sortKey) return rows; const dir = sortDir === "asc" ? 1 : -1; return [...rows].sort((a, b) => { if (sortKey === "player_name") return dir * String(a.player_name || "").localeCompare(String(b.player_name || ""), "es"); if (sortKey === "position") return dir * String(a.position || "").localeCompare(String(b.position || ""), "es"); const av = Number(a[sortKey]); const bv = Number(b[sortKey]); if (Number.isNaN(av) && Number.isNaN(bv)) return 0; if (Number.isNaN(av)) return 1; if (Number.isNaN(bv)) return -1; return dir * (av - bv); }); }, [rows, sortKey, sortDir]);
  const compMap = useMemo(() => Object.fromEntries(competitionProfiles.map((p) => [p.player_id, p])), [competitionProfiles]);
  const microMap = useMemo(() => Object.fromEntries(microcycleProfiles.map((p) => [`${p.player_id}:${p.microcycle_day}`, p])), [microcycleProfiles]);
  const title = selectedSources.length === 1 ? `${selectedSources[0].title} — ${moment(selectedSources[0].date).locale("es").format("dddd DD/MM")}` : selectedDates.length > 1 ? `Carga acumulada de ${selectedSources.length} cargas` : "Carga del período";
  const matchCount = selectedSources.filter((s) => s.sourceType === "match").length;
  const trainingCount = selectedSources.filter((s) => s.sourceType === "training").length;

  function saveConfig(next) { setGroups(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
  function positionRef(player, metricKey) { const key = REF_KEYS[metricKey]; const group = posGroup(player); const profiles = competitionProfiles.filter((p) => p.squad_id === squadId && (!season || p.season_id === season) && posGroup(playerMap[p.player_id]) === group && p[key]); const value = profiles.length ? profiles.reduce((a, p) => a + Number(p[key] || 0), 0) / profiles.length : null; return { value, source: `Referencia: ${group}`, used: `${profiles.length} jugadores · ${profiles.reduce((a, p) => a + Number(p.matches_used || 0), 0)} partidos válidos` }; }
  function ownRef(row, metricKey) { const key = REF_KEYS[metricKey]; if (!key) return { value: null, source: "Sin referencia", used: "" }; const profiles = selectedMds.map((md) => microMap[`${row.player_id}:${md}`]).filter(Boolean); const values = profiles.map((p) => Number(p[key])).filter(Number.isFinite); if (!values.length) return { value: null, source: "Sin referencia", used: "" }; const value = MAX_KEYS.has(metricKey) ? Math.max(...values) : metricKey === "m_min" ? values.reduce((a, b) => a + b, 0) / values.length : values.reduce((a, b) => a + b, 0); const sessionsUsed = profiles.reduce((a, p) => a + Number(p.sessions_used || 0), 0); return { value: viewMode === "avg" && SUM_KEYS.has(metricKey) ? value / Math.max(1, selectedSources.length) : value, source: `Perfil propio de los días`, used: `${sessionsUsed} sesiones históricas de ${selectedMds.join(", ")}` }; }
  function getRef(row, metricKey) { const key = REF_KEYS[metricKey]; if (refMode === "none" || !key) return { value: null, source: "Sin comparación", used: "" }; if (refMode === "match") return { value: compMap[row.player_id]?.[key] || null, source: "Demandas de partido", used: `${compMap[row.player_id]?.matches_used || 0} partidos +80'` }; if (refMode === "position") return positionRef(playerMap[row.player_id], metricKey); return ownRef(row, metricKey); }

  if (!selectedSourceIds.length) return <Empty text="Seleccioná una o más cargas del microciclo" />;

  return <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]"><div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 overflow-x-auto"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-bold text-white">{title}</h3><p className="text-xs text-zinc-500">{selectedSources.length} carga(s) · {trainingCount} sesión(es){matchCount ? ` + ${matchCount} partido(s)` : ""}</p></div><div className="flex flex-wrap gap-2"><div className="rounded-lg border border-zinc-700 bg-zinc-950 p-1"><button onClick={() => setViewMode("sum")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${viewMode === "sum" ? "bg-lime-400 text-zinc-950" : "text-zinc-400"}`}>Acumulado</button><button onClick={() => setViewMode("avg")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${viewMode === "avg" ? "bg-lime-400 text-zinc-950" : "text-zinc-400"}`}>Promedio por carga</button></div><select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white"><option value="all">Todas las cargas</option>{periodItems.map((s) => <option key={s.id} value={s.id}>{s.title || s.date}</option>)}</select><button onClick={() => setPanelOpen(true)} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white">Personalizar métricas</button></div></div>{rows.length === 0 ? <Empty text="GPS pendiente o sin datos válidos para calcular" /> : <table className="min-w-[1280px] w-full text-xs"><thead><tr className="border-b border-zinc-800 text-left text-zinc-500"><th className="cursor-pointer select-none py-2 hover:text-white" onClick={() => toggleSort("player_name")}>Jugador {sortKey === "player_name" ? (sortDir === "asc" ? <ArrowUp size={10} className="inline" /> : <ArrowDown size={10} className="inline" />) : <ChevronsUpDown size={10} className="inline opacity-30" />}</th><th className="cursor-pointer select-none hover:text-white" onClick={() => toggleSort("position")}>Posición {sortKey === "position" ? (sortDir === "asc" ? <ArrowUp size={10} className="inline" /> : <ArrowDown size={10} className="inline" />) : <ChevronsUpDown size={10} className="inline opacity-30" />}</th>{metrics.map((m) => <th key={m.key} className="cursor-pointer select-none px-2 py-2 hover:text-white" onClick={() => toggleSort(m.key)}>{m.label} {sortKey === m.key ? (sortDir === "asc" ? <ArrowUp size={10} className="inline" /> : <ArrowDown size={10} className="inline" />) : <ChevronsUpDown size={10} className="inline opacity-30" />}</th>)}</tr></thead><tbody>{sortedRows.map((row) => <React.Fragment key={row.player_id}><tr onClick={() => setExpanded(expanded === row.player_id ? "" : row.player_id)} className="cursor-pointer border-b border-zinc-800/70 hover:bg-zinc-950/50"><td className="py-3 pr-3"><div className="flex items-center gap-2">{expanded === row.player_id ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}<PlayerPhoto player={playerMap[row.player_id]} className="h-8 w-8 rounded-full object-cover" fallbackClassName="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800" /><span className="font-semibold text-white">{row.player_name}</span></div></td><td className="text-zinc-300">{row.position || "—"}</td>{metrics.map((m) => { const ref = getRef(row, m.key); const pct = ref.value ? (Number(row[m.key] || 0) / Number(ref.value)) * 100 : null; const titleCell = refMode === "none" ? `Actual: ${fmt(row[m.key], m.unit)}` : `Actual: ${fmt(row[m.key], m.unit)} · Referencia: ${fmt(ref.value, m.unit)} · ${ref.source} · ${ref.used}`; return <td key={m.key} className="px-2 py-3"><div title={titleCell} className={`rounded-lg px-2 py-1 font-semibold ${lightClass(pct, refMode)}`}>{fmt(row[m.key], m.unit)}{refMode !== "none" && <span className="ml-1 text-[10px] opacity-80">{pct ? `${Math.round(pct)}%` : "Sin ref."}</span>}</div></td>; })}</tr>{expanded === row.player_id && <tr className="border-b border-zinc-800 bg-zinc-950/60"><td colSpan={metrics.length + 2} className="p-4"><DetailTable row={row} /></td></tr>}</React.Fragment>)}</tbody></table>}</div><aside className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><h3 className="text-sm font-bold text-white">Referencia de comparación</h3><div className="space-y-2 text-sm">{[["none","Sin comparación"],["own","Perfil propio de los días"],["match","Demandas de partido"],["position","Posición"]].map(([id,label]) => <button key={id} onClick={() => setRefMode(id)} className={`w-full rounded-xl border px-3 py-2 text-left ${refMode === id ? "border-lime-400 bg-lime-500/10 text-lime-200" : "border-zinc-700 bg-zinc-950 text-zinc-300"}`}>{label}</button>)}</div><p className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-500">Los colores representan diferencia respecto de la referencia, no riesgo de lesión.</p><div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300"><p className="font-semibold text-white">Datos del período</p><p>{selectedSources.length} carga(s) · {trainingCount} sesiones{matchCount ? ` + ${matchCount} partido` : ""}</p></div></aside>{panelOpen && <MetricPanel groups={groups} onSave={saveConfig} onClose={() => setPanelOpen(false)} />}</div>;
}

function aggregateRows(items, gpsByItem, playerMap, metrics, selectedSourceCount, viewMode) {
  const map = {};
  items.forEach((item) => {
    (gpsByItem[item.id] || []).filter(validRow).forEach((r) => {
      const player = playerMap[r.player_id] || {};
      const entry = map[r.player_id] || { player_id: r.player_id, player_name: r.player_name || player.full_name || "Jugador", position: player.position || r.position || "", values: {}, details: [], sourceIds: new Set(), gpsDates: new Set(), sourcesWithGps: new Set() };
      const duration = rowDuration(r);
      entry.sourceIds.add(item.id);
      entry.gpsDates.add(item.date);
      entry.sourcesWithGps.add(item.id);
      entry.durationTotal = Number(entry.durationTotal || 0) + duration;
      entry.distanceTotal = Number(entry.distanceTotal || 0) + Number(r.total_distance || 0);
      entry.playerLoadTotal = Number(entry.playerLoadTotal || 0) + Number(r.player_load || 0);
      metrics.forEach((m) => { const value = metricValueFromRow(r, m.key); if (Number.isFinite(value)) entry.values[m.key] = [...(entry.values[m.key] || []), value]; });
      entry.details.push({ ...r, session_title: r.session_title || item.title || "Carga", session_date: r.session_date || item.date, md: r.md || item.md || item.match_day_code || item.microcycle_day || "—", duration_minutes: duration });
      map[r.player_id] = entry;
    });
  });
  return Object.values(map).map((item) => {
    const out = { ...item, sessions_count: item.sourceIds.size, gps_days: item.gpsDates.size, days_without_data: Math.max(0, selectedSourceCount - item.sourcesWithGps.size), duration_minutes: item.durationTotal || null };
    metrics.forEach((m) => {
      const vals = item.values[m.key] || [];
      if (m.key === "m_min") out[m.key] = item.durationTotal ? item.distanceTotal / item.durationTotal : null;
      else if (m.key === "player_load_per_min") out[m.key] = item.durationTotal ? item.playerLoadTotal / item.durationTotal : null;
      else if (m.key === "duration_minutes") out[m.key] = item.durationTotal || null;
      else if (m.key === "sessions_count") out[m.key] = item.sourceIds.size;
      else if (m.key === "gps_days") out[m.key] = item.gpsDates.size;
      else if (m.key === "days_without_data") out[m.key] = Math.max(0, selectedSourceCount - item.sourcesWithGps.size);
      else if (vals.length) out[m.key] = MAX_KEYS.has(m.key) || m.mode === "max" ? Math.max(...vals) : SUM_KEYS.has(m.key) ? vals.reduce((a, b) => a + b, 0) : vals.reduce((a, b) => a + b, 0) / vals.length;
      if (viewMode === "avg" && SUM_KEYS.has(m.key) && item.sourceIds.size) out[m.key] = out[m.key] / item.sourceIds.size;
    });
    return out;
  });
}
function Empty({ text }) { return <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/60 px-4 py-8 text-center text-sm text-zinc-500">{text}</div>; }
function DetailTable({ row }) { const total = row.details.reduce((acc, r) => ({ total_distance: acc.total_distance + Number(r.total_distance || 0), player_load: acc.player_load + Number(r.player_load || 0), distance_25: acc.distance_25 + Number(r.distance_25 || 0), sprints: acc.sprints + Number(r.sprints || 0), smax: Math.max(acc.smax, Number(r.smax || 0)) }), { total_distance: 0, player_load: 0, distance_25: 0, sprints: 0, smax: 0 }); return <div><p className="mb-3 text-sm font-bold text-white">{row.player_name} · detalle acumulado</p><table className="w-full min-w-[760px] text-xs"><thead><tr className="text-left text-zinc-500"><th>Carga</th><th>Fecha</th><th>Distancia</th><th>Player Load</th><th>D+25</th><th>Sprints</th><th>Vel. máxima</th></tr></thead><tbody>{row.details.map((d, index) => <tr key={`${d.session_id || d.match_id}-${index}`} className="border-t border-zinc-800"><td className="py-2 text-zinc-300">{d.md} · {d.session_title}</td><td className="text-zinc-300">{moment(d.session_date).locale("es").format("dddd")}</td><td>{fmt(d.total_distance, "m")}</td><td>{fmt(d.player_load)}</td><td>{fmt(d.distance_25, "m")}</td><td>{fmt(d.sprints)}</td><td>{fmt(d.smax, "km/h")}</td></tr>)}<tr className="border-t border-lime-500/30 font-bold text-white"><td className="py-2">Total</td><td /> <td>{fmt(total.total_distance, "m")}</td><td>{fmt(total.player_load)}</td><td>{fmt(total.distance_25, "m")}</td><td>{fmt(total.sprints)}</td><td>{fmt(total.smax, "km/h")}</td></tr></tbody></table></div>; }
function MetricPanel({ groups, onSave, onClose }) {
  const [draft, setDraft] = useState(groups);
  const toggle = (groupId, metric) => setDraft((current) => current.map((g) => g.id !== groupId ? g : { ...g, metrics: g.metrics.some((m) => m.key === metric.key) ? g.metrics.filter((m) => m.key !== metric.key) : [...g.metrics, metric] }));
  const move = (groupId, index, dir) => setDraft((current) => current.map((g) => { if (g.id !== groupId) return g; const metrics = [...g.metrics]; const target = index + dir; if (target < 0 || target >= metrics.length) return g; [metrics[index], metrics[target]] = [metrics[target], metrics[index]]; return { ...g, metrics }; }));
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="max-h-[86vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-5"><div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold text-white">Personalizar métricas</h3><button onClick={onClose} className="text-sm text-zinc-400">Cerrar</button></div><div className="space-y-4">{draft.map((g) => <div key={g.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"><p className="mb-2 text-sm font-bold text-white">{g.label}</p><div className="mb-3 space-y-1">{g.metrics.map((m, index) => <div key={m.key} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200"><span>{m.label}</span><span className="flex gap-1"><button onClick={() => move(g.id, index, -1)} className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-400">↑</button><button onClick={() => move(g.id, index, 1)} className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-400">↓</button></span></div>)}</div><div className="flex flex-wrap gap-2">{[...DEFAULT_GROUPS.find((d) => d.id === g.id).metrics, ...OPTIONAL].map((m) => <button key={m.key} onClick={() => toggle(g.id, m)} className={`rounded-lg border px-3 py-1.5 text-xs ${g.metrics.some((x) => x.key === m.key) ? "border-lime-400 bg-lime-500/10 text-lime-200" : "border-zinc-700 text-zinc-400"}`}>{m.label}</button>)}</div></div>)}</div><div className="mt-4 flex justify-end gap-2"><button onClick={() => setDraft(DEFAULT_GROUPS)} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300">Restaurar predeterminada</button><button onClick={() => { onSave(draft); onClose(); }} className="rounded-lg bg-lime-500 px-3 py-2 text-sm font-bold text-zinc-950">Guardar configuración</button></div></div></div>;
}