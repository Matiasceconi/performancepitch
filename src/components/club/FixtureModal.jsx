import React from "react";
import { X } from "lucide-react";
import ClubShield from "@/components/club/ClubShield";
import { formatDateOnly, matchDateValue, matchTimeValue, sameClubName } from "@/lib/clubCompetitionUtils";

export default function FixtureModal({ fixtures, teamName, onClose, title = "Fixture completo" }) {
  const teamFixtures = (fixtures || [])
    .filter((f) => sameClubName(f.homeTeam, teamName) || sameClubName(f.awayTeam, teamName))
    .sort((a, b) => String(matchDateValue(a)).localeCompare(String(matchDateValue(b))));

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{teamFixtures.length} partidos cargados</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="space-y-2">
          {teamFixtures.map((fx, i) => {
            const isHome = sameClubName(fx.homeTeam, teamName);
            const opponent = isHome ? fx.awayTeam : fx.homeTeam;
            const oppLogo = isHome ? fx.awayLogo : fx.homeLogo;
            const played = fx.status === "played" || fx.status === "finished" || (fx.homeScore != null && fx.awayScore != null);
            const status = played ? `${fx.homeScore} - ${fx.awayScore}` : "Programado";
            return (
              <div key={fx.id || i} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/60">
                <span className="text-xs text-zinc-500 w-20 shrink-0">{fx.round || "—"}</span>
                <span className={`text-xs font-bold w-5 shrink-0 ${isHome ? "text-emerald-400" : "text-blue-400"}`}>{isHome ? "L" : "V"}</span>
                <ClubShield teamName={opponent} teamLogo={oppLogo} size="w-6 h-6" />
                <span className="flex-1 text-sm text-white truncate">vs {opponent}</span>
                <div className="text-right shrink-0">
                  <p className="text-xs text-zinc-400">{formatDateOnly(matchDateValue(fx), { compact: true })}</p>
                  <p className="text-[10px] text-zinc-600">{matchTimeValue(fx) || "—"}</p>
                </div>
                <span className="text-xs font-bold text-white shrink-0 w-20 text-right">{status}</span>
              </div>
            );
          })}
          {!teamFixtures.length && <p className="py-10 text-center text-sm text-zinc-500">No hay partidos cargados para esta selección.</p>}
        </div>
      </div>
    </div>
  );
}
