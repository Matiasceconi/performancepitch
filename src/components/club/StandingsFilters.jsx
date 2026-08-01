import React from "react";

export default function StandingsFilters({ tournaments, zones, activeTournament, activeZone, onTournament, onZone }) {
  if (!tournaments.length && !zones.length) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      {tournaments.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {tournaments.map((t) => (
            <button key={t} onClick={() => onTournament(t)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${activeTournament === t ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}>{t}</button>
          ))}
        </div>
      )}
      {zones.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {zones.map((z) => (
            <button key={z} onClick={() => onZone(z)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${activeZone === z ? "bg-white text-zinc-950" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}>{z}</button>
          ))}
        </div>
      )}
    </div>
  );
}