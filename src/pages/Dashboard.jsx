import React, { useState, useEffect, useMemo, useCallback, Component } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import {
  Users, AlertCircle, Cake, Shield, ChevronRight,
  Activity, ArrowUp, ArrowDown, UserCheck, UserX, Zap,
  RefreshCw, Clock
} from "lucide-react";
import { useWorkspace } from "@/lib/WorkspaceContext";
import moment from "moment";
import "moment/locale/es";

import { STATUS_LABELS, isGoalkeeper, resolvePlayerType } from "@/components/squad/squadConstants";
import PlayerAvatar from "@/components/player/PlayerAvatar";
import { usePlayerCard360 } from "@/components/player/PlayerCard360Context";

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
function statusColor(s) { return STATUS_CARD_COLORS[s] || DEFAULT_COLOR; }

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
function StatCard({ label, value, color, icon: Icon, sub }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
      <div className="flex items-center justify-between mb-1">
        <Icon size={14} className={color} />
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight">{label}</p>
      {sub && (
        <p className="text-[9px] text-zinc-600 mt-1 leading-tight">{sub}</p>
      )}
    </div>
  );
}

// ─── Goalkeeper / Field split card ─────────────────────────────────────────
function SplitStatCard({ label, fieldValue, gkValue, color, icon: Icon }) {
  const total = (fieldValue || 0) + (gkValue || 0);
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
      <div className="flex items-center gap-1 mb-1">
        <Icon size={14} className={color} />
      </div>
      <p className={`text-xl font-bold ${color}`}>{total}</p>
      <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
      <div className="flex gap-2 mt-1.5">
        <span className="text-[9px] text-zinc-400">Campo: <strong className="text-zinc-300">{fieldValue}</strong></span>
        <span className="text-[9px] text-zinc-400">ARQ: <strong className="text-yellow-400">{gkValue}</strong></span>
      </div>
    </div>
  );
}

