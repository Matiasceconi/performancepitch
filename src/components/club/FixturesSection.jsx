import React, { useState, useEffect, useMemo } from "react";
import { Calendar, MapPin, Trophy, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { base44 } from "@/api/base44Client";
import ClubShield from "@/components/club/ClubShield";

const DYJ = "Defensa y Justicia";
const YOUTH_CATEGORIES = ["4ta", "5ta", "6ta", "7ma", "8va", "9na"];

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function fmtTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
  } catch { return "—"; }
}

function parseRound(round) {
  if (!round) return "—";
  // "Clausura - 3" => "Fecha 3"
  const m = round.match(/-\s*(\d+)/);
  return m ? `Fecha ${m[1]}` : round;
}

function isDyj(fixture) {
  return fixture.homeTeam === DYJ || fixture.awayTeam === DYJ;
}

function FixtureRow({ fx, isYouth }) {
  const finished = isYouth ? fx.status === "played" : fx.status === "finished";
  const dyjIsHome = isYouth ? fx.isHome : fx.homeTeam === DYJ;
  const round = isYouth ? (fx.fixtureRound ? `Fecha ${fx.fixtureRound}` : "—") : parseRound(fx.round);

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors">
      {/* Fecha + hora */}
      <div className="w-[72px] shrink-0">
        <p className="text-xs font-bold text-white leading-tight">{fmtDate(fx.date || fx.matchDate)}</p>
        <p className="text-[11px] text-zinc-500">{fmtTime(fx.date) || fx.time || "—"}</p>
      </div>

      {/* Round */}
      <div className="w-16 shrink-0 hidden sm:block">
        <span className="text-[11px] text-zinc-500 font-medium">{round}</span>
      </div>

      {/* Equipos + resultado */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {/* Home */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
          <span className={`text-sm truncate text-right ${fx.homeTeam === DYJ ? "text-emerald-400 font-bold" : "text-zinc-300"}`}>{fx.homeTeam}</span>
          <ClubShield teamName={fx.homeTeam} teamLogo={fx.homeLogo} providerTeamId={fx.providerTeamIdHome} size="w-6 h-6" />
        </div>
        {/* Score / vs */}
        <div className="shrink-0 px-1">
          {finished ? (
            <span className="text-sm font-bold text-white tabular-nums">
              {fx.homeScore ?? 0} - {fx.awayScore ?? 0}
            </span>
          ) : (
            <span className="text-[11px] text-zinc-600 font-medium uppercase">vs</span>
          )}
        </div>
        {/* Away */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <ClubShield teamName={fx.awayTeam} teamLogo={fx.awayLogo} providerTeamId={fx.providerTeamIdAway} size="w-6 h-6" />
          <span className={`text-sm truncate ${fx.awayTeam === DYJ ? "text-emerald-400 font-bold" : "text-zinc-300"}`}>{fx.awayTeam}</span>
        </div>
      </div>

      {/* Sede */}
      <div className="hidden lg:flex items-center gap-1 text-xs text-zinc-500 shrink-0 max-w-[140px] w-32">
        <MapPin size={11} className="shrink-0" />
        <span className="truncate">{fx.venue || "—"}</span>
      </div>
    </div>
  );
}

function FixtureGroup({ title, fixtures, isYouth, accent, max }) {
  const shown = max ? fixtures.slice(0, max) : fixtures;
  if (!shown.length) return null;
  return (
    <div>
      <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${accent}`}>
        {title}
        <span className="text-zinc-600 font-normal normal-case">({fixtures.length})</span>
      </h3>
      <div className="space-y-1.5">
        {shown.map((fx) => (
          <FixtureRow key={fx.id} fx={fx} isYouth={isYouth} />
        ))}
      </div>
    </div>
  );
}

function TournamentSelector({ value, onChange }) {
  const tournaments = ["Clausura", "Apertura"];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {tournaments.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            value === t ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function CategorySelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {YOUTH_CATEGORIES.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`px-2.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            value === c ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="py-10 text-center">
      <Calendar size={24} className="text-zinc-600 mx-auto mb-2" />
      <p className="text-zinc-500 text-sm">{message}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="py-10 flex items-center justify-center">
      <Loader2 size={20} className="text-zinc-500 animate-spin" />
    </div>
  );
}

function SeniorTab({ fixtures, loading, compId, defaultTournament }) {
  const [tournament, setTournament] = useState(defaultTournament || "Clausura");

  const teamFixtures = useMemo(
    () => fixtures.filter((f) => f.competitionId === compId && isDyj(f) && (!f.tournament || f.tournament === tournament)),
    [fixtures, compId, tournament]
  );

  const { jugados, proximos } = useMemo(() => {
    const finished = teamFixtures
      .filter((f) => f.status === "finished")
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const scheduled = teamFixtures
      .filter((f) => f.status === "scheduled")
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    return { jugados: finished, proximos: scheduled };
  }, [teamFixtures]);

  if (loading) return <LoadingState />;
  if (!compId) return <EmptyState message="No hay competencia configurada para esta división" />;

  return (
    <div className="space-y-4">
      <TournamentSelector value={tournament} onChange={setTournament} />
      {!jugados.length && !proximos.length ? (
        <EmptyState message="No hay fixtures para este torneo" />
      ) : (
        <div className="space-y-5">
          <FixtureGroup title="Últimos partidos" fixtures={jugados} accent="text-zinc-400" max={5} />
          <FixtureGroup title="Próximos partidos" fixtures={proximos} accent="text-emerald-400" max={5} />
        </div>
      )}
    </div>
  );
}

function JuvenilesTab() {
  const [category, setCategory] = useState("4ta");
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    base44.entities.FootballYouthFixture.filter({ category }, "-fixtureRound", 200)
      .then((all) => setFixtures(all || []))
      .catch(() => setFixtures([]))
      .finally(() => setLoading(false));
  }, [category]);

  const { jugados, proximos } = useMemo(() => {
    const played = fixtures
      .filter((f) => f.status === "played")
      .sort((a, b) => new Date(b.date || b.matchDate) - new Date(a.date || a.matchDate));
    const scheduled = fixtures
      .filter((f) => f.status === "scheduled")
      .sort((a, b) => new Date(a.date || a.matchDate) - new Date(b.date || b.matchDate));
    return { jugados: played, proximos: scheduled };
  }, [fixtures]);

  return (
    <div className="space-y-4">
      <CategorySelector value={category} onChange={setCategory} />
      {loading ? (
        <LoadingState />
      ) : !jugados.length && !proximos.length ? (
        <EmptyState message={`No hay fixtures de ${category} División`} />
      ) : (
        <div className="space-y-5">
          <FixtureGroup title="Últimos partidos" fixtures={jugados} isYouth accent="text-zinc-400" max={5} />
          <FixtureGroup title="Próximos partidos" fixtures={proximos} isYouth accent="text-emerald-400" max={5} />
        </div>
      )}
    </div>
  );
}

