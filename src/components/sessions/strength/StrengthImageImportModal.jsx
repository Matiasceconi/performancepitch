import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Upload, Loader, Sparkles, Trash2, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { METHOD_OPTIONS, TYPE_OPTIONS, syncToLibrary } from "@/components/sessions/strength/strengthOptions";

export default function StrengthImageImportModal({ session, hasExisting, onClose, onImported }) {
  const [step, setStep] = useState("upload"); // upload | analyzing | review
  const [imageUrl, setImageUrl] = useState(null);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({});
  const [replaceMode, setReplaceMode] = useState(null); // "replace" | "add"
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStep("analyzing");
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setImageUrl(file_url);

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Sos un preparador físico de fútbol. Esta imagen es una planilla/planificación de un entrenamiento de fuerza.
Extraé la siguiente información:
- Propósito mecánico de la sesión (si figura)
- Tipo de sesión de fuerza (si figura)
- Patrón vectorial (si figura)
- La lista de ejercicios de la planificación, en orden, con: grupo, método de trabajo, tipo de trabajo, nombre del ejercicio, volumen (formato libre ej: 3x8, 3+3, 12+12) y observaciones si existen.
- Si la imagen tiene dos cuadros/columnas, clasificá cada ejercicio según el cuadro donde aparece: "restaura" para Grupo Restaura/restauración/recuperación y "compensa" para Grupo Compensa/compensación/rendimiento.

Para "método" intentá mapear a una de estas opciones si es posible: ${METHOD_OPTIONS.join(", ")}. Si no coincide con ninguna, dejá el texto tal cual aparece en la imagen.
Para "tipo" intentá mapear a una de estas opciones si es posible: ${TYPE_OPTIONS.join(", ")}. Si no coincide con ninguna, dejá el texto tal cual aparece en la imagen.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            strength_purpose: { type: "string" },
            strength_session_type: { type: "string" },
            strength_vector_pattern: { type: "string" },
            exercises: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  strength_group: { type: "string", enum: ["restaura", "compensa"] },
                  method: { type: "string" },
                  exercise_type: { type: "string" },
                  exercise_name: { type: "string" },
                  volume: { type: "string" },
                  notes: { type: "string" },
                },
              },
            },
          },
          required: ["exercises"],
        },
      });

      setMeta({
        strength_purpose: result.strength_purpose || "",
        strength_session_type: result.strength_session_type || "",
        strength_vector_pattern: result.strength_vector_pattern || "",
      });
      setRows((result.exercises || []).map((r, i) => ({
        tempId: `import-${i}`,
        strength_group: normalizeGroup(r.strength_group),
        method: r.method || "",
        exercise_type: r.exercise_type || "",
        exercise_name: r.exercise_name || "",
        volume: r.volume || "",
        notes: r.notes || "",
      })));
      setReplaceMode(hasExisting ? null : "add");
      setStep("review");
    } catch (err) {
      toast({ title: "Error al analizar la imagen: " + err.message, variant: "destructive" });
      setStep("upload");
    }
  }

  function updateRow(tempId, field, value) {
    setRows(prev => prev.map(r => r.tempId === tempId ? { ...r, [field]: value } : r));
  }

  function normalizeGroup(value) {
    const text = String(value || "").toLowerCase();
    if (text.includes("compensa")) return "compensa";
    return "restaura";
  }

  function deleteRow(tempId) {
    setRows(prev => prev.filter(r => r.tempId !== tempId));
  }

  async function confirmImport() {
    if (hasExisting && !replaceMode) return;
    setSaving(true);
    try {
      if (replaceMode === "replace") {
        const existing = await base44.entities.StrengthStation.filter({ session_id: session.id }, "order", 200);
        await Promise.all(existing.map(s => base44.entities.StrengthStation.delete(s.id)));
      }

      const startOrder = replaceMode === "replace" ? 0 : (await base44.entities.StrengthStation.filter({ session_id: session.id }, "order", 200)).length;

      const created = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const payload = {
          session_id: session.id,
          order: startOrder + i + 1,
          station_number: rows.filter((item, idx) => idx <= i && normalizeGroup(item.strength_group) === normalizeGroup(r.strength_group)).length,
          strength_group: normalizeGroup(r.strength_group),
          method: r.method || "",
          exercise_type: r.exercise_type || "",
          exercise_name: r.exercise_name || "",
          volume: r.volume || "",
          notes: r.notes || "",
        };
        const row = await base44.entities.StrengthStation.create(payload);
        created.push(row);
        if (r.exercise_name) {
          await syncToLibrary(payload, session.id, session?.squad_id, session?.squad_name);
        }
      }

      const sessionUpdate = {
        strength_purpose: meta.strength_purpose || session.strength_purpose,
        strength_session_type: meta.strength_session_type || session.strength_session_type,
        strength_vector_pattern: meta.strength_vector_pattern || session.strength_vector_pattern,
      };
      await base44.entities.TrainingSession.update(session.id, sessionUpdate);

      await base44.entities.SessionVideoLink.create({
        session_id: session.id,
        title: "Planificación de fuerza (imagen original)",
        video_url: imageUrl,
        source: "Otro",
        video_type: "Fuerza",
      }).catch(() => {});

      toast({ title: `✓ ${created.length} ejercicios importados` });
      onImported({ ...session, ...sessionUpdate });
    } catch (err) {
      toast({ title: "Error al guardar la importación: " + err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-purple-400" />
            <p className="text-sm font-semibold text-white">Importar fuerza desde imagen</p>
          </div>
          <button onClick={onClose} disabled={saving} className="text-zinc-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === "upload" && (
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-zinc-700 rounded-xl py-10 cursor-pointer hover:border-zinc-500 transition-colors">
              <Upload size={22} className="text-zinc-500" />
              <p className="text-sm text-zinc-400">Subí una imagen de la planificación de fuerza</p>
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </label>
          )}

          {step === "analyzing" && (
            <div className="flex flex-col items-center justify-center gap-3 py-14">
              <Loader size={24} className="animate-spin text-purple-400" />
              <p className="text-sm text-zinc-400">Analizando imagen con IA...</p>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-zinc-400">Revisar importación</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-500 mb-1 block">Propósito mecánico</label>
                  <input value={meta.strength_purpose || ""} onChange={e => setMeta(m => ({ ...m, strength_purpose: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 mb-1 block">Tipo de sesión</label>
                  <input value={meta.strength_session_type || ""} onChange={e => setMeta(m => ({ ...m, strength_session_type: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 mb-1 block">Patrón vectorial</label>
                  <input value={meta.strength_vector_pattern || ""} onChange={e => setMeta(m => ({ ...m, strength_vector_pattern: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                </div>
              </div>

              {hasExisting && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2">
                  <p className="text-xs text-amber-300">¿Querés reemplazar la fuerza actual o agregar estos ejercicios debajo?</p>
                  <div className="flex gap-2">
                    <button onClick={() => setReplaceMode("replace")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${replaceMode === "replace" ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-300 border border-zinc-700"}`}>
                      Reemplazar actual
                    </button>
                    <button onClick={() => setReplaceMode("add")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${replaceMode === "add" ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-300 border border-zinc-700"}`}>
                      Agregar debajo
                    </button>
                  </div>
                </div>
              )}

              <div className="border border-zinc-800 rounded-xl overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/80">
                      <th className="text-center py-2 px-2 text-zinc-500 font-medium w-8">N°</th>
                      <th className="text-left py-2 px-2 text-zinc-500 font-medium">Grupo</th>
                      <th className="text-left py-2 px-2 text-zinc-500 font-medium">Método</th>
                      <th className="text-left py-2 px-2 text-zinc-500 font-medium">Tipo</th>
                      <th className="text-left py-2 px-2 text-zinc-500 font-medium">Ejercicio</th>
                      <th className="text-left py-2 px-2 text-zinc-500 font-medium">Volumen</th>
                      <th className="text-left py-2 px-2 text-zinc-500 font-medium">Observaciones</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.tempId} className="border-b border-zinc-800/60">
                        <td className="py-1.5 px-2 text-center text-white font-bold">{i + 1}</td>
                        <td className="py-1.5 px-2">
                          <select value={normalizeGroup(r.strength_group)} onChange={e => updateRow(r.tempId, "strength_group", e.target.value)}
                            className="w-28 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none">
                            <option value="restaura">Restaura</option>
                            <option value="compensa">Compensa</option>
                          </select>
                        </td>
                        <td className="py-1.5 px-2">
                          <input value={r.method} onChange={e => updateRow(r.tempId, "method", e.target.value)}
                            className="w-28 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none" />
                        </td>
                        <td className="py-1.5 px-2">
                          <input value={r.exercise_type} onChange={e => updateRow(r.tempId, "exercise_type", e.target.value)}
                            className="w-32 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none" />
                        </td>
                        <td className="py-1.5 px-2">
                          <input value={r.exercise_name} onChange={e => updateRow(r.tempId, "exercise_name", e.target.value)}
                            className="w-40 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none" />
                        </td>
                        <td className="py-1.5 px-2">
                          <input value={r.volume} onChange={e => updateRow(r.tempId, "volume", e.target.value)}
                            className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-amber-300 font-semibold focus:outline-none" />
                        </td>
                        <td className="py-1.5 px-2">
                          <input value={r.notes} onChange={e => updateRow(r.tempId, "notes", e.target.value)}
                            className="w-40 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none" />
                        </td>
                        <td className="py-1.5 px-2">
                          <button onClick={() => deleteRow(r.tempId)} className="text-zinc-600 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={8} className="text-center text-zinc-600 py-4">Sin ejercicios detectados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={onClose} disabled={saving} className="px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button onClick={confirmImport} disabled={saving || rows.length === 0 || (hasExisting && !replaceMode)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs bg-white text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50">
                  {saving ? <Loader size={13} className="animate-spin" /> : <Check size={13} />}
                  {saving ? "Guardando..." : "Confirmar importación"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}