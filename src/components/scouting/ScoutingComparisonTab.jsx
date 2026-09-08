import React, { useState } from "react";
import { GitCompareArrows, Loader2, Plus, X } from "lucide-react";
import { scoutingGateway } from "@/lib/scoutingApi";
import { fmtMoney, RECOMMENDATION_LABEL } from "./scoutingConstants";

const SCORE_LABELS = { technical: "Técnico", tactical: "Táctico", physical: "Físico", mental: "Mental", market: "Mercado" };

function Selector({ label, options, selected, onAdd, kind }) {
  const [value, setValue] = useState("");
  const available = options.filter((item) => !selected.includes(item.id));
  return <div className="space-y-1.5"><label className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</label><div className="flex gap-2"><select value={value} onChange={(e) => setValue(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white"><option value="">Seleccionar…</option>{available.map((item) => <option key={item.id} value={item.id}>{kind === "player" ? item.full_name : `${item.full_name} · ${item.current_club_name || "Sin club"}`}</option>)}</select><button type="button" onClick={() => { if (!value) return; onAdd(value); setValue(""); }} className="px-3 rounded-lg border border-zinc-700 text-zinc-300 hover:text-white"><Plus size={14}/></button></div></div>;
}

function Chips({ ids, options, onRemove, kind }) {
  return <div className="flex flex-wrap gap-1.5">{ids.map((id) => { const item = options.find((x) => x.id === id); if (!item) return null; return <span key={id} className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[10px] text-zinc-300">{kind === "player" ? item.full_name : item.full_name}<button onClick={() => onRemove(id)}><X size={10}/></button></span>; })}</div>;
}

function ScoreGrid({ report }) {
  if (!report) return <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-600">Sin informe estructurado</div>;
  return <div className="grid grid-cols-5 gap-1.5">{Object.entries(SCORE_LABELS).map(([key, label]) => <div key={key} className="rounded-lg bg-zinc-950 p-2 text-center"><p className="text-[9px] text-zinc-600">{label}</p><p className="text-sm font-bold text-white mt-0.5">{report.category_scores?.[key] ?? "—"}<span className="text-[9px] text-zinc-600">/10</span></p></div>)}</div>;
}

export default function ScoutingComparisonTab({ prospects, players }) {
  const [prospectIds, setProspectIds] = useState([]);
  const [playerIds, setPlayerIds] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function compare() {
    setLoading(true); setError("");
    try { setResult(await scoutingGateway("comparison", { prospect_ids: prospectIds, current_player_ids: playerIds })); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return <div className="space-y-4">
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap"><div><h3 className="text-sm font-bold text-white flex items-center gap-2"><GitCompareArrows size={16} className="text-amber-400"/> Comparador de candidatos</h3><p className="text-xs text-zinc-600 mt-1">Compara hasta 5 prospectos y hasta 3 jugadores actuales como referencia. No convierte métricas internas en un score de scouting.</p></div><button disabled={loading || (!prospectIds.length && !playerIds.length)} onClick={compare} className="px-4 py-2 rounded-lg bg-white text-zinc-950 text-sm font-bold disabled:opacity-40">{loading ? <Loader2 size={14} className="animate-spin"/> : "Comparar"}</button></div>
      <div className="grid md:grid-cols-2 gap-4 mt-4"><div><Selector label="Prospectos" options={prospects} selected={prospectIds} onAdd={(id) => setProspectIds((v) => v.length < 5 ? [...v, id] : v)} /><div className="mt-2"><Chips ids={prospectIds} options={prospects} onRemove={(id) => setProspectIds((v) => v.filter((x) => x !== id))}/></div></div><div><Selector label="Jugadores actuales de referencia" options={players} selected={playerIds} kind="player" onAdd={(id) => setPlayerIds((v) => v.length < 3 ? [...v, id] : v)} /><div className="mt-2"><Chips ids={playerIds} options={players} kind="player" onRemove={(id) => setPlayerIds((v) => v.filter((x) => x !== id))}/></div></div></div>
    </div>
    {error && <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-300">{error}</div>}
    {result && <>
      <div className="grid xl:grid-cols-2 gap-4">{result.prospects?.map(({ prospect, latest_report: report, report_count }) => <div key={prospect.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-base font-bold text-white">{prospect.full_name}</p><p className="text-xs text-zinc-500">{prospect.position || "—"} · {prospect.current_club_name || "Sin club"}</p></div><div className="text-right"><p className="text-xs font-bold text-amber-300">{report?.fit_score != null ? `${Math.round(report.fit_score)}% fit` : "Sin fit"}</p><p className="text-[10px] text-zinc-600">{report_count} informe(s)</p></div></div><div className="mt-3"><ScoreGrid report={report}/></div><div className="grid grid-cols-2 gap-2 mt-3 text-xs"><div className="rounded-lg bg-zinc-950 p-2"><p className="text-[9px] text-zinc-600">Recomendación</p><p className="text-zinc-300 mt-0.5">{report ? RECOMMENDATION_LABEL[report.recommendation] || report.recommendation : "—"}</p></div><div className="rounded-lg bg-zinc-950 p-2"><p className="text-[9px] text-zinc-600">Valor estimado</p><p className="text-zinc-300 mt-0.5">{fmtMoney(prospect.market_value_estimate, prospect.market_value_currency)}</p></div></div>{report?.summary && <p className="text-xs text-zinc-500 mt-3">{report.summary}</p>}</div>)}</div>
      {!!result.current_players?.length && <div><p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Referencia interna real</p><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{result.current_players.map(({ player, competition_profile: cp, training_profile: tp, minutes_summary: mins }) => <div key={player.id} className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4"><p className="text-sm font-bold text-white">{player.full_name}</p><p className="text-xs text-zinc-500">{player.position || "—"} · Plantel actual</p><div className="grid grid-cols-2 gap-2 mt-3 text-xs"><Metric label="Minutos registrados" value={mins?.total_minutes ?? 0}/><Metric label="Partidos con minutos" value={mins?.matches ?? 0}/><Metric label="m/min partido" value={cp?.avg_m_min != null ? Math.round(cp.avg_m_min) : "—"}/><Metric label="Smax partido" value={cp?.avg_smax != null ? `${Number(cp.avg_smax).toFixed(1)} km/h` : "—"}/><Metric label="DT partido" value={cp?.avg_total_distance != null ? `${Math.round(cp.avg_total_distance)} m` : "—"}/><Metric label="D+25 partido" value={cp?.avg_distance_25 != null ? `${Math.round(cp.avg_distance_25)} m` : "—"}/><Metric label="Sesiones GPS" value={tp?.total_sessions ?? "—"}/><Metric label="Smax entrenamiento" value={tp?.max_smax != null ? `${Number(tp.max_smax).toFixed(1)} km/h` : "—"}/></div></div>)}</div></div>}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[11px] text-zinc-600"><strong className="text-zinc-400">Metodología:</strong> {result.methodology?.scouting_scores} {result.methodology?.current_player_data}</div>
    </>}
  </div>;
}

function Metric({ label, value }) { return <div className="rounded-lg bg-zinc-950/70 p-2"><p className="text-[9px] text-zinc-600">{label}</p><p className="text-zinc-200 font-semibold mt-0.5">{value}</p></div>; }
