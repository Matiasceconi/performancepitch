import React, { useState } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { ChevronDown, ChevronUp, GripVertical, Trash2, Play, Plus, Clock } from "lucide-react";
import StrengthSeriesTable from "./StrengthSeriesTable";
import StrengthExercisePicker from "./StrengthExercisePicker";
import { summarizeSeries, summarizeLoads, getYouTubeId, getVideoThumbnail, migrateSeries } from "./strengthSeries";

// Tarjeta de ejercicio en modo edición.
// Resumen compacto colapsado + detalles expandibles (video/imagen, indicaciones, series).
export default function StrengthExerciseCard({ station, index, squadId, onChange, onSeriesChange, onBlur, onPickLibrary, onDelete, onAddNewExercise }) {
  const [expanded, setExpanded] = useState(false);
  const series = migrateSeries(station);
  const youtubeId = getYouTubeId(station.video_url);
  const thumb = youtubeId ? getVideoThumbnail(station.video_url) : station.image_url;
  const isLinked = !!(station.library_strength_exercise_id || station.library_exercise_id);

  function updateField(field, value) {
    onChange(station.id, field, value);
  }

  function updateSeries(newSeries) {
    onSeriesChange(station.id, newSeries);
  }

  return (
    <Draggable draggableId={station.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`rounded-xl border bg-zinc-900 transition-shadow ${snapshot.isDragging ? "border-zinc-500 shadow-lg" : "border-zinc-800"} ${isLinked ? "ring-1 ring-emerald-500/20" : ""}`}
        >
          {/* Header: resumen compacto */}
          <div className="flex items-center gap-2 p-3">
            <span {...provided.dragHandleProps} className="text-zinc-600 hover:text-zinc-300 cursor-grab shrink-0">
              <GripVertical size={16} />
            </span>
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-2 flex-1 min-w-0 text-left"
            >
              {thumb ? (
                <img src={thumb} alt="" className="w-10 h-10 rounded-lg object-cover border border-zinc-700 shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                  <Play size={14} className="text-zinc-600" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white truncate">{station.exercise_name || "Sin nombre"}</p>
                  {isLinked && <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Biblioteca</span>}
                </div>
                <p className="text-xs text-zinc-500 truncate">
                  {series.length} series · {summarizeSeries(series)} · {summarizeLoads(series)}
                </p>
              </div>
              {expanded ? <ChevronUp size={16} className="text-zinc-500 shrink-0" /> : <ChevronDown size={16} className="text-zinc-500 shrink-0" />}
            </button>
            <button
              onClick={() => onDelete(station.id)}
              title="Eliminar ejercicio"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 shrink-0"
            >
              <Trash2 size={15} />
            </button>
          </div>

          {/* Detalles expandibles */}
          {expanded && (
            <div className="border-t border-zinc-800 p-3 space-y-3">
              {/* Nombre + biblioteca */}
              <div className="flex items-center gap-2">
                <input
                  value={station.exercise_name || ""}
                  onChange={(e) => updateField("exercise_name", e.target.value)}
                  onBlur={() => onBlur(station)}
                  placeholder="Nombre del ejercicio..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
                />
                <StrengthExercisePicker squadId={squadId} onPick={(ex) => onPickLibrary(station.id, ex)} />
                <button
                  onClick={() => onAddNewExercise()}
                  title="Crear ejercicio nuevo en biblioteca"
                  className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700"
                >
                  <Plus size={13} /> Nuevo
                </button>
              </div>

              {/* Video URL */}
              <input
                value={station.video_url || ""}
                onChange={(e) => updateField("video_url", e.target.value)}
                onBlur={() => onBlur(station)}
                placeholder="URL de video (YouTube)..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-400 focus:outline-none focus:border-zinc-500"
              />

              {/* Video/imagen responsiva */}
              {station.video_url && youtubeId && (
                <div className="rounded-lg overflow-hidden border border-zinc-800 aspect-video">
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    title="Video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
              )}
              {station.video_url && !youtubeId && (
                <a href={station.video_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300">
                  <Play size={12} /> Abrir video
                </a>
              )}
              {station.image_url && !station.video_url && (
                <img src={station.image_url} alt="" className="w-full rounded-lg border border-zinc-800 max-h-48 object-contain" />
              )}

              {/* Indicaciones técnicas */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Indicaciones técnicas</label>
                <textarea
                  value={station.notes || ""}
                  onChange={(e) => updateField("notes", e.target.value)}
                  onBlur={() => onBlur(station)}
                  placeholder="Indicaciones de ejecución..."
                  rows={2}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 resize-none focus:outline-none focus:border-zinc-500"
                />
              </div>

              {/* Pausa general */}
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-zinc-500" />
                <label className="text-xs text-zinc-400">Pausa general (s)</label>
                <input
                  value={station.rest_time || ""}
                  onChange={(e) => updateField("rest_time", e.target.value)}
                  onBlur={() => onBlur(station)}
                  placeholder="120"
                  className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-zinc-500"
                />
                <span className="text-xs text-zinc-500">Aplica a todas las series</span>
              </div>

              {/* Tabla de series */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Prescripción serie por serie</label>
                <StrengthSeriesTable series={series} onChange={updateSeries} />
              </div>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}