export default function FixturesSection({ fixtures, loading, primeraCompId, reservaCompId }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={18} className="text-emerald-400" />
        <h2 className="text-lg font-bold text-white">Fixtures</h2>
      </div>
      <Tabs defaultValue="primera">
        <TabsList className="bg-zinc-800 w-full justify-stretch mb-4">
          <TabsTrigger value="primera" className="flex-1 data-[state=active]:bg-emerald-500 data-[state=active]:text-zinc-950">Primera</TabsTrigger>
          <TabsTrigger value="reserva" className="flex-1 data-[state=active]:bg-emerald-500 data-[state=active]:text-zinc-950">Reserva</TabsTrigger>
          <TabsTrigger value="juveniles" className="flex-1 data-[state=active]:bg-emerald-500 data-[state=active]:text-zinc-950">Juveniles</TabsTrigger>
        </TabsList>
        <TabsContent value="primera">
          <SeniorTab fixtures={fixtures || []} loading={loading} compId={primeraCompId} defaultTournament="Clausura" />
        </TabsContent>
        <TabsContent value="reserva">
          <SeniorTab fixtures={fixtures || []} loading={loading} compId={reservaCompId} defaultTournament="Clausura" />
        </TabsContent>
        <TabsContent value="juveniles">
          <JuvenilesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}