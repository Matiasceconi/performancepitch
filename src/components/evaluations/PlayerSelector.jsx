import React, { useState, useMemo } from "react";
import { Search, ChevronUp, ChevronDown, AlertTriangle, Link2Off } from "lucide-react";
import PlayerPhoto from "@/components/player/PlayerPhoto";
import { fmtDate } from "@/lib/evaluationChartUtils";

export default function PlayerSelector({ players, selectedId, onSelect, onPrev, onNext, hasPrev, hasNext }) {
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [testFilter, setTestFilter] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [sortBy, setSortBy] = useState("last_eval");

  const positions = useMemo(() => [...new Set(players.map((p) => p.position).filter(Boolean))].sort(), [players]);
  const allTests = useMemo(() => [...new Set(players.flatMap((p) => p.tests || []))].sort(), [players]);

  const filtered = useMemo(() => {
    let list = [...players];
    if (search) list = list.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    if (posFilter) list = list.filter((p) => p.position === posFilter);
    if (testFilter) list = list.filter((p) => (p.tests || []).includes(testFilter));
    if (onlyPending) list = list.filter((p) => p.pendingCount > 0);
    list.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return (b.lastDate || "").localeCompare(a.lastDate || "");
    });
    return list;
  }, [players, search, posFilter, testFilter, onlyPending, sortBy]);

  return (
    <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Filters */}
      <div className="p-3 border-b border-zinc-800 space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar jugador..." className="w-full pl-8 pr-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white" />
        </div>
        <div className="flex gap-1.5">
          <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white">
            <option value="">Todas pos.</option>
            {positions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={testFilter} onChange={(e) => setTestFilter(e.target.value)} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white">
            <option value="">Toda prueba</option>
            {allTests.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} className="accent-orange-500" />
            Solo con revisión
          </label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white">
            <option value="last_eval">Última eval.</option>
            <option value="name">Nombre</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((p) => {
          const isActive = p.id === selectedId;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`w-full flex items-center gap-2.5 p-2.5 border-b border-zinc-800/50 text-left transition-colors ${isActive ? "bg-blue-500/10 border-l-2 border-l-blue-400" : "hover:bg-zinc-800/30 border-l-2 border-l-transparent"}`}
            >
              {p.linked ? (
                <PlayerPhoto player={{ photo_url: p.photoUrl, full_name: p.name }} className="w-9 h-9 rounded-full object-cover border border-zinc-700 shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
                  <Link2Off size={14} className="text-red-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{p.name}</p>
                <p className="text-xs text-zinc-500 truncate">{p.position || "—"} · {p.tests?.length || 0} pruebas</p>
              </div>
              <div className="flex flex-col items-end shrink-0">
                {p.pendingCount > 0 && <AlertTriangle size={12} className="text-orange-400 mb-0.5" />}
                <span className="text-xs text-zinc-500">{p.lastDate ? fmtDate(p.lastDate, true) : "—"}</span>
              </div>
            </button>
          );
        })}
        {!filtered.length && <p className="text-zinc-500 text-xs text-center py-8">Sin resultados</p>}
      </div>

      {/* Nav buttons */}
      <div className="flex items-center justify-between p-2 border-t border-zinc-800">
        <button onClick={onPrev} disabled={!hasPrev} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 disabled:opacity-30"><ChevronUp size={16} /></button>
        <span className="text-xs text-zinc-500">{filtered.length} jugador(es)</span>
        <button onClick={onNext} disabled={!hasNext} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 disabled:opacity-30"><ChevronDown size={16} /></button>
      </div>
    </div>
  );
}