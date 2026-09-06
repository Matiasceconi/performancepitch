import React from "react";
import { MapPin, Clock, Trophy, Radio } from "lucide-react";
import ClubShield from "@/components/club/ClubShield";
import MatchCountdown from "@/components/club/MatchCountdown";
import {
  formatDateOnly,
  isClubTeam,
  isMatchToday,
  matchDateValue,
  matchTimeValue,
} from "@/lib/clubCompetitionUtils";

export default function TodayMatchAlert({
  fixture,
  title,
  aliases = [],
  timeZone = "America/Argentina/Buenos_Aires",
  standing,
  phase,
  zone,
}) {
  if (!fixture || !isMatchToday(fixture, timeZone)) return null;

  const isHome = isClubTeam(fixture.homeTeam, aliases);
  const time = matchTimeValue(fixture);
  const competitionContext = [phase, zone].filter(Boolean).join(" · ");

  return (
    <section className="relative overflow-hidden rounded-2xl border border-red-500/35 bg-gradient-to-r from-red-500/[0.12] via-zinc-900 to-zinc-900 shadow-xl shadow-red-950/10">
      <div className="absolute inset-x-0 top-0 h-1 bg-red-500" />
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-white">
              <Radio size={13} className="animate-pulse" /> Partido hoy
            </span>
            <div>
              <p className="text-sm font-black text-white">{title}</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {formatDateOnly(matchDateValue(fixture))}{fixture.round ? ` · ${fixture.round}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MatchCountdown match={fixture} timeZone={timeZone} size="md" />
            {standing && (
              <span className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-bold text-zinc-200">
                {standing.position}° · {standing.points} pts
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/20 p-4 sm:p-5">
          <div className="min-w-0 text-center">
            <ClubShield teamName={fixture.homeTeam} teamLogo={fixture.homeLogo} size="w-16 h-16" className="mx-auto" />
            <p className={`mt-2 truncate text-sm font-black ${isHome ? "text-emerald-300" : "text-white"}`}>{fixture.homeTeam}</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-600">Local</p>
          </div>

          <div className="text-center">
            <Clock size={20} className="mx-auto text-red-400" />
            <p className="mt-1 text-2xl font-black text-white">{time || "—"}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-600">hora local</p>
          </div>

          <div className="min-w-0 text-center">
            <ClubShield teamName={fixture.awayTeam} teamLogo={fixture.awayLogo} size="w-16 h-16" className="mx-auto" />
            <p className={`mt-2 truncate text-sm font-black ${!isHome ? "text-emerald-300" : "text-white"}`}>{fixture.awayTeam}</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-600">Visitante</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1.5"><Trophy size={13} className="text-zinc-600" /> {competitionContext || "Torneo vigente"}</span>
          {fixture.venue && <span className="inline-flex items-center gap-1.5"><MapPin size={13} className="text-zinc-600" /> {fixture.venue}</span>}
          <span className="font-semibold text-zinc-300">{isHome ? "El club juega de local" : "El club juega de visitante"}</span>
        </div>
      </div>
    </section>
  );
}
