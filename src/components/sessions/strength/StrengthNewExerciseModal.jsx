import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Loader2, AlertCircle } from "lucide-react";
import { normalizeExerciseName, canonicalExerciseName } from "@/components/sessions/exerciseLibrarySync";

// Modal para crear un ejercicio nuevo en la biblioteca.
// Detecta duplicados por nombre normalizado antes de guardar.
export default function StrengthNewExerciseModal({ squadId, squadName, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    async function checkDup() {
      if (!name.trim()) {
        setDuplicate(null);
        return;
      }
      setChecking(true);
      try {
        const all = await base44.entities.StrengthExerciseLibrary.list("-times_used", 500);
        const visible = all.filter((e) => e.global === true || e.squad_id === squadId);
        const exact = visible.find((e) => canonicalExerciseName(e.name) === canonicalExerciseName(name));
        if (exact) {
          setDuplicate({ type: "exact", exercise: exact });
        } else {
          const norm = normalizeExerciseName(name);
          const similar = visible.find((e) => {
            const eNorm = normalizeExerciseName(e.name);
            return eNorm.includes(norm) || norm.includes(eNorm);
          });
          if (similar) setDuplicate({ type: "similar", exercise: similar });
          else setDuplicate(null);
        }
      } catch {
        setDuplicate(null);
      } finally {
        setChecking(false);
      }
    }
    const t = setTimeout(checkDup, 350);
    return () => clearTimeout(t);
  }, [name, squadId]);

  async function uploadImage(file) {
    if (!file) return;
    setSaving(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setImageUrl(file_url);
    } finally {
      setSaving(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const created = await base44.entities.StrengthExerciseLibrary.create({
        name: name.trim(),
        normalized_name: canonicalExerciseName(name),
        category: category || undefined,
        video_url: videoUrl || undefined,
        image_url: imageUrl || undefined,
        notes: notes || undefined,
        squad_id: squadId || undefined,
        squad_name: squadName || undefined,
        global: !squadId,
        times_used: 1,
        first_created_at: today,
        last_used_at: today,
      });
      onCreated(created);
    } catch (err) {
      alert("No se pudo guardar el ejercicio: " + (err?.message || err));
    } finally {
      setSaving(false);
    }
  }

  function useExisting() {
    if (duplicate?.exercise) onCreated(duplicate.exercise);
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold">Crear ejercicio en biblioteca</h3>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-400">Nombre *</span>
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sentadilla bulgara..."
              className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500"
            />
          </label>

          {checking && <p className="text-xs text-zinc-500 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Verificando duplicados...</p>}

          {duplicate?.type === "exact" && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
              <p className="text-xs text-amber-300 flex items-center gap-1.5">
                <AlertCircle size={14} /> Ya existe "<strong>{duplicate.exercise.name}</strong>" en la biblioteca.
              </p>
              <button type="button" onClick={useExisting} className="px-3 py-1.5 rounded-lg bg-amber-500 text-zinc-950 text-xs font-semibold hover:bg-amber-400">
                Usar existente
              </button>
            </div>
          )}
          {duplicate?.type === "similar" && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-blue-500/10 border border-blue-500/30 p-3">
              <p className="text-xs text-blue-300 flex items-center gap-1.5">
                <AlertCircle size={14} /> Parece similar a "<strong>{duplicate.exercise.name}</strong>".
              </p>
              <button type="button" onClick={useExisting} className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-semibold hover:bg-blue-400">
                Usar existente
              </button>
            </div>
          )}

          <label className="block">
            <span className="text-xs text-zinc-400">Categoría</span>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Tren inferior, Core..."
              className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-zinc-400">URL Video (YouTube)</span>
              <input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/..."
                className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500"
              />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-400">Imagen</span>
              <div className="flex items-center gap-2 mt-1">
                {imageUrl && <img src={imageUrl} alt="" className="w-10 h-10 rounded object-cover border border-zinc-700" />}
                <label className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs cursor-pointer hover:bg-zinc-700">
                  {saving ? "Subiendo..." : "Subir"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0])} />
                </label>
              </div>
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-zinc-400">Indicaciones técnicas</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Indicaciones de ejecución..."
              rows={3}
              className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-zinc-500"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm">Cancelar</button>
          <button type="submit" disabled={saving || !name.trim()} className="px-4 py-2 rounded-lg bg-white text-zinc-900 font-semibold text-sm disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar en biblioteca"}
          </button>
        </div>
      </form>
    </div>
  );
}