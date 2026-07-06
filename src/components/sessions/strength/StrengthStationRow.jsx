import React from "react";
import { Draggable } from "@hello-pangea/dnd";
import { Trash2, Copy, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import StrengthExercisePicker from "./StrengthExercisePicker";

export default function StrengthStationRow({ station, index, squadId, onChange, onBlurField, onPickLibrary, onDuplicate, onDelete, onMoveUp, onMoveDown, isLast }) {
  return (
    <Draggable draggableId={station.id} index={index}>
      {(provided, snapshot) => (
        <tr ref={provided.innerRef} {...provided.draggableProps}
          className={`border-b border-zinc-800/60 ${snapshot.isDragging ? "bg-zinc-800" : "hover:bg-zinc-800/30"}`}>
          <td className="py-1.5 px-2 text-center align-middle">
            <div className="flex items-center gap-1 justify-center">
              <span {...provided.dragHandleProps} className="text-zinc-600 hover:text-zinc-300 cursor-grab"><GripVertical size={13} /></span>
              <span className="text-xs font-bold text-white w-4">{index + 1}</span>
            </div>
          </td>
          <td className="py-1.5 px-2 align-middle">
            <input list="strength-method-options" value={station.method || ""}
              onChange={e => onChange(station.id, "method", e.target.value)}
              onBlur={() => onBlurField(station)}
              placeholder="Método..."
              className="w-32 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-zinc-500" />
          </td>
          <td className="py-1.5 px-2 align-middle">
            <input list="strength-type-options" value={station.exercise_type || ""}
              onChange={e => onChange(station.id, "exercise_type", e.target.value)}
              onBlur={() => onBlurField(station)}
              placeholder="Tipo..."
              className="w-36 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-zinc-500" />
          </td>
          <td className="py-1.5 px-2 align-middle">
            <div className="flex items-center gap-1">
              <StrengthExercisePicker squadId={squadId} onPick={ex => onPickLibrary(station.id, ex)} />
              <div className="space-y-1">
                <input value={station.exercise_name || ""} onChange={e => onChange(station.id, "exercise_name", e.target.value)}
                  onBlur={() => onBlurField(station)}
                  placeholder="Ejercicio..."
                  className="w-44 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-zinc-500" />
                {(station.library_strength_exercise_id || station.library_exercise_id) && (
                  <label className="flex items-center gap-1 text-[9px] text-emerald-300">
                    <input type="checkbox" checked={!!station.sync_library_edits} onChange={e => onChange(station.id, "sync_library_edits", e.target.checked)} />
                    Actualizar también en biblioteca
                  </label>
                )}
              </div>
              </div>
          </td>
          <td className="py-1.5 px-2 align-middle">
            <input value={station.volume || ""} onChange={e => onChange(station.id, "volume", e.target.value)}
              onBlur={() => onBlurField(station)}
              placeholder="3x8, 3+3..."
              className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-amber-300 font-semibold focus:outline-none focus:border-zinc-500" />
          </td>
          {["sets", "reps", "time", "rest_time", "rir", "objective", "muscle_group", "vector_pattern"].map((field) => (
            <td key={field} className="py-1.5 px-2 align-middle">
              <input value={station[field] || ""} onChange={e => onChange(station.id, field, e.target.value)}
                onBlur={() => onBlurField(station)}
                placeholder="—"
                className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500" />
            </td>
          ))}
          <td className="py-1.5 px-2 align-middle">
            <input value={station.notes || ""} onChange={e => onChange(station.id, "notes", e.target.value)}
              onBlur={() => onBlurField(station)}
              placeholder="Observaciones..."
              className="w-48 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500" />
          </td>
          <td className="py-1.5 px-2 align-middle">
            <div className="flex items-center gap-0.5 justify-end">
              <button onClick={() => onMoveUp(index)} disabled={index === 0} className="p-1 text-zinc-600 hover:text-white disabled:opacity-30 transition-colors"><ChevronUp size={12} /></button>
              <button onClick={() => onMoveDown(index)} disabled={isLast} className="p-1 text-zinc-600 hover:text-white disabled:opacity-30 transition-colors"><ChevronDown size={12} /></button>
              <button onClick={() => onDuplicate(station)} className="p-1 text-zinc-600 hover:text-blue-400 transition-colors"><Copy size={12} /></button>
              <button onClick={() => onDelete(station.id)} className="p-1 text-zinc-600 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
            </div>
          </td>
        </tr>
      )}
    </Draggable>
  );
}