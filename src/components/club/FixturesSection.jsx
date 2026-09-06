import React, { useState, useEffect, useMemo } from "react";
import { Calendar, MapPin, Trophy, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { base44 } from "@/api/base44Client";
import ClubShield from "@/components/club/ClubShield";
import {
  formatDateOnly,
  getDateKeyInTimezone,
  matchDateValue,
  matchTimeValue,
  sameClubName,
} from "@/lib/clubCompetitionUtils";

const YOUTH_CATEGORIES = ["4ta", "5ta", "6ta", "7ma", "8va", "9na"];

function parseRound(round) {
  if (!round) return "—";
  const m = String(round).match(/(\d+)/);
  return m ? `Fecha ${m[1]}` : round;
}

function FixtureRow({ fx, isYouth, teamName }) {
  const finished = isYouth
    ? fx.status === "played"
    : fx.status === "played" || fx.status === "finished" || (fx.homeScore != null && fx.awayScore != null);
  const round = isYouth
    ? (fx.fixtureRound ? `Fecha ${fx.fixtureRound}` : parseRound(fx.round))
    : parseRound(fx.round);
  const clubHome = sameClubName(fx.homeTeam, teamName);
  const clubAway = sameClubName(fx.awayTeam, teamName);

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors ${
      (clubHome || clubAway)
        ? "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10"
        : "bg-zinc-950/40 border-zinc-800/60 hover:border-zinc-700"
    }`}>
      <div className="w-[68px] shrink-0">
        <p className="text-xs font-bold text-white leading-tight">{formatDateOnly(matchDateValue(fx), { compact: true })}</p>
        <p className="text-[11px] text-zinc-500">{matchTimeValue(fx) || "—"}</p>
      </div>
      <div className="w-16 shrink-0 hidden sm:block"><span className="text-[11px] text-zinc-500 font-medium">{round}</span></div>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
          <span className={`text-sm truncate text-right ${clubHome ? "text-emerald-400 font-bold" : "text-zinc-300"}`}>{fx.homeTeam}</span>
          <ClubShield teamName={fx.homeTeam} teamLogo={fx.homeLogo} size="w-6 h-6" />
        </div>
        <div className="shrink-0 px-1 min-w-[54px] text-center">
          {finished ? (
            <span className="text-sm font-bold text-white tabular-nums">{fx.homeScore ?? 0} - {fx.awayScore ?? 0}</span>
          ) : (
            <span className="text-[10px] text-zinc-600 font-medium uppercase">Programado</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <ClubShield teamName={fx.awayTeam} teamLogo={fx.awayLogo || fx.teamLogo} size="w-6 h-6" />
          <span className={`text-sm truncate ${clubAway ? "text-emerald-400 font-bold" : "text-zinc-300"}`}>{fx.awayTeam}</span>
        </div>
      </div>
      <div className="hidden lg:flex items-center gap-1 text-xs text-zinc-500 shrink-0 max-w-[140px] w-32">
        <MapPin size={11} className="shrink-0" /><span className="truncate">{fx.venue || "—"}</span>
      </div>
    </div>
  );
}

function FixtureGroup({ title, fixtures, isYouth, accent, max, teamName }) {
  const shown = max ? fixtures.slice(0, max) : fixtures;
  if (!shown.length) return null;
  return (
    <div>
      <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${accent}`}>
        {title}<span className="text-zinc-600 font-normal normal-case">({fixtures.length})</span>
      </h3>
      <div className="space-y-1.5">{shown.map((fx, i) => <FixtureRow key={fx.id || i} fx={fx} isYouth={isYouth} teamName={teamName} />)}</div>
    </div>
  );
}

function CategorySelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {YOUTH_CATEGORIES.map((category) => (
        <button key={category} onClick={() => onChange(category)} className={`px-2.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${value === category ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"}`}>
          {category}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ message }) {
  return <div className="py-10 text-center"><Calendar size={24} className="text-zinc-600 mx-auto mb-2" /><p className="text-zinc-500 text-sm">{message}</p></div>;
}

function SeniorTab({ fixtures, loading, subtitle, teamName, timeZone }) {
  const today = getDateKeyInTimezone(timeZone);
  const teamFixtures = useMemo(
    () => (fixtures || []).filter((fixture) => sameClubName(fixture.homeTeam, teamName) || sameClubName(fixture.awayTeam, teamName)),
    [fixtures, teamName]
  );
  const { jugados, proximos } = useMemo(() => {
    const finished = teamFixtures
      .filter((fixture) => fixture.status === "played" || fixture.status === "finished" || (fixture.homeScore != null && fixture.awayScore != null))
      .sort((a, b) => String(matchDateValue(b)).localeCompare(String(matchDateValue(a))));
    const scheduled = teamFixtures
      .filter((fixture) => fixture.status === "scheduled" && matchDateValue(fixture) >= today)
      .sort((a, b) => String(matchDateValue(a)).localeCompare(String(matchDateValue(b))));
    return { jugados: finished, proximos: scheduled };
  }, [teamFixtures, today]);

  if (loading) return <div className="py-10 flex items-center justify-center"><Loader2 size={20} className="text-zinc-500 animate-spin" /></div>;
  return (
    <div className="space-y-4">
      {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
      {!jugados.length && !proximos.length ? <EmptyState message="No hay fixtures para esta competencia" /> : (
        <div className="space-y-5">
          <FixtureGroup title="Últimos resultados" fixtures={jugados} accent="text-zinc-400" max={5} teamName={teamName} />
          <FixtureGroup title="Próximos partidos" fixtures={proximos} accent="text-emerald-400" max={5} teamName={teamName} />
        </div>
      )}
    </div>
  );
}

function JuvenilesTab({ teamName, timeZone }) {
  const [category, setCategory] = useState("4ta");
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = getDateKeyInTimezone(timeZone);

  useEffect(() => {
    setLoading(true);
    base44.entities.FootballYouthFixture.filter({ category }, "date", 200)
      .then((all) => setFixtures(all || []))
      .catch(() => setFixtures([]))
      .finally(() => setLoading(false));
  }, [category]);

  const { jugados, proximos } = useMemo(() => {
    const played = fixtures.filter((f) => f.status === "played").sort((a, b) => String(matchDateValue(b)).localeCompare(String(matchDateValue(a))));
    const scheduled = fixtures.filter((f) => f.status === "scheduled" && matchDateValue(f) >= today).sort((a, b) => String(matchDateValue(a)).localeCompare(String(matchDateValue(b))));
    return { jugados: played, proximos: scheduled };
  }, [fixtures, today]);

  return (
    <div className="space-y-4">
      <CategorySelector value={category} onChange={setCategory} />
      {loading ? <div className="py-10 flex items-center justify-center"><Loader2 size={20} className="text-zinc-500 animate-spin" /></div> : !jugados.length && !proximos.length ? (
        <EmptyState message={`No hay fixtures de ${category} División`} />
      ) : (
        <div className="space-y-5">
          <FixtureGroup title="Últimos resultados" fixtures={jugados} isYouth accent="text-zinc-400" max={5} teamName={teamName} />
          <FixtureGroup title="Próximos partidos" fixtures={proximos} isYouth accent="text-emerald-400" max={5} teamName={teamName} />
        </div>
      )}
    </div>
  );
}

export default function FixturesSection({ seniorFixtures = [], reserveFixtures = [], loading = false, teamName = "Club", timeZone = "America/Argentina/Buenos_Aires", seniorLabel = "Plantel superior" }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4"><Trophy size={18} className="text-emerald-400" /><h2 className="text-lg font-bold text-white">Fixtures</h2></div>
      <Tabs defaultValue="primera">
        <TabsList className="bg-zinc-800 w-full justify-stretch mb-4">
          <TabsTrigger value="primera" className="flex-1 data-[state=active]:bg-emerald-500 data-[state=active]:text-zinc-950">Primera</TabsTrigger>
          <TabsTrigger value="reserva" className="flex-1 data-[state=active]:bg-emerald-500 data-[state=active]:text-zinc-950">Reserva</TabsTrigger>
          <TabsTrigger value="juveniles" className="flex-1 data-[state=active]:bg-emerald-500 data-[state=active]:text-zinc-950">Juveniles</TabsTrigger>
        </TabsList>
        <TabsContent value="primera"><SeniorTab fixtures={seniorFixtures} loading={loading} subtitle={seniorLabel} teamName={teamName} timeZone={timeZone} /></TabsContent>
        <TabsContent value="reserva"><SeniorTab fixtures={reserveFixtures} loading={loading} subtitle="Torneo Proyección" teamName={teamName} timeZone={timeZone} /></TabsContent>
        <TabsContent value="juveniles"><JuvenilesTab teamName={teamName} timeZone={timeZone} /></TabsContent>
      </Tabs>
    </div>
  );
}
