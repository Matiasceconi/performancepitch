import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import moment from "moment";
import "moment/locale/es";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { isGoalkeeper } from "@/components/squad/squadConstants";
import ExternalGpsLoadHeader from "./ExternalGpsLoadHeader";
import ExternalGpsWeeklySummary from "./ExternalGpsWeeklySummary";
import ExternalGpsDailyChart from "./ExternalGpsDailyChart";
import ExternalGpsPlayerTable from "./ExternalGpsPlayerTable";
import ExternalGpsComparison from "./ExternalGpsComparison";
import ExternalGpsSessionList from "./ExternalGpsSessionList";
import ExternalGpsAlerts from "./ExternalGpsAlerts";
import ExternalGpsExcludedList from "./ExternalGpsExcludedList";
import { avg, fmtInt, computeAlerts, classifyGpsInclusion } from "./externalGpsLoadUtils";
import { useToast } from "@/components/ui/use-toast";

moment.locale("es");
const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function ExternalGpsLoad() {
  const { activeSquadId, activeSquad } = useWorkspace();
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(moment().startOf("isoWeek"));
  const [players, setPlayers] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [gpsRows, setGpsRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const { toast } = useToast();

  const weekEnd = useMemo(() => moment(weekStart).endOf("isoWeek"), [weekStart]);
  const dateFrom = weekStart.format("YYYY-MM-DD");
  const dateTo = weekEnd.format("YYYY-MM-DD");

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    const [allPlayers, mb, allSessions] = await Promise.all([
      base44.entities.Player.list("-created_date", 500),
      base44.entities.SquadMembership.list("-effective_from", 1000),
      base44.entities.TrainingSession.list("-date", 500),
    ]);
    setPlayers(allPlayers.filter((p) => p.active !== false));
    setMemberships(mb.filter((m) => m.status === "activo"));

    const weekSessions = allSessions.filter((s) =>
      (!activeSquadId || !s.squad_id || s.squad_id === activeSquadId) &&
      s.date >= dateFrom && s.date <= dateTo
    );
    setSessions(weekSessions);

    if (weekSessions.length === 0) {
      setGpsRows([]);
    } else {
      const rowsPerSession = await Promise.all(
        weekSessions.map((s) => base44.entities.SessionGPSData.filter({ session_id: s.id }, "-created_date", 500))
      );
      setGpsRows(rowsPerSession.flat());
    }
    setLoading(false);
    setRefreshing(false);
  }, [activeSquadId, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const playerMap = useMemo(() => {
    const map = {};
    players.forEach((p) => { map[p.id] = p; });
    return map;
  }, [players]);

  // Miembros activos del plantel activo
  const squadPlayers = useMemo(() => {
    if (!activeSquadId) return players;
    const ids = new Set(memberships.filter((m) => m.squad_id === activeSquadId).map((m) => m.player_id));
    return players.filter((p) => ids.has(p.id));
  }, [players, memberships, activeSquadId]);

  // Enriquecer filas GPS con datos de sesión (fecha, MD) y jugador (posición, tipo)
  const enrichedRows = useMemo(() => {
    const sessionMap = {};
    sessions.forEach((s) => { sessionMap[s.id] = s; });
    return gpsRows.map((r) => {
      const session = sessionMap[r.session_id];
      const player = playerMap[r.player_id];
      return {
        ...r,
        date: session?.date,
        session_title: session?.title,
        match_day_code: session?.match_day_code,
        position: player?.position || "",
        player_type: player?.player_type || (isGoalkeeper(player) ? "arquero" : "jugador_campo"),
      };
    });
  }, [gpsRows, sessions, playerMap]);

  // Solo el grupo principal (include_in_session_average !== false) afecta promedios/gráficos/comparaciones
  const includedRows = useMemo(() => enrichedRows.filter((r) => r.include_in_session_average !== false), [enrichedRows]);
  const excludedRows = useMemo(() => enrichedRows.filter((r) => r.include_in_session_average === false), [enrichedRows]);

  const fieldRows = useMemo(() => includedRows.filter((r) => r.player_type !== "arquero"), [includedRows]);
  const gkRows = useMemo(() => includedRows.filter((r) => r.player_type === "arquero"), [includedRows]);

  const summary = useMemo(() => ({
    sessionsCount: new Set(includedRows.map((r) => r.session_id)).size,
    playersCount: new Set(includedRows.map((r) => r.player_id)).size,
    avgDistance: avg(includedRows.map((r) => r.total_distance)),
    avgMMin: avg(includedRows.map((r) => r.m_min)),
    avgPlayerLoad: avg(includedRows.map((r) => r.player_load)),
    avgSprints: avg(includedRows.map((r) => r.sprints)),
    avgAcc: avg(includedRows.map((r) => r.acc_3)),
    avgDec: avg(includedRows.map((r) => r.dec_3)),
    maxSmax: includedRows.length ? Math.max(...includedRows.map((r) => r.smax || 0)) : null,
  }), [includedRows]);

  const dailyData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const day = moment(weekStart).add(i, "days");
      const dayStr = day.format("YYYY-MM-DD");
      const rows = includedRows.filter((r) => r.date === dayStr);
      return {
        label: DAY_LABELS[i],
        date: dayStr,
        avgDistance: rows.length ? avg(rows.map((r) => r.total_distance)) : null,
        avgPlayerLoad: rows.length ? avg(rows.map((r) => r.player_load)) : null,
        avgMMin: rows.length ? avg(rows.map((r) => r.m_min)) : null,
      };
    });
  }, [includedRows, weekStart]);

  const playerAgg = useMemo(() => {
    const map = {};
    includedRows.forEach((r) => {
      if (!map[r.player_id]) {
        map[r.player_id] = {
          player_id: r.player_id, player_name: r.player_name || playerMap[r.player_id]?.full_name || "",
          position: r.position, player_type: r.player_type,
          sessions: new Set(), total_distance: 0, player_load: 0, sprints: 0, acc_3: 0, dec_3: 0, smax_max: 0,
        };
      }
      const acc = map[r.player_id];
      acc.sessions.add(r.session_id);
      acc.total_distance += r.total_distance || 0;
      acc.player_load += r.player_load || 0;
      acc.sprints += r.sprints || 0;
      acc.acc_3 += r.acc_3 || 0;
      acc.dec_3 += r.dec_3 || 0;
      if ((r.smax || 0) > acc.smax_max) acc.smax_max = r.smax || 0;
    });
    return Object.fromEntries(Object.entries(map).map(([pid, v]) => [pid, { ...v, sessions: v.sessions.size }]));
  }, [includedRows, playerMap]);

  const playerTableRows = useMemo(() => Object.values(playerAgg), [playerAgg]);

  const sessionList = useMemo(() => {
    return sessions.map((s) => {
      const rows = includedRows.filter((r) => r.session_id === s.id);
      return {
        id: s.id, title: s.title, date: s.date, match_day_code: s.match_day_code,
        playersWithGps: new Set(rows.map((r) => r.player_id)).size,
        avgDistance: rows.length ? avg(rows.map((r) => r.total_distance)) : null,
        avgMMin: rows.length ? avg(rows.map((r) => r.m_min)) : null,
        avgPlayerLoad: rows.length ? avg(rows.map((r) => r.player_load)) : null,
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [sessions, includedRows]);

  const alerts = useMemo(() => computeAlerts({ squadPlayers, playerAgg, sessions, gpsRows: includedRows }),
    [squadPlayers, playerAgg, sessions, includedRows]);

  function handleExport() {
    const squadName = activeSquad?.name || "plantel";
    let text = `Carga Externa GPS — ${squadName} — Semana ${weekStart.format("DD/MM")} a ${weekEnd.format("DD/MM/YYYY")}\n\n`;
    text += `Resumen semanal:\n`;
    text += `Sesiones con GPS: ${summary.sessionsCount}\n`;
    text += `Jugadores con GPS: ${summary.playersCount}\n`;
    text += `Distancia prom.: ${fmtInt(summary.avgDistance)} m\n`;
    text += `m/min prom.: ${fmtInt(summary.avgMMin)}\n`;
    text += `Player Load prom.: ${fmtInt(summary.avgPlayerLoad)}\n\n`;
    text += `Carga por jugador:\n`;
    playerTableRows.forEach((r) => {
      text += `${r.player_name} | ${r.position} | ${r.player_type === "arquero" ? "Arquero" : "Campo"} | Sesiones: ${r.sessions} | Distancia: ${fmtInt(r.total_distance)} | PL: ${fmtInt(r.player_load)}\n`;
    });
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `carga-externa-gps-${dateFrom}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  function handleViewSession(sessionId) {
    navigate(`/sessions?session=${sessionId}`);
  }

  // Revisa el estado de cada jugador en cada sesión de la semana y recalcula
  // include_in_session_average / gps_group / exclusion_reason en SessionGPSData.
  async function recalculateAverages() {
    setRecalculating(true);
    let updatedCount = 0;
    for (const s of sessions) {
      const [sessionPlayers, sessionGpsRows] = await Promise.all([
        base44.entities.SessionPlayer.filter({ session_id: s.id }, "-created_date", 500),
        base44.entities.SessionGPSData.filter({ session_id: s.id }, "-created_date", 500),
      ]);
      const spByPlayerId = {};
      sessionPlayers.forEach((sp) => { spByPlayerId[sp.player_id] = sp; });

      const updates = sessionGpsRows.map((row) => {
        const cls = classifyGpsInclusion(spByPlayerId[row.player_id]);
        return { id: row.id, include_in_session_average: cls.include, gps_group: cls.group, exclusion_reason: cls.reason };
      }).filter((u) => {
        const orig = sessionGpsRows.find((r) => r.id === u.id);
        return orig?.include_in_session_average !== u.include_in_session_average || orig?.gps_group !== u.gps_group;
      });

      if (updates.length > 0) {
        await base44.entities.SessionGPSData.bulkUpdate(updates);
        updatedCount += updates.length;
      }
    }
    await load(true);
    setRecalculating(false);
    toast({ title: `✓ Promedios recalculados (${updatedCount} registros actualizados)` });
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      <ExternalGpsLoadHeader
        activeSquad={activeSquad}
        weekStart={weekStart}
        weekEnd={weekEnd}
        onPrevWeek={() => setWeekStart((m) => moment(m).subtract(1, "week"))}
        onNextWeek={() => setWeekStart((m) => moment(m).add(1, "week"))}
        onThisWeek={() => setWeekStart(moment().startOf("isoWeek"))}
        onExport={handleExport}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        onRecalculate={recalculateAverages}
        recalculating={recalculating}
      />

      {enrichedRows.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-14 text-center">
          <p className="text-zinc-400 text-sm font-medium">Sin datos GPS para esta semana</p>
        </div>
      ) : (
        <>
          <ExternalGpsWeeklySummary summary={summary} />
          <ExternalGpsDailyChart dailyData={dailyData} />
          <ExternalGpsPlayerTable rows={playerTableRows} playerMap={playerMap} />
          <ExternalGpsComparison fieldRows={fieldRows} gkRows={gkRows} />
          <ExternalGpsSessionList sessions={sessionList} onViewSession={handleViewSession} />
          <ExternalGpsExcludedList rows={excludedRows} />
        </>
      )}

      <ExternalGpsAlerts alerts={alerts} />
    </div>
  );
}