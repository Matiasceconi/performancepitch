import React from "react";
import { Trophy } from "lucide-react";
import ClubShield from "@/components/club/ClubShield";

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "short" }); }
  catch { return iso; }
}

const RESULT_CFG = {
  W: { label: "G", cls: "bg-emerald-500 text-white" },
  D: { label: "E", cls: "bg-yellow-500 text-zinc-950" },
  L: { label: "P", cls: "bg-red-500 text-white" },
};

export default function LastResults({ fixtures, teamName }) {
  const results = (fixtures || [])
    .filter((f) => f.status === "finished" && (f.homeTeam === teamName || f.awayTeam === teamName))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Trophy size={16} className="text-emerald-400" /> Últimos Resultados
      </h2>
      {!results.length ? (
        <p className="text-zinc-500 text-sm text-center py-6">No hay resultados recientes.</p>
      ) : (
        <div className="space-y-2">
          {results.map((fx, i) => {
            const isHome = fx.homeTeam === teamName;
            const opponent = isHome ? fx.awayTeam : fx.homeTeam;
            const oppLogo = isHome ? fx.awayLogo : fx.homeLogo;
            const teamScore = isHome ? fx.homeScore : fx.awayScore;
            const oppScore = isHome ? fx.awayScore : fx.homeScore;
            const result = teamScore > oppScore ? "W" : teamScore < oppScore ? "L" : "D";
            const cfg = RESULT_CFG[result];
            return (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-950/50 border border-zinc-800/60">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${cfg.cls}`}>{cfg.label}</span>
                <span className="text-xs text-zinc-500 font-medium w-4 shrink-0">{isHome ? "L" : "V"}</span>
                <ClubShield teamName={opponent} teamLogo={oppLogo} providerTeamId={isHome ? fx.providerTeamIdAway : fx.providerTeamIdHome} size="w-6 h-6" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">vs {opponent}</p>
                  <p className="text-xs text-zinc-500">{fx.tournament || "—"} · {fmtDate(fx.date)}</p>
                </div>
                <span className="text-sm font-bold text-white shrink-0">{teamScore} - {oppScore}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}