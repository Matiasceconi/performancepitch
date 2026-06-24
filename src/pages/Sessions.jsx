import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Video, Play, Clock, LayoutList, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import SessionCalendar from "@/components/staff/SessionCalendar";
import moment from "moment";
import "moment/locale/es";

moment.locale("es");

const sessionTypes = ["Entrenamiento", "Táctica", "Físico", "Regenerativo", "Partido amistoso", "Otro"];
const intensities  = ["Baja", "Media", "Alta", "Muy alta"];

const intensityColors = {
  "Baja":     "bg-blue-500/15 text-blue-400",
  "Media":    "bg-yellow-500/15 text-yellow-400",
  "Alta":     "bg-orange-500/15 text-orange-400",
  "Muy alta": "bg-red-500/15 text-red-400",
};

const typeColors = {
  "Entrenamiento":    "bg-blue-500/15 text-blue-400",
  "Táctica":          "bg-purple-500/15 text-purple-400",
  "Físico":           "bg-orange-500/15 text-orange-400",
  "Regenerativo":     "bg-emerald-500/15 text-emerald-400",
  "Partido amistoso": "bg-red-500/15 text-red-400",
  "Otro":             "bg-zinc-500/15 text-zinc-400",
};

const intensityBorder = {
  "Baja":     "border-blue-400",
  "Media":    "border-yellow-400",
  "Alta":     "border-orange-400",
  "Muy alta": "border-red-400",
};

