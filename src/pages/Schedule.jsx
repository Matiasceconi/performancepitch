import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, ChevronRight, Plus, X, Clock, MapPin, Pencil, Trash2 } from "lucide-react";
import moment from "moment";
import "moment/locale/es";

moment.locale("es");

const COLOR_MAP = {
  blue:   { bg: "bg-blue-500/20",   border: "border-blue-500/40",   text: "text-blue-300",   dot: "bg-blue-400" },
  green:  { bg: "bg-emerald-500/20", border: "border-emerald-500/40", text: "text-emerald-300", dot: "bg-emerald-400" },
  yellow: { bg: "bg-yellow-500/20", border: "border-yellow-500/40", text: "text-yellow-300", dot: "bg-yellow-400" },
  orange: { bg: "bg-orange-500/20", border: "border-orange-500/40", text: "text-orange-300", dot: "bg-orange-400" },
  red:    { bg: "bg-red-500/20",    border: "border-red-500/40",    text: "text-red-300",    dot: "bg-red-400" },
  purple: { bg: "bg-violet-500/20", border: "border-violet-500/40", text: "text-violet-300", dot: "bg-violet-400" },
  pink:   { bg: "bg-pink-500/20",   border: "border-pink-500/40",   text: "text-pink-300",   dot: "bg-pink-400" },
  cyan:   { bg: "bg-cyan-500/20",   border: "border-cyan-500/40",   text: "text-cyan-300",   dot: "bg-cyan-400" },
};

const COLORS = ["blue","green","yellow","orange","red","purple","pink","cyan"];
const COLOR_LABELS = { blue:"Azul", green:"Verde", yellow:"Amarillo", orange:"Naranja", red:"Rojo", purple:"Violeta", pink:"Rosa", cyan:"Celeste" };

const EMPTY_FORM = { date: "", time: "", title: "", type: "", duration_minutes: "", location: "", notes: "", color: "blue", rival_logo_url: "" };

const QUICK_TEMPLATES = [
  { title: "Desayuno", time: "08:00", duration_minutes: 45, color: "yellow", type: "Comida" },
  { title: "Almuerzo", time: "13:00", duration_minutes: 60, color: "orange", type: "Comida" },
  { title: "Cena", time: "20:00", duration_minutes: 60, color: "orange", type: "Comida" },
  { title: "Entrenamiento", time: "10:00", duration_minutes: 90, color: "green", type: "Entrenamiento" },
  { title: "Partido", time: "20:00", duration_minutes: 105, color: "red", type: "Partido" },
  { title: "Charla técnica", time: "09:00", duration_minutes: 60, color: "blue", type: "Charla" },
  { title: "Recuperación", time: "11:00", duration_minutes: 60, color: "cyan", type: "Físico" },
  { title: "Viaje", time: "07:00", duration_minutes: 120, color: "purple", type: "Logística" },
];

function EventCard({ event, onEdit, onDelete }) {
  const c = COLOR_MAP[event.color] || COLOR_MAP.blue;
  return (
    <div className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${c.bg} ${c.border} group`}>
      {event.rival_logo_url
        ? <img src={event.rival_logo_url} alt="Escudo" className="w-7 h-7 object-contain shrink-0 mt-0.5" onError={(e) => { e.target.style.display = "none"; }} />
        : <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${c.dot}`} />
      }
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <div>
            <p className={`text-sm font-semibold ${c.text}`}>{event.title}</p>
            {event.type && <p className="text-xs text-zinc-500">{event.type}</p>}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={() => onEdit(event)} className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
              <Pencil size={12} />
            </button>
            <button onClick={() => onDelete(event.id)} className="p-1 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors">
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {event.time && (
            <span className="flex items-center gap-1 text-xs text-zinc-500">
              <Clock size={10} /> {event.time}{event.duration_minutes ? ` · ${event.duration_minutes}min` : ""}
            </span>
          )}
          {event.location && (
            <span className="flex items-center gap-1 text-xs text-zinc-500">
              <MapPin size={10} /> {event.location}
            </span>
          )}
        </div>
        {event.notes && <p className="text-xs text-zinc-600 mt-1">{event.notes}</p>}
      </div>
    </div>
  );
}

