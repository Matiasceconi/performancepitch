import React, { useState, useEffect, useMemo, Component } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import {
  Users, AlertCircle, Cake, Shield, ChevronRight,
  Activity, ArrowUp, ArrowDown, UserCheck, UserX, Zap
} from "lucide-react";
import moment from "moment";
import "moment/locale/es";
import TournamentTable from "@/components/staff/TournamentTable";
import TournamentImporter from "@/components/staff/TournamentImporter";
import { STATUS_LABELS } from "@/components/squad/squadConstants";

moment.locale("es");

// ─── Status color mapping ──────────────────────────────────────────────────
const STATUS_CARD_COLORS = {
  disponible:   { bg: "bg-emerald-500/15", border: "border-emerald-500/30", dot: "bg-emerald-400", text: "text-emerald-300" },
  molestia:     { bg: "bg-yellow-500/15",  border: "border-yellow-500/30",  dot: "bg-yellow-400",  text: "text-yellow-300" },
  diferenciado: { bg: "bg-amber-500/15",   border: "border-amber-500/30",   dot: "bg-amber-400",   text: "text-amber-300" },
  lesionado:    { bg: "bg-red-500/15",     border: "border-red-500/30",     dot: "bg-red-400",     text: "text-red-300" },
  convocado:    { bg: "bg-blue-500/15",    border: "border-blue-500/30",    dot: "bg-blue-400",    text: "text-blue-300" },
  ausente:      { bg: "bg-zinc-700/30",    border: "border-zinc-700",       dot: "bg-zinc-500",    text: "text-zinc-400" },
  "subió":      { bg: "bg-sky-500/15",     border: "border-sky-500/30",     dot: "bg-sky-400",     text: "text-sky-300" },
  "bajó":       { bg: "bg-orange-500/15",  border: "border-orange-500/30",  dot: "bg-orange-400",  text: "text-orange-300" },
  suspendido:   { bg: "bg-purple-500/15",  border: "border-purple-500/30",  dot: "bg-purple-400",  text: "text-purple-300" },
  reintegro:    { bg: "bg-teal-500/15",    border: "border-teal-500/30",    dot: "bg-teal-400",    text: "text-teal-300" },
  descanso:     { bg: "bg-zinc-600/20",    border: "border-zinc-600",       dot: "bg-zinc-400",    text: "text-zinc-300" },
};
const DEFAULT_COLOR = { bg: "bg-zinc-800/40", border: "border-zinc-700", dot: "bg-zinc-500", text: "text-zinc-400" };

function statusColor(status) {
  return STATUS_CARD_COLORS[status] || DEFAULT_COLOR;
}

// ─── Error Boundary ────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center text-red-400 text-sm">
        Error al cargar esta sección.
        <button onClick={() => this.setState({ hasError: false })} className="ml-2 underline text-xs">Reintentar</button>
      </div>
    );
    return this.props.children;
  }
}

