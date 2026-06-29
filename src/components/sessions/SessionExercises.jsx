import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const EXERCISE_TYPES = ["Técnico", "Táctico", "Físico", "Rondo", "Partido reducido", "Posesión", "Definición", "Otro"];

export default function SessionExercises({ sessionId }) {
  const [exercises, setExercises] = useState([]);
  const [form, setForm] = useState({ name: "", type: "Técnico", duration_minutes: "", objective: "", space: "", players: "", sets: "", rest_seconds: "", notes: "" });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    base44.entities.StrengthExercise.filter({ session_id: sessionId }, "order", 100).then(setExercises);
  }, [sessionId]);

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function addExercise(e) {
    e.preventDefault();
    setSaving(true);
    const ex = await base44.entities.StrengthExercise.create({
      ...form,
      session_id: sessionId,
      order: exercises.length + 1,
    });
    setExercises(prev => [...prev, ex]);
    setForm({ name: "", type: "Técnico", duration_minutes: "", objective: "", space: "", players: "", sets: "", rest_seconds: "", notes: "" });
    setShowForm(false);
    setSaving(false);
    toast({ title: "✓ Ejercicio agregado" });
  }

  async function removeExercise(id) {
    await base44.entities.StrengthExercise.delete(id);
    setExercises(prev => prev.filter(e => e.id !== id));
  }

  return (
    <div className="space-y-4">
      {exercises.length === 0 && !showForm && (
        <p className="text-zinc-600 text-sm text-center py-4">Sin ejercicios cargados</p>
      )}

      {exercises.map((ex, i) => (
        <div key={ex.id} className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 flex gap-3">
          <span className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[11px] font-bold text-zinc-300 shrink-0">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-white">{ex.name}</p>
                <p className="text-xs text-zinc-500">{ex.type}{ex.duration_minutes ? ` · ${ex.duration_minutes} min` : ""}{ex.sets ? ` · ${ex.sets} series` : ""}{ex.rest_seconds ? ` · ${ex.rest_seconds}s pausa` : ""}</p>
                {ex.objective && <p className="text-xs text-zinc-400 mt-0.5">{ex.objective}</p>}
                {ex.space && <p className="text-xs text-zinc-500">Espacio: {ex.space}{ex.players ? ` · Jugadores: ${ex.players}` : ""}</p>}
                {ex.notes && <p className="text-xs text-zinc-500 italic mt-0.5">{ex.notes}</p>}
              </div>
              <button onClick={() => removeExercise(ex.id)}
                className="text-zinc-600 hover:text-red-400 transition-colors shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}

      {showForm ? (
        <form onSubmit={addExercise} className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-white">Nuevo ejercicio</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <input required value={form.name} onChange={e => setF("name", e.target.value)} placeholder="Nombre del ejercicio *"
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <select value={form.type} onChange={e => setF("type", e.target.value)}
              className="bg-zinc-700 border border-zinc-600 rounded-lg px-2 py-2 text-xs text-white focus:outline-none">
              {EXERCISE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <input type="number" value={form.duration_minutes} onChange={e => setF("duration_minutes", e.target.value)} placeholder="Duración (min)"
              className="bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            <input value={form.objective} onChange={e => setF("objective", e.target.value)} placeholder="Objetivo"
              className="col-span-2 bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            <input value={form.space} onChange={e => setF("space", e.target.value)} placeholder="Espacio"
              className="bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            <input value={form.players} onChange={e => setF("players", e.target.value)} placeholder="Nº jugadores"
              className="bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            <input type="number" value={form.sets} onChange={e => setF("sets", e.target.value)} placeholder="Series"
              className="bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            <input type="number" value={form.rest_seconds} onChange={e => setF("rest_seconds", e.target.value)} placeholder="Pausa (seg)"
              className="bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            <input value={form.notes} onChange={e => setF("notes", e.target.value)} placeholder="Notas"
              className="col-span-2 bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-3 py-1.5 rounded-lg bg-zinc-700 text-zinc-300 text-xs hover:bg-zinc-600 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-white text-zinc-900 font-semibold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50">
              {saving ? "Guardando..." : "Agregar"}
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors">
          <Plus size={14} /> Agregar ejercicio
        </button>
      )}
    </div>
  );
}