import React, { useEffect, useMemo, useState } from "react";
import { MapPin, Clock, Users, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { base44 } from "@/api/base44Client";

const DYJ_LOGO = "https://media.api-sports.io/football/teams/18684.png";
const DYJ_NAME = "Defensa y Justicia";
const CATEGORY_ORDER = ["4ta", "5ta", "6ta", "7ma", "8va", "9na"];

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}

function fmtFullDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  } catch { return iso; }
}

function Shield({ logo, name, size = "w-8 h-8" }) {
  const [err, setErr] = useState(false);
  if (!logo || err) {
    const initials = (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("");
    return (
      <div className={`${size} rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0`}>
        <span className="text-[10px] font-bold text-zinc-400">{initials}</span>
      </div>
    );
  }
  return <img src={logo} alt={name} className={`${size} object-contain shrink-0`} onError={() => setErr(true)} />;
}

function DyJShield({ size = "w-8 h-8" }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div className={`${size} rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0`}>
        <span className="text-[10px] font-bold text-emerald-300">DYJ</span>
      </div>
    );
  }
  return <img src={DYJ_LOGO} alt={DYJ_NAME} className={`${size} object-contain shrink-0`} onError={() => setErr(true)} />;
}

// Calcula resultado desde la perspectiva de DyJ
function dyjResult(fixture) {
  if (fixture.status !== "played" || fixture.homeScore == null || fixture.awayScore == null) return null;
  const dyjGoals = fixture.isHome ? fixture.homeScore : fixture.awayScore;
  const rivalGoals = fixture.isHome ? fixture.awayScore : fixture.homeScore;
  if (dyjGoals > rivalGoals) return "W";
  if (dyjGoals < rivalGoals) return "L";
  return "D";
}

