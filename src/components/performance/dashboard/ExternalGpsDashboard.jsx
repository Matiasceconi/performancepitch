import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { isGoalkeeper } from "@/components/squad/squadConstants";
import { avg, withRetry } from "../externalGpsLoadUtils";
import ImportHistoricalGPSModal from "../ImportHistoricalGPSModal";
import GpsDashboardHeader from "./GpsDashboardHeader";
import GpsKpiCards from "./GpsKpiCards";
import GpsSessionListPanel from "./GpsSessionListPanel";
import GpsSessionSummaryPanel from "./GpsSessionSummaryPanel";
import GpsLoadAlerts from "./GpsLoadAlerts";
import GpsPlayerTable from "./GpsPlayerTable";
import GpsMatchComparisonPanel from "./GpsMatchComparisonPanel";
import GpsPositionRadar from "./GpsPositionRadar";
import GpsExportButtons from "./GpsExportButtons";
import GpsMicrocycleContext from "./GpsMicrocycleContext";
import GpsLastSessionHero from "./GpsLastSessionHero";
import { useNavigate } from "react-router-dom";
import moment from "moment";

export default function ExternalGpsDashboard() {
  const { activeSquadId, activeSquad } = useWorkspace();
  const navigate = useNavigate();
  const dashboardRef = useRef(null);

  const [squads, setSquads] = useState([]);
  const [selectedSquadId, setSelectedSquadId] = useState(activeSquadId || "");
  const [selectedSeason, setSelectedSeason] = useState("");
  const [players, setPlayers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [gpsBySession, setGpsBySession] = useState({});
  const [competitionProfiles, setCompetitionProfiles] = useState([]);
  const [weeklyPlans, setWeeklyPlans] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");

  useEffect(() => {
    if (activeSquadId) setSelectedSquadId(activeSquadId);
  }, [activeSquadId]);

  useEffect(() => {
    async function loadSquads() {
      const all = await base44.entities.Squad.list("-season", 200);
      setSquads(all);
      const current = all.find((s) => s.id === (activeSquadId || selectedSquadId));
      if (current) setSelectedSeason(current.season || "");
    }
    loadSquads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seasons = useMemo(() => [...new Set(squads.map((s) => s.season).filter(Boolean))].sort().reverse(), [squads]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allPlayers, allSessions, allCompetitionProfiles, allWeeklyPlans, allMatches] = await Promise.all([
        base44.entities.Player.list("-created_date", 500),
        base44.entities.TrainingSession.list("-date", 500),
        base44.entities.PlayerCompetitionProfile.list("-updated_at", 1000),
        base44.entities.WeeklyPlan.list("-week_start", 100),
        base44.entities.MatchReport.list("-date", 200),
      ]);
      setPlayers(allPlayers.filter((p) => p.active !== false));
      setCompetitionProfiles(allCompetitionProfiles);
      setWeeklyPlans(selectedSquadId ? allWeeklyPlans.filter((p) => p.squad_id === selectedSquadId) : allWeeklyPlans);
      setMatches(selectedSquadId ? allMatches.filter((m) => m.squad_id === selectedSquadId) : allMatches);

      const squadSessions = allSessions.filter((s) => !selectedSquadId || s.squad_id === selectedSquadId);
      setSessions(squadSessions);

      if (squadSessions.length > 0) {
        const sessionIds = new Set(squadSessions.map((s) => s.id));
        const allGpsRows = await withRetry(() => base44.entities.SessionGPSData.list("-created_date", 5000));
        const grouped = {};
        allGpsRows.forEach((r) => {
          if (!sessionIds.has(r.session_id)) return;
          if (!grouped[r.session_id]) grouped[r.session_id] = [];
          grouped[r.session_id].push(r);
        });
        setGpsBySession(grouped);
        setSelectedSessionId((prev) => prev && squadSessions.some((s) => s.id === prev) ? prev : squadSessions[0].id);
      } else {
        setGpsBySession({});
        setSelectedSessionId("");
      }
    } catch (err) {
      console.error("ExternalGpsDashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedSquadId]);

  useEffect(() => { load(); }, [load]);

  const playerMap = useMemo(() => {
    const map = {};
    players.forEach((p) => { map[p.id] = p; });
    return map;
  }, [players]);

  const competitionMap = useMemo(() => {
    const map = {};
    competitionProfiles.forEach((c) => { map[c.player_id] = c; });
    return map;
  }, [competitionProfiles]);

  // Todas las filas GPS del plantel (excluye arqueros e inactivos del promedio)
  const allEnrichedRows = useMemo(() => {
    const sessionMap = {};
    sessions.forEach((s) => { sessionMap[s.id] = s; });
    return Object.entries(gpsBySession).flatMap(([sessionId, rows]) =>
      rows
        .filter((r) => r.include_in_session_average !== false)
        .map((r) => {
          const player = playerMap[r.player_id];
          return { ...r, date: sessionMap[sessionId]?.date, position: player?.position || "", player_name: r.player_name || player?.full_name || "" };
        })
        .filter((r) => !isGoalkeeper(playerMap[r.player_id]))
    );
  }, [gpsBySession, sessions, playerMap]);

  const sortedSessions = useMemo(() => [...sessions].sort((a, b) => (b.date || "").localeCompare(a.date || "")), [sessions]);

  const sessionsForList = useMemo(() => sortedSessions.map((s) => ({
    ...s,
    playerCount: new Set((gpsBySession[s.id] || []).filter((r) => r.include_in_session_average !== false).map((r) => r.player_id)).size,
  })), [sortedSessions, gpsBySession]);

  const kpis = useMemo(() => {
    const sessionsWithGps = sessions.filter((s) => (gpsBySession[s.id] || []).length > 0);
    const playersPerSession = sessionsWithGps.map((s) => new Set((gpsBySession[s.id] || []).map((r) => r.player_id)).size);
    return {
      sessionsCount: sessionsWithGps.length,
      lastSessionDate: sortedSessions[0]?.date,
      lastSessionTitle: sortedSessions[0] ? `${sortedSessions[0].match_day_code || ""} ${sortedSessions[0].title || ""}`.trim() : "",
      avgPlayersPerSession: avg(playersPerSession),
      avgTotalDistance: avg(allEnrichedRows.map((r) => r.total_distance)),
      avgPlayerLoad: avg(allEnrichedRows.map((r) => r.player_load)),
      avgSprints: avg(allEnrichedRows.map((r) => r.sprints)),
    };
  }, [sessions, gpsBySession, sortedSessions, allEnrichedRows]);

  const today = moment().format("YYYY-MM-DD");
  const currentCycle = useMemo(() => {
    if (!weeklyPlans.length) return null;
    const withToday = weeklyPlans.find((p) => (p.days_data || []).some((d) => d.date === today));
    if (withToday) return withToday;
    return weeklyPlans.find((p) => p.week_start && p.week_start <= today) || weeklyPlans[0];
  }, [weeklyPlans, today]);

  const cycleDays = currentCycle?.days_data || [];
  const cycleObjective = useMemo(() => {
    const objectives = cycleDays.map((d) => d.objetivo).filter((o) => o && o !== "—");
    if (!objectives.length) return "";
    return [...new Set(objectives)].join(" / ");
  }, [cycleDays]);

  const rivalByDate = useMemo(() => {
    const map = {};
    cycleDays.forEach((d) => {
      if (d.md === "MD" && d.date) {
        const match = matches.find((m) => m.date === d.date);
        if (match) map[d.date] = match.rival;
      }
    });
    return map;
  }, [cycleDays, matches]);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);
  const sessionRows = useMemo(() => {
    const rows = (gpsBySession[selectedSessionId] || []).filter((r) => r.include_in_session_average !== false);
    return rows
      .map((r) => {
        const player = playerMap[r.player_id];
        return { ...r, position: player?.position || "", player_name: r.player_name || player?.full_name || "" };
      })
      .filter((r) => !isGoalkeeper(playerMap[r.player_id]));
  }, [gpsBySession, selectedSessionId, playerMap]);

  const sessionSummary = useMemo(() => ({
    playersCount: sessionRows.length,
    avgDistance: avg(sessionRows.map((r) => r.total_distance)),
    avgMMin: avg(sessionRows.map((r) => r.m_min)),
    avgPlayerLoad: avg(sessionRows.map((r) => r.player_load)),
    avgSprints: avg(sessionRows.map((r) => r.sprints)),
  }), [sessionRows]);

  const highlights = useMemo(() => {
    function top(key) {
      const withVal = sessionRows.filter((r) => r[key] != null);
      if (!withVal.length) return null;
      const best = withVal.reduce((a, b) => (b[key] > a[key] ? b : a));
      return { name: best.player_name, value: best[key] };
    }
    return {
      maxDistance: top("total_distance"),
      maxSprints: top("sprints"),
      maxPlayerLoad: top("player_load"),
      maxSmax: top("smax"),
      maxRhie: top("rhie_bouts"),
    };
  }, [sessionRows]);

  const alertCounts = useMemo(() => {
    const counts = { muyAlta: 0, alta: 0, optima: 0 };
    sessionRows.forEach((r) => {
      const comp = competitionMap[r.player_id];
      if (!comp?.avg_total_distance) return;
      const pct = (r.total_distance / comp.avg_total_distance) * 100;
      if (pct >= 110) counts.muyAlta++;
      else if (pct >= 95) counts.alta++;
      else counts.optima++;
    });
    return counts;
  }, [sessionRows, competitionMap]);

  useEffect(() => {
    if (sessionRows.length && !sessionRows.some((r) => r.player_id === selectedPlayerId)) {
      setSelectedPlayerId(sessionRows[0].player_id);
    }
  }, [sessionRows, selectedPlayerId]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5" ref={dashboardRef}>
      <GpsDashboardHeader
        squads={squads}
        selectedSquadId={selectedSquadId}
        onSquadChange={setSelectedSquadId}
        seasons={seasons}
        selectedSeason={selectedSeason}
        onSeasonChange={setSelectedSeason}
        onImport={() => setShowImportModal(true)}
      />

      {showImportModal && <ImportHistoricalGPSModal onClose={() => { setShowImportModal(false); load(); }} />}

      <GpsLastSessionHero
        session={sortedSessions[0]}
        playerCount={sortedSessions[0] ? new Set((gpsBySession[sortedSessions[0].id] || []).map((r) => r.player_id)).size : null}
        md={cycleDays.find((d) => d.date === sortedSessions[0]?.date)?.md}
        rival={rivalByDate[sortedSessions[0]?.date]}
      />

      <GpsMicrocycleContext days={cycleDays} rivalByDate={rivalByDate} objective={cycleObjective} />

      <GpsKpiCards kpis={kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GpsSessionListPanel
          sessions={sessionsForList}
          selectedSessionId={selectedSessionId}
          onSelect={setSelectedSessionId}
          onViewReport={(id) => navigate(`/sessions?session=${id}`)}
        />
        <GpsSessionSummaryPanel session={selectedSession} summary={sessionSummary} highlights={highlights} />
      </div>

      <GpsLoadAlerts counts={alertCounts} />

      <GpsPlayerTable rows={sessionRows} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GpsMatchComparisonPanel
          rows={sessionRows}
          competitionMap={competitionMap}
          selectedPlayerId={selectedPlayerId}
          onSelectPlayer={setSelectedPlayerId}
        />
        <GpsPositionRadar rows={sessionRows} />
      </div>

      <GpsExportButtons session={selectedSession} rows={sessionRows} dashboardRef={dashboardRef} />
    </div>
  );
}