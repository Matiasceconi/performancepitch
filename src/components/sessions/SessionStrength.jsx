import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { DragDropContext } from "@hello-pangea/dnd";
import { Plus, Sparkles, ImagePlus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import StrengthHeader from "@/components/sessions/strength/StrengthHeader";
import StrengthGroupTable from "@/components/sessions/strength/StrengthGroupTable";
import StrengthPDFExport from "@/components/sessions/strength/StrengthPDFExport";
import StrengthImageImportModal from "@/components/sessions/strength/StrengthImageImportModal";
import { METHOD_OPTIONS, TYPE_OPTIONS, syncToLibrary } from "@/components/sessions/strength/strengthOptions";

export default function SessionStrength({ session, onSessionUpdate }) {
  const [stations, setStations] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const [showImageImport, setShowImageImport] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    base44.entities.StrengthStation.filter({ session_id: session.id }, "order", 200)
      .then(rows => setStations(rows.sort((a, b) => (a.order || 0) - (b.order || 0))));
  }, [session.id]);

  async function persistOrder(list) {
    const updated = list.map((s, i) => ({ ...s, order: i + 1, station_number: i + 1 }));
    setStations(updated);
    await Promise.all(updated.map(s => base44.entities.StrengthStation.update(s.id, { order: s.order, station_number: s.station_number, strength_group: s.strength_group || "restaura" })));
  }

  async function addRow(initial = {}) {
    const group = initial.strength_group || "restaura";
    const groupCount = stations.filter(s => (s.strength_group || "restaura") === group).length;
    const payload = {
      session_id: session.id,
      order: stations.length + 1,
      station_number: groupCount + 1,
      strength_group: group,
      method: "", exercise_type: "", exercise_name: "", volume: "", notes: "", video_url: "",
      restore_exercise: "", compensate_exercise: "", sets: "", reps: "", time: "", rest_time: "", rir: "", objective: "", muscle_group: "", vector_pattern: "", tags: [],
      ...initial,
    };
    const created = await base44.entities.StrengthStation.create(payload);
    setStations(prev => [...prev, created]);
  }

  function onChange(id, field, value) {
    setStations(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  }

  async function onBlurField(station) {
    const payload = {
      strength_group: station.strength_group || "restaura",
      method: station.method || undefined,
      exercise_type: station.exercise_type || undefined,
      exercise_name: station.exercise_name || undefined,
      volume: station.volume || undefined,
      image_url: station.image_url || undefined,
      video_url: station.video_url || undefined,
      restore_exercise: station.restore_exercise || undefined,
      compensate_exercise: station.compensate_exercise || undefined,
      sets: station.sets || undefined,
      reps: station.reps || undefined,
      time: station.time || undefined,
      rest_time: station.rest_time || undefined,
      rir: station.rir || undefined,
      objective: station.objective || undefined,
      muscle_group: station.muscle_group || undefined,
      vector_pattern: station.vector_pattern || undefined,
      tags: station.tags || [],
      notes: station.notes || undefined,
      library_exercise_id: station.library_exercise_id || station.library_strength_exercise_id || undefined,
      library_strength_exercise_id: station.library_strength_exercise_id || station.library_exercise_id || undefined,
    };
    await base44.entities.StrengthStation.update(station.id, payload);
    const linkedId = station.library_strength_exercise_id || station.library_exercise_id;
    if (station.exercise_name && !linkedId) {
      const libId = await syncToLibrary(station, session.id, session?.squad_id, session?.squad_name);
      if (libId) {
        await base44.entities.StrengthStation.update(station.id, { library_exercise_id: libId, library_strength_exercise_id: libId });
        setStations(prev => prev.map(s => s.id === station.id ? { ...s, library_exercise_id: libId, library_strength_exercise_id: libId } : s));
      }
    } else if (linkedId) {
      const shouldUpdate = station.sync_library_edits || window.confirm("Este ejercicio está vinculado a la biblioteca. ¿Querés actualizar la plantilla original?");
      if (shouldUpdate) {
        await syncToLibrary(station, session.id, session?.squad_id, session?.squad_name, { updateExistingId: linkedId, incrementUsage: false });
        setStations(prev => prev.map(s => s.id === station.id ? { ...s, sync_library_edits: true } : s));
        toast({ title: "✓ Biblioteca de fuerza actualizada" });
      }
    }
  }

  async function onPickLibrary(id, ex) {
    const updated = {
      strength_group: stations.find(s => s.id === id)?.strength_group || "restaura",
      method: ex.method || "",
      exercise_type: ex.exercise_type || "",
      exercise_name: ex.name || "",
      volume: ex.volume || "",
      image_url: ex.image_url || "",
      video_url: ex.video_url || "",
      restore_exercise: ex.restore_exercise || "",
      compensate_exercise: ex.compensate_exercise || "",
      sets: ex.sets || "",
      reps: ex.reps || "",
      time: ex.time || "",
      rest_time: ex.rest_time || "",
      rir: ex.rir || "",
      objective: ex.objective || "",
      muscle_group: ex.muscle_group || "",
      vector_pattern: ex.vector_pattern || "",
      tags: ex.tags || [],
      notes: ex.notes || "",
      library_exercise_id: ex.id,
      library_strength_exercise_id: ex.id,
    };
    setStations(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
    await base44.entities.StrengthStation.update(id, updated);
    base44.entities.StrengthExerciseLibrary.update(ex.id, {
      times_used: (ex.times_used || 1) + 1,
      last_used_at: new Date().toISOString().slice(0, 10),
    });
  }

  async function onDuplicate(station) {
    const { id, created_date, updated_date, ...rest } = station;
    const group = rest.strength_group || "restaura";
    rest.order = stations.length + 1;
    rest.station_number = stations.filter(s => (s.strength_group || "restaura") === group).length + 1;
    rest.strength_group = group;
    const created = await base44.entities.StrengthStation.create(rest);
    setStations(prev => [...prev, created]);
    toast({ title: "✓ Ejercicio duplicado" });
  }

  async function onDelete(id) {
    if (!window.confirm("¿Eliminar ejercicio?")) return;
    await base44.entities.StrengthStation.delete(id);
    setStations(prev => prev.filter(s => s.id !== id));
  }

  function onMoveInGroup(group, idx, direction) {
    const grouped = stations.filter(s => (s.strength_group || "restaura") === group);
    const nextIndex = idx + direction;
    if (nextIndex < 0 || nextIndex >= grouped.length) return;
    [grouped[idx], grouped[nextIndex]] = [grouped[nextIndex], grouped[idx]];
    const updated = stations.filter(s => (s.strength_group || "restaura") !== group).concat(grouped);
    persistOrder(updated);
  }

  function onDragEnd(result) {
    if (!result.destination) return;
    const sourceGroup = result.source.droppableId;
    const destGroup = result.destination.droppableId;
    const sourceItems = stations.filter(s => (s.strength_group || "restaura") === sourceGroup);
    const destItems = sourceGroup === destGroup ? sourceItems : stations.filter(s => (s.strength_group || "restaura") === destGroup);
    const [moved] = sourceItems.splice(result.source.index, 1);
    const movedWithGroup = { ...moved, strength_group: destGroup };
    if (sourceGroup === destGroup) {
      sourceItems.splice(result.destination.index, 0, movedWithGroup);
    } else {
      destItems.splice(result.destination.index, 0, movedWithGroup);
    }
    const others = stations.filter(s => ![sourceGroup, destGroup].includes(s.strength_group || "restaura"));
    persistOrder([...others, ...sourceItems, ...(sourceGroup === destGroup ? [] : destItems)]);
  }

  async function suggestRow() {
    setSuggesting(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Sos un preparador físico de fútbol profesional. Sugerí UN ejercicio de fuerza para una sesión con estos datos:
- MD (microciclo): ${session.match_day_code || "no especificado"}
- Propósito mecánico: ${session.strength_purpose || "no especificado"}
- Patrón vectorial: ${session.strength_vector_pattern || "no especificado"}
- Tipo de sesión de fuerza: ${session.strength_session_type || "no especificado"}

Elegí el método más adecuado de esta lista exacta: ${METHOD_OPTIONS.join(", ")}.
Elegí el tipo más adecuado de esta lista exacta: ${TYPE_OPTIONS.join(", ")}.
Proponé un ejercicio concreto y realista de fuerza para fútbol, y un volumen en formato libre (ej: 3x8, 3+3, 12+12).`,
        response_json_schema: {
          type: "object",
          properties: {
            method: { type: "string", enum: METHOD_OPTIONS },
            exercise_type: { type: "string", enum: TYPE_OPTIONS },
            exercise_name: { type: "string" },
            volume: { type: "string" },
          },
          required: ["method", "exercise_type", "exercise_name", "volume"],
        },
      });
      await addRow(result);
      toast({ title: "✓ Ejercicio sugerido por IA" });
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="space-y-4">
      <datalist id="strength-method-options">{METHOD_OPTIONS.map(m => <option key={m} value={m} />)}</datalist>
      <datalist id="strength-type-options">{TYPE_OPTIONS.map(t => <option key={t} value={t} />)}</datalist>

      <StrengthHeader session={session} onSessionUpdate={onSessionUpdate} />

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => addRow({ strength_group: "restaura" })} className="flex items-center gap-1.5 px-3 py-2 bg-red-500/15 border border-red-500/30 text-red-300 font-semibold rounded-lg text-xs hover:bg-red-500/25 transition-colors">
          <Plus size={13} /> Nuevo en Restaura
        </button>
        <button onClick={() => addRow({ strength_group: "compensa" })} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold rounded-lg text-xs hover:bg-emerald-500/25 transition-colors">
          <Plus size={13} /> Nuevo en Compensa
        </button>
        <button onClick={suggestRow} disabled={suggesting}
          className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/15 border border-purple-500/30 text-purple-300 rounded-lg text-xs hover:bg-purple-500/25 transition-colors disabled:opacity-50">
          <Sparkles size={13} /> {suggesting ? "Pensando..." : "Sugerir ejercicio"}
        </button>
        <button onClick={() => setShowImageImport(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs hover:bg-emerald-500/25 transition-colors">
          <ImagePlus size={13} /> Importar fuerza desde imagen
        </button>
        <StrengthPDFExport session={session} stations={stations} />
      </div>

      {showImageImport && (
        <StrengthImageImportModal
          session={session}
          hasExisting={stations.length > 0}
          onClose={() => setShowImageImport(false)}
          onImported={(updatedSession) => {
            setShowImageImport(false);
            if (onSessionUpdate) onSessionUpdate(updatedSession);
            base44.entities.StrengthStation.filter({ session_id: session.id }, "order", 200)
              .then(rows => setStations(rows.sort((a, b) => (a.order || 0) - (b.order || 0))));
          }}
        />
      )}

      {stations.length === 0 && (
        <p className="text-zinc-600 text-sm text-center py-6">Sin ejercicios cargados</p>
      )}

      {stations.length > 0 && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {(["restaura", "compensa"]).map(group => (
              <StrengthGroupTable
                key={group}
                group={group}
                stations={stations.filter(s => (s.strength_group || "restaura") === group).sort((a, b) => (a.order || 0) - (b.order || 0))}
                squadId={session?.squad_id}
                handlers={{ onChange, onBlurField, onPickLibrary, onDuplicate, onDelete, onMoveInGroup }}
              />
            ))}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}