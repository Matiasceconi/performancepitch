import React, { useState, useEffect } from "react";
import { Droppable } from "@hello-pangea/dnd";
import { Copy, Trash2, Save, Plus, Target } from "lucide-react";
import StrengthExerciseCard from "./StrengthExerciseCard";

const ICON_OPTIONS = [
  { value: "dumbbell", label: "Mancuerna" },
  { value: "activity", label: "Actividad" },
  { value: "zap", label: "Potencia" },
  { value: "shield", label: "Escudo" },
  { value: "target", label: "Objetivo" },
  { value: "users", label: "Grupo" },
  { value: "rotate", label: "Restaura" },
];

// Tarjeta de cuadro en modo edición.
export default function StrengthBlockCard({ block, index, stations, squadId, handlers }) {
  const [draft, setDraft] = useState({
    name: block.name || "",
    color: block.color || "#22c55e",
    objective: block.objective || block.description || "",
  });

  useEffect(() => {
    setDraft({
      name: block.name || "",
      color: block.color || "#22c55e",
      objective: block.objective || block.description || "",
    });
  }, [block.id, block.name, block.color, block.objective, block.description]);

  function commitDraft(patch) {
    const changed = Object.fromEntries(
      Object.entries(patch).filter(([key, value]) => value !== (block[key] || (key === "color" ? "#22c55e" : "")))
    );
    if (Object.keys(changed).length) handlers.updateBlock(block.id, changed);
  }

  return (
    <div className="bg-zinc-900 border rounded-xl overflow-hidden" style={{ borderColor: `${draft.color || "#22c55e"}60` }}>
      {/* Header */}
      <div className="p-4 border-b border-zinc-800" style={{ background: `${draft.color || "#22c55e"}12` }}>
        <div className="flex items-start gap-3">
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${draft.color || "#22c55e"}22`, color: draft.color || "#22c55e" }}
          >
            <Target size={20} />
          </span>
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <input
                value={draft.name}
                onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                onBlur={() => commitDraft({ name: draft.name })}
                placeholder="Nombre del cuadro..."
                className="min-w-[140px] flex-1 bg-zinc-950/40 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-zinc-500"
              />
              <input
                type="color"
                value={draft.color}
                onChange={(e) => setDraft((p) => ({ ...p, color: e.target.value }))}
                onBlur={() => commitDraft({ color: draft.color })}
                className="w-9 h-9 bg-transparent border border-zinc-700 rounded-lg overflow-hidden cursor-pointer"
                title="Color del cuadro"
              />
            </div>
            <input
              value={draft.objective}
              onChange={(e) => setDraft((p) => ({ ...p, objective: e.target.value }))}
              onBlur={() => commitDraft({ objective: draft.objective })}
              placeholder="Objetivo del cuadro..."
              className="w-full bg-zinc-950/30 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-600"
            />
          </div>
        </div>

        {/* Acciones del cuadro */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          <button
            onClick={() => handlers.addRow(block.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold"
          >
            <Plus size={13} /> Agregar ejercicio
          </button>
          <button
            onClick={() => handlers.duplicateBlock(block)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-950/40 text-zinc-300 text-xs hover:bg-zinc-800"
          >
            <Copy size={13} /> Duplicar
          </button>
          <button
            onClick={() => handlers.saveTemplate(block)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-950/40 text-zinc-300 text-xs hover:bg-zinc-800"
          >
            <Save size={13} /> Guardar plantilla
          </button>
          <button
            onClick={() => handlers.deleteBlock(block)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs hover:bg-red-500/20 ml-auto"
          >
            <Trash2 size={13} /> Eliminar
          </button>
        </div>
      </div>

      {/* Lista de ejercicios */}
      <Droppable droppableId={block.id}>
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="p-3 space-y-2 min-h-[60px]">
            {stations.map((station, rowIndex) => (
              <StrengthExerciseCard
                key={station.id}
                station={station}
                index={rowIndex}
                squadId={squadId}
                onChange={handlers.onChange}
                onSeriesChange={handlers.onSeriesChange}
                onBlur={handlers.onBlurField}
                onPickLibrary={handlers.onPickLibrary}
                onDelete={handlers.onDelete}
                onAddNewExercise={handlers.onAddNewExercise}
              />
            ))}
            {stations.length === 0 && (
              <p className="text-center text-zinc-600 text-xs py-6 border border-dashed border-zinc-800 rounded-lg">
                Sin ejercicios. Agregá uno desde la biblioteca o creá uno nuevo.
              </p>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}