function EventModal({ open, onClose, onSave, initial, defaultDate }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initial ? { ...EMPTY_FORM, ...initial } : { ...EMPTY_FORM, date: defaultDate || "" });
  }, [open, initial, defaultDate]);

  if (!open) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.title || !form.date) return;
    setSaving(true);
    const payload = { ...form, duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined };
    await onSave(payload);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">{initial ? "Editar evento" : "Nuevo evento"}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>
        {/* Quick templates */}
        <div className="mb-4">
          <p className="text-xs text-zinc-500 mb-2">Plantillas rápidas</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TEMPLATES.map((t) => (
              <button
                key={t.title}
                type="button"
                onClick={() => setForm((f) => ({ ...f, title: t.title, time: t.time, duration_minutes: t.duration_minutes, color: t.color, type: t.type }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${COLOR_MAP[t.color].bg} ${COLOR_MAP[t.color].text} ${COLOR_MAP[t.color].border} hover:opacity-80`}
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-zinc-400 mb-1 block">Título *</label>
              <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="Ej: Desayuno, Viaje al estadio..." value={form.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Tipo de evento</label>
              <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="Ej: Comida, Viaje..." value={form.type} onChange={(e) => set("type", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Fecha *</label>
              <input type="date" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Hora</label>
              <input type="time" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" value={form.time} onChange={(e) => set("time", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Duración (min)</label>
              <input type="number" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="60" value={form.duration_minutes} onChange={(e) => set("duration_minutes", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Lugar</label>
              <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="Ej: Hotel, Estadio..." value={form.location} onChange={(e) => set("location", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-zinc-400 mb-1 block">Notas</label>
              <textarea rows={2} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none" placeholder="Observaciones..." value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
            {form.type === "Partido" && (
              <div className="col-span-2">
                <label className="text-xs text-zinc-400 mb-1 block">URL escudo rival (opcional)</label>
                <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="https://..." value={form.rival_logo_url || ""} onChange={(e) => set("rival_logo_url", e.target.value)} />
                {form.rival_logo_url && (
                  <img src={form.rival_logo_url} alt="Escudo" className="mt-2 w-12 h-12 object-contain rounded" onError={(e) => e.target.style.display="none"} />
                )}
              </div>
            )}
            <div className="col-span-2">
              <label className="text-xs text-zinc-400 mb-2 block">Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button key={c} title={COLOR_LABELS[c]} onClick={() => set("color", c)} className={`w-7 h-7 rounded-full border-2 transition-all ${COLOR_MAP[c].dot} ${form.color === c ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={!form.title || !form.date || saving} className="px-4 py-2 rounded-lg text-sm bg-white text-zinc-900 font-semibold hover:bg-zinc-200 disabled:opacity-40 transition-colors">
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Schedule() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(moment().startOf("isoWeek"));
  const [view, setView] = useState("week"); // "week" | "month"
  const [currentMonth, setCurrentMonth] = useState(moment().startOf("month"));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [defaultDate, setDefaultDate] = useState("");

  async function loadEvents() {
    const data = await base44.entities.DayEvent.list("-date", 500);
    setEvents(data);
    setLoading(false);
  }

  useEffect(() => { loadEvents(); }, []);

  function getEventsForDate(dateStr) {
    return events
      .filter((e) => e.date === dateStr)
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  }

  async function handleSave(form) {
    if (editingEvent) {
      await base44.entities.DayEvent.update(editingEvent.id, form);
    } else {
      await base44.entities.DayEvent.create(form);
    }
    await loadEvents();
  }

  async function handleDelete(id) {
    await base44.entities.DayEvent.delete(id);
    await loadEvents();
  }

  function openNew(dateStr = "") {
    setEditingEvent(null);
    setDefaultDate(dateStr);
    setModalOpen(true);
  }

  function openEdit(event) {
    setEditingEvent(event);
    setDefaultDate(event.date);
    setModalOpen(true);
  }

  // WEEK VIEW
  function renderWeek() {
    const days = Array.from({ length: 7 }, (_, i) => currentWeek.clone().add(i, "day"));
    const today = moment().format("YYYY-MM-DD");

    return (
      <>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentWeek((w) => w.clone().subtract(1, "week"))} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors">
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-white font-semibold capitalize">
            {currentWeek.format("D MMM")} – {currentWeek.clone().endOf("isoWeek").format("D MMM YYYY")}
          </h2>
          <button onClick={() => setCurrentWeek((w) => w.clone().add(1, "week"))} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {days.map((d) => {
            const dateStr = d.format("YYYY-MM-DD");
            const isToday = dateStr === today;
            const dayEvents = getEventsForDate(dateStr);

            return (
              <div key={dateStr} className={`bg-zinc-900 border rounded-xl flex flex-col ${isToday ? "border-white/20" : "border-zinc-800"}`}>
                {/* Day header */}
                <div className={`flex items-center justify-between px-3 py-2 border-b ${isToday ? "border-white/10" : "border-zinc-800"}`}>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase font-medium">{d.format("ddd")}</p>
                    <p className={`text-lg font-bold ${isToday ? "text-white" : "text-zinc-300"}`}>{d.date()}</p>
                  </div>
                  <button onClick={() => openNew(dateStr)} className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-white transition-colors" title="Agregar evento">
                    <Plus size={14} />
                  </button>
                </div>
                {/* Events */}
                <div className="flex-1 p-2 space-y-1.5 min-h-[120px]">
                  {dayEvents.length === 0 && (
                    <p className="text-xs text-zinc-700 text-center pt-4">Sin eventos</p>
                  )}
                  {dayEvents.map((ev) => (
                    <EventCard key={ev.id} event={ev} onEdit={openEdit} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  // MONTH VIEW — mini calendar
  function renderMonth() {
    const DAYS_HEADER = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
    const startOfMonth = currentMonth.clone();
    const gridStart = startOfMonth.clone().startOf("isoWeek");
    const gridEnd = currentMonth.clone().endOf("month").endOf("isoWeek");
    const days = [];
    let day = gridStart.clone();
    while (day.isSameOrBefore(gridEnd, "day")) { days.push(day.clone()); day.add(1, "day"); }
    const today = moment().format("YYYY-MM-DD");

    return (
      <>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentMonth((m) => m.clone().subtract(1, "month"))} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors">
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-white font-semibold capitalize">{currentMonth.format("MMMM YYYY")}</h2>
          <button onClick={() => setCurrentMonth((m) => m.clone().add(1, "month"))} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {DAYS_HEADER.map((d) => <div key={d} className="text-center text-xs text-zinc-600 font-medium py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-px bg-zinc-800 rounded-xl overflow-hidden border border-zinc-800">
          {days.map((d) => {
            const dateStr = d.format("YYYY-MM-DD");
            const isCurrentMonth = d.isSame(currentMonth, "month");
            const isToday = dateStr === today;
            const dayEvents = getEventsForDate(dateStr);
            return (
              <div key={dateStr} className={`bg-zinc-900 min-h-[90px] p-1.5 ${!isCurrentMonth ? "opacity-25" : ""}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-white text-zinc-900" : "text-zinc-400"}`}>{d.date()}</div>
                  {isCurrentMonth && (
                    <button onClick={() => openNew(dateStr)} className="p-0.5 rounded hover:bg-zinc-700 text-zinc-700 hover:text-zinc-400 transition-colors opacity-0 hover:opacity-100 group-hover:opacity-100">
                      <Plus size={10} />
                    </button>
                  )}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev) => {
                    const c = COLOR_MAP[ev.color] || COLOR_MAP.blue;
                    return (
                      <div key={ev.id} className={`flex items-center gap-1 text-xs px-1 py-0.5 rounded truncate cursor-pointer ${c.bg} ${c.text}`} onClick={() => openEdit(ev)}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
                        <span className="truncate">{ev.time && `${ev.time} `}{ev.title}</span>
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && <p className="text-xs text-zinc-600 pl-1">+{dayEvents.length - 3} más</p>}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Cronograma</h1>
          <p className="text-zinc-500 text-sm mt-1">Planificación diaria del equipo</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-zinc-800 rounded-lg p-1 gap-1">
            <button onClick={() => setView("week")} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "week" ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>Semana</button>
            <button onClick={() => setView("month")} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "month" ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>Mes</button>
          </div>
          <button onClick={() => openNew(moment().format("YYYY-MM-DD"))} className="flex items-center gap-1.5 px-3 py-2 bg-white text-zinc-900 rounded-lg text-sm font-semibold hover:bg-zinc-200 transition-colors">
            <Plus size={15} /> Nuevo evento
          </button>
        </div>
      </div>

      {view === "week" ? renderWeek() : renderMonth()}

      <EventModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingEvent(null); }}
        onSave={handleSave}
        initial={editingEvent}
        defaultDate={defaultDate}
      />
    </div>
  );
}