import React, { useState } from "react";
import { ChevronDown, ChevronUp, Play, Clock, Dumbbell } from "lucide-react";
import { summarizeSeries, summarizeLoads, formatLoad, getYouTubeId, getVideoThumbnail, migrateSeries } from "./strengthSeries";

// Vista de presentación: solo consulta, un cuadro a la vez con pestañas.
export default function StrengthPresentationView({ blocks, stationsByBlock, onEdit }) {
  const [activeTab, setActiveTab] = useState(0);
  const [expandedEx, setExpandedEx] = useState({});

  const visibleBlocks = blocks.filter((b) => !b.hidden);
  const activeBlock = visibleBlocks[activeTab] || visibleBlocks[0];

  if (!activeBlock) {
    return (
      <div className="text-center py-12">
        <Dumbbell size={32} className="text-zinc-700 mx-auto mb-3" />
        <p className="text-zinc-500 text-sm">No hay cuadros para mostrar.</p>
        <button onClick={onEdit} className="mt-4 px-4 py-2 rounded-lg bg-white text-zinc-950 text-sm font-semibold">Editar</button>
      </div>
    );
  }

  const stations = stationsByBlock[activeBlock.id] || [];

  function toggleEx(id) {
    setExpandedEx((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="space-y-4">
      {/* Header con botón editar */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-bold text-lg">Vista de entrenamiento</h3>
        <button onClick={onEdit} className="px-4 py-2 rounded-lg bg-white text-zinc-950 text-sm font-semibold hover:bg-zinc-200">
          Editar
        </button>
      </div>

      {/* Pestañas de cuadros */}
      {visibleBlocks.length > 1 && (
        <div className="flex gap-1.5 flex-wrap border-b border-zinc-800 pb-px">
          {visibleBlocks.map((block, i) => (
            <button
              key={block.id}
              onClick={() => setActiveTab(i)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors ${
                i === activeTab ? "text-white border-b-2 -mb-px" : "text-zinc-500 hover:text-zinc-300"
              }`}
              style={i === activeTab ? { borderColor: block.color || "#22c55e", color: block.color || "#22c55e" } : {}}
            >
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: block.color || "#22c55e" }} />
              {block.name}
            </button>
          ))}
        </div>
      )}

      {/* Cuadro activo */}
      <div className="rounded-xl border bg-zinc-900 overflow-hidden" style={{ borderColor: `${activeBlock.color || "#22c55e"}60` }}>
        <div className="p-4 border-b border-zinc-800" style={{ background: `${activeBlock.color || "#22c55e"}10` }}>
          <div className="flex items-center gap-3">
            <span
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${activeBlock.color || "#22c55e"}22`, color: activeBlock.color || "#22c55e" }}
            >
              <Dumbbell size={20} />
            </span>
            <div>
              <h4 className="text-lg font-bold text-white">{activeBlock.name}</h4>
              {activeBlock.objective && <p className="text-sm text-zinc-400">{activeBlock.objective}</p>}
            </div>
          </div>
        </div>

        {/* Lista de ejercicios */}
        <div className="p-3 space-y-2">
          {stations.length === 0 && <p className="text-center text-zinc-600 text-sm py-8">Sin ejercicios en este cuadro.</p>}
          {stations.map((station, i) => {
            const series = migrateSeries(station);
            const isOpen = !!expandedEx[station.id];
            const youtubeId = getYouTubeId(station.video_url);
            const thumb = youtubeId ? getVideoThumbnail(station.video_url) : station.image_url;
            return (
              <div key={station.id} className="rounded-lg border border-zinc-800 bg-zinc-950/40 overflow-hidden">
                {/* Resumen */}
                <button onClick={() => toggleEx(station.id)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-zinc-800/30">
                  <span className="text-xs font-bold text-zinc-500 w-6 shrink-0">{i + 1}</span>
                  {thumb ? (
                    <img src={thumb} alt="" className="w-12 h-12 rounded-lg object-cover border border-zinc-700 shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                      <Play size={16} className="text-zinc-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{station.exercise_name || "Sin nombre"}</p>
                    <p className="text-xs text-zinc-500">
                      {series.length} series · {summarizeSeries(series)} · {summarizeLoads(series)}
                    </p>
                  </div>
                  {station.rest_time && (
                    <span className="flex items-center gap-1 text-xs text-zinc-400 shrink-0">
                      <Clock size={12} /> {station.rest_time}s
                    </span>
                  )}
                  {isOpen ? <ChevronUp size={16} className="text-zinc-500 shrink-0" /> : <ChevronDown size={16} className="text-zinc-500 shrink-0" />}
                </button>

                {/* Detalle expandible */}
                {isOpen && (
                  <div className="border-t border-zinc-800 p-3 space-y-3">
                    {/* Series detalladas */}
                    {series.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-zinc-500 border-b border-zinc-800">
                              <th className="text-center py-1.5 px-2 font-medium w-10">#</th>
                              <th className="text-left py-1.5 px-2 font-medium">Reps</th>
                              <th className="text-left py-1.5 px-2 font-medium">Tiempo</th>
                              <th className="text-left py-1.5 px-2 font-medium">Carga</th>
                            </tr>
                          </thead>
                          <tbody>
                            {series.map((s, si) => (
                              <tr key={si} className="border-b border-zinc-800/40">
                                <td className="text-center py-1.5 px-2 text-zinc-400 font-semibold">{si + 1}</td>
                                <td className="py-1.5 px-2 text-zinc-200">{s.reps || "—"}</td>
                                <td className="py-1.5 px-2 text-zinc-200">{s.time ? `${s.time}s` : "—"}</td>
                                <td className="py-1.5 px-2 text-zinc-200">{formatLoad(s)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Video */}
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
                      <a href={station.video_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-blue-400">
                        <Play size={12} /> Abrir video
                      </a>
                    )}
                    {station.image_url && !station.video_url && (
                      <img src={station.image_url} alt="" className="w-full rounded-lg border border-zinc-800 max-h-56 object-contain" />
                    )}

                    {/* Indicaciones técnicas */}
                    {station.notes && (
                      <div className="rounded-lg bg-zinc-950/60 border border-zinc-800 p-3">
                        <p className="text-xs text-zinc-400 font-semibold mb-1">Indicaciones técnicas</p>
                        <p className="text-sm text-zinc-300 whitespace-pre-wrap">{station.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}