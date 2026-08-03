import React, { useState, useEffect, useMemo } from "react";
import { Trophy, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ClubStandingsTable from "@/components/club/ClubStandingsTable";
import ClubShield from "@/components/club/ClubShield";
import FormDots from "@/components/club/FormDots";

const TOURNAMENT_PRIORITY = ["Tabla General 2026", "Clausura", "Apertura"];

const ACCENT_MAP = {
  blue: { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30", active: "bg-blue-500/15 text-blue-400 border border-blue-500/30" },
  emerald: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30", active: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
};

export default function DivisionStandingsSection({ competitionName, displayTitle, highlightTeam, accent = "emerald" }) {
  const [allStandings, setAllStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTournament, setActiveTournament] = useState(null);
  const [activeZone, setActiveZone] = useState(null);

  const a = ACCENT_MAP[accent] || ACCENT_MAP.emerald;

  useEffect(() => {
    if (!competitionName) { setAllStandings([]); setLoading(false); return; }
    setLoading(true);
    base44.entities.FootballStanding.filter({ competitionName }, "position", 500)
      .then((rows) => setAllStandings(rows || []))
      .catch((e) => { console.error("standings fetch", e); setAllStandings([]); })
      .finally(() => setLoading(false));
  }, [competitionName]);

  const tournaments = useMemo(() => {
    const set = [...new Set(allStandings.map((r) => r.tournament).filter(Boolean))];
    return set.sort((x, y) => {
      const xi = TOURNAMENT_PRIORITY.findIndex((t) => x.includes(t));
      const yi = TOURNAMENT_PRIORITY.findIndex((t) => y.includes(t));
      if (xi === -1 && yi === -1) return 0;
      if (xi === -1) return 1;
      if (yi === -1) return -1;
      return xi - yi;
    });
  }, [allStandings]);

  const zones = useMemo(() => {
    if (!activeTournament) return [];
    return [...new Set(allStandings.filter((r) => r.tournament === activeTournament).map((r) => r.group).filter(Boolean))];
  }, [allStandings, activeTournament]);

  useEffect(() => {
    if (tournaments.length && !tournaments.includes(activeTournament)) {
      setActiveTournament(tournaments[0]);
    }
  }, [tournaments, activeTournament]);

  useEffect(() => {
    if (!activeTournament) return;
    const tournamentRows = allStandings.filter((r) => r.tournament === activeTournament);
    const zonesInTournament = [...new Set(tournamentRows.map((r) => r.group).filter(Boolean))];
    if (zonesInTournament.length <= 1) {
      setActiveZone(zonesInTournament[0] || null);
      return;
    }
    const teamRow = tournamentRows.find((r) => r.teamName === highlightTeam);
    setActiveZone(teamRow?.group || zonesInTournament[0]);
  }, [activeTournament, allStandings, highlightTeam]);

  const filteredStandings = useMemo(() => {
    if (!allStandings.length || !activeTournament) return [];
    return allStandings
      .filter((r) => r.tournament === activeTournament && (zones.length <= 1 || r.group === activeZone))
      .sort((a, b) => a.position - b.position);
  }, [allStandings, activeTournament, activeZone, zones.length]);

  const clubRow = filteredStandings.find((r) => r.teamName === highlightTeam);

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 flex items-center justify-center">
        <Loader2 size={20} className="text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (!allStandings.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
        <Trophy size={28} className="text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-400 text-sm font-medium">Tabla no disponible</p>
        <p className="text-zinc-600 text-xs mt-1">No hay datos de standings para {displayTitle}.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + tournament selector */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-base font-bold text-white">{displayTitle}</h3>
        {activeTournament && (
          <span className="text-xs text-zinc-500">{activeTournament}{activeZone ? ` · ${activeZone}` : ""}</span>
        )}
      </div>

      {tournaments.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          {tournaments.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTournament(t)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                activeTournament === t ? a.active : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {zones.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wide hidden sm:inline">Zona</span>
          {zones.map((z) => (
            <button
              key={z}
              onClick={() => setActiveZone(z)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                activeZone === z ? "bg-white text-zinc-950" : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              {z}
            </button>
          ))}
        </div>
      )}

      {/* Club summary card */}
      {clubRow && (
        <div className={`bg-zinc-900 border ${a.border} rounded-xl p-4 flex items-center gap-4`}>
          <ClubShield teamName={highlightTeam} teamLogo={clubRow.teamLogo} size="w-12 h-12" rounded="rounded-xl" />
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Posición</p>
              <p className="text-xl font-bold text-white">{clubRow.position}°</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Puntos</p>
              <p className="text-xl font-bold text-white">{clubRow.points}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Jugados</p>
              <p className="text-xl font-bold text-white">{clubRow.played}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Dif. Gol</p>
              <p className="text-xl font-bold text-white">{clubRow.goalDifference > 0 ? `+${clubRow.goalDifference}` : clubRow.goalDifference}</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Últimos 5</p>
              <div className="mt-1.5"><FormDots form={clubRow.form} /></div>
            </div>
          </div>
        </div>
      )}

      {/* Standings table */}
      <ClubStandingsTable standings={filteredStandings} highlightTeam={highlightTeam} />
    </div>
  );
}