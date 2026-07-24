import React from "react";
import RivalClubPicker from "@/components/clubs/RivalClubPicker";

const STAGES = ["Fase regular", "Fase de grupos", "Octavos de final", "Cuartos de final", "Semifinal", "Final", "Tercer puesto", "Amistoso"];

export default function MatchFiltersPanel({ filters, setFilters, activeSquad, activeSeasonId, competitions, matches, clubs }) {
  const set = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const matchdays = Array.from(new Set(matches.map((m) => m.matchday_number).filter((value) => value !== undefined && value !== null))).sort((a, b) => Number(a) - Number(b));
  const stages = Array.from(new Set([...STAGES, ...matches.map((m) => m.competition_stage).filter(Boolean)]));
  const seasons = Array.from(new Set([activeSeasonId, ...matches.map((m) => m.season_id).filter(Boolean)].filter(Boolean)));

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-2">
      <div>
        <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 block">Plantel</label>
        <select value={filters.squad_id || activeSquad?.id || ""} onChange={(e) => set("squad_id", e.target.value)} className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-inner shadow-black/30">
          {activeSquad && <option value={activeSquad.id}>{activeSquad.name}</option>}
        </select>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 block">Temporada</label>
        <select value={filters.season_id || ""} onChange={(e) => set("season_id", e.target.value)} className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-inner shadow-black/30">
          <option value="">Todas</option>
          {seasons.map((season) => <option key={season} value={season}>{season}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 block">Competencia</label>
        <select value={filters.competition_id || ""} onChange={(e) => set("competition_id", e.target.value)} className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-inner shadow-black/30">
          <option value="">Todas</option>
          {competitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.short_name || competition.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 block">Fase / instancia</label>
        <select value={filters.competition_stage || ""} onChange={(e) => set("competition_stage", e.target.value)} className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-inner shadow-black/30">
          <option value="">Todas</option>
          {stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 block">Fecha / jornada</label>
        <select value={filters.matchday_number || ""} onChange={(e) => set("matchday_number", e.target.value)} className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-inner shadow-black/30">
          <option value="">Todas</option>
          {matchdays.map((number) => <option key={number} value={number}>Fecha {number}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 block">Condición</label>
        <select value={filters.location || ""} onChange={(e) => set("location", e.target.value)} className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-inner shadow-black/30">
          <option value="">Todas</option><option value="Local">Local</option><option value="Visitante">Visitante</option><option value="Neutral">Neutral</option>
        </select>
      </div>
      <div className="md:col-span-2 xl:col-span-1">
        <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 block">Rival</label>
        <RivalClubPicker
          clubs={clubs}
          filterMode
          allowClear
          placeholder="Todos los rivales"
          selectedClubId={filters.rival_club_id || ""}
          onSelect={(_, patch) => setFilters((current) => ({ ...current, rival: patch.rival, rival_club_id: patch.rival_club_id }))}
          onClear={() => setFilters((current) => ({ ...current, rival: "", rival_club_id: "" }))}
        />
      </div>
      <div className="flex items-end">
        <button onClick={() => setFilters({ squad_id: activeSquad?.id || "" })} className="w-full h-[38px] rounded-lg border border-zinc-800 bg-zinc-950/60 text-xs text-zinc-400 hover:text-white hover:bg-zinc-900">Limpiar filtros</button>
      </div>
    </div>
  );
}