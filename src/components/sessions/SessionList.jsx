import React from "react";
import { Calendar, Users, Clock, ChevronRight, Trash2 } from "lucide-react";
import moment from "moment";

const TYPE_COLORS = {
  Campo: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Fuerza: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  Regenerativo: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  Activación: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  "Partido reducido": "bg-purple-500/15 text-purple-300 border-purple-500/30",
  Mixto: "bg-zinc-500/15 text-zinc-300 border-zinc-600",
  Otro: "bg-zinc-500/15 text-zinc-300 border-zinc-600",
};

export default function SessionList({ sessions, onSelect, onDelete, hasFilters = false }) {
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
        return (
          <div key={session.id}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 hover:border-zinc-700 transition-colors cursor-pointer group"
            onClick={() => onSelect(session)}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeClass}`}>
                  {session.session_type}
                </span>
                {session.match_day_code && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400">
                    {session.match_day_code}
                  </span>
                )}
                {session.squad_name && (
                  <span className="text-[10px] text-zinc-500">{session.squad_name}</span>
                )}
              </div>
              <p className="text-sm font-semibold text-white truncate">{session.title}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 flex-wrap">
                <span className="flex items-center gap-1"><Calendar size={10} />{moment(session.date).format("DD/MM/YYYY")}</span>
                {session.duration_minutes && <span className="flex items-center gap-1"><Clock size={10} />{session.duration_minutes} min</span>}
                {session.players_selected != null && <span className="flex items-center gap-1"><Users size={10} />{session.players_selected} jugadores</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={e => { e.stopPropagation(); onDelete(session.id); }}
                className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 size={14} />
              </button>
              <ChevronRight size={16} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            </div>
          </div>
        );
      })}
    </div>
  );
}