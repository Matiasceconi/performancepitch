import React, { useMemo } from "react";
import { useFootballData } from "@/components/futbol/useFootballData";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { ShieldCheck, Loader2, AlertCircle, MapPin, Calendar, Trophy, Goal } from "lucide-react";

const COMPETITION_ID = "6a6d7e6852dc4637a1cf1260";
const TEAM_NAME = "Defensa y Justicia";
const ZONE = "Zona B";
const TOURNAMENT = "Clausura";
const GENERAL_TOURNAMENT = "Tabla General 2026";

function normalizeName(name) {
  return (name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function isTeamMatch(fixture, teamName) {
  const n = normalizeName(teamName);
  return normalizeName(fixture.homeTeam) === n || normalizeName(fixture.awayTeam) === n;
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function fmtDateShort(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit", month: "short",
    });
  } catch { return iso; }
}

function StatTile({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3 shadow-sm">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-bold text-white leading-none">{value}</p>
        <p className="text-xs text-zinc-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

function StandingsRow({ row, highlighted }) {
  return (
    <tr className={`border-t border-zinc-800/60 ${highlighted ? "bg-emerald-500/[0.08] border-l-2 border-l-emerald-500" : ""}`}>
      <td className="text-center p-2.5 text-zinc-400 font-medium text-sm">{row.position}</td>
      <td className="p-2.5">
        <div className="flex items-center gap-2">
          {row.teamLogo ? <img src={row.teamLogo} alt="" className="w-5 h-5 object-contain shrink-0" onError={(e) => { e.target.style.display = "none"; }} /> : <div className="w-5 h-5 rounded-full bg-zinc-800 shrink-0" />}
          <span className={`text-sm truncate ${highlighted ? "text-emerald-300 font-semibold" : "text-zinc-300"}`}>{row.teamName}</span>
        </div>
      </td>
      <td className="text-center p-2.5 text-zinc-400 text-sm">{row.played}</td>
      <td className="text-center p-2.5 text-zinc-400 text-sm hidden sm:table-cell">{row.won}</td>
      <td className="text-center p-2.5 text-zinc-400 text-sm hidden sm:table-cell">{row.drawn}</td>
      <td className="text-center p-2.5 text-zinc-400 text-sm hidden sm:table-cell">{row.lost}</td>
      <td className="text-center p-2.5 text-zinc-400 text-sm hidden md:table-cell">{row.goalsFor}</td>
      <td className="text-center p-2.5 text-zinc-400 text-sm hidden md:table-cell">{row.goalsAgainst}</td>
      <td className="text-center p-2.5 text-zinc-400 text-sm hidden md:table-cell">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
      <td className="text-center p-2.5"><span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-md bg-zinc-800 text-white font-bold text-sm">{row.points}</span></td>
    </tr>
  );
}

function StandingsTable({ standings, teamName, title }) {
  const rows = (standings || []).slice().sort((a, b) => a.position - b.position);
  if (!rows.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
        <p className="text-zinc-500 text-sm">Sin datos para {title}.</p>
      </div>
    );
  }
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="text-sm font-bold text-white">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="text-zinc-500 text-xs uppercase bg-zinc-900">
              <th className="text-center p-2.5 font-semibold w-10">#</th>
              <th className="text-left p-2.5 font-semibold">Equipo</th>
              <th className="text-center p-2.5 font-semibold">PJ</th>
              <th className="text-center p-2.5 font-semibold hidden sm:table-cell">G</th>
              <th className="text-center p-2.5 font-semibold hidden sm:table-cell">E</th>
              <th className="text-center p-2.5 font-semibold hidden sm:table-cell">P</th>
              <th className="text-center p-2.5 font-semibold hidden md:table-cell">GF</th>
              <th className="text-center p-2.5 font-semibold hidden md:table-cell">GC</th>
              <th className="text-center p-2.5 font-semibold hidden md:table-cell">DG</th>
              <th className="text-center p-2.5 font-semibold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => <StandingsRow key={`${r.teamName}-${r.position}`} row={r} highlighted={normalizeName(r.teamName) === normalizeName(teamName)} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NextMatchCard({ fixture, teamName }) {
  if (!fixture) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
        <p className="text-zinc-500 text-sm">No hay próximos partidos programados.</p>
      </div>
    );
  }
  const isHome = normalizeName(fixture.homeTeam) === normalizeName(teamName);
  const locality = isHome ? "Local" : "Visitante";

  return (
    <div className="bg-gradient-to-br from-emerald-900/30 to-zinc-900 border border-emerald-700/30 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">PRÓXIMO PARTIDO</span>
        <span className="text-xs text-zinc-500">{fixture.round || ""}</span>
      </div>
      <div className="flex items-center justify-center gap-3 sm:gap-6">
        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          {fixture.homeLogo ? <img src={fixture.homeLogo} alt="" className="w-12 h-12 object-contain" onError={(e) => { e.target.style.display = "none"; }} /> : <div className="w-12 h-12 rounded-full bg-zinc-800" />}
          <span className="text-xs font-semibold text-white text-center truncate w-full">{fixture.homeTeam}</span>
        </div>
        <span className="text-zinc-500 text-sm font-bold shrink-0">VS</span>
        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          {fixture.awayLogo ? <img src={fixture.awayLogo} alt="" className="w-12 h-12 object-contain" onError={(e) => { e.target.style.display = "none"; }} /> : <div className="w-12 h-12 rounded-full bg-zinc-800" />}
          <span className="text-xs font-semibold text-white text-center truncate w-full">{fixture.awayTeam}</span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-zinc-800/60 space-y-1">
        <p className="text-sm text-white font-medium text-center capitalize">{fmtDate(fixture.date)}</p>
        {fixture.venue && <p className="text-xs text-zinc-500 text-center flex items-center justify-center gap-1"><MapPin size={11} /> {fixture.venue}</p>}
        <p className="text-xs text-emerald-400 text-center font-medium">{locality}</p>
      </div>
    </div>
  );
}

