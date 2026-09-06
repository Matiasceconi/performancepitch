import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertCircle, RefreshCw, ShieldCheck,
  Target, TrendingUp, Trophy,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useWorkspace } from "@/lib/WorkspaceContext";
import ClubStandingsTable from "@/components/club/ClubStandingsTable";
import NextMatchCard from "@/components/club/NextMatchCard";
import TodayMatchAlert from "@/components/club/TodayMatchAlert";
import LastResults from "@/components/club/LastResults";
import CalendarDates from "@/components/club/CalendarDates";
import QuickActions from "@/components/club/QuickActions";
import FixtureModal from "@/components/club/FixtureModal";
import ScorersTable from "@/components/club/ScorersTable";
import NextYouthMatch from "@/components/club/NextYouthMatch";
import FixturesSection from "@/components/club/FixturesSection";
import YouthCategorySelector from "@/components/club/YouthCategorySelector";
import YouthStandingsTable from "@/components/club/YouthStandingsTable";
import {
  buildClubAliases,
  buildDivisionModel,
  buildMatchModel,
  competitionDisplayName,
  fixtureRival,
  formatDateOnly,
  getDateKeyInTimezone,
  phaseLabel,
  zoneLabel,
} from "@/lib/clubCompetitionUtils";

function StatTile({ icon: Icon, label, value, accent, tone, detail }) {
  const borderCls = tone === "pos" ? "border-emerald-500/30" : tone === "neg" ? "border-red-500/30" : "border-zinc-800";
  return (
    <div className={`bg-zinc-900 border ${borderCls} rounded-xl p-4 flex items-center gap-3 shadow-lg shadow-black/20`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent}`}><Icon size={20} /></div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide truncate">{label}</p>
        <p className="text-2xl font-bold text-white leading-tight">{value}</p>
        {detail && <p className="mt-0.5 text-[10px] text-zinc-600 truncate">{detail}</p>}
      </div>
    </div>
  );
}

function CompetitionStatusCard({ label, model, aliases, accentClass }) {
  const row = model.currentRow;
  const phase = phaseLabel(model.currentGroup);
  const zone = zoneLabel(model.currentGroup);
  const next = model.matchModel?.upcoming?.[0];
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">{label}</p>
          <p className="mt-1 truncate text-sm font-black text-white">{phase}{zone ? ` · ${zone}` : ""}</p>
          <p className="mt-1 text-xs text-zinc-500">{row ? `${row.points} pts · ${row.played} PJ` : "Tabla vigente no disponible"}</p>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-black leading-none ${accentClass}`}>{row ? `${row.position}°` : "—"}</p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-zinc-600">torneo vigente</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
        <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-600">Próximo rival</span>
        <span className="truncate text-xs font-bold text-zinc-300">{next ? fixtureRival(next, aliases) : "Por confirmar"}</span>
      </div>
    </div>
  );
}

function TableModeButton({ active, onClick, children, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-30 ${active ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}
    >
      {children}
    </button>
  );
}

function latestStandingDate(...models) {
  const dates = models
    .flatMap((model) => [...(model.currentRows || []), ...(model.annualRows || [])])
    .map((row) => row.lastUpdated || row.updated_date)
    .filter(Boolean)
    .sort();
  return dates.at(-1) || "";
}

