import React from "react";
import { Pin, RotateCcw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function MinutesFiltersRow({
  filters,
  filtersPinned,
  updateFilter,
  toggleFiltersPinned,
  resetFilters,
  squadOptions,
  seasonOptions,
  competitionOptions,
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <FilterSelect label="Plantel" value={filters.squadId} onChange={(value) => updateFilter("squadId", value)} options={squadOptions} />
        <FilterSelect label="Temporada" value={filters.seasonId} onChange={(value) => updateFilter("seasonId", value)} options={seasonOptions} />
        <FilterSelect label="Competencia" value={filters.competitionId} onChange={(value) => updateFilter("competitionId", value)} options={competitionOptions} />
        <FilterSelect label="Tipo de partido" value={filters.matchType} onChange={(value) => updateFilter("matchType", value)} options={[{ value: "all", label: "Todos" }, { value: "oficial", label: "Oficiales" }, { value: "amistoso", label: "Amistosos" }]} />
        <FilterSelect label="Rango de fechas" value={filters.dateRange} onChange={(value) => updateFilter("dateRange", value)} options={[{ value: "season", label: "Toda la temporada" }, { value: "last5", label: "Últimos 5 partidos" }, { value: "last10", label: "Últimos 10 partidos" }, { value: "custom", label: "Rango personalizado" }]} />
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400">Buscar jugador</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="Buscar jugador" className="h-10 border-zinc-700 bg-zinc-950 pl-9 text-white" />
          </div>
        </div>
      </div>
      {filters.dateRange === "custom" && (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <DateInput label="Desde" value={filters.dateFrom} onChange={(value) => updateFilter("dateFrom", value)} />
          <DateInput label="Hasta" value={filters.dateTo} onChange={(value) => updateFilter("dateTo", value)} />
          <FilterActions filtersPinned={filtersPinned} onTogglePinned={toggleFiltersPinned} onReset={resetFilters} className="items-end justify-start md:justify-end" />
        </div>
      )}
      {filters.dateRange !== "custom" && (
        <FilterActions filtersPinned={filtersPinned} onTogglePinned={toggleFiltersPinned} onReset={resetFilters} className="mt-3 justify-end" />
      )}
    </div>
  );
}

function FilterActions({ filtersPinned, onTogglePinned, onReset, className = "" }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <button
        type="button"
        onClick={onTogglePinned}
        aria-pressed={filtersPinned}
        title={filtersPinned ? "Dejar de recordar estos filtros" : "Recordar estos filtros al volver a la página"}
        className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition ${
          filtersPinned
            ? "border-yellow-500/40 bg-yellow-500/15 text-yellow-200 hover:bg-yellow-500/25"
            : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-800 hover:text-white"
        }`}
      >
        <Pin size={14} className={filtersPinned ? "fill-current" : ""} />
        {filtersPinned ? "Filtros fijados" : "Fijar filtros"}
      </button>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
      >
        <RotateCcw size={14} /> Limpiar filtros
      </button>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-400">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-yellow-500">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function DateInput({ label, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-400">{label}</label>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-yellow-500" />
    </div>
  );
}
