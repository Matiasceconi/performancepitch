import React, { useState, useMemo } from "react";

const STATUS_CFG = {
  finished: { label: "Finalizado", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  in_play: { label: "En juego", cls: "bg-red-500/15 text-red-400 border-red-500/30 animate-pulse" },
  scheduled: { label: "Programado", cls: "bg-zinc-700/40 text-zinc-300 border-zinc-600" },
  postponed: { label: "Postergado", cls: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  cancelled: { label: "Cancelado", cls: "bg-zinc-700/40 text-zinc-500 border-zinc-700" },
};

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function extractRoundNumber(round) {
  const m = (round || "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function FixtureCard({ fx }) {
  const cfg = STATUS_CFG[fx.status] || STATUS_CFG.scheduled;
  const isFinished = fx.status === "finished";
  const isInPlay = fx.status === "in_play";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 hover:border-zinc-700 transition-colors">
      <div className="flex items-center gap-3">
        {/* Home */}
        <div className="flex-1 flex items-center gap-2 min-w-0 justify-end text-right">
          <span className={`text-sm truncate ${isFinished ? "text-white font-semibold" : "text-zinc-300"}`}>{fx.homeTeam}</span>
          {fx.homeLogo ? <img src={fx.homeLogo} alt="" className="w-7 h-7 object-contain shrink-0" onError={(e) => { e.target.style.display = "none"; }} /> : <div className="w-7 h-7 rounded-full bg-zinc-800 shrink-0" />}
        </div>

        {/* Score / vs */}
        <div className="flex items-center gap-2 shrink-0 px-2">
          {isFinished || isInPlay ? (
            <>
              <span className={`text-lg font-bold ${isInPlay ? "text-red-400" : "text-white"}`}>{fx.homeScore ?? 0}</span>
              <span className="text-zinc-600 text-xs">-</span>
              <span className={`text-lg font-bold ${isInPlay ? "text-red-400" : "text-white"}`}>{fx.awayScore ?? 0}</span>
            </>
          ) : (
            <span className="text-zinc-600 text-xs font-medium uppercase">vs</span>
          )}
        </div>

        {/* Away */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {fx.awayLogo ? <img src={fx.awayLogo} alt="" className="w-7 h-7 object-contain shrink-0" onError={(e) => { e.target.style.display = "none"; }} /> : <div className="w-7 h-7 rounded-full bg-zinc-800 shrink-0" />}
          <span className={`text-sm truncate ${isFinished ? "text-white font-semibold" : "text-zinc-300"}`}>{fx.awayTeam}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-zinc-800/60">
        <div className="min-w-0">
          <p className="text-xs text-zinc-400 capitalize">{fmtDate(fx.date)}</p>
          {fx.venue && <p className="text-xs text-zinc-600 truncate">{fx.venue}</p>}
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.cls}`}>{cfg.label}</span>
      </div>
    </div>
  );
}

export default function FixturesList({ fixtures }) {
  const [filter, setFilter] = useState("upcoming"); // upcoming | results

  const grouped = useMemo(() => {
    const list = (fixtures || []).filter((f) => f && f.homeTeam);
    if (filter === "upcoming") {
      const upcoming = list
        .filter((f) => f.status === "scheduled" || f.status === "postponed")
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      return groupByRound(upcoming);
    }
    const results = list
      .filter((f) => f.status === "finished" || f.status === "in_play" || f.status === "cancelled")
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return groupByRound(results);
  }, [fixtures, filter]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setFilter("upcoming")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filter === "upcoming" ? "bg-white text-zinc-950" : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white"}`}
        >
          Próximos
        </button>
        <button
          onClick={() => setFilter("results")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filter === "results" ? "bg-white text-zinc-950" : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white"}`}
        >
          Resultados
        </button>
      </div>

      {grouped.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
          <p className="text-zinc-500 text-sm">No hay partidos {filter === "upcoming" ? "programados" : "finalizados"}.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((g) => (
            <div key={g.key} className="space-y-2">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-1">{g.label}</h3>
              <div className="space-y-2">
                {g.items.map((fx, i) => <FixtureCard key={`${fx.homeTeam}-${fx.awayTeam}-${i}`} fx={fx} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByRound(list) {
  const map = new Map();
  for (const fx of list) {
    const round = fx.round || "Sin fecha";
    const num = extractRoundNumber(round);
    const key = num != null ? `round-${num}` : round;
    if (!map.has(key)) map.set(key, { key, label: num != null ? `Fecha ${num}` : round, items: [] });
    map.get(key).items.push(fx);
  }
  return Array.from(map.values());
}