import React, { useMemo } from "react";
import { Trophy, Goal, CalendarClock, CheckCircle2, Hourglass, TrendingUp } from "lucide-react";

function extractRoundNumber(round) {
  const m = (round || "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-bold text-white leading-none">{value}</p>
        <p className="text-xs text-zinc-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

export default function StatsTab({ fixtures, standings }) {
  const stats = useMemo(() => {
    const list = (fixtures || []).filter((f) => f && f.homeTeam);
    const played = list.filter((f) => f.status === "finished");
    const remaining = list.filter((f) => f.status === "scheduled" || f.status === "postponed");

    // Current matchday: first round with unfinished matches
    const rounds = [...new Set(list.map((f) => f.round).filter(Boolean))];
    let currentMatchday = "—";
    for (const r of rounds) {
      const roundMatches = list.filter((f) => f.round === r);
      const hasUnfinished = roundMatches.some((m) => m.status !== "finished");
      if (hasUnfinished) { currentMatchday = r; break; }
    }
    if (currentMatchday === "—" && rounds.length) currentMatchday = rounds[rounds.length - 1];

    // Top scoring teams from finished matches
    const teamGoals = new Map();
    for (const f of played) {
      if (f.homeScore != null) teamGoals.set(f.homeTeam, (teamGoals.get(f.homeTeam) || 0) + f.homeScore);
      if (f.awayScore != null) teamGoals.set(f.awayTeam, (teamGoals.get(f.awayTeam) || 0) + f.awayScore);
    }
    const topScorers = [...teamGoals.entries()]
      .map(([team, goals]) => ({ team, goals }))
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 5);

    // Top teams by points from standings
    const topByPoints = (standings || [])
      .slice()
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);

    return { total: list.length, played: played.length, remaining: remaining.length, currentMatchday, topScorers, topByPoints };
  }, [fixtures, standings]);

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={Trophy} label="Total partidos" value={stats.total} color="bg-yellow-500/15 text-yellow-400" />
        <SummaryCard icon={CheckCircle2} label="Jugados" value={stats.played} color="bg-emerald-500/15 text-emerald-400" />
        <SummaryCard icon={Hourglass} label="Restantes" value={stats.remaining} color="bg-blue-500/15 text-blue-400" />
        <SummaryCard icon={CalendarClock} label="Fecha actual" value={stats.currentMatchday} color="bg-purple-500/15 text-purple-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top scoring teams */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white mb-3">
            <Goal size={16} className="text-yellow-400" /> Equipos con más goles
          </h3>
          {stats.topScorers.length === 0 ? (
            <p className="text-zinc-500 text-sm">Sin datos de goles todavía.</p>
          ) : (
            <div className="space-y-2">
              {stats.topScorers.map((t, i) => (
                <div key={t.team} className="flex items-center gap-3">
                  <span className="w-5 text-zinc-500 text-xs font-bold">{i + 1}</span>
                  <span className="flex-1 text-zinc-300 text-sm truncate">{t.team}</span>
                  <span className="text-white font-bold text-sm">{t.goals}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top by points */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white mb-3">
            <TrendingUp size={16} className="text-emerald-400" /> Líderes de la zona
          </h3>
          {stats.topByPoints.length === 0 ? (
            <p className="text-zinc-500 text-sm">Sin datos de tabla todavía.</p>
          ) : (
            <div className="space-y-2">
              {stats.topByPoints.map((t, i) => (
                <div key={t.teamName} className="flex items-center gap-3">
                  <span className="w-5 text-zinc-500 text-xs font-bold">{i + 1}</span>
                  {t.teamLogo ? <img src={t.teamLogo} alt="" className="w-5 h-5 object-contain shrink-0" onError={(e) => { e.target.style.display = "none"; }} /> : null}
                  <span className="flex-1 text-zinc-300 text-sm truncate">{t.teamName}</span>
                  <span className="text-white font-bold text-sm">{t.points} pts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}