export default function ClubDashboard() {
  const { clubBrand, activeSquad, institutionProfile } = useWorkspace();
  const teamName = institutionProfile?.official_name || clubBrand?.name || "Club";
  const timeZone = institutionProfile?.timezone || "America/Argentina/Buenos_Aires";
  const today = getDateKeyInTimezone(timeZone);
  const season = institutionProfile?.default_season || clubBrand?.season || today.slice(0, 4);
  const aliases = useMemo(() => buildClubAliases(institutionProfile, clubBrand), [institutionProfile, clubBrand]);

  const [standings, setStandings] = useState([]);
  const [matches, setMatches] = useState([]);
  const [internalCompetitions, setInternalCompetitions] = useState([]);
  const [scorersProyeccion, setScorersProyeccion] = useState([]);
  const [scorersLiga, setScorersLiga] = useState([]);
  const [activeDivision, setActiveDivision] = useState("primera");
  const [tableMode, setTableMode] = useState("current");
  const [activeYouthCategory, setActiveYouthCategory] = useState("4ta");
  const [showFixture, setShowFixture] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState(null);
  const tableRef = useRef(null);

  const loadData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const [standingRows, matchRows, competitions] = await Promise.all([
        base44.entities.Standings.list("-lastUpdated", 2000),
        base44.entities.UpcomingMatch.list("matchDate", 2000),
        base44.entities.Competitions.list("name", 200),
      ]);
      setStandings(standingRows || []);
      setMatches(matchRows || []);
      setInternalCompetitions(competitions || []);

      const proyComp = (competitions || []).find((competition) => competition.division === "reserva" && competition.provider_competition_id && competition.active !== false);
      const seniorComp = (competitions || []).find((competition) => competition.division === "primera" && competition.provider_competition_id && competition.active !== false);
      const [proyScorers, seniorScorers] = await Promise.all([
        proyComp ? base44.entities.FootballScorer.filter({ competitionId: proyComp.provider_competition_id, tournament: "Clausura" }, "-goals", 50).catch(() => []) : Promise.resolve([]),
        seniorComp ? base44.entities.FootballScorer.filter({ competitionId: seniorComp.provider_competition_id }, "-goals", 50).catch(() => []) : Promise.resolve([]),
      ]);
      setScorersProyeccion(proyScorers || []);
      setScorersLiga(seniorScorers || []);
      setLoadedAt(new Date());
    } catch (requestError) {
      console.error("ClubDashboard competition load", requestError);
      setError(requestError?.message || "No se pudieron cargar las competencias del club.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(false); }, [loadData]);

  useEffect(() => {
    const name = String(activeSquad?.name || "").toLowerCase();
    if (name.includes("reserva") || name.includes("proye")) {
      setActiveDivision("reserva");
      setTableMode("current");
    } else if (/4ta|5ta|6ta|7ma|8va|9na|cuarta|quinta|sexta|septima|séptima|octava|novena|juvenil/.test(name)) {
      setActiveDivision("juveniles");
    } else if (name.includes("primera")) {
      setActiveDivision("primera");
      setTableMode("current");
    }
  }, [activeSquad?.id, activeSquad?.name]);

  const senior = useMemo(() => buildDivisionModel({ standings, aliases, division: "primera", configuredCompetitions: internalCompetitions, season }), [standings, aliases, internalCompetitions, season]);
  const reserve = useMemo(() => buildDivisionModel({ standings, aliases, division: "reserva", configuredCompetitions: internalCompetitions, season }), [standings, aliases, internalCompetitions, season]);
  const seniorMatches = useMemo(() => buildMatchModel({ matches, aliases, competition: senior.competition, division: "primera", timeZone, today }), [matches, aliases, senior.competition, timeZone, today]);
  const reserveMatches = useMemo(() => buildMatchModel({ matches, aliases, competition: reserve.competition, division: "reserva", timeZone, today }), [matches, aliases, reserve.competition, timeZone, today]);

  senior.matchModel = seniorMatches;
  reserve.matchModel = reserveMatches;

  const selectedModel = activeDivision === "reserva" ? reserve : senior;
  const selectedRows = tableMode === "annual" ? selectedModel.annualRows : selectedModel.currentRows;
  const selectedRow = tableMode === "annual" ? selectedModel.annualRow : selectedModel.currentRow;
  const selectedGroup = tableMode === "annual" ? selectedModel.annualGroup : selectedModel.currentGroup;
  const selectedCompetitionLabel = competitionDisplayName(selectedModel.competition, activeDivision === "reserva" ? "reserva" : "primera");
  const selectedPhase = phaseLabel(selectedGroup);
  const selectedZone = zoneLabel(selectedGroup);

  const seniorLabel = competitionDisplayName(senior.competition, "primera");
  const reserveLabel = competitionDisplayName(reserve.competition, "reserva");
  const standingUpdated = latestStandingDate(senior, reserve);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-5 max-w-[1500px] mx-auto">
        <div className="h-40 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />)}</div>
        <div className="grid lg:grid-cols-2 gap-4"><div className="h-56 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" /><div className="h-56 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" /></div>
      </div>
    );
  }

  if (error && !standings.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center"><AlertCircle size={26} className="text-red-400" /></div>
        <p className="text-zinc-400 text-sm text-center max-w-sm">{error}</p>
        <button onClick={() => loadData(false)} className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-bold text-white">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1500px] mx-auto">
      <section className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-emerald-600/10 via-zinc-900 to-zinc-950 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              {clubBrand?.logoUrl ? <img src={clubBrand.logoUrl} alt="" className="h-14 w-14 object-contain" /> : <ShieldCheck size={28} className="text-emerald-400" />}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Tablero institucional</p>
              <h1 className="mt-1 truncate text-2xl font-black text-white sm:text-3xl">{teamName}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span>Temporada {season}</span>
                <span>·</span>
                <span>Zona horaria: {timeZone}</span>
                <span>·</span>
                <span>{standingUpdated ? `Tabla actualizada ${formatDateOnly(standingUpdated, { compact: true })}` : "Sin fecha de tabla"}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <QuickActions onFixture={() => setShowFixture(true)} onTable={() => tableRef.current?.scrollIntoView({ behavior: "smooth" })} />
            <button onClick={() => loadData(true)} disabled={refreshing} className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-50">
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Recargar
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <CompetitionStatusCard label={seniorLabel} model={senior} aliases={aliases} accentClass="text-emerald-400" />
          <CompetitionStatusCard label={reserveLabel} model={reserve} aliases={aliases} accentClass="text-blue-400" />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-600">
          <span>Posición principal = torneo vigente. La tabla anual se muestra aparte y nunca reemplaza esa posición.</span>
          <span>{loadedAt ? `Datos leídos ${loadedAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
        </div>
      </section>

      {seniorMatches.today.map((fixture) => (
        <TodayMatchAlert
          key={fixture.id || `senior-${fixture.matchDate}`}
          fixture={fixture}
          title={`HOY · ${seniorLabel}`}
          aliases={aliases}
          timeZone={timeZone}
          standing={senior.currentRow}
          phase={phaseLabel(senior.currentGroup)}
          zone={zoneLabel(senior.currentGroup)}
        />
      ))}
      {reserveMatches.today.map((fixture) => (
        <TodayMatchAlert
          key={fixture.id || `reserve-${fixture.matchDate}`}
          fixture={fixture}
          title={`HOY · ${reserveLabel}`}
          aliases={aliases}
          timeZone={timeZone}
          standing={reserve.currentRow}
          phase={phaseLabel(reserve.currentGroup)}
          zone={zoneLabel(reserve.currentGroup)}
        />
      ))}

      {activeDivision !== "juveniles" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile icon={Trophy} label={tableMode === "annual" ? "Posición anual" : "Posición vigente"} value={selectedRow ? `${selectedRow.position}°` : "—"} accent="bg-emerald-500/15 text-emerald-400" tone={selectedRow?.position <= 4 ? "pos" : selectedRow?.position > 16 ? "neg" : undefined} detail={`${selectedPhase}${selectedZone ? ` · ${selectedZone}` : ""}`} />
          <StatTile icon={Target} label="Puntos" value={selectedRow?.points ?? "—"} accent="bg-yellow-500/15 text-yellow-400" />
          <StatTile icon={Activity} label="Partidos jugados" value={selectedRow?.played ?? "—"} accent="bg-blue-500/15 text-blue-400" />
          <StatTile icon={TrendingUp} label="Diferencia de gol" value={selectedRow ? (selectedRow.goalDifference > 0 ? `+${selectedRow.goalDifference}` : selectedRow.goalDifference) : "—"} accent="bg-purple-500/15 text-purple-400" tone={selectedRow?.goalDifference > 0 ? "pos" : selectedRow?.goalDifference < 0 ? "neg" : undefined} />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <NextMatchCard fixture={reserveMatches.upcoming[0]} title="Próximo Partido — Reserva" badgeText="Proyección" badgeClass="bg-emerald-500/15 text-emerald-300 border-emerald-500/30" iconClass="text-emerald-400" timeZone={timeZone} />
        <NextMatchCard fixture={seniorMatches.upcoming[0]} title={`Próximo Partido — ${seniorLabel}`} badgeText={phaseLabel(senior.currentGroup)} badgeClass="bg-blue-500/15 text-blue-300 border-blue-500/30" iconClass="text-blue-400" timeZone={timeZone} />
      </div>

      <NextYouthMatch />

      <FixturesSection
        seniorFixtures={seniorMatches.all}
        reserveFixtures={reserveMatches.all}
        loading={loading}
        teamName={teamName}
        timeZone={timeZone}
        seniorLabel={`${seniorLabel} · ${phaseLabel(senior.currentGroup)}${zoneLabel(senior.currentGroup) ? ` · ${zoneLabel(senior.currentGroup)}` : ""}`}
      />

      <section ref={tableRef} className="space-y-3">
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-white"><Trophy size={18} className="text-emerald-400" /> Tabla de clasificación</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {activeDivision === "juveniles" ? "Seleccioná la categoría juvenil." : `${selectedCompetitionLabel} · ${selectedPhase}${selectedZone ? ` · ${selectedZone}` : ""}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <TableModeButton active={activeDivision === "primera"} onClick={() => { setActiveDivision("primera"); setTableMode("current"); }}>Primera</TableModeButton>
            <TableModeButton active={activeDivision === "reserva"} onClick={() => { setActiveDivision("reserva"); setTableMode("current"); }}>Reserva</TableModeButton>
            <TableModeButton active={activeDivision === "juveniles"} onClick={() => setActiveDivision("juveniles")}>Juveniles</TableModeButton>
            {activeDivision !== "juveniles" && <span className="mx-1 hidden h-7 w-px bg-zinc-700 sm:block" />}
            {activeDivision !== "juveniles" && (
              <>
                <TableModeButton active={tableMode === "current"} onClick={() => setTableMode("current")}>Torneo vigente</TableModeButton>
                <TableModeButton active={tableMode === "annual"} onClick={() => setTableMode("annual")} disabled={!selectedModel.annualRows.length}>Tabla anual</TableModeButton>
              </>
            )}
          </div>
        </div>

        {activeDivision === "juveniles" ? (
          <div className="space-y-3">
            <YouthCategorySelector activeCategory={activeYouthCategory} onCategory={setActiveYouthCategory} />
            <YouthStandingsTable category={activeYouthCategory} highlightTeam={teamName} />
          </div>
        ) : selectedRows.length ? (
          <ClubStandingsTable standings={selectedRows} highlightTeam={teamName} />
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900 p-8 text-center">
            <Trophy size={28} className="mx-auto mb-3 text-zinc-600" />
            <p className="text-sm font-medium text-zinc-400">Tabla no disponible para esta selección.</p>
          </div>
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <ScorersTable scorers={scorersProyeccion} title="Goleadores — Proyección" accent="green" type="proyeccion" highlightTeam={teamName} />
        <ScorersTable scorers={scorersLiga} title={`Goleadores — ${seniorLabel}`} accent="blue" type="liga" highlightTeam={teamName} showPhoto />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <LastResults fixtures={reserveMatches.results} teamName={teamName} title="Últimos Resultados — Reserva" accent="text-emerald-400" />
        <LastResults fixtures={seniorMatches.results} teamName={teamName} title={`Últimos Resultados — ${seniorLabel}`} accent="text-blue-400" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <CalendarDates fixtures={seniorMatches.upcoming} teamName={teamName} timeZone={timeZone} title={`Próximas fechas — ${seniorLabel}`} />
        <CalendarDates fixtures={reserveMatches.upcoming} teamName={teamName} timeZone={timeZone} title="Próximas fechas — Reserva" />
      </div>

      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs leading-5 text-zinc-400">
        <span className="font-bold text-blue-200">Lógica del tablero:</span> posiciones y partidos se leen desde las entidades centralizadas de competencias; la posición visible prioritaria siempre corresponde al torneo vigente. Si existe un partido en la fecha local de la institución, el aviso aparece automáticamente por encima del resto de los módulos.
      </div>

      {showFixture && <FixtureModal fixtures={reserveMatches.all} teamName={teamName} onClose={() => setShowFixture(false)} title="Fixture completo — Reserva" />}
    </div>
  );
}
