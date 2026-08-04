import React, { useState, useEffect, useMemo } from "react";
import { Calendar, MapPin, Trophy, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { base44 } from "@/api/base44Client";
import ClubShield from "@/components/club/ClubShield";

const DYJ = "Defensa y Justicia";
const YOUTH_CATEGORIES = ["4ta", "5ta", "6ta", "7ma", "8va", "9na"];

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isDyj(fixture) {
  return fixture.homeTeam === DYJ || fixture.awayTeam === DYJ;
}

function FixtureRow({ fx, isYouth }) {
  const finished = isYouth ? fx.status === "played" : fx.status === "finished";
  const isHome = isYouth ? fx.isHome : fx.homeTeam === DYJ;
  const dyjScore = isHome ? fx.homeScore : fx.awayScore;
  const rivalScore = isHome ? fx.awayScore : fx.homeScore;
  const rival = isHome ? fx.awayTeam : fx.homeTeam;
  const rivalLogo = isHome ? fx.awayLogo : fx.homeLogo;
  const providerId = isHome ? fx.providerTeamIdAway : fx.providerTeamIdHome;
  const round = isYouth ? (fx.fixtureRound ? `Fecha ${fx.fixtureRound}` : "—") : fx.round || "—";

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors">
      {/* Fecha + hora */}
      <div className="w-14 shrink-0 text-center">
        <p className="text-sm font-bold text-white">{fmtDate(fx.date || fx.matchDate)}</p>
        <p className="text-[11px] text-zinc-500">{fx.time || "—"}</p>
      </div>

      {/* Round */}
      <div className="w-16 shrink-0 hidden sm:block">
        <span className="text-[11px] text-zinc-500 font-medium">{round}</span>
      </div>

      {/* Equipos / resultado */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {isYouth && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${isHome ? "bg-emerald-500/20 text-emerald-300" : "bg-blue-500/20 text-blue-300"}`}>
            {isHome ? "L" : "V"}
          </span>
        )}
        <ClubShield teamName={DYJ} size="w-6 h-6" />
        <span className="text-sm font-semibold text-white truncate hidden sm:inline">DYJ</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {finished ? (
            <span className="text-sm font-bold text-white tabular-nums">
              {dyjScore} - {rivalScore}
            </span>
          ) : (
            <span className="text-xs text-zinc-500 font-medium">Programado</span>
          )}
        </div>
        <ClubShield teamName={rival} teamLogo={rivalLogo} providerTeamId={providerId} size="w-6 h-6" />
        <span className="text-sm text-zinc-300 truncate">{rival}</span>
      </div>

      {/* Sede */}
      <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-500 shrink-0 max-w-[160px]">
        <MapPin size={11} className="shrink-0" />
        <span className="truncate">{fx.venue || "—"}</span>
      </div>
    </div>
  );
}

function FixtureGroup({ title, fixtures, isYouth, accent }) {
  if (!fixtures.length) return null;
  return (
    <div>
      <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${accent}`}>
        {title}
        <span className="text-zinc-600 font-normal normal-case">({fixtures.length})</span>
      </h3>
      <div className="space-y-1.5">
        {fixtures.map((fx) => (
          <FixtureRow key={fx.id} fx={fx} isYouth={isYouth} />
        ))}
      </div>
    </div>
  );
}

function TournamentSelector({ value, onChange }) {
  const tournaments = ["Clausura 2026", "Apertura 2026"];
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

function PrimeraTab({ fixtures, loading }) {
  const [tournament, setTournament] = useState("Clausura 2026");

  const dyjFixtures = useMemo(
    () => fixtures.filter((f) => isDyj(f) && f.competitionName !== "Reserve League" && (!f.tournament || f.tournament === tournament)),
    [fixtures, tournament]
  );

  const { jugados, proximos } = useMemo(() => {
    const finished = dyjFixtures.filter((f) => f.status === "finished").sort((a, b) => new Date(b.date) - new Date(a.date));
    const scheduled = dyjFixtures.filter((f) => f.status === "scheduled").sort((a, b) => new Date(a.date) - new Date(b.date));
    return { jugados: finished, proximos: scheduled };
  }, [dyjFixtures]);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <TournamentSelector value={tournament} onChange={setTournament} />
      {!jugados.length && !proximos.length ? (
        <EmptyState message="No hay fixtures de Primera para este torneo" />
      ) : (
        <div className="space-y-5">
          <FixtureGroup title="Jugados" fixtures={jugados} accent="text-zinc-400" />
          <FixtureGroup title="Próximos" fixtures={proximos} accent="text-emerald-400" />
        </div>
      )}
    </div>
  );
}

function ReservaTab({ fixtures, loading }) {
  const dyjFixtures = useMemo(
    () => fixtures.filter((f) => isDyj(f) && f.competitionName === "Reserve League"),
    [fixtures]
  );

  const { jugados, proximos } = useMemo(() => {
    const finished = dyjFixtures.filter((f) => f.status === "finished").sort((a, b) => new Date(b.date) - new Date(a.date));
    const scheduled = dyjFixtures.filter((f) => f.status === "scheduled").sort((a, b) => new Date(a.date) - new Date(b.date));
    return { jugados: finished, proximos: scheduled };
  }, [dyjFixtures]);

  if (loading) return <LoadingState />;

  if (!jugados.length && !proximos.length) return <EmptyState message="No hay fixtures de Reserva" />;

  return (
    <div className="space-y-5">
      <FixtureGroup title="Jugados" fixtures={jugados} accent="text-zinc-400" />
      <FixtureGroup title="Próximos" fixtures={proximos} accent="text-emerald-400" />
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
    const played = fixtures.filter((f) => f.status === "played").sort((a, b) => new Date(b.date || b.matchDate) - new Date(a.date || a.matchDate));
    const scheduled = fixtures.filter((f) => f.status === "scheduled").sort((a, b) => new Date(a.date || a.matchDate) - new Date(b.date || b.matchDate));
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
          <FixtureGroup title="Jugados" fixtures={jugados} isYouth accent="text-zinc-400" />
          <FixtureGroup title="Próximos" fixtures={proximos} isYouth accent="text-emerald-400" />
        </div>
      )}
    </div>
  );
}

export default function FixturesSection() {
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.FootballFixture.list("-date", 500)
      .then((all) => setFixtures(all || []))
      .catch(() => setFixtures([]))
      .finally(() => setLoading(false));
  }, []);

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
          <PrimeraTab fixtures={fixtures} loading={loading} />
        </TabsContent>
        <TabsContent value="reserva">
          <ReservaTab fixtures={fixtures} loading={loading} />
        </TabsContent>
        <TabsContent value="juveniles">
          <JuvenilesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}