// ─── Next Match Card ───────────────────────────────────────────────────────
function NextMatchCard({ match, matchReport }) {
  const daysLeft = moment(match.date).diff(moment().startOf("day"), "days");
  const [logoError, setLogoError] = useState(false);
  const [showSquad, setShowSquad] = useState(false);
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 overflow-hidden">
          {match.rival_logo_url && !logoError
            ? <img src={match.rival_logo_url} alt="Rival" className="w-full h-full object-contain p-1" onError={() => setLogoError(true)} />
            : <Shield size={24} className="text-zinc-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-0.5">Próximo partido</p>
          <p className="text-white font-bold text-base truncate">{match.title}</p>
          <p className="text-zinc-400 text-sm capitalize">
            {moment(match.date).format("dddd D [de] MMMM")}
            {match.time ? ` · ${match.time}hs` : ""}
            {match.location ? ` · ${match.location}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="text-right">
            <p className="text-3xl font-black text-white leading-none">{daysLeft}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{daysLeft === 1 ? "día" : "días"}</p>
          </div>
          {matchReport?.squad_names?.length > 0 &&
            <button onClick={() => setShowSquad(!showSquad)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/25 transition-colors font-medium">
              <Users size={12} /> Convocados ({matchReport.squad_names.length})
            </button>}
        </div>
      </div>
      {showSquad && matchReport &&
        <div className="border-t border-zinc-800 p-4">
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-3">Lista de convocados</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {matchReport.squad_names.map((name, i) =>
              <div key={i} className="flex items-center gap-2 text-sm text-white">
                <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 shrink-0">{i + 1}</span>
                {name}
              </div>)}
          </div>
        </div>}
    </div>
  );
}

// ─── Summary stat card ─────────────────────────────────────────────────────
function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <Icon size={16} className={color} />
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
    </div>
  );
}

// ─── Player row (read-only) ────────────────────────────────────────────────
function PlayerRow({ player, status, tags, notes }) {
  const col = statusColor(status);
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${col.bg} ${col.border}`}>
      {player.photo_url
        ? <img src={player.photo_url} alt={player.full_name} className="w-8 h-8 rounded-full object-cover border border-zinc-700 shrink-0" />
        : <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-zinc-500">{(player.full_name || "?").charAt(0)}</span>
          </div>}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{player.full_name}</p>
        <p className="text-xs text-zinc-500 truncate">{player.position}{player.category ? ` · ${player.category}` : ""}</p>
        {notes && <p className="text-[10px] text-zinc-500 italic truncate">"{notes}"</p>}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${col.bg} ${col.text} border ${col.border}`}>
          {STATUS_LABELS[status] || status}
        </span>
        {tags?.length > 0 && (
          <div className="flex flex-wrap gap-0.5 justify-end">
            {tags.slice(0, 2).map(t => (
              <span key={t} className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded-full border border-zinc-700">{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Group list card ───────────────────────────────────────────────────────
function GroupCard({ title, dotColor, players, statusMap, emptyText, linkTo }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotColor} inline-block`} />
          {title}
          <span className={`text-xs font-normal ${dotColor.replace("bg-", "text-")}`}>({players.length})</span>
        </h2>
        {linkTo && (
          <Link to={linkTo} className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
            Ver todos <ChevronRight size={14} />
          </Link>
        )}
      </div>
      <div className="p-3">
        {players.length === 0
          ? <p className="text-zinc-600 text-sm text-center py-5">{emptyText}</p>
          : <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {players.map(p => {
                const ds = statusMap[p.id] || {};
                return <PlayerRow key={p.id} player={p} status={ds.status || "disponible"} tags={ds.tags} notes={ds.notes} />;
              })}
            </div>}
      </div>
    </div>
  );
}

