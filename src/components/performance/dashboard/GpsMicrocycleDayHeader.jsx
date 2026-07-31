import React, { useMemo } from "react";
import moment from "moment";
import "moment/locale/es";
import { Activity, AlertTriangle, CalendarOff, CheckCircle2, Clock, Trophy, Users } from "lucide-react";
import { resolveDaySessions, dayGpsStatus, dayGpsPlayerCount } from "./gpsDayResolver";
import { buildDailySummariesFromDays } from "./gpsDayAccumulation";
import { MICRO_METRICS } from "./gpsMicrocycleReportUtils";

moment.locale("es");

const STATUS_CONFIG = {
  free: { label: "Día libre", icon: CalendarOff, color: "text-zinc-500", border: "border-zinc-800", bg: "from-zinc-900 to-zinc-950", badge: "bg-zinc-800 text-zinc-400" },
  no_session: { label: "Sin sesión", icon: Clock, color: "text-zinc-500", border: "border-zinc-800", bg: "from-zinc-900 to-zinc-950", badge: "bg-zinc-800 text-zinc-400" },
  gps_pending: { label: "GPS pendiente", icon: Clock, color: "text-amber-400", border: "border-amber-500/30", bg: "from-amber-950/40 to-zinc-950", badge: "bg-amber-500/15 text-amber-300" },
  gps_partial: { label: "GPS incompleto", icon: AlertTriangle, color: "text-yellow-400", border: "border-yellow-500/30", bg: "from-yellow-950/40 to-zinc-950", badge: "bg-yellow-500/15 text-yellow-300" },
  gps_complete: { label: "GPS procesado", icon: CheckCircle2, color: "text-lime-400", border: "border-lime-500/30", bg: "from-emerald-950/40 to-zinc-950", badge: "bg-lime-500/15 text-lime-300" },
  match_with_gps: { label: "Partido con GPS", icon: Trophy, color: "text-lime-300", border: "border-emerald-500/40", bg: "from-emerald-950 via-zinc-950 to-zinc-950", badge: "bg-emerald-400/15 text-emerald-200" },
  match_no_gps: { label: "Partido sin GPS", icon: Trophy, color: "text-emerald-300", border: "border-emerald-500/30", bg: "from-emerald-950/40 to-zinc-950", badge: "bg-emerald-500/15 text-emerald-300" },
  needs_review: { label: "Requiere revisión", icon: AlertTriangle, color: "text-red-400", border: "border-red-500/30", bg: "from-red-950/40 to-zinc-950", badge: "bg-red-500/15 text-red-300" },
};

function fmtMetric(value, unit) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  const shown = unit === "km/h" || unit === "u/min" || unit === "%" || n < 100 ? n.toFixed(1) : Math.round(n).toLocaleString("es-AR");
  return `${shown}${unit ? " " + unit : ""}`.trim();
}

