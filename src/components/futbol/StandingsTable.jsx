import React from "react";

function FormDots({ form }) {
  if (!form) return <span className="text-zinc-600 text-xs">—</span>;
  const chars = form.slice(-5).split("");
  const colorMap = { W: "bg-emerald-500", D: "bg-zinc-500", L: "bg-red-500" };
  return (
    <div className="flex items-center gap-1">
      {chars.map((c, i) => (
        <span key={i} className={`w-2 h-2 rounded-full ${colorMap[c] || "bg-zinc-600"}`} title={c === "W" ? "Ganó" : c === "D" ? "Empató" : "Perdió"} />
      ))}
    </div>
  );
}

function zoneClass(position, total) {
  if (position <= 6) return "bg-emerald-500/[0.06] border-l-2 border-emerald-500/40";
  if (position <= 12) return "bg-blue-500/[0.06] border-l-2 border-blue-500/40";
  if (position > total - 3) return "bg-red-500/[0.06] border-l-2 border-red-500/40";
  return "border-l-2 border-transparent";
}

export default function StandingsTable({ standings, competitionName }) {
  const rows = (standings || []).slice().sort((a, b) => a.position - b.position);
  if (!rows.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
        <p className="text-zinc-500 text-sm">No hay datos de tabla de posiciones disponibles.</p>
      </div>
    );
  }
  const total = rows.length;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-b border-zinc-800 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40" /> Copa Libertadores</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500/40" /> Copa Sudamericana</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/40" /> Descenso</span>
      </div>

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
              <th className="text-center p-2.5 font-semibold hidden md:table-cell">DIF</th>
              <th className="text-center p-2.5 font-semibold">PTS</th>
              <th className="text-center p-2.5 font-semibold hidden lg:table-cell">Forma</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.teamName}-${r.position}`} className={`border-t border-zinc-800/60 ${zoneClass(r.position, total)}`}>
                <td className="text-center p-2.5 text-zinc-400 font-medium">{r.position}</td>
                <td className="p-2.5">
                  <div className="flex items-center gap-2">
                    {r.teamLogo ? (
                      <img src={r.teamLogo} alt="" className="w-6 h-6 object-contain shrink-0" onError={(e) => { e.target.style.display = "none"; }} />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-zinc-800 shrink-0" />
                    )}
                    <span className="text-white font-medium truncate">{r.teamName}</span>
                  </div>
                </td>
                <td className="text-center p-2.5 text-zinc-300">{r.played}</td>
                <td className="text-center p-2.5 text-zinc-300 hidden sm:table-cell">{r.won}</td>
                <td className="text-center p-2.5 text-zinc-300 hidden sm:table-cell">{r.drawn}</td>
                <td className="text-center p-2.5 text-zinc-300 hidden sm:table-cell">{r.lost}</td>
                <td className="text-center p-2.5 text-zinc-400 hidden md:table-cell">{r.goalsFor}</td>
                <td className="text-center p-2.5 text-zinc-400 hidden md:table-cell">{r.goalsAgainst}</td>
                <td className="text-center p-2.5 text-zinc-400 hidden md:table-cell">{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</td>
                <td className="text-center p-2.5">
                  <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md bg-zinc-800 text-white font-bold">{r.points}</span>
                </td>
                <td className="text-center p-2.5 hidden lg:table-cell"><FormDots form={r.form} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}