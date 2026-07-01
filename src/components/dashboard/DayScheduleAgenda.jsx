import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Activity, Dumbbell, ClipboardList, Trophy, HeartPulse, Users, CalendarDays, ChevronRight, Plus, Pencil } from "lucide-react";
import { useWorkspace } from "@/lib/WorkspaceContext";
import moment from "moment";
import QuickEventModal from "@/components/dashboard/QuickEventModal";

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

// Estado del evento según hora actual: pendiente | en_curso | finalizado
function getEventStatus(ev, dateStr) {
  if (!ev.time) return "pendiente";
  const start = moment(`${dateStr} ${ev.time}`, "YYYY-MM-DD HH:mm");
  if (!start.isValid()) return "pendiente";
  const end = start.clone().add(ev.duration_minutes || 60, "minutes");
  const now = moment();
  if (now.isBefore(start)) return "pendiente";
  if (now.isAfter(end)) return "finalizado";
  return "en_curso";
}

const STATUS_LABELS = { pendiente: "Pendiente", en_curso: "En curso", finalizado: "Finalizado" };

export default function DayScheduleAgenda({ todayEvents = [], tomorrowEvents = [], todayDate, tomorrowDate, onRefresh }) {
  const { activeSquadId, activeSquad } = useWorkspace();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const sortedToday = useMemo(
    () => [...todayEvents].sort((a, b) => (a.time || "").localeCompare(b.time || "")),
    [todayEvents]
  );
  const sortedTomorrow = useMemo(
    () => [...tomorrowEvents].sort((a, b) => (a.time || "").localeCompare(b.time || "")),
    [tomorrowEvents]
  );

  // Si no hay eventos hoy, o todos ya finalizaron → mostrar el cronograma de mañana
  const showTomorrow = useMemo(() => {
    if (sortedToday.length === 0) return true;
    return sortedToday.every(ev => getEventStatus(ev, todayDate) === "finalizado");
  }, [sortedToday, todayDate]);

  const displayDate = showTomorrow ? tomorrowDate : todayDate;
  const displayEvents = showTomorrow ? sortedTomorrow : sortedToday;
  const title = showTomorrow ? "Cronograma de Mañana" : "Cronograma del Día";
  const emptyText = showTomorrow ? "Sin eventos cargados para mañana" : "Sin eventos cargados para hoy";

  function openNew() { setEditingEvent(null); setModalOpen(true); }
  function openEdit(ev) { setEditingEvent(ev); setModalOpen(true); }
  function handleSaved() { if (onRefresh) onRefresh(); }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <button onClick={openNew} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-lg hover:bg-zinc-800 transition-colors">
          <Plus size={13} /> Agregar
        </button>
      </div>
      <div className="p-4">
        {displayEvents.length === 0 ? (
          <p className="text-zinc-600 text-sm text-center py-6">{emptyText}</p>
        ) : (
          <div className="space-y-2">
            {displayEvents.map(ev => {
              const style = getEventStyle(ev.type);
              const Icon = style.icon;
              const status = getEventStatus(ev, displayDate);
              const isFinished = status === "finalizado";
              const isOngoing = status === "en_curso";
              return (
                <div key={ev.id}
                  className={`group flex items-center gap-3 px-3 py-2 rounded-lg border transition-all ${
                    isFinished
                      ? "bg-zinc-800/30 border-zinc-800 opacity-60"
                      : isOngoing
                      ? `${style.bg} ${style.border} ring-2 ring-white/20`
                      : `${style.bg} ${style.border}`
                  }`}
                >
                  <span className={`text-xs font-semibold w-12 shrink-0 ${isFinished ? "text-zinc-600" : "text-zinc-300"}`}>
                    {ev.time || "--:--"}
                  </span>
                  <Icon size={15} className={`${isFinished ? "text-zinc-600" : style.color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isFinished ? "text-zinc-500 line-through" : "text-white"}`}>
                      {ev.title}
                    </p>
                    {ev.location && <p className="text-[10px] text-zinc-500 truncate">{ev.location}</p>}
                  </div>
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0 border ${
                    isFinished
                      ? "bg-zinc-700/30 text-zinc-500 border-zinc-700"
                      : isOngoing
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-zinc-700/30 text-zinc-400 border-zinc-700"
                  }`}>
                    {STATUS_LABELS[status]}
                  </span>
                  <button onClick={() => openEdit(ev)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all shrink-0" title="Editar">
                    <Pencil size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <Link to={`/schedule?date=${displayDate}`}
          className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors">
          Abrir Calendario Completo <ChevronRight size={13} />
        </Link>
      </div>

      <QuickEventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        event={editingEvent}
        date={displayDate}
        squadId={activeSquadId}
        squadName={activeSquad?.name || ""}
      />
    </div>
  );
}