import React from "react";
import { Search, X } from "lucide-react";
import { SESSION_MD_CODES } from "@/components/planning/microcycleSync";

const TYPES = ["Campo", "Fuerza", "Regenerativo", "Activación", "Partido reducido", "Mixto", "Otro"];
const MD_CODES = SESSION_MD_CODES;

export const DEFAULT_FILTERS = {
  search: "", dateFrom: "", dateTo: "", type: "", md: "",
  minPlayers: "", gps: "todos", video: "todos", sort: "recientes",
};

function hasActiveFilters(f) {
  return Object.entries(f).some(([k, v]) => k !== "sort" && v !== "" && v !== "todos");
}

export default function SessionFilters({ filters, onChange }) {
  function set(key, val) { onChange({ ...filters, [key]: val }); }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={filters.search} onChange={e => set("search", e.target.value)}
          placeholder="Buscar sesión..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-600" />
      </div>

      {/* Quick filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={filters.dateFrom} onChange={e => set("dateFrom", e.target.value)}
          title="Desde"
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-600" />
        <input type="date" value={filters.dateTo} onChange={e => set("dateTo", e.target.value)}
          title="Hasta"
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-600" />

        <select value={filters.type} onChange={e => set("type", e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-600">
          <option value="">Todos los tipos</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={filters.md} onChange={e => set("md", e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-600">
          <option value="">Todos los MD</option>
          {MD_CODES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <input type="number" min={0} value={filters.minPlayers} onChange={e => set("minPlayers", e.target.value)}
          placeholder="Mín. jugadores"
          className="w-28 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-600" />

        <select value={filters.gps} onChange={e => set("gps", e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-600">
          <option value="todos">GPS: todos</option>
          <option value="con">Con GPS</option>
          <option value="sin">Sin GPS</option>
        </select>

        <select value={filters.video} onChange={e => set("video", e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-600">
          <option value="todos">Video: todos</option>
          <option value="con">Con video</option>
          <option value="sin">Sin video</option>
        </select>

        <select value={filters.sort} onChange={e => set("sort", e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-600">
          <option value="recientes">Más recientes primero</option>
          <option value="antiguas">Más antiguas primero</option>
          <option value="duracion">Por duración</option>
          <option value="jugadores">Por cantidad de jugadores</option>
        </select>

        {hasActiveFilters(filters) && (
          <button onClick={() => onChange(DEFAULT_FILTERS)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white text-xs transition-colors">
            <X size={12} /> Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}