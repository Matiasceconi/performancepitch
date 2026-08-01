import React from "react";

export default function ClubStandingsTable({ standings, highlightTeam }) {
  const rows = (standings || []).slice().sort((a, b) => a.position - b.position);
  if (!rows.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
        <p className="text-zinc-500 text-sm">No hay datos de tabla disponibles.</p>
      </div>
    );
  }
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-zinc-500 text-xs uppercase bg-zinc-900">
              <th className="text-center p-2.5 font-semibold w-10">#</th>
              <th className="text-left p-2.5 font-semibold">Equipo</th>
              <th className="text-center p-2.5 font-semibold">PJ</th>
              <th className="text-center p-2.5 font-semibold hidden sm:table-cell">G</th>
              <th className="text-center p-2.5 font-semibold hidden sm:table-cell">E</th>
              <th className="text-center p-2.5 font-semibold hidden sm:table-cell">P</th>
              <th className="text-center p-2.5 font-semibold hidden md:table-cell">GF</th>
              <th className="text-center p-2.5 font-semibold hidden md:table-cell">GC</th>
              <th className="text-center p-2.5 font-semibold hidden md:table-cell">DG</th>
              <th className="text-center p-2.5 font-semibold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isHL = r.teamName === highlightTeam;
              return (
                <tr key={`${r.teamName}-${r.position}`} className={`border-t border-zinc-800/60 ${isHL ? "bg-emerald-500/10 border-l-2 border-emerald-500" : "border-l-2 border-transparent"}`}>
                  <td className="text-center p-2.5 text-zinc-400 font-medium">{r.position}</td>
                  <td className="p-2.5">
                    <div className="flex items-center gap-2">
                      {r.teamLogo ? <img src={r.teamLogo} alt="" className="w-5 h-5 object-contain shrink-0" onError={(e) => { e.target.style.display = "none"; }} /> : <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 text-[10px] font-bold text-zinc-400">{(r.teamName || "?").charAt(0)}</div>}
                      <span className={`truncate ${isHL ? "text-emerald-300 font-bold" : "text-white font-medium"}`}>{r.teamName}</span>
                    </div>
                  </td>
                  <td className="text-center p-2.5 text-zinc-300">{r.played}</td>
                  <td className="text-center p-2.5 text-zinc-300 hidden sm:table-cell">{r.won}</td>
                  <td className="text-center p-2.5 text-zinc-300 hidden sm:table-cell">{r.drawn}</td>
                  <td className="text-center p-2.5 text-zinc-300 hidden sm:table-cell">{r.lost}</td>
                  <td className="text-center p-2.5 text-zinc-400 hidden md:table-cell">{r.goalsFor}</td>
                  <td className="text-center p-2.5 text-zinc-400 hidden md:table-cell">{r.goalsAgainst}</td>
                  <td className="text-center p-2.5 text-zinc-400 hidden md:table-cell">{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</td>
                  <td className="text-center p-2.5"><span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md font-bold ${isHL ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-white"}`}>{r.points}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}