import React, { useMemo, useState } from "react";
import moment from "moment";
import { Search } from "lucide-react";

export default function GpsMicrocycleHistoryPanel({ summaries, selectedSummaryId, onSelect }) {
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [season, setSeason] = useState("");
  const seasons = useMemo(() => [...new Set((summaries || []).map((s) => s.season_id).filter(Boolean))].sort().reverse(), [summaries]);
  const filtered = useMemo(() => (summaries || []).filter((s) => {
    const text = `${s.nombre_microciclo || ""} ${s.microcycle_name || ""} ${s.rival || ""} ${s.partido_asociado || ""}`.toLowerCase();
    if (query && !text.includes(query.toLowerCase())) return false;
    if (season && s.season_id !== season) return false;
    if (dateFrom && s.fecha_fin < dateFrom) return false;
    if (dateTo && s.fecha_inicio > dateTo) return false;
    return true;
  }), [summaries, query, season, dateFrom, dateTo]);

  return <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3"><div><h3 className="text-white font-bold text-lg">Historial de microciclos</h3><p className="text-zinc-500 text-sm">Buscá por fecha, número/nombre, rival, temporada o rango y abrí el resumen guardado.</p></div><div className="grid grid-cols-1 md:grid-cols-5 gap-2"><label className="md:col-span-2 relative"><Search size={14} className="absolute left-3 top-3 text-zinc-500" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Microciclo o rival..." className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white" /></label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white" /><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white" /><select value={season} onChange={(e) => setSeason(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"><option value="">Todas las temporadas</option>{seasons.map((s) => <option key={s} value={s}>{s}</option>)}</select></div><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 max-h-72 overflow-y-auto">{filtered.map((s) => <button key={s.id} onClick={() => onSelect(s.id)} className={`text-left rounded-xl border p-3 transition-colors ${selectedSummaryId === s.id ? "bg-emerald-500/10 border-emerald-500/40" : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"}`}><p className="text-white text-sm font-bold truncate">{s.nombre_microciclo || s.microcycle_name || "Microciclo"}</p><p className="text-xs text-zinc-500">{moment(s.fecha_inicio).format("DD/MM/YYYY")} - {moment(s.fecha_fin).format("DD/MM/YYYY")}</p><p className="text-xs text-zinc-400 mt-1">{s.rival || s.partido_asociado || "Sin rival"} · {s.season_id || "—"}</p></button>)}{!filtered.length && <p className="text-sm text-zinc-500 p-3">No hay microciclos guardados con esos filtros.</p>}</div></div>;
}