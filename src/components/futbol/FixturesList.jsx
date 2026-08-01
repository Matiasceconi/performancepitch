import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Eye } from "lucide-react";

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

function FixtureCard({ fx, onMatchClick }) {
  const cfg = STATUS_CFG[fx.status] || STATUS_CFG.scheduled;
  const isFinished = fx.status === "finished";
  const isInPlay = fx.status === "in_play";
  const clickable = isFinished && onMatchClick;

  return (
    <div
      onClick={clickable ? () => onMatchClick(fx) : undefined}
      className={`bg-zinc-900 border rounded-xl p-3 transition-colors ${clickable ? "border-zinc-800 hover:border-blue-500/50 cursor-pointer" : "border-zinc-800 hover:border-zinc-700"}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 min-w-0 justify-end text-right">
          <span className={`text-sm truncate ${isFinished ? "text-white font-semibold" : "text-zinc-300"}`}>{fx.homeTeam}</span>
          {fx.homeLogo ? <img src={fx.homeLogo} alt="" className="w-7 h-7 object-contain shrink-0" onError={(e) => { e.target.style.display = "none"; }} /> : <div className="w-7 h-7 rounded-full bg-zinc-800 shrink-0" />}
        </div>
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
        <div className="flex items-center gap-2 shrink-0">
          {clickable && (
            <span className="flex items-center gap-1 text-xs text-blue-400 font-medium">
              <Eye size={12} /> Ver detalles
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.cls}`}>{cfg.label}</span>
        </div>
      </div>
    </div>
  );
}

function RoundSection({ round, defaultOpen, onMatchClick }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/40 transition-colors"
      >
        <span className="text-sm font-bold text-white">{round.label}</span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">{round.items.length} partidos</span>
          {open ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
        </span>
      </button>
      {open && (
        <div className="p-3 space-y-2 border-t border-zinc-800/60">
          {round.items.map((fx, i) => <FixtureCard key={i} fx={fx} onMatchClick={onMatchClick} />)}
        </div>
      )}
    </div>
  );
}

function extractRoundNumber(round) {
  const m = (round || "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function roundLabel(round) {
  if (!round) return "Sin fecha";
  const num = extractRoundNumber(round);
  if (num != null) return `Fecha ${num}`;
  return round;
}

function groupByRound(list) {
  const map = new Map();
  for (const fx of list) {
    const key = fx.round || "Sin fecha";
    if (!map.has(key)) map.set(key, { key, label: roundLabel(fx.round), items: [] });
    map.get(key).items.push(fx);
  }
  return Array.from(map.values());
}

export default function FixturesList({ fixtures, onMatchClick }) {
  const grouped = useMemo(() => {
    const list = (fixtures || []).filter((f) => f && f.homeTeam);
    const groups = groupByRound(list);
    return groups.sort((a, b) => {
      const na = extractRoundNumber(a.key);
      const nb = extractRoundNumber(b.key);
      if (na != null && nb != null) return na - nb;
      if (na != null) return -1;
      if (nb != null) return 1;
      return a.key.localeCompare(b.key);
    });
  }, [fixtures]);

  if (!grouped.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
        <p className="text-zinc-500 text-sm">No hay partidos para este torneo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {grouped.map((g, i) => (
        <RoundSection key={g.key} round={g} defaultOpen={i === 0} onMatchClick={onMatchClick} />
      ))}
    </div>
  );
}