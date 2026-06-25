import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Plus, ChevronRight, Video, Clock, Play, Pencil, Trash2, Users, Zap, Filter } from "lucide-react";
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
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [selected, setSelected]       = useState(null);
  const [filterMD, setFilterMD]       = useState(null);
  const [filterType, setFilterType]   = useState(null);
  const [filterFocus, setFilterFocus] = useState(null);

  const [editingSession, setEditingSession] = useState(null);

  const emptyForm = {
    title: "",
    date: moment().format("YYYY-MM-DD"),
    match_day_code: "",
    session_type: "Entrenamiento",
    focus_area: "",
    intensity: "Media",
    duration_minutes: "",
    players_count: "",
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
      setAvailablePlayers(players);
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
      players_count: s.players_count ?? "",
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
        players_count: form.players_count !== "" ? Number(form.players_count) : undefined,
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
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Filter size={13} className="text-zinc-400" />
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Filtros</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500 w-16 shrink-0">Código MD</span>
            <button
              onClick={() => setFilterMD(null)}
              className={`text-xs px-3 py-1 rounded-full font-mono font-semibold transition-all ${filterMD === null ? "bg-violet-600 text-white shadow shadow-violet-500/30" : "bg-zinc-800 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700"}`}
            >Todos</button>
            {MD_CODES.map((c) => (
              <button key={c} onClick={() => setFilterMD(filterMD === c ? null : c)}
                className={`text-xs px-3 py-1 rounded-full font-mono font-semibold transition-all ${filterMD === c ? "bg-violet-600 text-white shadow shadow-violet-500/30" : "bg-zinc-800 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700"}`}
              >{c}</button>
            ))}
          </div>
          <div className="h-px bg-zinc-800" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500 w-16 shrink-0">Tipo</span>
            <button onClick={() => setFilterType(null)} className={`text-xs px-3 py-1 rounded-full font-semibold transition-all ${filterType === null ? "bg-zinc-200 text-zinc-900 shadow" : "bg-zinc-800 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700"}`}>Todos</button>
            {sessionTypes.map((t) => (
              <button key={t} onClick={() => setFilterType(filterType === t ? null : t)}
                className={`text-xs px-3 py-1 rounded-full font-semibold transition-all ${filterType === t ? "bg-zinc-200 text-zinc-900 shadow" : "bg-zinc-800 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700"}`}
              >{t}</button>
            ))}
          </div>
          <div className="h-px bg-zinc-800" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500 w-16 shrink-0">Foco</span>
            <button onClick={() => setFilterFocus(null)} className={`text-xs px-3 py-1 rounded-full font-semibold transition-all ${filterFocus === null ? "bg-zinc-200 text-zinc-900 shadow" : "bg-zinc-800 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700"}`}>Todos</button>
            {focusAreas.map((f) => (
              <button key={f} onClick={() => setFilterFocus(filterFocus === f ? null : f)}
                className={`text-xs px-3 py-1 rounded-full font-semibold transition-all ${filterFocus === f ? "bg-zinc-200 text-zinc-900 shadow" : "bg-zinc-800 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700"}`}
              >{f}</button>
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
          {sessions.filter((s) => (!filterMD || s.match_day_code === filterMD) && (!filterType || s.session_type === filterType) && (!filterFocus || s.focus_area === filterFocus)).map((s) => (
            <div
              key={s.id}
              className={`group relative bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-600 border-l-4 ${intensityBorder[s.intensity] || "border-l-zinc-700"} rounded-xl p-4 transition-all duration-200 cursor-pointer`}
            >
              <div className="flex items-center gap-3">
                <button onClick={() => setSelected(s)} className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-white font-bold text-base">{s.title}</span>
                    {s.match_day_code && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-violet-600/30 text-violet-300 font-mono font-bold border border-violet-500/30">
                        {s.match_day_code}
                      </span>
                    )}
                    {s.focus_area && (
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${focusColors[s.focus_area] || "bg-zinc-800 text-zinc-400"} border-current/20`}>
                        {s.focus_area}
                      </span>
                    )}
                    {s.intensity && (
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${intensityColors[s.intensity] || "bg-zinc-800 text-zinc-400"}`}>
                        {s.intensity}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span className="text-zinc-400 font-medium">{moment(s.date).format("ddd DD/MM/YYYY")}</span>
                    {s.duration_minutes && (
                      <span className="flex items-center gap-1"><Clock size={11} /> {s.duration_minutes} min</span>
                    )}
                    {s.players_count && (
                      <span className="flex items-center gap-1 text-emerald-400 font-semibold"><Users size={11} /> {s.players_count} jug.</span>
                    )}
                    {s.session_type && (
                      <span className="text-zinc-600">{s.session_type}</span>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {s.video_url && (
                    <a
                      href={s.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-white bg-red-500/15 hover:bg-red-500/30 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
                    >
                      <Play size={13} /> Video
                    </a>
                  )}
                  <Link
                    to="/catapult"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-white bg-blue-500/15 hover:bg-blue-500/30 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    <Zap size={13} /> GPS
                  </Link>
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
              <label className="text-xs text-zinc-400 mb-1 block">Jugadores participantes</label>
              <Input
                type="number"
                min={1}
                value={form.players_count}
                onChange={(e) => setForm((f) => ({ ...f, players_count: e.target.value }))}
                placeholder="Ej: 22"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
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
              <Select value={form.focus_area || "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, focus_area: v === "__none__" ? "" : v }))}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Sin foco" /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="__none__" className="text-zinc-400">Sin foco</SelectItem>
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
            <Button type="submit" className="w-full bg-white text-zinc-900 hover:bg-zinc-200">Guardar sesión</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}