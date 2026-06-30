import React, { useState, useEffect, useMemo, useCallback, Component } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Users, AlertCircle, Cake, ChevronRight } from "lucide-react";
import { useWorkspace } from "@/lib/WorkspaceContext";
import moment from "moment";
import "moment/locale/es";

import { STATUS_LABELS, isGoalkeeper } from "@/components/squad/squadConstants";
import PlayerAvatar from "@/components/player/PlayerAvatar";
import MovementBoardCard from "@/components/dashboard/MovementBoardCard";
import DashboardTopBar from "@/components/dashboard/DashboardTopBar";
import AiDaySummary from "@/components/dashboard/AiDaySummary";
import MovementsOverviewCard from "@/components/dashboard/MovementsOverviewCard";
import TodayCalendarCard from "@/components/dashboard/TodayCalendarCard";
import UpcomingEventsCard from "@/components/dashboard/UpcomingEventsCard";
import LastSessionCard from "@/components/dashboard/LastSessionCard";
import AlertsCard from "@/components/dashboard/AlertsCard";
import WeeklyLoadCard from "@/components/dashboard/WeeklyLoadCard";
import MedicalStatusCard from "@/components/dashboard/MedicalStatusCard";
import MinutesSummaryCard from "@/components/dashboard/MinutesSummaryCard";
import QuickActionsBar from "@/components/dashboard/QuickActionsBar";

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