function DayCard({ day, daySessions, status, gpsPlayers, metricValues, active, onClick, onSessionClick, selectedSessionIds }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.no_session;
  const StatusIcon = config.icon;
  const isMatch = day.day_type === "match";
  const isRest = day.day_type === "rest" || status === "free";
  const totalDistance = metricValues?.total_distance;
  const playerLoad = metricValues?.player_load;

  return (
    <button
      onClick={onClick}
      className={`relative min-h-[180px] min-w-[150px] max-w-[200px] rounded-xl border bg-gradient-to-b ${config.bg} p-3.5 text-left transition ${active ? `${config.border} shadow-[0_0_0_1px_rgba(163,230,53,0.35),0_18px_42px_rgba(0,0,0,0.35)]` : `${config.border} hover:border-zinc-600`}`}
    >
      {active && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-lime-400 text-[11px] font-black text-zinc-950">✓</span>}

      {/* Header: weekday + date + MD */}
      <div className="mb-2">
        <p className="text-[10px] uppercase font-medium text-zinc-500">{day.date ? moment(day.date).format("dddd") : "—"}</p>
        <p className="text-sm font-bold text-white leading-tight">{day.date ? moment(day.date).format("DD/MM") : "—"}</p>
        <p className="text-base font-black leading-none mt-1" style={{ color: isMatch ? "#a3e635" : "#fff" }}>
          {day.display_md_label || day.md || day.md_code || "—"}
        </p>
      </div>

      {/* Status badge */}
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${config.badge}`}>
        <StatusIcon size={10} /> {config.label}
      </span>

      {/* Sessions */}
      {!isRest && daySessions.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {daySessions.map((s) => (
            <div
              key={s.id}
              onClick={(e) => { e.stopPropagation(); onSessionClick?.(s.id); }}
              className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] transition ${selectedSessionIds?.includes(s.id) ? "bg-lime-500/15 text-lime-300" : "text-zinc-300 hover:bg-zinc-800/50"}`}
            >
              {s.start_time && <Clock size={9} className="shrink-0 text-zinc-500" />}
              <span className="truncate">{s.start_time || ""} {s.session_type || s.title || "Sesión"}</span>
            </div>
          ))}
        </div>
      )}

      {/* Objective */}
      {!isRest && daySessions.length > 0 && daySessions[0]?.session_objective && (
        <p className="mt-1.5 text-[10px] text-zinc-500 truncate">{daySessions[0].session_objective}</p>
      )}

      {/* Footer: GPS players + load */}
      {!isRest && (
        <div className="mt-2 border-t border-zinc-800 pt-1.5 space-y-0.5">
          {gpsPlayers > 0 && (
            <p className="flex items-center gap-1 text-[10px] text-zinc-400">
              <Users size={9} /> GPS {gpsPlayers} jugadores
            </p>
          )}
          {totalDistance != null && (
            <p className="flex items-center gap-1 text-[10px] text-zinc-400">
              <Activity size={9} /> {fmtMetric(totalDistance, "m")}
            </p>
          )}
          {playerLoad != null && (
            <p className="text-[10px] text-zinc-500">PL {fmtMetric(playerLoad, "u")}</p>
          )}
        </div>
      )}
    </button>
  );
}

export default function GpsMicrocycleDayHeader({
  cycleDays = [],
  sessions = [],
  gpsBySession = {},
  matchReports = [],
  matchGpsByMatch = {},
  squadId,
  seasonId,
  selectedDayDate = "",
  onSelectDay,
  selectedSessionIds = [],
  onToggleSession,
}) {
  const dayData = useMemo(() => {
    return (cycleDays || []).map((day) => {
      const daySessions = resolveDaySessions(day, sessions, squadId, seasonId);
      const status = dayGpsStatus(day, daySessions, gpsBySession, matchGpsByMatch);
      const gpsPlayers = dayGpsPlayerCount(daySessions, gpsBySession);
      const summaries = buildDailySummariesFromDays({
        cycleDays: [day], sessions, gpsBySession, matchReports, matchGpsByMatch, squadId, seasonId, metrics: MICRO_METRICS,
      });
      return { day, daySessions, status, gpsPlayers, metricValues: summaries[0] || {} };
    });
  }, [cycleDays, sessions, gpsBySession, matchReports, matchGpsByMatch, squadId, seasonId]);

  if (!cycleDays.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex gap-3 overflow-x-auto pb-1">
        {dayData.map(({ day, daySessions, status, gpsPlayers, metricValues }) => (
          <DayCard
            key={day.weekly_plan_day_id || day.id || day.date || Math.random()}
            day={day}
            daySessions={daySessions}
            status={status}
            gpsPlayers={gpsPlayers}
            metricValues={metricValues}
            active={selectedDayDate === day.date}
            onClick={() => onSelectDay?.(day.date)}
            onSessionClick={onToggleSession}
            selectedSessionIds={selectedSessionIds}
          />
        ))}
      </div>
    </div>
  );
}