const RESULT_CFG = {
  W: { label: "G", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  D: { label: "E", cls: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" },
  L: { label: "P", cls: "bg-red-500/20 text-red-300 border-red-500/40" },
};

// ── Resumen por categoría ────────────────────────────────────────────────────
function CategorySummary({ fixtures }) {
  const stats = useMemo(() => {
    const played = fixtures.filter((f) => f.status === "played");
    const map = {};
    CATEGORY_ORDER.forEach((cat) => {
      map[cat] = { PJ: 0, PG: 0, PE: 0, PP: 0, GF: 0, GC: 0, Dif: 0 };
    });
    played.forEach((f) => {
      const s = map[f.category];
      if (!s) return;
      const dyjGoals = f.isHome ? f.homeScore : f.awayScore;
      const rivalGoals = f.isHome ? f.awayScore : f.homeScore;
      s.PJ++;
      s.GF += dyjGoals || 0;
      s.GC += rivalGoals || 0;
      if (dyjGoals > rivalGoals) s.PG++;
      else if (dyjGoals < rivalGoals) s.PP++;
      else s.PE++;
    });
    CATEGORY_ORDER.forEach((cat) => { map[cat].Dif = map[cat].GF - map[cat].GC; });
    return map;
  }, [fixtures]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Users size={16} className="text-emerald-400" /> Resumen por Categoría
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {CATEGORY_ORDER.map((cat) => {
          const s = stats[cat];
          const difCls = s.Dif > 0 ? "text-emerald-400" : s.Dif < 0 ? "text-red-400" : "text-zinc-400";
          return (
            <div key={cat} className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-3">
              <p className="text-center text-xs font-bold text-white mb-2 pb-2 border-b border-zinc-800">{cat}</p>
              <div className="grid grid-cols-2 gap-y-1 text-xs">
                <span className="text-zinc-500">PJ</span><span className="text-right text-white font-medium">{s.PJ}</span>
                <span className="text-zinc-500">PG</span><span className="text-right text-emerald-400 font-medium">{s.PG}</span>
                <span className="text-zinc-500">PE</span><span className="text-right text-yellow-400 font-medium">{s.PE}</span>
                <span className="text-zinc-500">PP</span><span className="text-right text-red-400 font-medium">{s.PP}</span>
                <span className="text-zinc-500">GF</span><span className="text-right text-white font-medium">{s.GF}</span>
                <span className="text-zinc-500">GC</span><span className="text-right text-white font-medium">{s.GC}</span>
                <span className="text-zinc-500">Dif</span><span className={`text-right font-bold ${difCls}`}>{s.Dif > 0 ? `+${s.Dif}` : s.Dif}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Fila de fecha histórica colapsable ────────────────────────────────────────
function RoundRow({ round, fixturesByCat, isExpanded, onToggle }) {
  const rival = fixturesByCat[0] ? (fixturesByCat[0].isHome ? fixturesByCat[0].awayTeam : fixturesByCat[0].homeTeam) : "—";
  const rivalLogo = fixturesByCat[0]?.teamLogo;
  const date = fixturesByCat[0]?.date || fixturesByCat[0]?.matchDate;
  const allPlayed = fixturesByCat.length > 0 && fixturesByCat.every((f) => f.status === "played");
  const anyScheduled = fixturesByCat.some((f) => f.status === "scheduled");

  // Resultados por categoría
  const resultsByCat = {};
  CATEGORY_ORDER.forEach((cat) => {
    const f = fixturesByCat.find((fx) => fx.category === cat);
    resultsByCat[cat] = f || null;
  });

  return (
    <div className={`bg-zinc-950/40 border rounded-xl overflow-hidden ${anyScheduled ? "border-blue-500/30" : "border-zinc-800"}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-3 hover:bg-zinc-900/60 transition-colors">
        <div className="w-10 text-center shrink-0">
          <p className="text-[10px] text-zinc-500 uppercase">Fecha</p>
          <p className="text-lg font-bold text-white leading-none">{round}</p>
        </div>
        <Shield logo={rivalLogo} name={rival} size="w-8 h-8" />
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-white truncate">vs {rival}</p>
          <p className="text-xs text-zinc-500">{fmtDate(date)} · {fixturesByCat[0]?.isHome ? "Local" : "Visitante"}</p>
        </div>
        {anyScheduled ? (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">Programada</span>
        ) : (
          <div className="flex items-center gap-1">
            {CATEGORY_ORDER.map((cat) => {
              const f = resultsByCat[cat];
              const r = f ? dyjResult(f) : null;
              const cfg = r ? RESULT_CFG[r] : null;
              return (
                <span key={cat} className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold border ${cfg ? cfg.cls : "bg-zinc-800/50 text-zinc-600 border-zinc-700/50"}`}>
                  {cfg ? cfg.label : "—"}
                </span>
              );
            })}
          </div>
        )}
        {isExpanded ? <ChevronUp size={16} className="text-zinc-500 shrink-0" /> : <ChevronDown size={16} className="text-zinc-500 shrink-0" />}
      </button>
      {isExpanded && (
        <div className="border-t border-zinc-800 p-3 space-y-2">
          {CATEGORY_ORDER.map((cat) => {
            const f = resultsByCat[cat];
            if (!f) return (
              <div key={cat} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900/30">
                <span className="w-10 text-xs font-bold text-zinc-500">{cat}</span>
                <span className="text-xs text-zinc-600">Sin datos</span>
              </div>
            );
            const r = dyjResult(f);
            const cfg = r ? RESULT_CFG[r] : null;
            const dyjGoals = f.isHome ? f.homeScore : f.awayScore;
            const rivalGoals = f.isHome ? f.awayScore : f.homeScore;
            return (
              <div key={cat} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900/60">
                <span className="w-10 text-xs font-bold text-white">{cat}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${f.isHome ? "bg-emerald-500/15 text-emerald-300" : "bg-blue-500/15 text-blue-300"}`}>
                  {f.isHome ? "L" : "V"}
                </span>
                <span className="text-sm text-white font-medium flex-1">
                  {f.isHome ? `${DYJ_NAME} ${dyjGoals ?? "-"} - ${rivalGoals ?? "-"} ${f.awayTeam}` : `${f.homeTeam} ${f.homeScore ?? "-"} - ${f.awayScore ?? "-"} ${DYJ_NAME}`}
                </span>
                {cfg && <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${cfg.cls}`}>{cfg.label}</span>}
                {f.venue && <span className="text-xs text-zinc-500 hidden sm:flex items-center gap-1"><MapPin size={11} />{f.venue}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Próxima fecha destacada ───────────────────────────────────────────────────
function NextRoundCard({ round, fixturesByCat }) {
  if (!fixturesByCat.length) return null;
  const date = fixturesByCat[0]?.date || fixturesByCat[0]?.matchDate;
  const rival = fixturesByCat[0]?.isHome ? fixturesByCat[0]?.awayTeam : fixturesByCat[0]?.homeTeam;
  const rivalLogo = fixturesByCat[0]?.teamLogo;
  const isHome = fixturesByCat[0]?.isHome;
  const venue = fixturesByCat[0]?.venue;

  return (
    <div className="bg-gradient-to-br from-emerald-600/10 via-zinc-900 to-zinc-900 border border-emerald-500/30 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar size={18} className="text-emerald-400" /> Próxima Fecha — Juveniles
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5 capitalize">{fmtFullDate(date)}</p>
        </div>
        <span className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-bold">
          Fecha {round}
        </span>
      </div>

      <div className="flex items-center justify-center gap-4 mb-4 py-3 bg-zinc-950/40 rounded-xl">
        {isHome ? (
          <>
            <DyJShield size="w-12 h-12" />
            <div className="text-center">
              <p className="text-xs text-zinc-500 uppercase">vs</p>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${isHome ? "bg-emerald-500/15 text-emerald-300" : "bg-blue-500/15 text-blue-300"}`}>{isHome ? "Local" : "Visitante"}</span>
            </div>
            <Shield logo={rivalLogo} name={rival} size="w-12 h-12" />
          </>
        ) : (
          <>
            <Shield logo={rivalLogo} name={rival} size="w-12 h-12" />
            <div className="text-center">
              <p className="text-xs text-zinc-500 uppercase">vs</p>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${isHome ? "bg-emerald-500/15 text-emerald-300" : "bg-blue-500/15 text-blue-300"}`}>{isHome ? "Local" : "Visitante"}</span>
            </div>
            <DyJShield size="w-12 h-12" />
          </>
        )}
      </div>

      <p className="text-center text-sm font-semibold text-white mb-3">{isHome ? `${DYJ_NAME} vs ${rival}` : `${rival} vs ${DYJ_NAME}`}</p>
      {venue && <p className="text-center text-xs text-zinc-500 mb-4 flex items-center justify-center gap-1"><MapPin size={12} /> {venue}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {CATEGORY_ORDER.map((cat) => {
          const f = fixturesByCat.find((fx) => fx.category === cat);
          if (!f) return (
            <div key={cat} className="bg-zinc-950/40 border border-zinc-800 rounded-lg p-2 text-center">
              <p className="text-xs font-bold text-zinc-500">{cat}</p>
              <p className="text-[10px] text-zinc-600 mt-1">Sin datos</p>
            </div>
          );
          return (
            <div key={cat} className={`bg-zinc-950/40 border rounded-lg p-2 text-center ${f.isHome ? "border-emerald-500/30" : "border-blue-500/30"}`}>
              <p className="text-xs font-bold text-white">{cat}</p>
              <p className="text-xs text-zinc-300 mt-1 flex items-center justify-center gap-1"><Clock size={10} /> {f.time || "—"}</p>
              <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${f.isHome ? "bg-emerald-500/15 text-emerald-300" : "bg-blue-500/15 text-blue-300"}`}>
                {f.isHome ? "Local" : "Visit"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function YouthFixturesSection() {
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRound, setExpandedRound] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const all = await base44.entities.FootballYouthFixture.list("-date", 500);
        if (cancelled) return;
        setFixtures(all || []);
      } catch (e) {
        console.error("youth fixtures", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
  }, []);

  // Group by fixtureRound
  const rounds = useMemo(() => {
    const byRound = {};
    fixtures.forEach((f) => {
      const key = f.fixtureRound;
      if (key == null) return;
      if (!byRound[key]) byRound[key] = [];
      byRound[key].push(f);
    });
    // Sort each round's fixtures by category order
    Object.keys(byRound).forEach((k) => {
      byRound[k].sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
    });
    // Sort rounds descending
    return Object.entries(byRound)
      .map(([round, fxs]) => ({ round: Number(round), fixtures: fxs }))
      .sort((a, b) => b.round - a.round);
  }, [fixtures]);

  // Next scheduled round (earliest scheduled date >= today)
  const nextRound = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduled = rounds
      .filter((r) => r.fixtures.some((f) => f.status === "scheduled"))
      .map((r) => ({ ...r, minDate: Math.min(...r.fixtures.map((f) => new Date((f.date || f.matchDate) + "T00:00:00").getTime())) }))
      .sort((a, b) => a.minDate - b.minDate);
    const upcoming = scheduled.find((r) => r.minDate >= today.getTime());
    return upcoming || scheduled[0] || null;
  }, [rounds]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-40 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
        <div className="h-32 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
        <div className="h-64 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!fixtures.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
          <Users size={18} className="text-emerald-400" /> Juveniles
        </h2>
        <p className="text-zinc-500 text-sm text-center py-8">No hay fechas de juveniles cargadas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        <Users size={20} className="text-emerald-400" /> Juveniles — Divisiones 4ta a 9na
      </h2>

      {/* Próxima fecha destacada */}
      {nextRound && <NextRoundCard round={nextRound.round} fixturesByCat={nextRound.fixtures} />}

      {/* Resumen por categoría */}
      <CategorySummary fixtures={fixtures} />

      {/* Tabla de resultados históricos */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Histórico de Fechas</h3>
        <div className="space-y-2">
          {rounds.map((r) => (
            <RoundRow
              key={r.round}
              round={r.round}
              fixturesByCat={r.fixtures}
              isExpanded={expandedRound === r.round}
              onToggle={() => setExpandedRound(expandedRound === r.round ? null : r.round)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}