import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, ChevronRight, Video, Clock, Play, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import FieldSessionDetail from "@/components/staff/FieldSessionDetail";
import moment from "moment";
import "moment/locale/es";

moment.locale("es");

const sessionTypes = ["Entrenamiento", "Táctica", "Físico", "Regenerativo", "Partido amistoso", "Otro"];
const intensities  = ["Baja", "Media", "Alta", "Muy alta"];
const focusAreas   = ["Tensión", "Duración", "Velocidad", "Recuperación"];

const focusColors = {
  "Tensión":      "bg-red-500/20 text-red-400",
  "Duración":     "bg-blue-500/20 text-blue-400",
  "Velocidad":    "bg-yellow-500/20 text-yellow-400",
  "Recuperación": "bg-green-500/20 text-green-400",
};

const intensityColors = {
  "Baja":     "bg-blue-500/15 text-blue-400",
  "Media":    "bg-yellow-500/15 text-yellow-400",
  "Alta":     "bg-orange-500/15 text-orange-400",
  "Muy alta": "bg-red-500/15 text-red-400",
};

const intensityBorder = {
  "Baja":     "border-blue-400",
  "Media":    "border-yellow-400",
  "Alta":     "border-orange-400",
  "Muy alta": "border-red-400",
};

const MD_CODES = ["MD-6","MD-5","MD-4","MD-3","MD-2","MD-1","MD","MD+1","MD+2"];

