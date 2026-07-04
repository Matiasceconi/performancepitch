import React from "react";
import { Activity, Upload, ChevronDown } from "lucide-react";

export default function GpsDashboardHeader({
  squads, selectedSquadId, onSquadChange,
  seasons, selectedSeason, onSeasonChange,
  onImport,
}) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <Activity size={20} className="text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Carga Externa / GPS</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Análisis y monitoreo de la carga externa por sesión.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onImport}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Upload size={15} /> Cargar archivo GPS
        </button>

        <div className="relative">
          <select
            value={selectedSquadId || ""}
            onChange={(e) => onSquadChange(e.target.value)}
            className="appearance-none bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:border-emerald-600"
          >
            {squads.map((s) => (
              <option key={s.id} value={s.id} className="bg-zinc-900">{s.name}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={selectedSeason || ""}
            onChange={(e) => onSeasonChange(e.target.value)}
            className="appearance-none bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:border-emerald-600"
          >
            {seasons.map((s) => (
              <option key={s} value={s} className="bg-zinc-900">{s}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}