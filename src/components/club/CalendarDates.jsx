import React from "react";
import { CalendarDays } from "lucide-react";
import ClubShield from "@/components/club/ClubShield";
import MatchCountdown from "@/components/club/MatchCountdown";
import { formatDateOnly, matchDateValue, matchTimeValue, sameClubName } from "@/lib/clubCompetitionUtils";

export default function CalendarDates({ fixtures, teamName, timeZone = "America/Argentina/Buenos_Aires", title = "Próximas fechas" }) {
  const upcoming = (fixtures || [])
    .filter((f) => f.status === "scheduled" && (sameClubName(f.homeTeam, teamName) || sameClubName(f.awayTeam, teamName)))
    .sort((a, b) => String(matchDateValue(a)).localeCompare(String(matchDateValue(b))))
    .slice(0, 3);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <CalendarDays size={16} className="text-emerald-400" /> {title}
      </h2>
      {!upcoming.length ? (
        <p className="text-zinc-500 text-sm text-center py-6">No hay fechas programadas.</p>
      ) : (
        <div className="grid sm:grid-cols-3 gap-3">
          {upcoming.map((fx, i) => {
            const isHome = sameClubName(fx.homeTeam, teamName);
            const opponent = isHome ? fx.awayTeam : fx.homeTeam;
            const oppLogo = isHome ? fx.awayLogo : fx.homeLogo;
            return (
              <div key={fx.id || i} className="bg-zinc-950/50 border border-zinc-800/60 rounded-xl p-3 text-center">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-bold text-emerald-400 uppercase">{fx.round || "Fecha"}</p>
                  <MatchCountdown match={fx} timeZone={timeZone} />
                </div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <ClubShield teamName={opponent} teamLogo={oppLogo} size="w-10 h-10" />
                </div>
                <p className="text-sm font-medium text-white truncate">vs {opponent}</p>
                <p className="text-xs text-zinc-500 mt-1">{isHome ? "Local" : "Visitante"} · {formatDateOnly(matchDateValue(fx), { compact: true })}</p>
                <p className="text-[10px] text-zinc-600 mt-1">{matchTimeValue(fx) || "Horario a confirmar"}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
