import React, { useState } from "react";
import { Calendar, Users, Clock, ChevronRight, Trash2, Dumbbell, Zap, Video, FileText, Eye } from "lucide-react";
import VideoPreviewModal from "@/components/sessions/VideoPreviewModal";
import moment from "moment";
import { effectiveSessionMeta, findPlanDay } from "@/components/planning/microcycleSync";

const TYPE_COLORS = {
  Campo: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Fuerza: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  Regenerativo: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  Activación: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  "Partido reducido": "bg-purple-500/15 text-purple-300 border-purple-500/30",
  Mixto: "bg-zinc-500/15 text-zinc-300 border-zinc-600",
  Otro: "bg-zinc-500/15 text-zinc-300 border-zinc-600",
};

const actionBtn = "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap";

export default function SessionList({ sessions, onSelect, onDelete, hasFilters = false, exerciseCounts = {}, videoLinksBySession = {}, weeklyPlans = [] }) {
  const [preview, setPreview] = useState(null);

  if (sessions.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-600">
        <p className="text-sm">{hasFilters ? "No se encontraron sesiones" : "Sin sesiones creadas"}</p>
        {!hasFilters && <p className="text-xs mt-1">Creá la primera sesión para comenzar</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map(session => {
        const typeClass = TYPE_COLORS[session.session_type] || TYPE_COLORS["Otro"];
        const exercisesCount = exerciseCounts[session.id] || 0;
        const hasGPS = !!session.csv_label;
        const sessionVideoLinks = videoLinksBySession[session.id] || [];
        const hasVideo = !!session.video_url || sessionVideoLinks.length > 0;
        const hasPDF = !!session.pdf_exported;
        const effectiveMeta = effectiveSessionMeta(session, findPlanDay(weeklyPlans, { date: session.date, squadId: session.squad_id, seasonId: session.season_id }));

        return (
          <div key={session.id}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors group">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Left */}
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect(session, "players")}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeClass}`}>
                    {session.session_type}
                  </span>
                  {effectiveMeta.match_day_code && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400">
                      {effectiveMeta.match_day_code}
                    </span>
                  )}
                  {effectiveMeta.session_objective && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                      {effectiveMeta.session_objective}
                    </span>
                  )}
                  {session.squad_name && (
                    <span className="text-[10px] text-zinc-500">{session.squad_name}</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-white truncate">{session.title}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-500 flex-wrap">
                  <span className="flex items-center gap-1"><Calendar size={10} />{moment(session.date).format("DD/MM/YYYY")}</span>
                  {session.duration_minutes && <span className="flex items-center gap-1"><Clock size={10} />{session.duration_minutes} min</span>}
                  {session.players_selected != null && <span className="flex items-center gap-1"><Users size={10} />{session.players_selected} jugadores</span>}
                  <span className="flex items-center gap-1"><Dumbbell size={10} />{exercisesCount} ejercicios</span>
                  <span className={`flex items-center gap-1 ${hasGPS ? "text-emerald-400" : "text-zinc-600"}`}>
                    <Zap size={10} />{hasGPS ? "GPS sí" : "GPS no"}
                  </span>
                  <span className={`flex items-center gap-1 ${hasVideo ? "text-blue-400" : "text-zinc-600"}`}>
                    <Video size={10} />{hasVideo ? "Video sí" : "Video no"}
                  </span>
                  <span className={`flex items-center gap-1 ${hasPDF ? "text-yellow-400" : "text-zinc-600"}`}>
                    <FileText size={10} />{hasPDF ? "PDF sí" : "PDF no"}
                  </span>
                </div>
              </div>

              {/* Right — quick actions */}
              <div className="flex items-center gap-1.5 flex-wrap shrink-0" onClick={e => e.stopPropagation()}>
                <button onClick={() => onSelect(session, "players")}
                  className={`${actionBtn} bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700`}>
                  Ver sesión <ChevronRight size={11} />
                </button>
                <button onClick={() => onSelect(session, "exercises")}
                  className={`${actionBtn} bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700`}>
                  <Dumbbell size={11} /> Ejercicios
                </button>
                <button onClick={() => onSelect(session, "gps")}
                  className={`${actionBtn} bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700`}>
                  <Zap size={11} /> GPS
                </button>
                {hasVideo ? (
                  <button
                    onClick={() => setPreview({
                      url: session.video_url || sessionVideoLinks[0].video_url,
                      title: session.video_url ? session.title : sessionVideoLinks[0].title,
                    })}
                    className={`${actionBtn} bg-blue-500/15 border-blue-500/30 text-blue-300 hover:bg-blue-500/25`}>
                    <Eye size={11} /> Ver video
                  </button>
                ) : (
                  <span className={`${actionBtn} bg-zinc-800/50 border-zinc-800 text-zinc-600`}>
                    <Video size={11} /> Sin video
                  </span>
                )}
                <button onClick={() => onSelect(session, "players", true)}
                  className={`${actionBtn} bg-yellow-500/15 border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/25`}>
                  <FileText size={11} /> {hasPDF ? "Descargar PDF" : "Generar PDF"}
                </button>
                <button
                  onClick={() => onDelete(session.id)}
                  className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {preview && <VideoPreviewModal url={preview.url} title={preview.title} onClose={() => setPreview(null)} />}
    </div>
  );
}