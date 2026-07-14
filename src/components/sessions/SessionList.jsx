import React, { useMemo, useState } from "react";
import { Calendar, Users, Clock, Trash2, Dumbbell, Goal, LocateFixed, Video, Eye, PlaySquare } from "lucide-react";
import VideoPreviewModal from "@/components/sessions/VideoPreviewModal";
import moment from "moment";
import { effectiveSessionMeta, findPlanDay } from "@/components/planning/microcycleSync";
import { getSessionVisual } from "@/components/sessions/SessionObjectiveIcon";

const DEFAULT_OBJECTIVE = { color: "#22c55e", text_color: "#ffffff", border_color: "#22c55e" };
const actionBtn = "flex flex-col items-center justify-center gap-1 min-w-[70px] px-3 py-2 rounded-xl text-[11px] font-semibold border transition-colors whitespace-nowrap";

function statusText(ok, yes, no) {
  return <span className={ok ? "text-emerald-400" : "text-red-400"}>{ok ? `✓ ${yes}` : `✕ ${no}`}</span>;
}

function buildObjectiveMap(physicalObjectives = []) {
  return Object.fromEntries(physicalObjectives.map((o) => [String(o.name || "").toLowerCase(), o]));
}

export default function SessionList({ sessions, onSelect, onDelete, hasFilters = false, exerciseCounts = {}, videoLinksBySession = {}, weeklyPlans = [], physicalObjectives = [] }) {
  const [preview, setPreview] = useState(null);
  const objectiveMap = useMemo(() => buildObjectiveMap(physicalObjectives), [physicalObjectives]);

  if (sessions.length === 0) {
    return <div className="text-center py-16 text-zinc-600"><p className="text-sm">{hasFilters ? "No se encontraron sesiones" : "Sin sesiones creadas"}</p>{!hasFilters && <p className="text-xs mt-1">Creá la primera sesión para comenzar</p>}</div>;
  }

  return (
    <div className="space-y-2">
      {sessions.map((session, index) => {
        const exercisesCount = exerciseCounts[session.id] || 0;
        const hasGPS = !!session.csv_label;
        const sessionVideoLinks = videoLinksBySession[session.id] || [];
        const hasVideo = !!session.video_url || sessionVideoLinks.length > 0;
        const effectiveMeta = effectiveSessionMeta(session, findPlanDay(weeklyPlans, { date: session.date, squadId: session.squad_id, seasonId: session.season_id }));
        const objectiveName = effectiveMeta.session_objective || session.session_objective || "Sesión";
        const objective = objectiveMap[String(objectiveName).toLowerCase()] || DEFAULT_OBJECTIVE;
        const visual = getSessionVisual(objectiveName, objective);
        const Icon = visual.Icon;
        const period = session.period || "Competencia";

        return (
          <div key={session.id} className="group relative overflow-hidden rounded-[22px] border border-zinc-900/80 bg-[#111113] shadow-[0_18px_42px_rgba(0,0,0,0.35)] transition-all hover:border-zinc-700">
            <div className="absolute inset-y-0 left-0 w-3 sm:w-4" style={{ backgroundColor: visual.accent }} />
            <button onClick={() => onSelect(session, "players")} className="relative flex min-h-[142px] w-full items-center gap-6 overflow-hidden pl-8 pr-5 text-left sm:min-h-[158px] sm:gap-9 sm:pl-12">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_35%,rgba(255,255,255,0.045),transparent_34%),linear-gradient(90deg,rgba(255,255,255,0.035),rgba(255,255,255,0.01))]" />
              <div className="relative flex w-[118px] shrink-0 items-center justify-center sm:w-[150px]">
                <Icon size={92} color={visual.accent} className="drop-shadow-[0_6px_14px_rgba(0,0,0,0.4)] sm:h-[112px] sm:w-[112px]" />
              </div>
              <div className="relative min-w-0 flex-1 py-6">
                <p className="text-[18px] font-black uppercase leading-none tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.75)]">SESIÓN</p>
                <h3 className="mt-2 max-w-[520px] text-[38px] font-black leading-[0.95] tracking-[-0.05em] text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.75)] sm:text-[56px]">
                  {visual.text}
                </h3>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="flex items-center gap-1"><Calendar size={12} />{moment(session.date).format("DD/MM/YYYY")}</span>
                  {session.duration_minutes && <span className="flex items-center gap-1"><Clock size={12} />{session.duration_minutes} min</span>}
                  <span>{period}</span>
                  {effectiveMeta.match_day_code && <span style={{ color: visual.accent }}>{effectiveMeta.match_day_code}</span>}
                </div>
              </div>
            </button>

            <div className="absolute bottom-3 right-3 flex max-w-[92%] flex-wrap justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
              <span className="rounded-full bg-black/35 px-2 py-1 text-[10px] font-bold text-zinc-400">{session.players_selected || 0} jugadores</span>
              <span className="rounded-full bg-black/35 px-2 py-1 text-[10px] font-bold text-zinc-400">{exercisesCount} ejercicios</span>
              <button onClick={() => onSelect(session, "players")} className="rounded-full bg-black/50 px-2 py-1 text-[10px] font-bold text-zinc-200 hover:text-white"><Eye size={11} className="mr-1 inline" />Ver</button>
              <button onClick={() => onSelect(session, "exercises")} className="rounded-full bg-black/50 px-2 py-1 text-[10px] font-bold text-zinc-200 hover:text-white"><Goal size={11} className="mr-1 inline" />Ejercicios</button>
              <button onClick={() => onSelect(session, "strength")} className="rounded-full bg-black/50 px-2 py-1 text-[10px] font-bold text-zinc-200 hover:text-white"><Dumbbell size={11} className="mr-1 inline" />Fuerza</button>
              <button onClick={() => onSelect(session, "gps")} className="rounded-full bg-black/50 px-2 py-1 text-[10px] font-bold text-zinc-200 hover:text-white"><LocateFixed size={11} className="mr-1 inline" />GPS</button>
              {hasVideo ? <button onClick={() => setPreview({ url: session.video_url || sessionVideoLinks[0].video_url, title: session.video_url ? session.title : sessionVideoLinks[0].title })} className="rounded-full bg-black/50 px-2 py-1 text-[10px] font-bold text-zinc-200 hover:text-white"><PlaySquare size={11} className="mr-1 inline" />Video</button> : <button onClick={() => onSelect(session, "video")} className="rounded-full bg-black/50 px-2 py-1 text-[10px] font-bold text-zinc-200 hover:text-white"><Video size={11} className="mr-1 inline" />Video</button>}
              <button onClick={() => onDelete(session.id)} className="rounded-full bg-black/50 px-2 py-1 text-[10px] font-bold text-zinc-500 hover:text-red-400"><Trash2 size={11} /></button>
            </div>
          </div>
        );
      })}
      {preview && <VideoPreviewModal url={preview.url} title={preview.title} onClose={() => setPreview(null)} />}
    </div>
  );
}