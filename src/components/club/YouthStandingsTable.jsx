import React, { useState, useEffect } from "react";
import { Loader2, Trophy } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ClubShield from "@/components/club/ClubShield";

const CATEGORY_LABELS = {
  "4ta": "4ª División",
  "5ta": "5ª División",
  "6ta": "6ª División",
  "7ma": "7ª División",
  "8va": "8ª División",
  "9na": "9ª División",
};

export default function YouthStandingsTable({ category, highlightTeam, competitionName, tournament }) {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!category) { setStandings([]); setLoading(false); return; }
    setLoading(true);
    base44.entities.FootballYouthStanding.filter({ category }, "position", 50)
      .then((rows) => setStandings(rows || []))
      .catch((e) => { console.error("youth standings", e); setStandings([]); })
      .finally(() => setLoading(false));
  }, [category]);

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 flex items-center justify-center">
        <Loader2 size={20} className="text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (!standings.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
        <Trophy size={28} className="text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-400 text-sm font-medium">Tabla todavía no disponible para esta categoría</p>
      </div>
    );
  }

  const headerText = `${competitionName || "Torneo de Juveniles LPF 2026"}${tournament ? ` — ${tournament}` : ""}`;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/50">
        <h3 className="text-sm font-bold text-white">{headerText}</h3>
        <p className="text-xs text-zinc-500 mt-0.5">{CATEGORY_LABELS[category] || category}</p>
      </div>
      <div className="overflow-y-auto max-h-[600px]">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="sticky top-0 z-10">
            <tr className="text-zinc-500 text-xs uppercase bg-zinc-900">
              <th className="text-center p-2.5 font-semibold w-10">#</th>
              <th className="text-left p-2.5 font-semibold">Equipo</th>
              <th className="text-center p-2.5 font-semibold">Pts</th>
              <th className="text-center p-2.5 font-semibold">J</th>
              <th className="text-center p-2.5 font-semibold hidden sm:table-cell">G</th>
              <th className="text-center p-2.5 font-semibold hidden sm:table-cell">E</th>
              <th className="text-center p-2.5 font-semibold hidden sm:table-cell">P</th>
              <th className="text-center p-2.5 font-semibold hidden md:table-cell">GF</th>
              <th className="text-center p-2.5 font-semibold hidden md:table-cell">GC</th>
              <th className="text-center p-2.5 font-semibold">DIF</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((r) => {
              const isHL = r.teamName === highlightTeam;
              return (
                <tr
                  key={`${r.category}-${r.position}`}
                  className={`border-t border-zinc-800/60 ${isHL ? "bg-emerald-500/10 border-l-2 border-emerald-500" : ""}`}
                >
                  <td className="text-center p-2.5 text-zinc-400 font-medium">{r.position}</td>
                  <td className="p-2.5">
                    <div className="flex items-center gap-2">
                      <ClubShield teamName={r.teamName} size="w-5 h-5" rounded="rounded" />
                      <span className={`truncate ${isHL ? "text-emerald-300 font-bold" : "text-white font-medium"}`}>
                        {r.teamName}
                      </span>
                    </div>
                  </td>
                  <td className="text-center p-2.5">
                    <span
                      className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md font-bold ${
                        isHL ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-white"
                      }`}
                    >
                      {r.points}
                    </span>
                  </td>
                  <td className="text-center p-2.5 text-zinc-300">{r.played}</td>
                  <td className="text-center p-2.5 text-zinc-300 hidden sm:table-cell">{r.won}</td>
                  <td className="text-center p-2.5 text-zinc-300 hidden sm:table-cell">{r.drawn}</td>
                  <td className="text-center p-2.5 text-zinc-300 hidden sm:table-cell">{r.lost}</td>
                  <td className="text-center p-2.5 text-zinc-400 hidden md:table-cell">{r.goalsFor}</td>
                  <td className="text-center p-2.5 text-zinc-400 hidden md:table-cell">{r.goalsAgainst}</td>
                  <td className="text-center p-2.5 text-zinc-400">
                    {r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}