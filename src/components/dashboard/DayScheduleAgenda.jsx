import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Activity, Bus, Coffee, DoorOpen, Dumbbell, ClipboardList, Trophy, HeartPulse, Users, CalendarDays, ChevronRight, Plus, Pencil, Plane, Shirt, Utensils, Video } from "lucide-react";
import { useWorkspace } from "@/lib/WorkspaceContext";
import moment from "moment";
import QuickEventModal from "@/components/dashboard/QuickEventModal";

function getEventStyle(ev = {}) {
  const t = `${ev.title || ""} ${ev.type || ""} ${ev.event_type || ""} ${ev.location || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (t.includes("desayuno") || t.includes("merienda")) return { icon: Coffee, color: "text-amber-300", bg: "bg-amber-500/15", border: "border-amber-400/40", dot: "bg-amber-400" };
  if (t.includes("almuerzo") || t.includes("cena") || t.includes("comida")) return { icon: Utensils, color: "text-orange-300", bg: "bg-orange-500/15", border: "border-orange-400/40", dot: "bg-orange-400" };
  if (t.includes("llegada") || t.includes("vestuario") || t.includes("citacion") || t.includes("citación")) return { icon: Shirt, color: "text-sky-300", bg: "bg-sky-500/15", border: "border-sky-400/40", dot: "bg-sky-400" };
  if (t.includes("salida") || t.includes("traslado") || t.includes("micro") || t.includes("bus")) return { icon: Bus, color: "text-cyan-300", bg: "bg-cyan-500/15", border: "border-cyan-400/40", dot: "bg-cyan-400" };
  if (t.includes("viaje") || t.includes("vuelo")) return { icon: Plane, color: "text-indigo-300", bg: "bg-indigo-500/15", border: "border-indigo-400/40", dot: "bg-indigo-400" };
  if (t.includes("partido")) return { icon: Trophy, color: "text-red-300", bg: "bg-red-500/15", border: "border-red-400/40", dot: "bg-red-400" };
  if (t.includes("gimnasio") || t.includes("fuerza") || t.includes("gym")) return { icon: Dumbbell, color: "text-blue-300", bg: "bg-blue-500/15", border: "border-blue-400/40", dot: "bg-blue-400" };
  if (t.includes("cancha") || t.includes("campo") || t.includes("entrenamiento")) return { icon: Activity, color: "text-emerald-300", bg: "bg-emerald-500/15", border: "border-emerald-400/40", dot: "bg-emerald-400" };
  if (t.includes("auditorio") || t.includes("video") || t.includes("charla")) return { icon: Video, color: "text-violet-300", bg: "bg-violet-500/15", border: "border-violet-400/40", dot: "bg-violet-400" };
  if (t.includes("evalua")) return { icon: ClipboardList, color: "text-yellow-300", bg: "bg-yellow-500/15", border: "border-yellow-400/40", dot: "bg-yellow-400" };
  if (t.includes("medic") || t.includes("kinesio")) return { icon: HeartPulse, color: "text-purple-300", bg: "bg-purple-500/15", border: "border-purple-400/40", dot: "bg-purple-400" };
  if (t.includes("reunion") || t.includes("reunión")) return { icon: Users, color: "text-zinc-200", bg: "bg-zinc-700/40", border: "border-zinc-500/50", dot: "bg-zinc-400" };
  return { icon: DoorOpen, color: "text-zinc-300", bg: "bg-zinc-800/50", border: "border-zinc-600", dot: "bg-zinc-500" };
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
              const style = getEventStyle(ev);
              const Icon = style.icon;
              const status = getEventStatus(ev, displayDate);
              const isFinished = status === "finalizado";
              const isOngoing = status === "en_curso";
              return (
                <div key={ev.id}
                  className={`group relative overflow-hidden flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                    isFinished
                      ? "bg-zinc-800/30 border-zinc-800 opacity-60"
                      : isOngoing
                      ? `${style.bg} ${style.border} ring-2 ring-white/20`
                      : `${style.bg} ${style.border}`
                  }`}
                >
                  <span className={`absolute left-0 top-0 bottom-0 w-1 ${isFinished ? "bg-zinc-700" : style.dot}`} />
                  <span className={`text-xs font-semibold w-12 shrink-0 pl-1 ${isFinished ? "text-zinc-600" : "text-zinc-200"}`}>
                    {ev.time || "--:--"}
                  </span>
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isFinished ? "bg-zinc-800 text-zinc-600" : "bg-black/20 " + style.color}`}>
                    <Icon size={15} />
                  </span>
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