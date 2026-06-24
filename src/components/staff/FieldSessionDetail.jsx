import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, Play, Users, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

const performanceLevels = ["Muy bien", "Bien", "Regular", "Mal"];
const performanceColors = {
  "Muy bien": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Bien":     "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Regular":  "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Mal":      "bg-red-500/20 text-red-400 border-red-500/30",
};

function PlayerRow({ log, onChange }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-zinc-800/50 last:border-0">
      <div className="flex items-center gap-2 w-36 shrink-0">
        <span className="text-xs text-zinc-600 font-mono w-5 text-right">{log.player_number}</span>
        <span className="text-sm text-white truncate">{log.player_name}</span>
      </div>
      {/* Participated toggle */}
      <button
        onClick={() => onChange(log.player_id, { participated: !log.participated })}
        className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors shrink-0 ${
          log.participated
            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
            : "bg-zinc-800 text-zinc-600 border-zinc-700"
        }`}
      >
        {log.participated ? "Participó" : "No participó"}
      </button>
      {/* Performance select */}
      {log.participated && (
        <select
          value={log.performance || ""}
          onChange={(e) => onChange(log.player_id, { performance: e.target.value || undefined })}
          className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded-md px-2 py-1 flex-shrink-0"
        >
          <option value="">Sin eval.</option>
          {performanceLevels.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      )}
      {/* Notes */}
      <input
        value={log.notes || ""}
        onChange={(e) => onChange(log.player_id, { notes: e.target.value })}
        placeholder="Observación..."
        className="flex-1 min-w-0 bg-transparent border-b border-zinc-800 focus:border-zinc-600 text-xs text-zinc-300 placeholder-zinc-700 outline-none py-0.5 transition-colors"
      />
    </div>
  );
}

function ExerciseBlock({ exercise, players, onDelete }) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState({}); // player_id -> log data
  const [saving, setSaving] = useState({});
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !players.length) return;
    loadLogs();
  }, [open]);

  async function loadLogs() {
    try {
      const existing = await base44.entities.PlayerExerciseLog.filter({ exercise_id: exercise.id }, null, 100);
      const map = {};
      existing.forEach((l) => { map[l.player_id] = l; });
      // Merge with player list so every player appears
      players.forEach((p) => {
        if (!map[p.id]) {
          map[p.id] = {
            player_id: p.id,
            player_name: p.name,
            player_number: p.number,
            participated: true,
            performance: null,
            notes: "",
            _new: true,
          };
        } else {
          map[p.id].player_number = p.number;
        }
      });
      setLogs(map);
    } catch {
      toast({ title: "Error al cargar logs", variant: "destructive" });
    }
  }

  async function handleChange(playerId, patch) {
    // Optimistic update
    setLogs((prev) => ({ ...prev, [playerId]: { ...prev[playerId], ...patch } }));

    const current = { ...logs[playerId], ...patch };
    setSaving((s) => ({ ...s, [playerId]: true }));

    try {
      if (current._new || !current.id) {
        // Create
        const created = await base44.entities.PlayerExerciseLog.create({
          exercise_id: exercise.id,
          session_id: exercise.session_id,
          player_id: playerId,
          player_name: current.player_name,
          participated: current.participated ?? true,
          performance: current.performance || undefined,
          notes: current.notes || undefined,
        });
        setLogs((prev) => ({ ...prev, [playerId]: { ...prev[playerId], ...created, _new: false } }));
      } else {
        await base44.entities.PlayerExerciseLog.update(current.id, {
          participated: current.participated,
          performance: current.performance || undefined,
          notes: current.notes || undefined,
        });
      }
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setSaving((s) => ({ ...s, [playerId]: false }));
    }
  }

  const playerList = players.map((p) => logs[p.id] || {
    player_id: p.id, player_name: p.name, player_number: p.number, participated: true, _new: true,
  });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 hover:bg-zinc-800/30 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">{exercise.name}</p>
          <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-zinc-500">
            {exercise.space && <span>📍 {exercise.space}</span>}
            {exercise.duration_minutes && <span>⏱ {exercise.duration_minutes} min</span>}
            {(exercise.width_m || exercise.length_m) && (
              <span>📐 {exercise.width_m ?? "—"} × {exercise.length_m ?? "—"} m</span>
            )}
            {exercise.objective && <span className="text-zinc-400">{exercise.objective}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-zinc-600 flex items-center gap-1"><Users size={12} /> {players.length}</span>
          {open ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-zinc-800 px-4 pb-4 pt-3">
          {exercise.description && (
            <p className="text-xs text-zinc-500 mb-3">{exercise.description}</p>
          )}
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Interacción por jugador</p>
          <div className="overflow-x-auto">
            {playerList.length === 0 ? (
              <p className="text-zinc-600 text-xs text-center py-4">Sin jugadores en el plantel</p>
            ) : (
              playerList.map((log) => (
                <PlayerRow key={log.player_id} log={log} onChange={handleChange} />
              ))
            )}
          </div>
          <button onClick={() => onDelete(exercise.id)} className="mt-3 text-xs text-zinc-700 hover:text-red-400 transition-colors">
            Eliminar ejercicio
          </button>
        </div>
      )}
    </div>
  );
}

export default function FieldSessionDetail({ session, onBack }) {
  const [exercises, setExercises] = useState([]);
  const [players, setPlayers]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(!!session._openExForm);
  const [form, setForm] = useState({ name: "", description: "", space: "", duration_minutes: "", objective: "", width_m: "", length_m: "" });
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([
      base44.entities.FieldExercise.filter({ session_id: session.id }, "order", 100),
      base44.entities.Player.filter({ status: "Disponible" }, "number", 100),
    ]).then(([exs, pls]) => {
      setExercises(exs);
      // Also include all players (not just available) so you can track everyone
      return base44.entities.Player.list("number", 100).then(setPlayers);
    }).finally(() => setLoading(false));
  }, [session.id]);

  // Re-fetch all players (available + others for tracking)
  useEffect(() => {
    base44.entities.Player.list("number", 100).then(setPlayers);
  }, []);

  async function saveExercise(e) {
    e.preventDefault();
    try {
      const created = await base44.entities.FieldExercise.create({
        session_id: session.id,
        name: form.name,
        description: form.description || undefined,
        space: form.space || undefined,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
        objective: form.objective || undefined,
        width_m: form.width_m ? Number(form.width_m) : undefined,
        length_m: form.length_m ? Number(form.length_m) : undefined,
        order: exercises.length + 1,
      });
      setExercises((prev) => [...prev, created]);
      setForm({ name: "", description: "", space: "", duration_minutes: "", objective: "", width_m: "", length_m: "" });
      setShowForm(false);
      toast({ title: "Ejercicio agregado" });
    } catch {
      toast({ title: "Error al guardar ejercicio", variant: "destructive" });
    }
  }

  async function deleteExercise(id) {
    await base44.entities.FieldExercise.delete(id);
    setExercises((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="mt-1 text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-white tracking-tight">{session.title}</h2>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-zinc-500">
            <span>{moment(session.date).format("dddd D [de] MMMM YYYY")}</span>
            {session.duration_minutes && <span>{session.duration_minutes} min</span>}
            {session.intensity && <span className="text-zinc-400">{session.intensity}</span>}
          </div>
          {session.notes && <p className="text-xs text-zinc-600 mt-1">{session.notes}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {session.video_url && (
            <a href={session.video_url} target="_blank" rel="noopener noreferrer"
              className="bg-zinc-800 hover:bg-zinc-700 text-white p-2.5 rounded-lg transition-colors"
              title="Ver video"
            >
              <Play size={16} />
            </a>
          )}
          {session.gps_pdf_url && (
            <a href={session.gps_pdf_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white px-3 py-2 rounded-lg transition-colors text-xs font-medium"
              title="Ver informe GPS"
            >
              <FileText size={14} /> Informe GPS
            </a>
          )}
        </div>
      </div>

      {/* Exercises */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
          Ejercicios ({exercises.length})
        </p>
        <Button size="sm" onClick={() => setShowForm(true)} className="bg-white text-zinc-900 hover:bg-zinc-200 h-8 text-xs">
          <Plus size={13} className="mr-1" /> Agregar ejercicio
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
        </div>
      ) : exercises.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
          <p className="text-zinc-600 text-sm">Sin ejercicios — agregá el primero</p>
        </div>
      ) : (
        <div className="space-y-3">
          {exercises.map((ex) => (
            <ExerciseBlock key={ex.id} exercise={ex} players={players} onDelete={deleteExercise} />
          ))}
        </div>
      )}

      {/* Add exercise form */}
      {showForm && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5">
          <p className="text-sm font-semibold text-white mb-4">Nuevo ejercicio</p>
          <form onSubmit={saveExercise} className="space-y-3">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Nombre del ejercicio" className="bg-zinc-800 border-zinc-700 text-white" />
            <div className="grid grid-cols-2 gap-3">
              <Input value={form.space} onChange={(e) => setForm((f) => ({ ...f, space: e.target.value }))} placeholder="Espacio (ej: Mitad de campo)" className="bg-zinc-800 border-zinc-700 text-white" />
              <Input value={form.duration_minutes} onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))} placeholder="Duración (min)" type="number" className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <Input value={form.objective} onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))} placeholder="Objetivo táctico / físico" className="bg-zinc-800 border-zinc-700 text-white" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Ancho (m)</label>
                <Input value={form.width_m} onChange={(e) => setForm((f) => ({ ...f, width_m: e.target.value }))} placeholder="Ej: 20" type="number" className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Largo (m)</label>
                <Input value={form.length_m} onChange={(e) => setForm((f) => ({ ...f, length_m: e.target.value }))} placeholder="Ej: 30" type="number" className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
            </div>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Descripción del ejercicio..." rows={2} className="bg-zinc-800 border-zinc-700 text-white resize-none" />
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="bg-white text-zinc-900 hover:bg-zinc-200">Guardar ejercicio</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)} className="text-zinc-400">Cancelar</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}