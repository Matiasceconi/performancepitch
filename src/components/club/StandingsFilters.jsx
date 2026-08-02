import React from "react";
import { DIVISIONS } from "@/lib/standingsContextResolver";

/**
 * Filtros de standings con selector principal de división (Primera/Reserva/Juveniles)
 * y filtros secundarios de torneo y zona.
 */
export default function StandingsFilters({
  divisions = DIVISIONS,
  activeDivision,
  onDivision,
  tournaments = [],
  zones = [],
  activeTournament,
  activeZone,
  onTournament,
  onZone,
}) {
  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Selector principal de división */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wide hidden sm:inline">División</span>
        {divisions.map((d) => (
          <button
            key={d.id}
            onClick={() => onDivision(d.id)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              activeDivision === d.id
                ? "bg-emerald-500 text-zinc-950"
                : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
            }`}
          >
            {d.shortLabel || d.label}
          </button>
        ))}
      </div>

      {/* Filtros secundarios: torneo y zona */}
      {(tournaments.length > 0 || zones.length > 0) && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {tournaments.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wide hidden sm:inline">Torneo</span>
              {tournaments.map((t) => (
                <button
                  key={t}
                  onClick={() => onTournament(t)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                    activeTournament === t ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          {zones.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wide hidden sm:inline">Zona</span>
              {zones.map((z) => (
                <button
                  key={z}
                  onClick={() => onZone(z)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                    activeZone === z ? "bg-white text-zinc-950" : "bg-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}