// ─── Next training summary ─────────────────────────────────────────────────
function NextTrainingPanel({ players, statusMap }) {
  const groups = {
    disponible: [],
    diferenciado: [],
    lesionado: [],
    convocado: [],
    "subió": [],
    "bajó": [],
  };
  players.forEach(p => {
    const status = statusMap[p.id]?.status || "disponible";
    if (groups[status] !== undefined) groups[status].push(p);
  });

  const rows = [
    { key: "disponible",   label: "Entrenan completo",   color: "text-emerald-400", icon: Activity },
    { key: "diferenciado", label: "Diferenciados",        color: "text-amber-400",   icon: Zap },
    { key: "lesionado",    label: "Lesionados (fuera)",   color: "text-red-400",     icon: AlertCircle },
    { key: "convocado",    label: "Convocados",           color: "text-blue-400",    icon: UserCheck },
    { key: "subió",        label: "Suben",                color: "text-sky-400",     icon: ArrowUp },
    { key: "bajó",         label: "Bajan",                color: "text-orange-400",  icon: ArrowDown },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-white">Próximo entrenamiento</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Resumen por estado del plantel</p>
      </div>
      <div className="p-4 space-y-3">
        {rows.map(({ key, label, color, icon: Icon }) => (
          <div key={key} className="flex items-start gap-3">
            <Icon size={15} className={`${color} mt-0.5 shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-300">{label}</p>
                <span className={`text-sm font-bold ${color}`}>{groups[key].length}</span>
              </div>
              {groups[key].length > 0 && (
                <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                  {groups[key].map(p => p.full_name).join(", ")}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────
export default function Dashboard() {
  const [players, setPlayers] = useState([]);
  const [statusMap, setStatusMap] = useState({}); // player_id -> DailySquadStatus
  const [sessions, setSessions] = useState([]);
  const [nextMatch, setNextMatch] = useState(null);
  const [nextMatchReport, setNextMatchReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const today = moment().format("YYYY-MM-DD");

  // Initial load
  useEffect(() => {
    async function load() {
      const [allPlayers, dayStatuses, events, s, matchReports] = await Promise.all([
        base44.entities.Player.list("-created_date", 500),
        base44.entities.DailySquadStatus.filter({ date: today }, "-updated_at", 500),
        base44.entities.DayEvent.list("date", 200),
        base44.entities.TrainingSession.list("-date", 5),
        base44.entities.MatchReport.list("-date", 20),
      ]);

      setPlayers(allPlayers.filter(p => p.active !== false));

      const map = {};
      dayStatuses.forEach(ds => { map[ds.player_id] = ds; });
      setStatusMap(map);

      setSessions(s);

      const match = events.find(e => e.type === "Partido" && e.date >= today);
      setNextMatch(match || null);
      if (match) {
        setNextMatchReport(matchReports.find(r => r.date === match.date) || null);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Real-time subscription to DailySquadStatus changes
  useEffect(() => {
    const unsubscribe = base44.entities.DailySquadStatus.subscribe((event) => {
      const ds = event.data;
      if (!ds || ds.date !== today) return;
      if (event.type === "delete") {
        setStatusMap(prev => {
          const next = { ...prev };
          // remove by id
          Object.keys(next).forEach(k => { if (next[k]?.id === ds.id) delete next[k]; });
          return next;
        });
      } else {
        setStatusMap(prev => ({ ...prev, [ds.player_id]: ds }));
      }
    });
    return unsubscribe;
  }, [today]);

  // Derived data
  const byStatus = useMemo(() => {
    const groups = {
      disponible: [], lesionado: [], molestia: [], diferenciado: [],
      suspendido: [], convocado: [], "subió": [], "bajó": [], ausente: [], otros: [],
    };
    players.forEach(p => {
      const status = statusMap[p.id]?.status || "disponible";
      if (groups[status] !== undefined) groups[status].push(p);
      else groups.otros.push(p);
    });
    return groups;
  }, [players, statusMap]);

  const birthdayPlayers = useMemo(() =>
    players.filter(p => p.birth_date && moment(p.birth_date).format("MM-DD") === moment().format("MM-DD")),
    [players]
  );

  const summaryStats = [
    { label: "Total plantel",  value: players.length,                      icon: Users,     color: "text-blue-400" },
    { label: "Disponibles",    value: byStatus.disponible.length,           icon: Activity,  color: "text-emerald-400" },
    { label: "Lesionados",     value: byStatus.lesionado.length,            icon: AlertCircle, color: "text-red-400" },
    { label: "Molestias",      value: byStatus.molestia.length,             icon: AlertCircle, color: "text-orange-400" },
    { label: "Diferenciados",  value: byStatus.diferenciado.length,         icon: Zap,       color: "text-amber-400" },
    { label: "Suspendidos",    value: byStatus.suspendido.length,           icon: UserX,     color: "text-purple-400" },
    { label: "Convocados",     value: byStatus.convocado.length,            icon: UserCheck, color: "text-blue-300" },
    { label: "Suben",          value: byStatus["subió"].length,             icon: ArrowUp,   color: "text-sky-400" },
    { label: "Bajan",          value: byStatus["bajó"].length,              icon: ArrowDown, color: "text-orange-400" },
    { label: "Ausentes",       value: byStatus.ausente.length,              icon: UserX,     color: "text-zinc-400" },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-1 capitalize">{moment().format("dddd D [de] MMMM, YYYY")}</p>
        </div>
        <Link to="/daily-squad"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium transition-colors">
          Gestionar estados <ChevronRight size={15} />
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
        {summaryStats.map(s => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Birthday */}
      {birthdayPlayers.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
          <Cake size={20} className="text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-yellow-300 font-semibold text-sm">¡Cumpleaños hoy! 🎂</p>
            <p className="text-yellow-200/80 text-sm mt-0.5">
              {birthdayPlayers.map(p => `${p.full_name} (${moment().diff(moment(p.birth_date), "years")} años)`).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {/* Next match */}
      {nextMatch && <NextMatchCard match={nextMatch} matchReport={nextMatchReport} />}

      {/* Player groups + next training */}
      <div className="grid lg:grid-cols-3 gap-4">
        <ErrorBoundary>
          <GroupCard
            title="Disponibles" dotColor="bg-emerald-400"
            players={byStatus.disponible} statusMap={statusMap}
            emptyText="Sin jugadores disponibles" linkTo="/daily-squad"
          />
        </ErrorBoundary>

        <ErrorBoundary>
          <NextTrainingPanel players={players} statusMap={statusMap} />
        </ErrorBoundary>

        <ErrorBoundary>
          <GroupCard
            title="Lesionados" dotColor="bg-red-400"
            players={byStatus.lesionado} statusMap={statusMap}
            emptyText="Sin lesionados" linkTo="/daily-squad"
          />
        </ErrorBoundary>

        {byStatus.diferenciado.length > 0 && (
          <ErrorBoundary>
            <GroupCard
              title="Diferenciados" dotColor="bg-amber-400"
              players={byStatus.diferenciado} statusMap={statusMap}
              emptyText="" linkTo="/daily-squad"
            />
          </ErrorBoundary>
        )}

        {byStatus["subió"].length > 0 && (
          <ErrorBoundary>
            <GroupCard
              title="Suben" dotColor="bg-sky-400"
              players={byStatus["subió"]} statusMap={statusMap}
              emptyText="" linkTo="/daily-squad"
            />
          </ErrorBoundary>
        )}

        {byStatus["bajó"].length > 0 && (
          <ErrorBoundary>
            <GroupCard
              title="Bajan" dotColor="bg-orange-400"
              players={byStatus["bajó"]} statusMap={statusMap}
              emptyText="" linkTo="/daily-squad"
            />
          </ErrorBoundary>
        )}

        {byStatus.convocado.length > 0 && (
          <ErrorBoundary>
            <GroupCard
              title="Convocados" dotColor="bg-blue-400"
              players={byStatus.convocado} statusMap={statusMap}
              emptyText="" linkTo="/daily-squad"
            />
          </ErrorBoundary>
        )}

        {/* Tournament table */}
        <ErrorBoundary>
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="p-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">Clasificación — Torneo Proyección</h2>
            </div>
            <div className="p-4 space-y-4">
              <TournamentImporter />
              <TournamentTable />
            </div>
          </div>
        </ErrorBoundary>

        {/* Sessions */}
        <ErrorBoundary>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">Últimas sesiones</h2>
              <Link to="/sessions" className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
                Ver sesiones <ChevronRight size={14} />
              </Link>
            </div>
            <div className="p-4">
              {sessions.length === 0
                ? <p className="text-zinc-600 text-sm text-center py-6">No hay sesiones cargadas</p>
                : <div className="space-y-3">
                    {sessions.map(s => (
                      <div key={s.id}>
                        <p className="text-sm text-white">{s.title}</p>
                        <p className="text-xs text-zinc-500">{moment(s.date).format("DD/MM/YYYY")} · {s.session_type}</p>
                      </div>
                    ))}
                  </div>}
            </div>
          </div>
        </ErrorBoundary>
      </div>
    </div>
  );
}