function UpcomingMatchRow({ fixture, teamName }) {
  const isHome = normalizeName(fixture.homeTeam) === normalizeName(teamName);
  const opponent = isHome ? fixture.awayTeam : fixture.homeTeam;
  const opponentLogo = isHome ? fixture.awayLogo : fixture.homeLogo;
  const locality = isHome ? "L" : "V";

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-800/40 transition-colors">
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isHome ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-700 text-zinc-300"}`}>{locality}</span>
      {opponentLogo ? <img src={opponentLogo} alt="" className="w-6 h-6 object-contain shrink-0" onError={(e) => { e.target.style.display = "none"; }} /> : <div className="w-6 h-6 rounded-full bg-zinc-800 shrink-0" />}
      <span className="flex-1 text-sm text-zinc-300 truncate">{opponent}</span>
      <div className="text-right shrink-0">
        <p className="text-xs text-zinc-400">{fmtDateShort(fixture.date)}</p>
        <p className="text-xs text-zinc-600">{fixture.round || ""}</p>
      </div>
    </div>
  );
}

export default function ClubDashboard() {
  const { data, loading, error } = useFootballData();
  const { clubBrand } = useWorkspace();

  const teamName = clubBrand?.name || TEAM_NAME;
  const teamLogo = clubBrand?.logoUrl;

  const clausuraStandings = useMemo(() => {
    return (data?.standings?.[COMPETITION_ID] || [])
      .filter((s) => s.tournament === TOURNAMENT && s.group === ZONE)
      .sort((a, b) => a.position - b.position);
  }, [data]);

  const generalStandings = useMemo(() => {
    return (data?.standings?.[COMPETITION_ID] || [])
      .filter((s) => (s.tournament === GENERAL_TOURNAMENT || (s.tournament || "").toLowerCase().includes("general")) && s.group === ZONE)
      .sort((a, b) => a.position - b.position);
  }, [data]);

  const dyhRow = clausuraStandings.find((s) => normalizeName(s.teamName) === normalizeName(teamName));

  const upcomingFixtures = useMemo(() => {
    return (data?.fixtures || [])
      .filter((f) => f.competitionId === COMPETITION_ID && isTeamMatch(f, teamName) && f.status === "scheduled")
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [data, teamName]);

  const nextMatch = upcomingFixtures[0];
  const next5 = upcomingFixtures.slice(0, 5);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 size={28} className="animate-spin text-emerald-500" />
        <p className="text-zinc-500 text-sm">Cargando tablero del club...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertCircle size={28} className="text-red-400" />
        <p className="text-zinc-400 text-sm text-center max-w-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        {teamLogo ? (
          <img src={teamLogo} alt={teamName} className="w-16 h-16 object-contain" onError={(e) => { e.target.style.display = "none"; }} />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
            <ShieldCheck size={28} className="text-emerald-400" />
          </div>
        )}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">{teamName}</h1>
          <p className="text-sm text-emerald-400 font-medium">Torneo Proyección - Clausura 2026</p>
          <p className="text-xs text-zinc-500">Zona B</p>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={Trophy} label="Posición" value={`${dyhRow?.position || "—"}°`} accent="bg-emerald-500/15 text-emerald-400" />
        <StatTile icon={Trophy} label="Puntos" value={dyhRow?.points ?? "—"} accent="bg-emerald-500/15 text-emerald-400" />
        <StatTile icon={Calendar} label="Partidos Jugados" value={dyhRow?.played ?? "—"} accent="bg-blue-500/15 text-blue-400" />
        <StatTile icon={Goal} label="Gol Diferencia" value={dyhRow?.goalDifference != null ? (dyhRow.goalDifference > 0 ? `+${dyhRow.goalDifference}` : dyhRow.goalDifference) : "—"} accent="bg-purple-500/15 text-purple-400" />
      </div>

      {/* Next match + Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NextMatchCard fixture={nextMatch} teamName={teamName} />
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-3">Próximos 5 partidos</h3>
          {next5.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-6">No hay partidos programados.</p>
          ) : (
            <div className="space-y-1">
              {next5.map((fx, i) => <UpcomingMatchRow key={i} fixture={fx} teamName={teamName} />)}
            </div>
          )}
        </div>
      </div>

      {/* Clausura standings */}
      <StandingsTable standings={clausuraStandings} teamName={teamName} title="Tabla Clausura 2026 - Zona B" />

      {/* General standings */}
      <StandingsTable standings={generalStandings} teamName={teamName} title="Tabla General 2026 - Zona B" />
    </div>
  );
}