function SessionCard({ s }) {
  return (
    <div
      className={`bg-zinc-900 border border-zinc-800 border-l-2 ${intensityBorder[s.intensity] || "border-zinc-700"} rounded-xl p-4 hover:border-r-zinc-700 hover:border-t-zinc-700 hover:border-b-zinc-700 transition-colors`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-semibold text-sm">{s.title}</h3>
            <span className={`text-xs px-2 py-0.5 rounded ${typeColors[s.session_type] || "bg-zinc-800 text-zinc-400"}`}>
              {s.session_type}
            </span>
            {s.intensity && (
              <span className={`text-xs px-2 py-0.5 rounded ${intensityColors[s.intensity] || ""}`}>
                {s.intensity}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
            <span>{moment(s.date).format("DD/MM/YYYY")}</span>
            {s.duration_minutes && (
              <span className="flex items-center gap-1">
                <Clock size={12} /> {s.duration_minutes} min
              </span>
            )}
          </div>
          {s.notes && <p className="text-zinc-500 text-xs mt-2 line-clamp-2">{s.notes}</p>}
        </div>
        {s.video_url && (
          <a
            href={s.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 bg-zinc-800 hover:bg-zinc-700 text-white p-3 rounded-lg transition-colors"
          >
            <Play size={18} />
          </a>
        )}
      </div>
    </div>
  );
}

export default function Sessions() {
  const [sessions, setSessions]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState("calendar"); // "calendar" | "list"
  const [showForm, setShowForm]   = useState(false);

  const [selectedDay, setSelectedDay]       = useState(null);
  const [selectedDaySessions, setSelectedDaySessions] = useState([]);
  const [prefilledDate, setPrefilledDate]   = useState(null);

  const [form, setForm] = useState({
    title: "",
    date: moment().format("YYYY-MM-DD"),
    session_type: "Entrenamiento",
    intensity: "Media",
    duration_minutes: "",
    notes: "",
    video_url: "",
  });

  const { toast } = useToast();

  useEffect(() => { loadSessions(); }, []);

  async function loadSessions() {
    try {
      const data = await base44.entities.TrainingSession.list("-date", 200);
      setSessions(data);
    } finally {
      setLoading(false);
    }
  }

  function openNew(date) {
    setForm({
      title: "",
      date: date || moment().format("YYYY-MM-DD"),
      session_type: "Entrenamiento",
      intensity: "Media",
      duration_minutes: "",
      notes: "",
      video_url: "",
    });
    setShowForm(true);
  }

  function handleDayClick(dateKey, daySessions) {
    setSelectedDay(dateKey);
    setSelectedDaySessions(daySessions);
  }


  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await base44.entities.TrainingSession.create({
        ...form,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
      });
      toast({ title: "Sesión guardada" });
      setShowForm(false);
      // refresh selected day
      if (selectedDay === form.date) {
        setSelectedDaySessions((prev) => [...prev, { ...form, id: Date.now() }]);
      }
      setLoading(true);
      loadSessions();
    } catch {
      toast({ title: "Error al guardar sesión", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Sesiones</h1>
          <p className="text-zinc-500 text-sm mt-1">Organizá y registrá los entrenamientos del equipo</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-zinc-800 rounded-lg p-1 gap-1">
            <button
              onClick={() => setView("calendar")}
              className={`p-1.5 rounded-md transition-colors ${view === "calendar" ? "bg-white text-zinc-900" : "text-zinc-500 hover:text-white"}`}
              title="Vista calendario"
            >
              <CalendarDays size={16} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-1.5 rounded-md transition-colors ${view === "list" ? "bg-white text-zinc-900" : "text-zinc-500 hover:text-white"}`}
              title="Vista lista"
            >
              <LayoutList size={16} />
            </button>
          </div>
          <Button onClick={() => openNew()} className="bg-white text-zinc-900 hover:bg-zinc-200">
            <Plus size={16} className="mr-1.5" /> Nueva sesión
          </Button>
        </div>
      </div>

      {/* Calendar view */}
      {view === "calendar" && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <SessionCalendar sessions={sessions} onDayClick={handleDayClick} />
          </div>

          {/* Day panel */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col">
            {selectedDay ? (
              <>
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white capitalize">
                      {moment(selectedDay).format("dddd D")}
                    </p>
                    <p className="text-xs text-zinc-500 capitalize">
                      {moment(selectedDay).format("MMMM YYYY")}
                    </p>
                  </div>
                  <button
                    onClick={() => openNew(selectedDay)}
                    className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Agregar sesión en este día"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                  {selectedDaySessions.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-zinc-600 text-sm">Sin sesiones este día</p>
                      <button
                        onClick={() => openNew(selectedDay)}
                        className="mt-3 text-xs text-zinc-500 hover:text-white underline"
                      >
                        Agregar sesión
                      </button>
                    </div>
                  ) : (
                    selectedDaySessions.map((s) => (
                      <div key={s.id} className={`border-l-2 ${intensityBorder[s.intensity] || "border-zinc-700"} pl-3`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium">{s.title}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded ${typeColors[s.session_type] || ""}`}>
                                {s.session_type}
                              </span>
                              {s.intensity && (
                                <span className={`text-xs px-2 py-0.5 rounded ${intensityColors[s.intensity] || ""}`}>
                                  {s.intensity}
                                </span>
                              )}
                            </div>
                            {s.duration_minutes && (
                              <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                                <Clock size={11} /> {s.duration_minutes} min
                              </p>
                            )}
                            {s.notes && (
                              <p className="text-xs text-zinc-500 mt-1 line-clamp-3">{s.notes}</p>
                            )}
                          </div>
                          {s.video_url && (
                            <a
                              href={s.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded-lg transition-colors"
                            >
                              <Play size={14} />
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <CalendarDays size={32} className="text-zinc-700 mb-3" />
                <p className="text-zinc-600 text-sm">Seleccioná un día en el calendario para ver sus sesiones</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <>
          {sessions.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
              <Video size={40} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">No hay sesiones cargadas</p>
              <Button onClick={() => openNew()} variant="outline" className="mt-4 border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                Cargar primera sesión
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {sessions.map((s) => <SessionCard key={s.id} s={s} />)}
            </div>
          )}
        </>
      )}

      {/* Form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Nueva sesión</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Título</label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ej: Entrenamiento táctico"
                required
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Fecha</label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  required
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Duración (min)</label>
                <Input
                  type="number"
                  value={form.duration_minutes}
                  onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))}
                  placeholder="90"
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Tipo</label>
                <Select value={form.session_type} onValueChange={(v) => setForm((f) => ({ ...f, session_type: v }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {sessionTypes.map((t) => <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Intensidad</label>
                <Select value={form.intensity} onValueChange={(v) => setForm((f) => ({ ...f, intensity: v }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {intensities.map((i) => <SelectItem key={i} value={i} className="text-white">{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Notas</label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Observaciones de la sesión..."
                rows={3}
                className="bg-zinc-800 border-zinc-700 text-white resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Link del video</label>
              <Input
                value={form.video_url}
                onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
                placeholder="https://youtube.com/... o cualquier URL"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <Button type="submit" className="w-full bg-white text-zinc-900 hover:bg-zinc-200">
              Guardar sesión
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}