import React from "react";
import FormDots from "@/components/club/FormDots";
import ClubShield from "@/components/club/ClubShield";

function positionClass(position, total) {
  if (position <= 4) return "border-l-2 border-emerald-500 bg-emerald-500/[0.04]";
  if (position <= 8) return "border-l-2 border-yellow-500 bg-yellow-500/[0.04]";
  if (position > total - 2) return "border-l-2 border-red-500 bg-red-500/[0.04]";
  return "border-l-2 border-transparent";
}

export default function ClubStandingsTable({ standings, highlightTeam }) {
  const rows = (standings || []).slice().sort((a, b) => a.position - b.position);
  if (!rows.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
        <p className="text-zinc-500 text-sm">No hay datos de tabla disponibles.</p>
      </div>
    );
  }
  const total = rows.length;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-zinc-500 text-xs uppercase bg-zinc-900">
              <th className="text-center p-2.5 font-semibold w-10">#</th>
              <th className="text-center p-2.5 font-semibold w-12">Escudo</th>
              <th className="text-left p-2.5 font-semibold">Equipo</th>
              <th className="text-center p-2.5 font-semibold">PJ</th>
              <th className="text-center p-2.5 font-semibold hidden sm:table-cell">G</th>
              <th className="text-center p-2.5 font-semibold hidden sm:table-cell">E</th>
              <th className="text-center p-2.5 font-semibold hidden sm:table-cell">P</th>
              <th className="text-center p-2.5 font-semibold hidden md:table-cell">GF</th>
              <th className="text-center p-2.5 font-semibold hidden md:table-cell">GC</th>
              <th className="text-center p-2.5 font-semibold hidden md:table-cell">DG</th>
              <th className="text-center p-2.5 font-semibold">Pts</th>
              <th className="text-center p-2.5 font-semibold hidden lg:table-cell">Últimos 5</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isHL = r.teamName === highlightTeam;
              const rowCls = isHL ? "border-l-2 border-emerald-500 bg-emerald-500/10" : positionClass(r.position, total);
              return (
                <tr key={`${r.teamName}-${r.position}`} className={`border-t border-zinc-800/60 ${rowCls}`}>
                  <td className="text-center p-2.5 text-zinc-400 font-medium">{r.position}</td>
                  <td className="text-center p-2.5">
                    <ClubShield teamName={r.teamName} teamLogo={r.teamLogo} providerTeamId={r.providerTeamId} size="w-6 h-6" className="mx-auto" />
                  </td>
                  <td className="p-2.5"><span className={`truncate ${isHL ? "text-emerald-300 font-bold" : "text-white font-medium"}`}>{r.teamName}</span></td>
                  <td className="text-center p-2.5 text-zinc-300">{r.played}</td>
                  <td className="text-center p-2.5 text-zinc-300 hidden sm:table-cell">{r.won}</td>
                  <td className="text-center p-2.5 text-zinc-300 hidden sm:table-cell">{r.drawn}</td>
                  <td className="text-center p-2.5 text-zinc-300 hidden sm:table-cell">{r.lost}</td>
                  <td className="text-center p-2.5 text-zinc-400 hidden md:table-cell">{r.goalsFor}</td>
                  <td className="text-center p-2.5 text-zinc-400 hidden md:table-cell">{r.goalsAgainst}</td>
                  <td className="text-center p-2.5 text-zinc-400 hidden md:table-cell">{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</td>
                  <td className="text-center p-2.5"><span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md font-bold ${isHL ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-white"}`}>{r.points}</span></td>
                  <td className="text-center p-2.5 hidden lg:table-cell"><FormDots form={r.form} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-t border-zinc-800 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Playoffs (1-4)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-500" /> Repechaje (5-8)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> Descenso (últimos 2)</span>
      </div>
    </div>
  );
}