import React from "react";
import { Trophy } from "lucide-react";
import ClubShield from "@/components/club/ClubShield";

export default function ScorersTable({ scorers, title, accent, type, highlightTeam, showPhoto }) {
  const sorted = [...(scorers || [])].sort((a, b) => (b.goals || 0) - (a.goals || 0)).slice(0, 20);
  const accentColor = accent === "blue" ? "text-blue-400" : "text-emerald-400";
  const highlightBg = accent === "blue" ? "bg-blue-500/10" : "bg-emerald-500/10";
  const highlightText = accent === "blue" ? "text-blue-300" : "text-emerald-300";

  const totalGoals = sorted.reduce((sum, s) => sum + (s.goals || 0), 0);
  const topScorer = sorted[0];
  const dyhScorers = (scorers || []).filter((s) => (s.teamName || "").includes("Defensa"));
  const dyhGoals = dyhScorers.reduce((sum, s) => sum + (s.goals || 0), 0);
  const topAssister = [...(scorers || [])].sort((a, b) => (b.assists || 0) - (a.assists || 0))[0];
  const dyhByAssists = [...dyhScorers].sort((a, b) => (b.assists || 0) - (a.assists || 0))[0];
  const dyhHighlight = dyhByAssists || dyhScorers[0];

  let miniStats = [];
  if (type === "proyeccion") {
    miniStats = [
      { label: "Total Goles", value: totalGoals },
      { label: "Goleador Líder", value: topScorer ? `${topScorer.playerName} (${topScorer.goals})` : "—" },
      { label: "Goles DyJ", value: dyhGoals },
    ];
  } else {
    miniStats = [
      { label: "Goleador Líder", value: topScorer ? `${topScorer.playerName} (${topScorer.goals})` : "—" },
      { label: "Asistidor Líder", value: topAssister ? `${topAssister.playerName} (${topAssister.assists})` : "—" },
      { label: "Destacado DyJ", value: dyhHighlight ? `${dyhHighlight.playerName} (${dyhHighlight.assists || dyhHighlight.goals || 0})` : "—" },
    ];
  }

  if (!sorted.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h2 className={`text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${accentColor}`}><Trophy size={16} /> {title}</h2>
        <p className="text-zinc-500 text-sm text-center py-6">No hay datos de goleadores.</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 animate-in fade-in duration-500">
      <h2 className={`text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${accentColor}`}><Trophy size={16} /> {title}</h2>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {miniStats.map((s, i) => (
          <div key={i} className="bg-zinc-950/50 border border-zinc-800/60 rounded-lg p-2 text-center">
            <p className="text-[10px] text-zinc-500 uppercase font-medium truncate">{s.label}</p>
            <p className="text-xs font-bold text-white truncate">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="max-h-[400px] overflow-y-auto rounded-lg border border-zinc-800/60">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-900 z-10">
            <tr className="text-zinc-500 text-xs uppercase">
              <th className="text-center p-2 font-semibold w-8">#</th>
              <th className="text-left p-2 font-semibold">Jugador</th>
              <th className="text-center p-2 font-semibold">G</th>
              <th className="text-center p-2 font-semibold hidden sm:table-cell">A</th>
              <th className="text-center p-2 font-semibold w-8">🟨</th>
              <th className="text-center p-2 font-semibold w-8">🟥</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const isHL = (s.teamName || "").includes("Defensa");
              return (
                <tr key={i} className={`border-t border-zinc-800/60 ${isHL ? highlightBg : ""}`}>
                  <td className="text-center p-2 text-zinc-400">{i + 1}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {showPhoto && s.photo ? <img src={s.photo} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" onError={(e) => { e.target.style.display = "none"; }} /> : null}
                      <div className="min-w-0">
                        <p className={`truncate ${isHL ? `${highlightText} font-semibold` : "text-white"}`}>{s.playerName}</p>
                        <div className="flex items-center gap-1">
                          <ClubShield teamName={s.teamName} teamLogo={s.teamLogo} size="w-5 h-5" />
                          <span className="text-xs text-zinc-500 truncate">{s.teamName}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="text-center p-2"><span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-md bg-yellow-500/15 text-yellow-400 font-bold">{s.goals || 0}</span></td>
                  <td className="text-center p-2 text-zinc-300 hidden sm:table-cell">{s.assists || 0}</td>
                  <td className="text-center p-2"><span className="text-yellow-400 font-medium">{s.yellowCards || 0}</span></td>
                  <td className="text-center p-2"><span className="text-red-400 font-medium">{s.redCards || 0}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}