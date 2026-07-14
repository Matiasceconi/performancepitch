import React from "react";
import { Activity, ChevronDown } from "lucide-react";

export default function GpsDashboardHeader({
  squads, selectedSquadId, onSquadChange,
  seasons, selectedSeason, onSeasonChange,
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/10 shadow-[0_0_24px_rgba(16,185,129,0.12)]">
          <Activity size={24} className="text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight text-white">Carga Externa / GPS</h1>
          <p className="mt-1 text-sm text-zinc-500">Análisis y monitoreo de la carga externa por sesión.</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <select
            value={selectedSquadId || ""}
            onChange={(e) => onSquadChange(e.target.value)}
            className="h-10 min-w-[126px] appearance-none rounded-xl border border-zinc-700/80 bg-zinc-900/90 pl-3 pr-9 text-sm text-white shadow-inner outline-none transition focus:border-emerald-500"
          >
            {squads.map((s) => (
              <option key={s.id} value={s.id} className="bg-zinc-900">{s.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        </div>

        <div className="relative">
          <select
            value={selectedSeason || ""}
            onChange={(e) => onSeasonChange(e.target.value)}
            className="h-10 min-w-[78px] appearance-none rounded-xl border border-zinc-700/80 bg-zinc-900/90 pl-3 pr-9 text-sm text-white shadow-inner outline-none transition focus:border-emerald-500"
          >
            {seasons.map((s) => (
              <option key={s} value={s} className="bg-zinc-900">{s}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        </div>
      </div>
    </div>
  );
}