import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { Plus, Sparkles, ImagePlus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import StrengthHeader from "@/components/sessions/strength/StrengthHeader";
import StrengthStationRow from "@/components/sessions/strength/StrengthStationRow";
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
    await Promise.all(updated.map(s => base44.entities.StrengthStation.update(s.id, { order: s.order, station_number: s.station_number })));
  }

  async function addRow(initial = {}) {
    const payload = {
      session_id: session.id,
      order: stations.length + 1,
      station_number: stations.length + 1,
      method: "", exercise_type: "", exercise_name: "", volume: "", notes: "",
      ...initial,
    };
    const created = await base44.entities.StrengthStation.create(payload);
    setStations(prev => [...prev, created]);
  }

  function onChange(id, field, value) {
    setStations(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  }

  async function onBlurField(station) {
    await base44.entities.StrengthStation.update(station.id, {
      method: station.method || undefined,
      exercise_type: station.exercise_type || undefined,
      exercise_name: station.exercise_name || undefined,
      volume: station.volume || undefined,
      notes: station.notes || undefined,
    });
    if (station.exercise_name && !station.library_exercise_id) {
      await syncToLibrary(station, session.id, session?.squad_id, session?.squad_name);
    }
  }

  async function onPickLibrary(id, ex) {
    const updated = {
      method: ex.method || "",
      exercise_type: ex.exercise_type || "",
      exercise_name: ex.name || "",
      volume: ex.volume || "",
      image_url: ex.image_url || "",
      library_exercise_id: ex.id,
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
    rest.order = stations.length + 1;
    rest.station_number = stations.length + 1;
    const created = await base44.entities.StrengthStation.create(rest);
    setStations(prev => [...prev, created]);
    toast({ title: "✓ Ejercicio duplicado" });
  }

  async function onDelete(id) {
    if (!window.confirm("¿Eliminar ejercicio?")) return;
    await base44.entities.StrengthStation.delete(id);
    setStations(prev => prev.filter(s => s.id !== id));
  }

  function onMoveUp(idx) {
    if (idx === 0) return;
    const list = [...stations];
    [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
    persistOrder(list);
  }

  function onMoveDown(idx) {
    if (idx === stations.length - 1) return;
    const list = [...stations];
    [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
    persistOrder(list);
  }

  function onDragEnd(result) {
    if (!result.destination) return;
    const list = [...stations];
    const [moved] = list.splice(result.source.index, 1);
    list.splice(result.destination.index, 0, moved);
    persistOrder(list);
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
        <button onClick={() => addRow()} className="flex items-center gap-1.5 px-3 py-2 bg-white text-zinc-900 font-semibold rounded-lg text-xs hover:bg-zinc-200 transition-colors">
          <Plus size={13} /> Nuevo ejercicio
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
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
          <DragDropContext onDragEnd={onDragEnd}>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80">
                  <th className="text-center py-2 px-2 text-zinc-500 font-medium w-12">N°</th>
                  <th className="text-left py-2 px-2 text-zinc-500 font-medium">Método</th>
                  <th className="text-left py-2 px-2 text-zinc-500 font-medium">Tipo</th>
                  <th className="text-left py-2 px-2 text-zinc-500 font-medium">Ejercicio</th>
                  <th className="text-left py-2 px-2 text-zinc-500 font-medium">Volumen</th>
                  <th className="text-left py-2 px-2 text-zinc-500 font-medium">Observaciones</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <Droppable droppableId="strength-stations">
                {(provided) => (
                  <tbody ref={provided.innerRef} {...provided.droppableProps}>
                    {stations.map((st, i) => (
                      <StrengthStationRow
                        key={st.id}
                        station={st}
                        index={i}
                        squadId={session?.squad_id}
                        onChange={onChange}
                        onBlurField={onBlurField}
                        onPickLibrary={onPickLibrary}
                        onDuplicate={onDuplicate}
                        onDelete={onDelete}
                        onMoveUp={onMoveUp}
                        onMoveDown={onMoveDown}
                        isLast={i === stations.length - 1}
                      />
                    ))}
                    {provided.placeholder}
                  </tbody>
                )}
              </Droppable>
            </table>
          </DragDropContext>
        </div>
      )}
    </div>
  );
}