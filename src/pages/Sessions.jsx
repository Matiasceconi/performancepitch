import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Video, Upload, X, Play, Clock, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

const sessionTypes = ["Entrenamiento", "Táctica", "Físico", "Regenerativo", "Partido amistoso", "Otro"];
const intensities = ["Baja", "Media", "Alta", "Muy alta"];

const intensityColors = {
  "Baja": "bg-blue-500/15 text-blue-400",
  "Media": "bg-yellow-500/15 text-yellow-400",
  "Alta": "bg-orange-500/15 text-orange-400",
  "Muy alta": "bg-red-500/15 text-red-400",
};

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    try {
      const data = await base44.entities.TrainingSession.list("-date", 50);
      setSessions(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleVideoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm((f) => ({ ...f, video_url: file_url }));
      toast({ title: "Video subido correctamente" });
    } catch {
      toast({ title: "Error al subir video", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await base44.entities.TrainingSession.create({
        ...form,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
      });
      toast({ title: "Sesión creada" });
      setShowForm(false);
      setForm({
        title: "",
        date: moment().format("YYYY-MM-DD"),
        session_type: "Entrenamiento",
        intensity: "Media",
        duration_minutes: "",
        notes: "",
        video_url: "",
      });
      setLoading(true);
      loadSessions();
    } catch {
      toast({ title: "Error al crear sesión", variant: "destructive" });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Sesiones</h1>
          <p className="text-zinc-500 text-sm mt-1">Registrá las sesiones de entrenamiento con video</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-white text-zinc-900 hover:bg-zinc-200">
          <Plus size={16} className="mr-1.5" /> Nueva sesión
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <Video size={40} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">No hay sesiones cargadas</p>
          <Button onClick={() => setShowForm(true)} variant="outline" className="mt-4 border-zinc-700 text-zinc-300 hover:bg-zinc-800">
            Cargar primera sesión
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {sessions.map((s) => (
            <div key={s.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-semibold text-sm">{s.title}</h3>
                    <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded">{s.session_type}</span>
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
          ))}
        </div>
      )}

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
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {sessionTypes.map((t) => (
                      <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Intensidad</label>
                <Select value={form.intensity} onValueChange={(v) => setForm((f) => ({ ...f, intensity: v }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {intensities.map((i) => (
                      <SelectItem key={i} value={i} className="text-white">{i}</SelectItem>
                    ))}
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
              <label className="text-xs text-zinc-400 mb-2 block">Video</label>
              {form.video_url ? (
                <div className="flex items-center gap-2 bg-zinc-800 p-3 rounded-lg">
                  <Play size={16} className="text-emerald-400" />
                  <span className="text-xs text-zinc-300 flex-1 truncate">Video cargado</span>
                  <button type="button" onClick={() => setForm((f) => ({ ...f, video_url: "" }))} className="text-zinc-500 hover:text-red-400">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-zinc-700 rounded-lg p-6 cursor-pointer hover:border-zinc-500 transition-colors">
                  {uploading ? (
                    <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Upload size={24} className="text-zinc-600" />
                      <span className="text-xs text-zinc-500">Subir video</span>
                    </>
                  )}
                  <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" disabled={uploading} />
                </label>
              )}
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