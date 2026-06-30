import React from "react";
import { Link } from "react-router-dom";
import { Activity, Dumbbell, ClipboardList, Trophy, HeartPulse, Users, CalendarDays, ChevronRight } from "lucide-react";

function getEventStyle(type = "") {
  const t = type.toLowerCase();
  if (t.includes("partido")) return { icon: Trophy, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" };
  if (t.includes("fuerza")) return { icon: Dumbbell, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" };
  if (t.includes("evalua")) return { icon: ClipboardList, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" };
  if (t.includes("médic") || t.includes("medic") || t.includes("kinesio")) return { icon: HeartPulse, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" };
  if (t.includes("reunion") || t.includes("reunión")) return { icon: Users, color: "text-zinc-300", bg: "bg-zinc-700/30", border: "border-zinc-600" };
  if (t.includes("entrenamiento") || t.includes("campo")) return { icon: Activity, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" };
  return { icon: CalendarDays, color: "text-zinc-400", bg: "bg-zinc-800/40", border: "border-zinc-700" };
}

export default function DayScheduleAgenda({ events }) {
  const sorted = [...events].sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-white">Cronograma del Día</h2>
      </div>
      <div className="p-4">
        {sorted.length === 0 ? (
          <p className="text-zinc-600 text-sm text-center py-6">Sin eventos cargados para hoy</p>
        ) : (
          <div className="space-y-2">
            {sorted.map(ev => {
              const style = getEventStyle(ev.type);
              const Icon = style.icon;
              return (
                <div key={ev.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${style.bg} ${style.border}`}>
                  <span className="text-xs font-semibold text-zinc-300 w-12 shrink-0">{ev.time || "--:--"}</span>
                  <Icon size={15} className={`${style.color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{ev.title}</p>
                    {ev.location && <p className="text-[10px] text-zinc-500 truncate">{ev.location}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Link to="/schedule"
          className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors">
          Abrir Calendario Completo <ChevronRight size={13} />
        </Link>
      </div>
    </div>
  );
}