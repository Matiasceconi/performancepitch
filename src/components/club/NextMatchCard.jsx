import React from "react";
import { MapPin, Calendar, Trophy, Clock3 } from "lucide-react";
import ClubShield from "@/components/club/ClubShield";
import MatchCountdown from "@/components/club/MatchCountdown";
import { formatDateOnly, matchDateValue, matchTimeValue } from "@/lib/clubCompetitionUtils";

export default function NextMatchCard({
  fixture,
  title,
  badgeText,
  badgeClass,
  iconClass,
  timeZone = "America/Argentina/Buenos_Aires",
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <Calendar size={16} className={iconClass} /> {title}
        </h2>
        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${badgeClass}`}>{badgeText}</span>
      </div>
      {fixture ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 flex flex-col items-center gap-2 text-center min-w-0">
              <ClubShield teamName={fixture.homeTeam} teamLogo={fixture.homeLogo} size="w-14 h-14" />
              <span className="text-sm font-semibold text-white text-center truncate max-w-full">{fixture.homeTeam}</span>
              <span className="text-xs text-zinc-500">Local</span>
            </div>
            <div className="px-2"><span className="text-zinc-600 text-xs font-bold uppercase">vs</span></div>
            <div className="flex-1 flex flex-col items-center gap-2 text-center min-w-0">
              <ClubShield teamName={fixture.awayTeam} teamLogo={fixture.awayLogo} size="w-14 h-14" />
              <span className="text-sm font-semibold text-white text-center truncate max-w-full">{fixture.awayTeam}</span>
              <span className="text-xs text-zinc-500">Visitante</span>
            </div>
          </div>
          <div className="border-t border-zinc-800 pt-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm text-white font-medium capitalize">{formatDateOnly(matchDateValue(fixture))}</p>
              <MatchCountdown match={fixture} timeZone={timeZone} />
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400"><Clock3 size={12} /> {matchTimeValue(fixture) || "Horario a confirmar"}</div>
            <div className="flex items-center gap-2 text-xs text-zinc-400"><MapPin size={12} /> {fixture.venue || "Estadio a confirmar"}</div>
            <div className="flex items-center gap-2 text-xs text-zinc-400"><Trophy size={12} /> {fixture.round || "Fecha a confirmar"}</div>
          </div>
        </div>
      ) : (
        <p className="text-zinc-500 text-sm text-center py-8">No hay próximos partidos programados.</p>
      )}
    </div>
  );
}
