import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Save, FolderOpen, Trash2, Loader2 } from "lucide-react";

// Modal dual: guardar cuadro como plantilla o aplicar plantilla existente.
export default function StrengthTemplateModal({ mode, block, squadId, squadName, onClose, onSaved, onApply }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [templateName, setTemplateName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [squadId]);

  async function loadTemplates() {
    setLoading(true);
    try {
      const rows = await base44.entities.StrengthBlockTemplate.list("-created_at", 200);
      setTemplates(rows.filter((t) => t.global === true || t.squad_id === squadId));
    } finally {
      setLoading(false);
    }
  }

  async function saveTemplate() {
    if (!templateName.trim()) return;
    setSaving(true);
    try {
      const exercises = (block._exercises || []).map((ex, i) => ({
        library_exercise_id: ex.library_strength_exercise_id || ex.library_exercise_id || "",
        exercise_name: ex.exercise_name || "",
        order: i + 1,
        series: ex.series || [],
        rest_time: ex.rest_time || "",
        notes: ex.notes || "",
        image_url: ex.image_url || "",
        video_url: ex.video_url || "",
      }));
      await base44.entities.StrengthBlockTemplate.create({
        name: templateName.trim(),
        color: block.color || "#22c55e",
        objective: block.objective || block.description || "",
        exercises,
        squad_id: squadId || undefined,
        squad_name: squadName || undefined,
        global: !squadId,
        created_at: new Date().toISOString(),
      });
      onSaved();
    } catch (err) {
      alert("No se pudo guardar la plantilla: " + (err?.message || err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(id) {
    if (!window.confirm("¿Eliminar esta plantilla? No afecta a sesiones que ya la usaron.")) return;
    await base44.entities.StrengthBlockTemplate.delete(id);
    loadTemplates();
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold flex items-center gap-2">
            {mode === "save" ? <><Save size={18} /> Guardar como plantilla</> : <><FolderOpen size={18} /> Aplicar plantilla</>}
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>

        {mode === "save" && (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-zinc-400">Nombre de la plantilla *</span>
              <input
                autoFocus
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={block.name ? `${block.name} (plantilla)` : "Mi plantilla..."}
                className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500"
              />
            </label>
            <div className="rounded-lg bg-zinc-950/40 border border-zinc-800 p-3 text-xs text-zinc-400">
              <p>La plantilla guardará: nombre, color, objetivo, ejercicios, orden, series, repeticiones, tiempos, cargas y pausa.</p>
              <p className="mt-1 text-zinc-500">Los cambios en esta copia no modificarán la plantilla original y viceversa.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm">Cancelar</button>
              <button onClick={saveTemplate} disabled={saving || !templateName.trim()} className="px-4 py-2 rounded-lg bg-white text-zinc-900 font-semibold text-sm disabled:opacity-50">
                {saving ? "Guardando..." : "Guardar plantilla"}
              </button>
            </div>
          </div>
        )}

        {mode === "apply" && (
          <div className="space-y-2">
            {loading && <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-zinc-500" /></div>}
            {!loading && templates.length === 0 && (
              <p className="text-center text-zinc-500 text-sm py-8">No hay plantillas guardadas. Guardá un cuadro como plantilla primero.</p>
            )}
            {!loading && templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-950/40 p-3 hover:border-zinc-500 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: t.color || "#22c55e" }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{t.name}</p>
                    <p className="text-xs text-zinc-500">{t.exercises?.length || 0} ejercicios{t.objective ? ` · ${t.objective}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onApply(t)} className="px-3 py-1.5 rounded-lg bg-white text-zinc-950 text-xs font-semibold hover:bg-zinc-200">Aplicar</button>
                  <button onClick={() => deleteTemplate(t.id)} className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}