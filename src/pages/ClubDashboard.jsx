import React, { useMemo } from "react";
import { Trophy, Loader2, AlertCircle, MapPin, Calendar, TrendingUp, Target, Activity } from "lucide-react";
import { useFootballData } from "@/components/futbol/useFootballData";
import { useWorkspace } from "@/lib/WorkspaceContext";
import ClubStandingsTable from "@/components/club/ClubStandingsTable";

const COMPETITION_ID = "6a6d7e6852dc4637a1cf1260";
const TEAM_NAME = "Defensa y Justicia";
const ZONE = "Zona B";

function fmtFull(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function fmtShort(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "numeric", month: "short",
    });
  } catch { return iso; }
}

function StatTile({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3 shadow-lg shadow-black/20">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white leading-tight">{value}</p>
      </div>
    </div>
  );
}

export default function ClubDashboard() {
  const { data, loading, error } = useFootballData();
  const { clubBrand } = useWorkspace();

  const allStandings = data?.standings?.[COMPETITION_ID] || [];

  const clausuraStandings = useMemo(
    () => allStandings.filter((s) => s.tournament === "Clausura" && s.group === ZONE).sort((a, b) => a.position - b.position),
    [allStandings]
  );

  const generalStandings = useMemo(
    () => allStandings.filter((s) => s.tournament === "Tabla General 2026" && s.group === ZONE).sort((a, b) => a.position - b.position),
    [allStandings]
  );

  const dyhRow = clausuraStandings.find((s) => s.teamName === TEAM_NAME);

  const upcoming = useMemo(
    () =>
      (data?.fixtures || [])
        .filter((f) => f.competitionId === COMPETITION_ID && f.status === "scheduled")
        .filter((f) => f.homeTeam === TEAM_NAME || f.awayTeam === TEAM_NAME)
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [data?.fixtures]
  );

  const nextMatch = upcoming[0];
  const next5 = upcoming.slice(0, 5);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 size={28} className="animate-spin text-emerald-500" />
        <p className="text-zinc-500 text-sm">Cargando datos del club...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertCircle size={26} className="text-red-400" />
        </div>
        <p className="text-zinc-400 text-sm text-center max-w-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600/10 via-zinc-900 to-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-4">
          {clubBrand?.logoUrl ? (
            <img src={clubBrand.logoUrl} alt="" className="w-16 h-16 object-contain shrink-0" onError={(e) => { e.target.style.display = "none"; }} />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Trophy size={28} className="text-emerald-400" />
            </div>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">{clubBrand?.name || TEAM_NAME}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs font-semibold border border-emerald-500/30">Torneo Proyección</span>
              <span className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-700">Clausura 2026</span>
              <span className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-700">{ZONE}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={Trophy} label="Posición" value={dyhRow ? `${dyhRow.position}°` : "—"} accent="bg-emerald-500/15 text-emerald-400" />
        <StatTile icon={Target} label="Puntos" value={dyhRow?.points ?? "—"} accent="bg-yellow-500/15 text-yellow-400" />
        <StatTile icon={Activity} label="Partidos Jugados" value={dyhRow?.played ?? "—"} accent="bg-blue-500/15 text-blue-400" />
        <StatTile icon={TrendingUp} label="Gol Diferencia" value={dyhRow ? (dyhRow.goalDifference > 0 ? `+${dyhRow.goalDifference}` : dyhRow.goalDifference) : "—"} accent="bg-purple-500/15 text-purple-400" />
      </div>

      {/* Next match + Next 5 */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Next match */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-emerald-400" /> Próximo Partido
          </h2>
          {nextMatch ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 flex flex-col items-center gap-2 text-center">
                  {nextMatch.homeLogo ? <img src={nextMatch.homeLogo} alt="" className="w-14 h-14 object-contain" onError={(e) => { e.target.style.display = "none"; }} /> : <div className="w-14 h-14 rounded-full bg-zinc-800" />}
                  <span className="text-sm font-semibold text-white text-center">{nextMatch.homeTeam}</span>
                  <span className="text-xs text-zinc-500">Local</span>
                </div>
                <div className="px-2"><span className="text-zinc-600 text-xs font-bold uppercase">vs</span></div>
                <div className="flex-1 flex flex-col items-center gap-2 text-center">
                  {nextMatch.awayLogo ? <img src={nextMatch.awayLogo} alt="" className="w-14 h-14 object-contain" onError={(e) => { e.target.style.display = "none"; }} /> : <div className="w-14 h-14 rounded-full bg-zinc-800" />}
                  <span className="text-sm font-semibold text-white text-center">{nextMatch.awayTeam}</span>
                  <span className="text-xs text-zinc-500">Visitante</span>
                </div>
              </div>
              <div className="border-t border-zinc-800 pt-3 space-y-1.5">
                <p className="text-sm text-white font-medium capitalize">{fmtFull(nextMatch.date)}</p>
                <div className="flex items-center gap-2 text-xs text-zinc-400"><MapPin size={12} /> {nextMatch.venue || "Estadio a confirmar"}</div>
                <div className="flex items-center gap-2 text-xs text-zinc-400"><Trophy size={12} /> {nextMatch.round || "Fecha a confirmar"}</div>
              </div>
            </div>
          ) : (
            <p className="text-zinc-500 text-sm text-center py-8">No hay próximos partidos programados.</p>
          )}
        </div>

        {/* Next 5 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-emerald-400" /> Próximos Partidos
          </h2>
          {next5.length ? (
            <div className="space-y-2">
              {next5.map((fx, i) => {
                const isHome = fx.homeTeam === TEAM_NAME;
                const opponent = isHome ? fx.awayTeam : fx.homeTeam;
                const oppLogo = isHome ? fx.awayLogo : fx.homeLogo;
                return (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-950/50 border border-zinc-800/60 hover:border-zinc-700 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-emerald-400">{isHome ? "L" : "V"}</span>
                    </div>
                    {oppLogo ? <img src={oppLogo} alt="" className="w-7 h-7 object-contain shrink-0" onError={(e) => { e.target.style.display = "none"; }} /> : <div className="w-7 h-7 rounded-full bg-zinc-800 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">vs {opponent}</p>
                      <p className="text-xs text-zinc-500">{fx.round || "—"}</p>
                    </div>
                    <span className="text-xs text-zinc-400 shrink-0">{fmtShort(fx.date)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm text-center py-8">No hay próximos partidos.</p>
          )}
        </div>
      </div>

      {/* Clausura standings */}
      <div>
        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <Trophy size={18} className="text-emerald-400" /> Tabla de Clasificación — Clausura Zona B
        </h2>
        <ClubStandingsTable standings={clausuraStandings} highlightTeam={TEAM_NAME} />
      </div>

      {/* General standings */}
      <div>
        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <Trophy size={18} className="text-yellow-400" /> Tabla General 2026 — Zona B
        </h2>
        <ClubStandingsTable standings={generalStandings} highlightTeam={TEAM_NAME} />
      </div>
    </div>
  );
}