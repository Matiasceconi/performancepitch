import React, { useState, useMemo, useRef, useEffect } from "react";
import { Trophy, Loader2, AlertCircle, TrendingUp, Target, Activity, Calendar } from "lucide-react";
import { useFootballData } from "@/components/futbol/useFootballData";
import { useWorkspace } from "@/lib/WorkspaceContext";
import ClubStandingsTable from "@/components/club/ClubStandingsTable";
import NextMatchCard from "@/components/club/NextMatchCard";
import TodayMatchAlert from "@/components/club/TodayMatchAlert";
import LastResults from "@/components/club/LastResults";
import CalendarDates from "@/components/club/CalendarDates";
import QuickActions from "@/components/club/QuickActions";
import StandingsFilters from "@/components/club/StandingsFilters";
import FixtureModal from "@/components/club/FixtureModal";
import ScorersTable from "@/components/club/ScorersTable";
import YouthFixturesSection from "@/components/club/YouthFixturesSection";
import { base44 } from "@/api/base44Client";
import ClubShield from "@/components/club/ClubShield";

const COMPETITION_ID = "6a6d7e6852dc4637a1cf1260";
const LIGA_PROFESIONAL_ID = "6a6d7dfa52dc4637a1cf121e";
const TEAM_NAME = "Defensa y Justicia";
const ZONE = "Zona B";

function fmtShort(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "short" }); }
  catch { return iso; }
}

