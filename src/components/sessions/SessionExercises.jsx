import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Edit2, Check, X, GripVertical, Video, Image, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const EXERCISE_TYPES = ["Activación", "Técnico", "Táctico", "Reducido", "Posesión", "Finalización", "Fuerza", "Regenerativo", "Otro"];

const TYPE_COLORS = {
  "Activación": "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  "Técnico": "bg-blue-500/15 text-blue-300 border-blue-500/30",
  "Táctico": "bg-purple-500/15 text-purple-300 border-purple-500/30",
  "Reducido": "bg-orange-500/15 text-orange-300 border-orange-500/30",
  "Posesión": "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "Finalización": "bg-red-500/15 text-red-300 border-red-500/30",
  "Fuerza": "bg-pink-500/15 text-pink-300 border-pink-500/30",
  "Regenerativo": "bg-sky-500/15 text-sky-300 border-sky-500/30",
  "Otro": "bg-zinc-500/15 text-zinc-300 border-zinc-600",
};

const EMPTY_FORM = {
  name: "", type: "Técnico", duration_min: "", blocks: "", work_time: "", rest_time: "",
  length_m: "", width_m: "", players_count: "", objective: "", description: "",
  image_url: "", video_url: "", notes: "",
};

function calcDerived(f) {
  const l = parseFloat(f.length_m) || 0;
  const w = parseFloat(f.width_m) || 0;
  const p = parseFloat(f.players_count) || 0;
  const total_area = l && w ? parseFloat((l * w).toFixed(1)) : undefined;
  const eii = total_area && p ? parseFloat((total_area / p).toFixed(2)) : undefined;
  return { total_area, eii };
}

function num(v) { const n = parseFloat(v); return isNaN(n) ? undefined : n; }

