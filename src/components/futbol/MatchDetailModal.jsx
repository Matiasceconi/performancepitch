import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Loader2, AlertCircle, Goal, Square, Repeat, ChevronRight } from "lucide-react";

const POS_LABEL = { G: "ARCO", D: "DEF", M: "MED", F: "DEL" };

function layoutPlayers(lineup, side) {
  const groups = { G: [], D: [], M: [], F: [] };
  (lineup || []).forEach((p) => {
    const key = String(p.pos || "M").charAt(0).toUpperCase();
    const g = ["G", "D", "M", "F"].includes(key) ? key : "M";
    groups[g].push(p);
  });
  const depthMap = { G: 0.07, D: 0.22, M: 0.40, F: 0.56 };
  const result = [];
  ["G", "D", "M", "F"].forEach((pos) => {
    const players = groups[pos];
    if (!players.length) return;
    const depth = depthMap[pos];
    players.forEach((p, i) => {
      const n = players.length;
      const y = n === 1 ? 0.5 : 0.12 + (i / (n - 1)) * 0.76;
      const x = side === "home" ? depth : 1 - depth;
      result.push({ ...p, x, y });
    });
  });
  return result;
}

function PlayerDot({ player, side }) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
      style={{ left: `${player.x * 100}%`, top: `${player.y * 100}%` }}
    >
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 border-white/90 shadow-md ${
          side === "home" ? "bg-blue-600 text-white" : "bg-red-600 text-white"
        }`}
      >
        {player.number || ""}
      </div>
      <span className="text-[9px] text-white bg-black/70 px-1 rounded mt-0.5 max-w-[64px] truncate leading-tight">
        {player.name || ""}
      </span>
    </div>
  );
}

function FormationPitch({ homeLineup, awayLineup, homeFormation, awayFormation }) {
  const home = layoutPlayers(homeLineup, "home");
  const away = layoutPlayers(awayLineup, "away");

  return (
    <div className="relative w-full aspect-[16/10] bg-gradient-to-b from-emerald-800 to-emerald-950 rounded-xl overflow-hidden border border-emerald-700/40">
      {/* Field markings */}
      <div className="absolute inset-1.5 border-2 border-white/25 rounded-md" />
      <div className="absolute top-1.5 bottom-1.5 left-1/2 w-0.5 bg-white/25" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 border-2 border-white/25 rounded-full" />
      <div className="absolute top-1/2 -translate-y-1/2 left-1.5 w-10 h-20 border-2 border-white/25 border-l-0" />
      <div className="absolute top-1/2 -translate-y-1/2 right-1.5 w-10 h-20 border-2 border-white/25 border-r-0" />

      {/* Formation labels */}
      <span className="absolute top-2 left-3 text-xs font-bold text-white/70">{homeFormation}</span>
      <span className="absolute top-2 right-3 text-xs font-bold text-white/70">{awayFormation}</span>

      {/* Players */}
      {home.map((p, i) => <PlayerDot key={`h-${i}`} player={p} side="home" />)}
      {away.map((p, i) => <PlayerDot key={`a-${i}`} player={p} side="away" />)}
    </div>
  );
}

function EventRow({ ev }) {
  const isHome = ev.team === "home";
  const isGoal = ev.type === "Goal";
  const isCard = ev.type === "Card";
  const isSubst = ev.type === "subst";
  const isRed = isCard && String(ev.detail || "").toLowerCase().includes("red");

  const Icon = isGoal ? Goal : isCard ? Square : isSubst ? Repeat : ChevronRight;
  const iconColor = isGoal ? "text-emerald-400" : isRed ? "text-red-500" : isCard ? "text-yellow-400" : "text-zinc-400";

  return (
    <div className={`flex items-start gap-2.5 p-2 rounded-lg bg-zinc-900/60 ${isHome ? "" : "flex-row-reverse text-right"}`}>
      <span className="text-xs text-zinc-500 font-mono shrink-0 w-8 pt-0.5">{ev.time || 0}'</span>
      <Icon size={16} className={`shrink-0 mt-0.5 ${iconColor}`} />
      <div className={`flex-1 min-w-0 ${isHome ? "text-left" : "text-right"}`}>
        <p className="text-sm text-white truncate">{ev.player || ""}</p>
        {ev.assist && <p className="text-xs text-zinc-500">Asistencia: {ev.assist}</p>}
        {ev.detail && ev.detail !== "Normal Goal" && <p className="text-xs text-zinc-500">{ev.detail}</p>}
      </div>
    </div>
  );
}

function EventsTimeline({ events }) {
  const sorted = [...(events || [])].sort((a, b) => (a.time || 0) - (b.time || 0));
  if (!sorted.length) return <p className="text-zinc-500 text-sm text-center py-6">Sin eventos registrados.</p>;
  return (
    <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
      {sorted.map((ev, i) => <EventRow key={i} ev={ev} />)}
    </div>
  );
}

function normalizeStats(statistics) {
  if (!statistics) return [];
  if (Array.isArray(statistics)) {
    const homeMap = {};
    const awayMap = {};
    statistics.forEach((s) => {
      if (s.team === "home") homeMap[s.type] = s.value;
      else if (s.team === "away") awayMap[s.type] = s.value;
    });
    const types = [...new Set([...Object.keys(homeMap), ...Object.keys(awayMap)])];
    return types.map((type) => ({ type, home: homeMap[type], away: awayMap[type] }));
  }
  if (statistics.home && statistics.away) {
    const homeArr = Array.isArray(statistics.home) ? statistics.home : [];
    const awayArr = Array.isArray(statistics.away) ? statistics.away : [];
    const homeMap = Object.fromEntries(homeArr.map((s) => [s.type, s.value]));
    const awayMap = Object.fromEntries(awayArr.map((s) => [s.type, s.value]));
    const types = [...new Set([...Object.keys(homeMap), ...Object.keys(awayMap)])];
    return types.map((type) => ({ type, home: homeMap[type], away: awayMap[type] }));
  }
  return [];
}

function StatBar({ stat }) {
  const home = parseFloat(String(stat.home || "").replace(/[^\d.]/g, "")) || 0;
  const away = parseFloat(String(stat.away || "").replace(/[^\d.]/g, "")) || 0;
  const total = home + away;
  const homePct = total > 0 ? (home / total) * 100 : 50;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-white font-semibold w-12 text-left">{stat.home || "—"}</span>
        <span className="text-zinc-400 text-xs uppercase tracking-wide">{stat.type}</span>
        <span className="text-white font-semibold w-12 text-right">{stat.away || "—"}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-zinc-800">
        <div className="bg-blue-500 transition-all" style={{ width: `${homePct}%` }} />
        <div className="bg-red-500 transition-all" style={{ width: `${100 - homePct}%` }} />
      </div>
    </div>
  );
}

function MatchStatistics({ statistics }) {
  const stats = normalizeStats(statistics);
  if (!stats.length) return <p className="text-zinc-500 text-sm text-center py-6">Sin estadísticas disponibles.</p>;
  return (
    <div className="space-y-3">
      {stats.map((s, i) => <StatBar key={i} stat={s} />)}
    </div>
  );
}

function LineupList({ lineup, side, label }) {
  const groups = { G: [], D: [], M: [], F: [] };
  (lineup || []).forEach((p) => {
    const key = String(p.pos || "M").charAt(0).toUpperCase();
    const g = ["G", "D", "M", "F"].includes(key) ? key : "M";
    groups[g].push(p);
  });

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{label}</h4>
      {["G", "D", "M", "F"].map((pos) => {
        if (!groups[pos].length) return null;
        return (
          <div key={pos}>
            <p className="text-[10px] font-bold text-zinc-600 uppercase mb-1">{POS_LABEL[pos]}</p>
            <div className="space-y-1">
              {groups[pos].map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${side === "home" ? "bg-blue-600/20 text-blue-300" : "bg-red-600/20 text-red-300"}`}>
                    {p.number || ""}
                  </span>
                  <span className="text-zinc-300 truncate">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MatchDetailModal({ fixture, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("pitch");

  const loadDetail = (fx) => {
    setLoading(true);
    setError("");
    setDetail(null);
    base44.functions
      .invoke("fetchMatchDetail", { fixtureId: fx.fixtureId || fx.id })
      .then((res) => {
        const data = res.data || res;
        if (data.error) throw new Error(data.error);
        setDetail(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e?.message || "Error al cargar el detalle");
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!fixture) return;
    loadDetail(fixture);
  }, [fixture]);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  if (!fixture) return null;

  const homeName = fixture.homeTeam || detail?.homeName;
  const awayName = fixture.awayTeam || detail?.awayName;
  const homeLogo = fixture.homeLogo || detail?.homeLogo;
  const awayLogo = fixture.awayLogo || detail?.awayLogo;
  const homeScore = fixture.homeScore ?? detail?.homeScore;
  const awayScore = fixture.awayScore ?? detail?.awayScore;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto" onClick={onClose}>
      <div
        className="relative w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
          <X size={16} />
        </button>

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800">
          <div className="flex items-center justify-center gap-3 sm:gap-6">
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              {homeLogo ? <img src={homeLogo} alt="" className="w-12 h-12 object-contain" onError={(e) => { e.target.style.display = "none"; }} /> : <div className="w-12 h-12 rounded-full bg-zinc-800" />}
              <span className="text-sm font-semibold text-white text-center truncate w-full">{homeName}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {homeScore != null && awayScore != null ? (
                <>
                  <span className="text-3xl font-black text-white">{homeScore}</span>
                  <span className="text-zinc-600 text-xl">-</span>
                  <span className="text-3xl font-black text-white">{awayScore}</span>
                </>
              ) : (
                <span className="text-zinc-500 text-sm uppercase">vs</span>
              )}
            </div>
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              {awayLogo ? <img src={awayLogo} alt="" className="w-12 h-12 object-contain" onError={(e) => { e.target.style.display = "none"; }} /> : <div className="w-12 h-12 rounded-full bg-zinc-800" />}
              <span className="text-sm font-semibold text-white text-center truncate w-full">{awayName}</span>
            </div>
          </div>
          {fixture.date && (
            <p className="text-center text-xs text-zinc-500 mt-3 capitalize">
              {new Date(fixture.date).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            </p>
          )}
          {fixture.venue && <p className="text-center text-xs text-zinc-600 mt-0.5">{fixture.venue}</p>}
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={28} className="animate-spin text-zinc-600" />
              <p className="text-zinc-500 text-sm">Cargando detalles...</p>
              <p className="text-zinc-600 text-xs">La primera vez puede tardar unos segundos</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertCircle size={28} className="text-red-400" />
              <p className="text-zinc-400 text-sm text-center max-w-xs">{error}</p>
              <button onClick={() => loadDetail(fixture)} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors">
                Reintentar
              </button>
            </div>
          ) : detail ? (
            <>
              {/* View tabs */}
              <div className="flex gap-1 mb-4 border-b border-zinc-800">
                {[
                  { id: "pitch", label: "Formaciones" },
                  { id: "events", label: "Eventos" },
                  { id: "stats", label: "Estadísticas" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setView(t.id)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${view === t.id ? "border-blue-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {view === "pitch" && (
                <div className="space-y-4">
                  <FormationPitch
                    homeLineup={detail.homeLineup}
                    awayLineup={detail.awayLineup}
                    homeFormation={detail.homeFormation}
                    awayFormation={detail.awayFormation}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {homeLogo ? <img src={homeLogo} alt="" className="w-5 h-5 object-contain" onError={(e) => { e.target.style.display = "none"; }} /> : null}
                        <span className="text-sm font-bold text-white truncate">{homeName}</span>
                      </div>
                      {detail.homeCoach && <p className="text-xs text-zinc-500 mb-2">DT: {detail.homeCoach}</p>}
                      <LineupList lineup={detail.homeLineup} side="home" label="XI Inicial" />
                      {detail.homeSubs?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-zinc-800">
                          <LineupList lineup={detail.homeSubs} side="home" label="Suplentes" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {awayLogo ? <img src={awayLogo} alt="" className="w-5 h-5 object-contain" onError={(e) => { e.target.style.display = "none"; }} /> : null}
                        <span className="text-sm font-bold text-white truncate">{awayName}</span>
                      </div>
                      {detail.awayCoach && <p className="text-xs text-zinc-500 mb-2">DT: {detail.awayCoach}</p>}
                      <LineupList lineup={detail.awayLineup} side="away" label="XI Inicial" />
                      {detail.awaySubs?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-zinc-800">
                          <LineupList lineup={detail.awaySubs} side="away" label="Suplentes" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {view === "events" && <EventsTimeline events={detail.events} />}

              {view === "stats" && <MatchStatistics statistics={detail.statistics} />}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}