// ─── Player row (read-only) — driven by DailySquadStatus record ────────────
function PlayerRow({ ds, playerMap, showMovement = false }) {
  const { openCard } = usePlayerCard360();
  const player = playerMap[ds.player_id] || {};
  const col = statusColor(ds.status);
  const name = ds.player_name || player.full_name || "—";
  const position = player.position || ds.position || "";
  const playerObj = player.id ? player : { id: ds.player_id, full_name: name, photo_url: player.photo_url };
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${col.bg} ${col.border}`}>
      <PlayerAvatar player={playerObj} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{name}</p>
        {showMovement && ds.base_squad_name && ds.target_squad_name ? (
          <p className="text-xs text-zinc-500 truncate">
            {position} · <span className="text-zinc-400">{ds.base_squad_name}</span>
            <span className="text-zinc-600 mx-1">→</span>
            <span className="text-sky-400">{ds.target_squad_name}</span>
            {ds.temporary && <span className="ml-1 text-[9px] text-zinc-600">· Temporal</span>}
          </p>
        ) : (
          <p className="text-xs text-zinc-500 truncate">{position}</p>
        )}
        {showMovement && ds.date && (
          <p className="text-[10px] text-zinc-600">Desde: {moment(ds.date).format("DD/MM/YYYY")}</p>
        )}
        {ds.notes && <p className="text-[10px] text-zinc-500 italic truncate">"{ds.notes}"</p>}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${col.bg} ${col.text} border ${col.border}`}>
          {STATUS_LABELS[ds.status] || ds.status}
        </span>
        {ds.tags?.length > 0 && (
          <div className="flex flex-wrap gap-0.5 justify-end">
            {ds.tags.slice(0, 2).map(t => (
              <span key={t} className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded-full border border-zinc-700">{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Group list card — con separación campo / arqueros ─────────────────────
function GroupCard({ title, dotColor, records, playerMap, emptyText, linkTo, showMovement = false, isGKFn }) {
  const gkRecords    = isGKFn ? records.filter(ds => isGKFn(ds)) : [];
  const fieldRecords = isGKFn ? records.filter(ds => !isGKFn(ds)) : records;
  const hasBoth = gkRecords.length > 0 && fieldRecords.length > 0;
  const total = records.length;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotColor} inline-block`} />
          {title}
          <span className={`text-xs font-normal ${dotColor.replace("bg-", "text-")}`}>({total})</span>
          {isGKFn && gkRecords.length > 0 && fieldRecords.length > 0 && (
            <span className="text-[10px] text-zinc-500 font-normal">
              Campo: {fieldRecords.length} · ARQ: {gkRecords.length}
            </span>
          )}
        </h2>
        {linkTo && (
          <Link to={linkTo} className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
            Ver todos <ChevronRight size={14} />
          </Link>
        )}
      </div>
      <div className="p-3">
        {records.length === 0
          ? <p className="text-zinc-600 text-sm text-center py-5">{emptyText}</p>
          : <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {/* Jugadores de campo */}
              {hasBoth && fieldRecords.length > 0 && (
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-1 pt-1">
                  Jugadores de campo ({fieldRecords.length})
                </p>
              )}
              {fieldRecords.map(ds => <PlayerRow key={ds.id || ds.player_id} ds={ds} playerMap={playerMap} showMovement={showMovement} />)}

              {/* Arqueros — separados visualmente */}
              {gkRecords.length > 0 && (
                <>
                  {hasBoth && (
                    <div className="flex items-center gap-2 pt-2 pb-1">
                      <span className="text-[10px] font-semibold text-yellow-400 uppercase tracking-wider px-1">
                        🥅 Arqueros ({gkRecords.length})
                      </span>
                      <div className="flex-1 h-px bg-yellow-500/20" />
                    </div>
                  )}
                  {!hasBoth && (
                    <p className="text-[10px] font-semibold text-yellow-400 uppercase tracking-wider px-1 pt-1 flex items-center gap-1">
                      🥅 Arqueros ({gkRecords.length})
                    </p>
                  )}
                  {gkRecords.map(ds => (
                    <div key={ds.id || ds.player_id} className="ring-1 ring-yellow-500/20 rounded-xl">
                      <PlayerRow ds={ds} playerMap={playerMap} showMovement={showMovement} />
                    </div>
                  ))}
                </>
              )}
            </div>}
      </div>
    </div>
  );
}

// ─── Next training summary — purely from DailySquadStatus records ──────────
function NextTrainingPanel({ byStatus, playerMap }) {
  const rows = [
    { key: "disponible",   label: "Entrenan completo",  color: "text-emerald-400", icon: Activity },
    { key: "diferenciado", label: "Diferenciados",       color: "text-amber-400",   icon: Zap },
    { key: "lesionado",    label: "Lesionados (fuera)",  color: "text-red-400",     icon: AlertCircle },
    { key: "convocado",    label: "Convocados",          color: "text-blue-400",    icon: UserCheck },
    { key: "subió",        label: "Suben",               color: "text-sky-400",     icon: ArrowUp },
    { key: "bajó",         label: "Bajan",               color: "text-orange-400",  icon: ArrowDown },
  ];
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-white">Próximo entrenamiento</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Resumen por estado del plantel</p>
      </div>
      <div className="p-4 space-y-3">
        {rows.map(({ key, label, color, icon: Icon }) => {
          const recs = byStatus[key] || [];
          return (
            <div key={key} className="flex items-start gap-3">
              <Icon size={15} className={`${color} mt-0.5 shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-zinc-300">{label}</p>
                  <span className={`text-sm font-bold ${color}`}>{recs.length}</span>
                </div>
                {recs.length > 0 && (
                  <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                    {recs.map(ds => ds.player_name || playerMap[ds.player_id]?.full_name || "").filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}



// ─── Main Dashboard ────────────────────────────────────────────────────────
export default function Dashboard() {
  const today = moment().format("YYYY-MM-DD");
  const { activeSquadId, activeSquad, mySquads, setActiveSquad } = useWorkspace();

  // Use activeSquadId from context as selectedSquadId
  const selectedSquadId = activeSquadId || "";

  // State
  const [squads, setSquads] = useState([]);
  const [playerMap, setPlayerMap] = useState({});  // id -> Player
  const [playerList, setPlayerList] = useState([]); // for birthdays
  const [memberships, setMemberships] = useState([]); // SquadMembership activos
  const [dayStatuses, setDayStatuses] = useState([]); // DailySquadStatus[] for today
  const [sessions, setSessions] = useState([]);
  const [nextMatch, setNextMatch] = useState(null);
  const [nextMatchReport, setNextMatchReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadData(); }, [activeSquadId]);

  function refresh() { loadData(true); }

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);

    const [allPlayers, statuses, allSquads, mb, events, s, matchReports] = await Promise.all([
      base44.entities.Player.list("-created_date", 500),
      base44.entities.DailySquadStatus.filter({ date: today }, "-updated_at", 500),
      base44.entities.Squad.list("name", 100),
      base44.entities.SquadMembership.list("-effective_from", 1000),
      base44.entities.DayEvent.list("date", 200),
      base44.entities.TrainingSession.list("-date", 50),
      base44.entities.MatchReport.list("-date", 20),
    ]);

    const map = {};
    allPlayers.filter(p => p.active !== false).forEach(p => { map[p.id] = p; });
    const filterBySquad = x => !selectedSquadId || !x.squad_id || x.squad_id === selectedSquadId;
    setPlayerMap(map);
    setPlayerList(allPlayers.filter(p => p.active !== false));
    setDayStatuses(statuses);
    setMemberships(mb.filter(m => m.status === "activo"));
    setSquads(allSquads.filter(sq => sq.active !== false));
    setSessions(s.filter(filterBySquad).slice(0, 5));

    const match = events.find(e => e.type === "Partido" && e.date >= today);
    setNextMatch(match || null);
    if (match) setNextMatchReport(matchReports.find(r => r.date === match.date) || null);

    setLastSync(new Date());
    if (!silent) setLoading(false); else setRefreshing(false);
  }, [today]);

  // Real-time subscription — DailySquadStatus is the source of truth
  useEffect(() => {
    const unsubscribe = base44.entities.DailySquadStatus.subscribe((event) => {
      const ds = event.data;
      if (!ds || ds.date !== today) return;
      setDayStatuses(prev => {
        if (event.type === "delete") return prev.filter(r => r.id !== ds.id);
        const idx = prev.findIndex(r => r.player_id === ds.player_id);
        if (idx >= 0) { const next = [...prev]; next[idx] = ds; return next; }
        return [...prev, ds];
      });
      setLastSync(new Date());
    });
    return unsubscribe;
  }, [today]);

  // ── Build the unified player list for the selected squad ──────────────
  // Returns synthetic "ds-like" records combining membership + DailySquadStatus
  const squadRecords = useMemo(() => {
    const statusById = {}; // player_id -> DailySquadStatus
    dayStatuses.forEach(ds => { statusById[ds.player_id] = ds; });

    if (!selectedSquadId) {
      // "Todos": show all DailySquadStatus records regardless of squad
      return dayStatuses;
    }

    // 1) Active stable members of this squad (via SquadMembership)
    const stableMembers = memberships.filter(m => {
      if (m.squad_id !== selectedSquadId) return false;
      if (m.effective_from && m.effective_from > today) return false;
      if (m.effective_to && m.effective_to < today) return false;
      return true;
    });

    const recordsMap = {}; // player_id -> ds record (real or synthetic)

    stableMembers.forEach(m => {
      const player = playerMap[m.player_id];
      if (!player) return;

      const saved = statusById[m.player_id];

      // If the player has a status record AND they have an active temporary movement to ANOTHER squad,
      // they are NOT in this squad today — skip them
      if (saved && saved.temporary && saved.active_in_target_squad && saved.target_squad_id && saved.target_squad_id !== selectedSquadId) {
        return;
      }

      if (saved) {
        recordsMap[m.player_id] = saved;
      } else {
        // No status record → synthetic "disponible por defecto"
        recordsMap[m.player_id] = {
          player_id: m.player_id,
          player_name: player.full_name || "",
          position: player.position || "",
          category: player.category || "",
          status: "disponible",
          tags: [],
          notes: "",
          temporary: false,
          active_in_target_squad: true,
          base_squad_id: selectedSquadId,
          target_squad_id: selectedSquadId,
          _synthetic: true, // marker: no real record exists
        };
      }
    });

    // 2) Temporary visitors from other squads active in this squad today
    dayStatuses.forEach(ds => {
      if (ds.temporary && ds.active_in_target_squad && ds.target_squad_id === selectedSquadId) {
        recordsMap[ds.player_id] = ds;
      }
    });

    return Object.values(recordsMap);
  }, [selectedSquadId, dayStatuses, memberships, playerMap, today]);

  // ── Group by status ────────────────────────────────────────────────────
  const byStatus = useMemo(() => {
    const groups = {};
    squadRecords.forEach(ds => {
      const s = ds.status || "disponible";
      if (!groups[s]) groups[s] = [];
      groups[s].push(ds);
    });
    return groups;
  }, [squadRecords]);

  // ── Movement groups (only when a squad is selected) ───────────────────
  // Reserva / Primera squad lookups (used to isolate the dedicated "Reserva → Primera" board)
  const reservaSquad = useMemo(() => squads.find(s => (s.name || "").trim().toLowerCase() === "reserva"), [squads]);
  const primeraSquad = useMemo(() => squads.find(s => (s.name || "").trim().toLowerCase() === "primera"), [squads]);

  // "Suben DESDE este plantel" → base = selectedSquad, target = otro plantel superior
  // Excluye Reserva→Primera, que tiene su propio tablero dedicado
  const subenDesde = useMemo(() => {
    if (!selectedSquadId) return (byStatus["subió"] || []);
    return squadRecords.filter(ds =>
      ds.temporary &&
      ds.active_in_target_squad &&
      ds.base_squad_id === selectedSquadId &&
      ds.target_squad_id !== selectedSquadId &&
      ["sube_temporal", "subió"].includes(ds.movement_type || ds.status) &&
      !(reservaSquad && primeraSquad && ds.base_squad_id === reservaSquad.id && ds.target_squad_id === primeraSquad.id)
    );
  }, [squadRecords, selectedSquadId, byStatus, reservaSquad, primeraSquad]);

  // "Suben desde Reserva a Primera" → tablero dedicado, solo visible en el dashboard de Reserva
  const subenReservaAPrimera = useMemo(() => {
    if (!selectedSquadId || !reservaSquad || !primeraSquad || selectedSquadId !== reservaSquad.id) return [];
    return squadRecords.filter(ds =>
      ds.temporary &&
      ds.active_in_target_squad &&
      ds.movement_type === "sube_temporal" &&
      ds.base_squad_id === reservaSquad.id &&
      ds.target_squad_id === primeraSquad.id
    );
  }, [squadRecords, selectedSquadId, reservaSquad, primeraSquad]);

  // "Suben A este plantel" → base = otro plantel, target = selectedSquad
  const subenA = useMemo(() => {
    if (!selectedSquadId) return [];
    return squadRecords.filter(ds =>
      ds.temporary &&
      ds.active_in_target_squad &&
      ds.base_squad_id !== selectedSquadId &&
      ds.target_squad_id === selectedSquadId &&
      ["sube_temporal", "subió"].includes(ds.movement_type || ds.status)
    );
  }, [squadRecords, selectedSquadId]);

  // "Bajan DESDE este plantel" → base = selectedSquad, target = otro plantel inferior
  const bajanDesde = useMemo(() => {
    if (!selectedSquadId) return (byStatus["bajó"] || []);
    return squadRecords.filter(ds =>
      ds.temporary &&
      ds.active_in_target_squad &&
      ds.base_squad_id === selectedSquadId &&
      ds.target_squad_id !== selectedSquadId &&
      ["baja_temporal", "bajó"].includes(ds.movement_type || ds.status)
    );
  }, [squadRecords, selectedSquadId, byStatus]);

  // "Bajan A este plantel" → base = otro plantel superior, target = selectedSquad
  const bajanA = useMemo(() => {
    if (!selectedSquadId) return [];
    return squadRecords.filter(ds =>
      ds.temporary &&
      ds.active_in_target_squad &&
      ds.base_squad_id !== selectedSquadId &&
      ds.target_squad_id === selectedSquadId &&
      ["baja_temporal", "bajó"].includes(ds.movement_type || ds.status)
    );
  }, [squadRecords, selectedSquadId]);

  const totalCount = squadRecords.length;

  // Split records by goalkeeper / field player using playerMap
  // Checks player_type first (most reliable), then falls back to position
  function isGK(ds) {
    const player = playerMap[ds.player_id];
    if (player) return isGoalkeeper(player);
    // fallback: use position stored in ds or resolve from position string
    return isGoalkeeper({ position: ds.position });
  }

  function splitByType(records) {
    const gk = records.filter(ds => isGK(ds));
    const field = records.filter(ds => !isGK(ds));
    return { gk: gk.length, field: field.length };
  }

  const dispSplit = splitByType(byStatus.disponible || []);
  const lesioSplit = splitByType(byStatus.lesionado || []);
  const diffSplit = splitByType(byStatus.diferenciado || []);
  const gkTotal = splitByType(squadRecords).gk;
  const fieldTotal = splitByType(squadRecords).field;

  const birthdayPlayers = useMemo(() =>
    playerList.filter(p => p.birth_date && moment(p.birth_date).format("MM-DD") === moment().format("MM-DD")),
    [playerList]
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  const hasStatusToday = selectedSquadId ? squadRecords.length > 0 : dayStatuses.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Dashboard
            {activeSquad && <span className="text-zinc-500 font-normal text-lg ml-2">· {activeSquad.name}</span>}
          </h1>
          <p className="text-zinc-500 text-sm mt-1 capitalize">{moment().format("dddd D [de] MMMM, YYYY")}</p>
          {lastSync && (
            <p className="text-zinc-600 text-xs mt-0.5 flex items-center gap-1">
              <Clock size={10} />
              Actualizado desde Estado del Plantel: {moment(lastSync).format("HH:mm:ss")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Actualizar
          </button>
          <Link to="/daily-squad"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium transition-colors">
            Gestionar estados <ChevronRight size={15} />
          </Link>
        </div>
      </div>

      {/* Squad filter — driven by WorkspaceContext activeSquad */}
      {mySquads.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded-xl p-1 gap-1 flex-wrap">
            {mySquads.map(sq => (
              <button key={sq.id}
                onClick={() => setActiveSquad(sq)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedSquadId === sq.id ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"
                }`}>
                {sq.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No state loaded warning */}
      {!hasStatusToday && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5 flex items-center gap-3">
          <AlertCircle size={18} className="text-zinc-500 shrink-0" />
          <div>
            <p className="text-zinc-300 text-sm font-medium">Sin estado cargado para hoy</p>
            <p className="text-zinc-500 text-xs mt-0.5">
              Ingresá a <Link to="/daily-squad" className="text-blue-400 underline">Estado del Plantel</Link> para registrar el estado de los jugadores.
            </p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <StatCard label="Total plantel" value={totalCount} icon={Users} color="text-blue-400"
          sub={`Campo: ${fieldTotal} · ARQ: ${gkTotal}`} />
        <SplitStatCard label="Disponibles" fieldValue={dispSplit.field} gkValue={dispSplit.gk} icon={Activity} color="text-emerald-400" />
        <SplitStatCard label="Lesionados" fieldValue={lesioSplit.field} gkValue={lesioSplit.gk} icon={AlertCircle} color="text-red-400" />
        <SplitStatCard label="Diferenciados" fieldValue={diffSplit.field} gkValue={diffSplit.gk} icon={Zap} color="text-amber-400" />
        <StatCard label="Molestias" value={(byStatus.molestia || []).length} icon={AlertCircle} color="text-orange-400" />
        <StatCard label="Convocados" value={(byStatus.convocado || []).length} icon={UserCheck} color="text-blue-300" />
        <StatCard label="Suspendidos" value={(byStatus.suspendido || []).length} icon={UserX} color="text-purple-400" />
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
            records={byStatus.disponible || []} playerMap={playerMap}
            emptyText="Sin estado disponible cargado" linkTo="/daily-squad"
            isGKFn={isGK}
          />
        </ErrorBoundary>

        <ErrorBoundary>
          <NextTrainingPanel byStatus={byStatus} playerMap={playerMap} />
        </ErrorBoundary>

        <ErrorBoundary>
          <GroupCard
            title="Lesionados" dotColor="bg-red-400"
            records={byStatus.lesionado || []} playerMap={playerMap}
            emptyText="Sin lesionados cargados" linkTo="/daily-squad"
            isGKFn={isGK}
          />
        </ErrorBoundary>

        {(byStatus.diferenciado || []).length > 0 && (
          <ErrorBoundary>
            <GroupCard
              title="Diferenciados" dotColor="bg-amber-400"
              records={byStatus.diferenciado} playerMap={playerMap}
              emptyText="" linkTo="/daily-squad" isGKFn={isGK}
            />
          </ErrorBoundary>
        )}

        {subenDesde.length > 0 && (
          <ErrorBoundary>
            <GroupCard
              title={selectedSquadId ? `Suben desde ${squads.find(s => s.id === selectedSquadId)?.name || "este plantel"}` : "Suben"}
              dotColor="bg-sky-400"
              records={subenDesde} playerMap={playerMap}
              emptyText="" linkTo="/daily-squad" showMovement isGKFn={isGK}
            />
          </ErrorBoundary>
        )}

        {subenA.length > 0 && (
          <ErrorBoundary>
            <GroupCard
              title={selectedSquadId ? `Suben a ${squads.find(s => s.id === selectedSquadId)?.name || "este plantel"}` : "Suben (visitantes)"}
              dotColor="bg-cyan-400"
              records={subenA} playerMap={playerMap}
              emptyText="" linkTo="/daily-squad" showMovement isGKFn={isGK}
            />
          </ErrorBoundary>
        )}

        {subenReservaAPrimera.length > 0 && (
          <ErrorBoundary>
            <GroupCard
              title="Suben desde Reserva a Primera"
              dotColor="bg-indigo-400"
              records={subenReservaAPrimera} playerMap={playerMap}
              emptyText="" linkTo="/daily-squad" showMovement isGKFn={isGK}
            />
          </ErrorBoundary>
        )}

        {bajanDesde.length > 0 && (
          <ErrorBoundary>
            <GroupCard
              title={selectedSquadId ? `Bajan desde ${squads.find(s => s.id === selectedSquadId)?.name || "este plantel"}` : "Bajan"}
              dotColor="bg-orange-400"
              records={bajanDesde} playerMap={playerMap}
              emptyText="" linkTo="/daily-squad" showMovement isGKFn={isGK}
            />
          </ErrorBoundary>
        )}

        {bajanA.length > 0 && (
          <ErrorBoundary>
            <GroupCard
              title={selectedSquadId ? `Bajan a ${squads.find(s => s.id === selectedSquadId)?.name || "este plantel"}` : "Bajan (visitantes)"}
              dotColor="bg-amber-400"
              records={bajanA} playerMap={playerMap}
              emptyText="" linkTo="/daily-squad" showMovement isGKFn={isGK}
            />
          </ErrorBoundary>
        )}

        {(byStatus.convocado || []).length > 0 && (
          <ErrorBoundary>
            <GroupCard
              title="Convocados" dotColor="bg-blue-400"
              records={byStatus.convocado} playerMap={playerMap}
              emptyText="" linkTo="/daily-squad" isGKFn={isGK}
            />
          </ErrorBoundary>
        )}

        {(byStatus.molestia || []).length > 0 && (
          <ErrorBoundary>
            <GroupCard
              title="Molestias" dotColor="bg-yellow-400"
              records={byStatus.molestia} playerMap={playerMap}
              emptyText="" linkTo="/daily-squad" isGKFn={isGK}
            />
          </ErrorBoundary>
        )}

        {(byStatus.suspendido || []).length > 0 && (
          <ErrorBoundary>
            <GroupCard
              title="Suspendidos" dotColor="bg-purple-400"
              records={byStatus.suspendido} playerMap={playerMap}
              emptyText="" linkTo="/daily-squad" isGKFn={isGK}
            />
          </ErrorBoundary>
        )}

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