export default function SessionExercises({ sessionId }) {
  const [exercises, setExercises] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null); // null = new, string = editing
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const { toast } = useToast();

  async function handleImageUpload(file) {
    if (!file) return;
    setUploadingImg(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setF("image_url", file_url);
    setUploadingImg(false);
  }

  useEffect(() => {
    base44.entities.SessionExercise.filter({ session_id: sessionId }, "order", 100).then(exs => {
      setExercises(exs.sort((a, b) => (a.order || 0) - (b.order || 0)));
    });
  }, [sessionId]);

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function openNew() { setForm(EMPTY_FORM); setEditId(null); setShowForm(true); }

  function openEdit(ex) {
    setForm({
      name: ex.name || "", type: ex.type || "Técnico",
      duration_min: ex.duration_min ?? "", blocks: ex.blocks ?? "",
      work_time: ex.work_time || "", rest_time: ex.rest_time || "",
      length_m: ex.length_m ?? "", width_m: ex.width_m ?? "",
      players_count: ex.players_count ?? "", objective: ex.objective || "",
      description: ex.description || "", image_url: ex.image_url || "",
      video_url: ex.video_url || "", notes: ex.notes || "",
    });
    setEditId(ex.id);
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const { total_area, eii } = calcDerived(form);
    const payload = {
      session_id: sessionId,
      name: form.name,
      type: form.type,
      duration_min: num(form.duration_min),
      blocks: num(form.blocks),
      work_time: form.work_time || undefined,
      rest_time: form.rest_time || undefined,
      length_m: num(form.length_m),
      width_m: num(form.width_m),
      players_count: num(form.players_count),
      total_area,
      eii,
      objective: form.objective || undefined,
      description: form.description || undefined,
      image_url: form.image_url || undefined,
      video_url: form.video_url || undefined,
      notes: form.notes || undefined,
    };

    if (editId) {
      const updated = await base44.entities.SessionExercise.update(editId, payload);
      setExercises(prev => prev.map(e => e.id === editId ? { ...e, ...updated } : e));
      toast({ title: "✓ Ejercicio actualizado" });
    } else {
      payload.order = exercises.length + 1;
      const created = await base44.entities.SessionExercise.create(payload);
      setExercises(prev => [...prev, created]);
      toast({ title: "✓ Ejercicio agregado" });
    }
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setSaving(false);
  }

  async function removeExercise(id) {
    if (!window.confirm("¿Eliminar ejercicio?")) return;
    await base44.entities.SessionExercise.delete(id);
    setExercises(prev => prev.filter(e => e.id !== id));
  }

  async function moveUp(idx) {
    if (idx === 0) return;
    const list = [...exercises];
    [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
    const updated = list.map((e, i) => ({ ...e, order: i + 1 }));
    setExercises(updated);
    await Promise.all(updated.map(e => base44.entities.SessionExercise.update(e.id, { order: e.order })));
  }

  async function moveDown(idx) {
    if (idx === exercises.length - 1) return;
    const list = [...exercises];
    [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
    const updated = list.map((e, i) => ({ ...e, order: i + 1 }));
    setExercises(updated);
    await Promise.all(updated.map(e => base44.entities.SessionExercise.update(e.id, { order: e.order })));
  }

  function toggleExpand(id) { setExpanded(p => ({ ...p, [id]: !p[id] })); }

  const derived = calcDerived(form);

  return (
    <div className="space-y-4">
      {exercises.length === 0 && !showForm && (
        <p className="text-zinc-600 text-sm text-center py-6">Sin ejercicios cargados</p>
      )}

      {/* Exercise cards */}
      {exercises.map((ex, i) => {
        const tc = TYPE_COLORS[ex.type] || TYPE_COLORS["Otro"];
        const isExpanded = expanded[ex.id];
        return (
          <div key={ex.id} className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
            {/* Full-width image at top */}
            {ex.image_url && (
              <img src={ex.image_url} alt={ex.name}
                className="w-full max-h-56 object-cover" />
            )}
            {/* Card header */}
            <div className="flex items-center gap-3 p-4">
              {/* Order controls */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button onClick={() => moveUp(i)} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                  <ChevronUp size={13} />
                </button>
                <span className="text-[11px] font-bold text-zinc-500 text-center">{i + 1}</span>
                <button onClick={() => moveDown(i)} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                  <ChevronDown size={13} />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tc}`}>{ex.type}</span>
                  {ex.duration_min && <span className="text-[10px] text-zinc-500">{ex.duration_min} min</span>}
                  {ex.blocks && <span className="text-[10px] text-zinc-500">{ex.blocks} bloques</span>}
                </div>
                <p className="text-sm font-semibold text-white">{ex.name}</p>
                {ex.objective && <p className="text-xs text-zinc-400 mt-0.5 truncate">{ex.objective}</p>}
              </div>

              {/* Metrics quick view */}
              {(ex.total_area || ex.eii || ex.players_count) && (
                <div className="hidden sm:flex items-center gap-3 text-[10px] text-zinc-500 shrink-0">
                  {ex.length_m && ex.width_m && <span>{ex.length_m}×{ex.width_m}m</span>}
                  {ex.players_count && <span>{ex.players_count} jug.</span>}
                  {ex.total_area && <span>{ex.total_area}m²</span>}
                  {ex.eii && <span className="text-amber-400 font-semibold">EII {ex.eii}</span>}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {ex.video_url && (
                  <a href={ex.video_url} target="_blank" rel="noreferrer"
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-blue-400 transition-colors">
                    <Video size={13} />
                  </a>
                )}
                <button onClick={() => toggleExpand(ex.id)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-white transition-colors">
                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
                <button onClick={() => openEdit(ex)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-white transition-colors">
                  <Edit2 size={13} />
                </button>
                <button onClick={() => removeExercise(ex.id)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div className="border-t border-zinc-700 p-4 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {ex.work_time && <div><p className="text-zinc-500">Tiempo trabajo</p><p className="text-white font-medium">{ex.work_time}</p></div>}
                  {ex.rest_time && <div><p className="text-zinc-500">Pausa</p><p className="text-white font-medium">{ex.rest_time}</p></div>}
                  {ex.length_m && <div><p className="text-zinc-500">Largo</p><p className="text-white font-medium">{ex.length_m} m</p></div>}
                  {ex.width_m && <div><p className="text-zinc-500">Ancho</p><p className="text-white font-medium">{ex.width_m} m</p></div>}
                  {ex.players_count && <div><p className="text-zinc-500">Jugadores</p><p className="text-white font-medium">{ex.players_count}</p></div>}
                  {ex.total_area && <div><p className="text-zinc-500">Superficie</p><p className="text-white font-medium">{ex.total_area} m²</p></div>}
                  {ex.eii && <div><p className="text-zinc-500">EII</p><p className="text-amber-300 font-bold">{ex.eii} m²/jug</p></div>}
                </div>
                {ex.description && <p className="text-xs text-zinc-400">{ex.description}</p>}
                {ex.notes && <p className="text-xs text-zinc-500 italic">{ex.notes}</p>}
              </div>
            )}
          </div>
        );
      })}

      {/* Form */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-white">{editId ? "Editar ejercicio" : "Nuevo ejercicio"}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] text-zinc-400 mb-1 block">Nombre *</label>
              <input required value={form.name} onChange={e => setF("name", e.target.value)}
                placeholder="Nombre del ejercicio"
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Tipo</label>
              <select value={form.type} onChange={e => setF("type", e.target.value)}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-2 py-2 text-xs text-white focus:outline-none">
                {EXERCISE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Duración (min)</label>
              <input type="number" value={form.duration_min} onChange={e => setF("duration_min", e.target.value)}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Bloques</label>
              <input type="number" value={form.blocks} onChange={e => setF("blocks", e.target.value)}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Tiempo trabajo</label>
              <input value={form.work_time} onChange={e => setF("work_time", e.target.value)} placeholder="ej: 4 min"
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Pausa</label>
              <input value={form.rest_time} onChange={e => setF("rest_time", e.target.value)} placeholder="ej: 2 min"
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>

            {/* Space */}
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Largo (m)</label>
              <input type="number" value={form.length_m} onChange={e => setF("length_m", e.target.value)}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Ancho (m)</label>
              <input type="number" value={form.width_m} onChange={e => setF("width_m", e.target.value)}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">N° jugadores</label>
              <input type="number" value={form.players_count} onChange={e => setF("players_count", e.target.value)}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>

            {/* Auto-calculated */}
            {(derived.total_area || derived.eii) && (
              <div className="flex items-center gap-4 col-span-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs">
                {derived.total_area && <span className="text-zinc-300">Superficie: <strong className="text-white">{derived.total_area} m²</strong></span>}
                {derived.eii && <span className="text-zinc-300">EII: <strong className="text-amber-300">{derived.eii} m²/jug</strong></span>}
              </div>
            )}

            <div className="col-span-2">
              <label className="text-[10px] text-zinc-400 mb-1 block">Objetivo</label>
              <input value={form.objective} onChange={e => setF("objective", e.target.value)}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-zinc-400 mb-1 block">Descripción</label>
              <textarea value={form.description} onChange={e => setF("description", e.target.value)}
                rows={2} className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none resize-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Imagen del ejercicio</label>
              {form.image_url ? (
                <div className="relative">
                  <img src={form.image_url} alt="preview" className="w-full max-h-40 object-cover rounded-lg border border-zinc-600" />
                  <button type="button" onClick={() => setF("image_url", "")}
                    className="absolute top-1 right-1 bg-zinc-900/80 text-zinc-300 hover:text-red-400 rounded-full p-1 transition-colors">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <label className={`flex items-center gap-2 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-xs text-zinc-300 cursor-pointer hover:bg-zinc-600 transition-colors ${uploadingImg ? "opacity-60 pointer-events-none" : ""}`}>
                  <Image size={13} />
                  {uploadingImg ? "Subiendo..." : "Subir imagen"}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => handleImageUpload(e.target.files[0])} />
                </label>
              )}
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">URL video</label>
              <input value={form.video_url} onChange={e => setF("video_url", e.target.value)} placeholder="https://youtube.com/..."
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-zinc-400 mb-1 block">Notas</label>
              <input value={form.notes} onChange={e => setF("notes", e.target.value)}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
              className="px-3 py-1.5 rounded-lg bg-zinc-700 text-zinc-300 text-xs hover:bg-zinc-600 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-white text-zinc-900 font-semibold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50">
              {saving ? "Guardando..." : editId ? "Actualizar" : "Agregar"}
            </button>
          </div>
        </form>
      ) : (
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors">
          <Plus size={14} /> Agregar ejercicio
        </button>
      )}
    </div>
  );
}