function StatTile({ icon: Icon, label, value, accent, tone }) {
  const borderCls = tone === "pos" ? "border-emerald-500/30" : tone === "neg" ? "border-red-500/30" : "border-zinc-800";
  return (
    <div className={`bg-zinc-900 border ${borderCls} rounded-xl p-4 flex items-center gap-3 shadow-lg shadow-black/20 animate-in fade-in slide-in-from-bottom-2 duration-500`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent}`}><Icon size={20} /></div>
      <div>
        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white leading-tight">{value}</p>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 animate-pulse"><div className="h-4 w-32 bg-zinc-800 rounded mb-4" /><div className="h-20 bg-zinc-800/50 rounded" /></div>;
}

export default function ClubDashboard() {
  const { data, loading, error } = useFootballData();
  const { clubBrand } = useWorkspace();
  const [activeTournament, setActiveTournament] = useState("Clausura");
  const [activeZone, setActiveZone] = useState(ZONE);
  const [showFixture, setShowFixture] = useState(false);
  const tableRef = useRef(null);
  const [scorersProyeccion, setScorersProyeccion] = useState([]);
  const [scorersLiga, setScorersLiga] = useState([]);

  useEffect(() => {
    async function fetchScorers() {
      try {
        const proy = await base44.entities.FootballScorer.filter({ competitionId: COMPETITION_ID, tournament: "Clausura" }, "-goals", 50);
        const liga = await base44.entities.FootballScorer.filter({ competitionId: LIGA_PROFESIONAL_ID }, "-goals", 50);
        setScorersProyeccion(proy || []);
        setScorersLiga(liga || []);
      } catch (e) { console.error("scorers", e); }
    }
    fetchScorers();
  }, []);

  const allStandings = data?.standings?.[COMPETITION_ID] || [];
  const allFixtures = data?.fixtures || [];

  const tournaments = useMemo(() => [...new Set(allStandings.map((s) => s.tournament).filter(Boolean))], [allStandings]);
  const zones = useMemo(() => [...new Set(allStandings.filter((s) => s.tournament === activeTournament).map((s) => s.group).filter(Boolean))], [allStandings, activeTournament]);
  const filteredStandings = useMemo(() => allStandings.filter((s) => s.tournament === activeTournament && s.group === activeZone).sort((a, b) => a.position - b.position), [allStandings, activeTournament, activeZone]);
  const dyhRow = filteredStandings.find((s) => s.teamName === TEAM_NAME);

  const upcomingReserva = useMemo(() => allFixtures.filter((f) => f.competitionId === COMPETITION_ID && f.status === "scheduled" && (f.homeTeam === TEAM_NAME || f.awayTeam === TEAM_NAME)).sort((a, b) => new Date(a.date) - new Date(b.date)), [allFixtures]);
  const nextMatchReserva = upcomingReserva[0];
  const next5Reserva = upcomingReserva.slice(0, 5);

  const nextMatchPrimera = useMemo(() => allFixtures.filter((f) => f.competitionId === LIGA_PROFESIONAL_ID && f.status === "scheduled" && (f.homeTeam === TEAM_NAME || f.awayTeam === TEAM_NAME)).sort((a, b) => new Date(a.date) - new Date(b.date))[0], [allFixtures]);

  const reservaClausuraFixtures = useMemo(() => allFixtures.filter((f) => f.competitionId === COMPETITION_ID && f.tournament === "Clausura"), [allFixtures]);
  const primeraFixtures = useMemo(() => allFixtures.filter((f) => f.competitionId === LIGA_PROFESIONAL_ID), [allFixtures]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
        <div className="h-24 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-4"><SkeletonCard /><SkeletonCard /></div>
        <SkeletonCard />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center"><AlertCircle size={26} className="text-red-400" /></div>
        <p className="text-zinc-400 text-sm text-center max-w-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600/10 via-zinc-900 to-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            {clubBrand?.logoUrl ? (
              <img src={clubBrand.logoUrl} alt="" className="w-16 h-16 object-contain shrink-0" onError={(e) => { e.target.style.display = "none"; }} />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0"><Trophy size={28} className="text-emerald-400" /></div>
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{clubBrand?.name || TEAM_NAME}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs font-semibold border border-emerald-500/30">Torneo Proyección</span>
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-700">Clausura 2026</span>
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-700">{ZONE}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-1.5">Panel de control del club</p>
            </div>
          </div>
          <QuickActions onFixture={() => setShowFixture(true)} onTable={() => tableRef.current?.scrollIntoView({ behavior: "smooth" })} />
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={Trophy} label="Posición" value={dyhRow ? `${dyhRow.position}°` : "—"} accent="bg-emerald-500/15 text-emerald-400" tone={dyhRow?.position <= 4 ? "pos" : dyhRow?.position > 16 ? "neg" : undefined} />
        <StatTile icon={Target} label="Puntos" value={dyhRow?.points ?? "—"} accent="bg-yellow-500/15 text-yellow-400" />
        <StatTile icon={Activity} label="Partidos Jugados" value={dyhRow?.played ?? "—"} accent="bg-blue-500/15 text-blue-400" />
        <StatTile icon={TrendingUp} label="Gol Diferencia" value={dyhRow ? (dyhRow.goalDifference > 0 ? `+${dyhRow.goalDifference}` : dyhRow.goalDifference) : "—"} accent="bg-purple-500/15 text-purple-400" tone={dyhRow?.goalDifference > 0 ? "pos" : dyhRow?.goalDifference < 0 ? "neg" : undefined} />
      </div>

      {/* Today match alerts */}
      <TodayMatchAlert fixture={nextMatchReserva} title="Reserva — Proyección" />
      <TodayMatchAlert fixture={nextMatchPrimera} title="Primera División — Liga Profesional" />

      {/* Next match cards */}
      <div className="grid lg:grid-cols-2 gap-4">
        <NextMatchCard fixture={nextMatchReserva} title="Próximo Partido — Reserva" badgeText="Proyección" badgeClass="bg-emerald-500/15 text-emerald-300 border-emerald-500/30" iconClass="text-emerald-400" />
        <NextMatchCard fixture={nextMatchPrimera} title="Próximo Partido — Primera" badgeText="Liga Profesional" badgeClass="bg-blue-500/15 text-blue-300 border-blue-500/30" iconClass="text-blue-400" />
      </div>

      {/* Standings with filters */}
      <div ref={tableRef}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><Trophy size={18} className="text-emerald-400" /> Tabla de Clasificación</h2>
          <StandingsFilters tournaments={tournaments} zones={zones} activeTournament={activeTournament} activeZone={activeZone} onTournament={setActiveTournament} onZone={setActiveZone} />
        </div>
        <ClubStandingsTable standings={filteredStandings} highlightTeam={TEAM_NAME} />
      </div>

      {/* Scorers tables */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ScorersTable scorers={scorersProyeccion} title="Goleadores — Proyección Clausura" accent="green" type="proyeccion" highlightTeam={TEAM_NAME} />
        <ScorersTable scorers={scorersLiga} title="Goleadores — Liga Profesional" accent="blue" type="liga" highlightTeam={TEAM_NAME} showPhoto />
      </div>

      {/* Last results — Reserva & Primera */}
      <div className="grid lg:grid-cols-2 gap-4">
        <LastResults fixtures={reservaClausuraFixtures} teamName={TEAM_NAME} title="Últimos Resultados — Reserva" accent="text-emerald-400" />
        <LastResults fixtures={primeraFixtures} teamName={TEAM_NAME} title="Últimos Resultados — Primera División" accent="text-blue-400" />
      </div>

      {/* Next 5 — Reserva */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Calendar size={16} className="text-emerald-400" /> Próximos Partidos — Reserva
        </h2>
        {next5Reserva.length ? (
          <div className="space-y-2">
            {next5Reserva.map((fx, i) => {
              const isHome = fx.homeTeam === TEAM_NAME;
              const opponent = isHome ? fx.awayTeam : fx.homeTeam;
              const oppLogo = isHome ? fx.awayLogo : fx.homeLogo;
              return (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-950/50 border border-zinc-800/60 hover:border-zinc-700 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-emerald-400">{isHome ? "L" : "V"}</span></div>
                  <ClubShield teamName={opponent} teamLogo={oppLogo} providerTeamId={isHome ? fx.providerTeamIdAway : fx.providerTeamIdHome} size="w-7 h-7" />
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white truncate">vs {opponent}</p><p className="text-xs text-zinc-500">{fx.round || "—"}</p></div>
                  <span className="text-xs text-zinc-400 shrink-0">{fmtShort(fx.date)}</span>
                </div>
              );
            })}
          </div>
        ) : <p className="text-zinc-500 text-sm text-center py-8">No hay próximos partidos.</p>}
      </div>

      {/* Calendar dates */}
      <CalendarDates fixtures={allFixtures.filter((f) => f.competitionId === COMPETITION_ID)} teamName={TEAM_NAME} />

      {/* Juveniles */}
      <YouthFixturesSection />

      {/* Fixture modal */}
      {showFixture && <FixtureModal fixtures={allFixtures} teamName={TEAM_NAME} onClose={() => setShowFixture(false)} />}
    </div>
  );
}