// ─── Player row (read-only) — driven by DailySquadStatus record ────────────
function PlayerRow({ ds, playerMap, showMovement = false }) {
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
              {hasBoth && fieldRecords.length > 0 && (
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-1 pt-1">
                  Jugadores de campo ({fieldRecords.length})
                </p>
              )}
              {fieldRecords.map(ds => <PlayerRow key={ds.id || ds.player_id} ds={ds} playerMap={playerMap} showMovement={showMovement} />)}

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

// ─── Main Dashboard ────────────────────────────────────────────────────────
export default function Dashboard() {
  const today = moment().format("YYYY-MM-DD");
  const { activeSquadId, activeSquad, mySquads, setActiveSquad } = useWorkspace();

  const selectedSquadId = activeSquadId || "";

  // State
  const [squads, setSquads] = useState([]);
  const [playerMap, setPlayerMap] = useState({});
  const [playerList, setPlayerList] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [dayStatuses, setDayStatuses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [weekSessionsCount, setWeekSessionsCount] = useState(0);
  const [todayEvents, setTodayEvents] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [nextMatch, setNextMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadData(); }, [activeSquadId]);

  function refresh() { loadData(true); }

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);

    const [allPlayers, statuses, allSquads, mb, events, s] = await Promise.all([
      base44.entities.Player.list("-created_date", 500),
      base44.entities.DailySquadStatus.filter({ date: today }, "-updated_at", 500),
      base44.entities.Squad.list("name", 100),
      base44.entities.SquadMembership.list("-effective_from", 1000),
      base44.entities.DayEvent.list("date", 200),
      base44.entities.TrainingSession.list("-date", 50),
    ]);

    const map = {};
    allPlayers.filter(p => p.active !== false).forEach(p => { map[p.id] = p; });
    const filterBySquad = x => !selectedSquadId || !x.squad_id || x.squad_id === selectedSquadId;
    setPlayerMap(map);
    setPlayerList(allPlayers.filter(p => p.active !== false));
    setDayStatuses(statuses);
    setMemberships(mb.filter(m => m.status === "activo"));
    setSquads(allSquads.filter(sq => sq.active !== false));

    const squadSessions = s.filter(filterBySquad);
    setSessions(squadSessions.slice(0, 5));
    const weekAgo = moment().subtract(6, "days").format("YYYY-MM-DD");
    setWeekSessionsCount(squadSessions.filter(sess => sess.date >= weekAgo && sess.date <= today).length);

    const squadEvents = events.filter(filterBySquad);
    setTodayEvents(squadEvents.filter(e => e.date === today).sort((a, b) => (a.time || "").localeCompare(b.time || "")));
    setUpcomingEvents(
      squadEvents.filter(e => e.date > today)
        .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
        .slice(0, 5)
    );

    const match = squadEvents.find(e => e.type === "Partido" && e.date >= today);
    setNextMatch(match || null);

    if (!silent) setLoading(false); else setRefreshing(false);
  }, [today, selectedSquadId]);

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
    });
    return unsubscribe;
  }, [today]);

  // ── Build the unified player list for the selected squad ──────────────
  const squadRecords = useMemo(() => {
    const statusById = {};
    dayStatuses.forEach(ds => { statusById[ds.player_id] = ds; });

    if (!selectedSquadId) return dayStatuses;

    const stableMembers = memberships.filter(m => {
      if (m.squad_id !== selectedSquadId) return false;
      if (m.effective_from && m.effective_from > today) return false;
      if (m.effective_to && m.effective_to < today) return false;
      return true;
    });

    const recordsMap = {};

    stableMembers.forEach(m => {
      const player = playerMap[m.player_id];
      if (!player) return;

      const saved = statusById[m.player_id];

      if (saved) {
        recordsMap[m.player_id] = saved;
      } else {
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
          _synthetic: true,
        };
      }
    });

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

  // ── Movement groups ─────────────────────────────────────────────────────
  const reservaSquad = useMemo(() => squads.find(s => (s.name || "").trim().toLowerCase() === "reserva"), [squads]);
  const primeraSquad = useMemo(() => squads.find(s => (s.name || "").trim().toLowerCase() === "primera"), [squads]);

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

  function isGK(ds) {
    const player = playerMap[ds.player_id];
    if (player) return isGoalkeeper(player);
    return isGoalkeeper({ position: ds.position });
  }

  const birthdayPlayers = useMemo(() =>
    playerList.filter(p => p.birth_date && moment(p.birth_date).format("MM-DD") === moment().format("MM-DD")),
    [playerList]
  );

  // ── MD code (relative to next match) ───────────────────────────────────
  const mdCode = useMemo(() => {
    if (!nextMatch) return null;
    const daysLeft = moment(nextMatch.date).diff(moment(today), "days");
    if (daysLeft === 0) return "MD";
    if (daysLeft > 0) return `MD-${daysLeft}`;
    return `MD+${Math.abs(daysLeft)}`;
  }, [nextMatch, today]);

  const movementGroups = [
    {
      key: "subenA", label: `Suben a ${squads.find(s => s.id === selectedSquadId)?.name || "este plantel"}`, direction: "up",
      records: subenA,
      render: () => (
        <MovementBoardCard
          title={selectedSquadId ? `Suben a ${squads.find(s => s.id === selectedSquadId)?.name || "este plantel"}` : "Suben (visitantes)"}
          originLabel="Otros planteles"
          destLabel={squads.find(s => s.id === selectedSquadId)?.name?.trim() || "este plantel"}
          colorScheme="sky"
          records={subenA} playerMap={playerMap} isGKFn={isGK}
        />
      ),
    },
    {
      key: "subenReservaAPrimera", label: "Suben desde Reserva a Primera", direction: "up",
      records: subenReservaAPrimera,
      render: () => (
        <MovementBoardCard
          title="Suben desde Reserva a Primera"
          originLabel="Reserva" destLabel="Primera" colorScheme="violet"
          records={subenReservaAPrimera} playerMap={playerMap} isGKFn={isGK}
        />
      ),
    },
    {
      key: "subenDesde", label: selectedSquadId ? `Suben desde ${squads.find(s => s.id === selectedSquadId)?.name || "este plantel"}` : "Suben", direction: "up",
      records: subenDesde,
      render: () => (
        <GroupCard
          title={selectedSquadId ? `Suben desde ${squads.find(s => s.id === selectedSquadId)?.name || "este plantel"}` : "Suben"}
          dotColor="bg-sky-400" records={subenDesde} playerMap={playerMap}
          emptyText="" linkTo="/daily-squad" showMovement isGKFn={isGK}
        />
      ),
    },
    {
      key: "bajanDesde", label: selectedSquadId ? `Bajan desde ${squads.find(s => s.id === selectedSquadId)?.name || "este plantel"}` : "Bajan", direction: "down",
      records: bajanDesde,
      render: () => (
        <GroupCard
          title={selectedSquadId ? `Bajan desde ${squads.find(s => s.id === selectedSquadId)?.name || "este plantel"}` : "Bajan"}
          dotColor="bg-orange-400" records={bajanDesde} playerMap={playerMap}
          emptyText="" linkTo="/daily-squad" showMovement isGKFn={isGK}
        />
      ),
    },
    {
      key: "bajanA", label: selectedSquadId ? `Bajan a ${squads.find(s => s.id === selectedSquadId)?.name || "este plantel"}` : "Bajan (visitantes)", direction: "down",
      records: bajanA,
      render: () => (
        <GroupCard
          title={selectedSquadId ? `Bajan a ${squads.find(s => s.id === selectedSquadId)?.name || "este plantel"}` : "Bajan (visitantes)"}
          dotColor="bg-amber-400" records={bajanA} playerMap={playerMap}
          emptyText="" linkTo="/daily-squad" showMovement isGKFn={isGK}
        />
      ),
    },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  const hasStatusToday = selectedSquadId ? squadRecords.length > 0 : dayStatuses.length > 0;
  const injuredCount = (byStatus.lesionado || []).length;
  const discomfortCount = (byStatus.molestia || []).length;
  const suspendedCount = (byStatus.suspendido || []).length;
  const calledUpCount = (byStatus.convocado || []).length;
  const lastSession = sessions[0] || null;

  return (
    <div className="space-y-6">
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

      {/* Fila 1: Plantel | MD | Próximo partido | Fecha */}
      <ErrorBoundary>
        <DashboardTopBar
          squadName={activeSquad?.name}
          mdCode={mdCode}
          nextMatch={nextMatch}
          refreshing={refreshing}
          onRefresh={refresh}
          mySquads={mySquads}
          selectedSquadId={selectedSquadId}
          onSelectSquad={setActiveSquad}
        />
      </ErrorBoundary>

      {/* Fila 2: Resumen del día (IA) */}
      <ErrorBoundary>
        <AiDaySummary
          squadName={activeSquad?.name}
          total={totalCount}
          available={(byStatus.disponible || []).length}
          injured={injuredCount}
          differentiated={(byStatus.diferenciado || []).length}
          calledUp={calledUpCount}
          nextMatch={nextMatch}
        />
      </ErrorBoundary>

      {/* Fila 3: Disponibles | Lesionados | Diferenciados | Movimientos */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <ErrorBoundary>
          <GroupCard
            title="Disponibles" dotColor="bg-emerald-400"
            records={byStatus.disponible || []} playerMap={playerMap}
            emptyText="Sin estado disponible cargado" linkTo="/daily-squad"
            isGKFn={isGK}
          />
        </ErrorBoundary>
        <ErrorBoundary>
          <GroupCard
            title="Lesionados" dotColor="bg-red-400"
            records={byStatus.lesionado || []} playerMap={playerMap}
            emptyText="Sin lesionados cargados" linkTo="/daily-squad"
            isGKFn={isGK}
          />
        </ErrorBoundary>
        <ErrorBoundary>
          <GroupCard
            title="Diferenciados" dotColor="bg-amber-400"
            records={byStatus.diferenciado || []} playerMap={playerMap}
            emptyText="Sin diferenciados cargados" linkTo="/daily-squad"
            isGKFn={isGK}
          />
        </ErrorBoundary>
        <ErrorBoundary>
          <MovementsOverviewCard groups={movementGroups} />
        </ErrorBoundary>
      </div>

      {/* Fila 4: Calendario de hoy | Próximos eventos */}
      <div className="grid md:grid-cols-2 gap-4">
        <ErrorBoundary>
          <TodayCalendarCard events={todayEvents} />
        </ErrorBoundary>
        <ErrorBoundary>
          <UpcomingEventsCard events={upcomingEvents} />
        </ErrorBoundary>
      </div>

      {/* Fila 5: Última sesión | Próximo partido | Alertas */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        <ErrorBoundary>
          <LastSessionCard session={lastSession} />
        </ErrorBoundary>
        <ErrorBoundary>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">Próximo partido</h2>
              <Link to="/matches" className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
                Ver partidos <ChevronRight size={14} />
              </Link>
            </div>
            <div className="p-4">
              {nextMatch ? (
                <>
                  <p className="text-white font-semibold text-sm">{nextMatch.title}</p>
                  <p className="text-xs text-zinc-500 mt-1 capitalize">
                    {moment(nextMatch.date).format("dddd D [de] MMMM")}
                    {nextMatch.time ? ` · ${nextMatch.time}hs` : ""}
                    {nextMatch.location ? ` · ${nextMatch.location}` : ""}
                  </p>
                </>
              ) : (
                <p className="text-zinc-600 text-sm text-center py-6">Sin partido programado</p>
              )}
            </div>
          </div>
        </ErrorBoundary>
        <ErrorBoundary>
          <AlertsCard injuredCount={injuredCount} suspendedCount={suspendedCount} discomfortCount={discomfortCount} />
        </ErrorBoundary>
      </div>

      {/* Fila 6: Carga semanal | Estado médico | Minutos */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        <ErrorBoundary>
          <WeeklyLoadCard sessionsCount={weekSessionsCount} />
        </ErrorBoundary>
        <ErrorBoundary>
          <MedicalStatusCard injuredCount={injuredCount} discomfortCount={discomfortCount} />
        </ErrorBoundary>
        <ErrorBoundary>
          <MinutesSummaryCard />
        </ErrorBoundary>
      </div>

      {/* Fila 7: Acciones rápidas */}
      <ErrorBoundary>
        <QuickActionsBar />
      </ErrorBoundary>
    </div>
  );
}