export default function FieldSessions() {
  const [sessions, setSessions]       = useState([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [selected, setSelected]       = useState(null);
  const [filterMD, setFilterMD]       = useState(null);
  const [filterType, setFilterType]   = useState(null);

  const [editingSession, setEditingSession] = useState(null);

  const emptyForm = {
    title: "",
    date: moment().format("YYYY-MM-DD"),
    match_day_code: "",
    session_type: "Entrenamiento",
    focus_area: "",
    intensity: "Media",
    duration_minutes: "",
    notes: "",
    video_url: "",
    gps_pdf_url: "",
  };

  const [form, setForm] = useState(emptyForm);

  const { toast } = useToast();

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [data, players] = await Promise.all([
        base44.entities.TrainingSession.list("-date", 200),
        base44.entities.Player.filter({ status: "Disponible" }, "number", 100),
      ]);
      setSessions(data);
      setAvailableCount(players.length);
    } finally {
      setLoading(false);
    }
  }

  function openEdit(s, e) {
    e.stopPropagation();
    setEditingSession(s);
    setForm({
      title: s.title || "",
      date: s.date || moment().format("YYYY-MM-DD"),
      match_day_code: s.match_day_code || "",
      session_type: s.session_type || "Entrenamiento",
      focus_area: s.focus_area || "",
      intensity: s.intensity || "Media",
      duration_minutes: s.duration_minutes ?? "",
      notes: s.notes || "",
      video_url: s.video_url || "",
      gps_pdf_url: s.gps_pdf_url || "",
    });
    setShowForm(true);
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!confirm("¿Eliminar esta sesión?")) return;
    await base44.entities.TrainingSession.delete(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    toast({ title: "Sesión eliminada" });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
      };
      if (editingSession) {
        await base44.entities.TrainingSession.update(editingSession.id, payload);
        toast({ title: "Sesión actualizada" });
      } else {
        const created = await base44.entities.TrainingSession.create(payload);
        setSelected(created);
      }
      setShowForm(false);
      setEditingSession(null);
      setForm(emptyForm);
      setLoading(true);
      await load();
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  if (selected) {
    return <FieldSessionDetail session={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Sesiones de Campo</h2>
          <p className="text-zinc-500 text-sm mt-0.5 flex items-center gap-1.5">
            Ejercicios, espacio e interacción por jugador
            <span className="inline-flex items-center gap-1 ml-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5 text-xs font-medium">
              <Users size={11} /> {availableCount} disponibles
            </span>
          </p>
        </div>
        <Button onClick={() => { setEditingSession(null); setForm(emptyForm); setShowForm(true); }} className="bg-white text-zinc-900 hover:bg-zinc-200">
          <Plus size={15} className="mr-1.5" /> Nueva sesión
        </Button>
      </div>

      {/* Filters */}
      {sessions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500 font-medium">Código MD:</span>
            <button
              onClick={() => setFilterMD(null)}
              className={`text-xs px-2.5 py-1 rounded-full font-mono transition-colors ${filterMD === null ? "bg-violet-500/30 text-violet-300" : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"}`}
            >Todos</button>
            {MD_CODES.map((c) => (
              <button key={c} onClick={() => setFilterMD(filterMD === c ? null : c)}
                className={`text-xs px-2.5 py-1 rounded-full font-mono transition-colors ${filterMD === c ? "bg-violet-500/30 text-violet-300" : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"}`}
              >{c}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500 font-medium">Tipo:</span>
            <button onClick={() => setFilterType(null)} className={`text-xs px-2.5 py-1 rounded-full transition-colors ${filterType === null ? "bg-white/10 text-white" : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"}`}>Todos</button>
            {sessionTypes.map((t) => (
              <button key={t} onClick={() => setFilterType(filterType === t ? null : t)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${filterType === t ? "bg-white/10 text-white" : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"}`}
              >{t}</button>
            ))}
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <Video size={36} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">No hay sesiones de campo cargadas</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sessions.filter((s) => (!filterMD || s.match_day_code === filterMD) && (!filterType || s.session_type === filterType)).map((s) => (
            <div
              key={s.id}
              className={`bg-zinc-900 border border-zinc-800 border-l-2 ${intensityBorder[s.intensity] || "border-zinc-700"} rounded-xl p-4`}
            >
              <div className="flex items-center gap-3">
                <button onClick={() => setSelected(s)} className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold text-sm">{s.title}</span>
                    {s.match_day_code && (
                      <span className="text-xs px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 font-mono font-bold">
                        {s.match_day_code}
                      </span>
                    )}
                    {s.focus_area && (
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${focusColors[s.focus_area] || "bg-zinc-800 text-zinc-400"}`}>
                        {s.focus_area}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded ${intensityColors[s.intensity] || "bg-zinc-800 text-zinc-400"}`}>
                      {s.intensity}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                    <span>{moment(s.date).format("DD/MM/YYYY")}</span>
                    {s.duration_minutes && (
                      <span className="flex items-center gap-1"><Clock size={11} /> {s.duration_minutes} min</span>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setSelected({ ...s, _openExForm: true })}
                    className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus size={13} /> Ejercicio
                  </button>
                  <button onClick={(e) => openEdit(s, e)} className="text-zinc-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-zinc-800">
                    <Pencil size={14} />
                  </button>
                  <button onClick={(e) => handleDelete(s.id, e)} className="text-zinc-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-zinc-800">
                    <Trash2 size={14} />
                  </button>
                  <button onClick={() => setSelected(s)} className="text-zinc-600 hover:text-white transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(v) => { setShowForm(v); if (!v) { setEditingSession(null); setForm(emptyForm); } }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{editingSession ? "Editar sesión de campo" : "Nueva sesión de campo"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Título</label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required className="bg-zinc-800 border-zinc-700 text-white" placeholder="Ej: Táctica ofensiva" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Fecha</label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Duración (min)</label>
                <Input type="number" value={form.duration_minutes} onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))} placeholder="90" className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Código MD (días para el partido)</label>
              <Select value={form.match_day_code} onValueChange={(v) => setForm((f) => ({ ...f, match_day_code: v === "__none__" ? "" : v }))}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="__none__" className="text-zinc-400">Sin etiqueta</SelectItem>
                  {["MD-6","MD-5","MD-4","MD-3","MD-2","MD-1","MD","MD+1","MD+2"].map((c) => (
                    <SelectItem key={c} value={c} className="text-white">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <label className="text-xs text-zinc-400 mb-1 block">Foco de la sesión</label>
              <Select value={form.focus_area} onValueChange={(v) => setForm((f) => ({ ...f, focus_area: v }))}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Seleccionar foco..." /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {focusAreas.map((f) => <SelectItem key={f} value={f} className="text-white">{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Notas</label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} className="bg-zinc-800 border-zinc-700 text-white resize-none" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Link del video</label>
              <Input value={form.video_url} onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))} placeholder="https://youtube.com/..." className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Informe GPS (link PDF)</label>
              <Input value={form.gps_pdf_url} onChange={(e) => setForm((f) => ({ ...f, gps_pdf_url: e.target.value }))} placeholder="https://drive.google.com/..." className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <Button type="submit" className="w-full bg-white text-zinc-900 hover:bg-zinc-200">Guardar sesión</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}