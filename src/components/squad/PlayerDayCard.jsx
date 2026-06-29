import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronDown, Tag, FileText, Clock, X } from "lucide-react";
import { STATUS_LABELS, STATUS_COLORS, ALL_TAGS } from "@/components/squad/squadConstants";
import PlayerHistoryModal from "@/components/squad/PlayerHistoryModal";

const STATUS_LIST = Object.keys(STATUS_LABELS);

export default function PlayerDayCard({ player, dayStatus, hasPending, onChange, selectedDate }) {
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const { status, tags, notes, team, category } = dayStatus;
  const statusClass = STATUS_COLORS[status] || "bg-zinc-700 text-zinc-300 border-zinc-600";

  function addTag(tag) {
    if (!tags.includes(tag)) onChange({ tags: [...tags, tag] });
  }
  function removeTag(tag) {
    onChange({ tags: tags.filter(t => t !== tag) });
  }
  function handleCustomTag(e) {
    e.preventDefault();
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      onChange({ tags: [...tags, tagInput.trim()] });
    }
    setTagInput("");
  }

  return (
    <>
      <div className={`bg-zinc-900 border rounded-xl transition-all ${hasPending ? "border-amber-500/40" : "border-zinc-800"}`}>
        {/* Card header */}
        <div className="p-3">
          <div className="flex items-center gap-2.5">
            {player.photo_url ? (
              <img src={player.photo_url} alt={player.full_name} className="w-10 h-10 rounded-full object-cover border border-zinc-700 shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-zinc-500">{(player.full_name || "?").charAt(0)}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{player.full_name}</p>
              <p className="text-xs text-zinc-500 truncate">{player.position}{team ? ` · ${team}` : ""}{category ? ` · ${category}` : ""}</p>
            </div>
            {hasPending && <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Cambio pendiente" />}
          </div>

          {/* Status selector */}
          <div className="mt-2.5">
            <select
              value={status}
              onChange={e => onChange({ status: e.target.value })}
              className={`w-full text-xs font-semibold rounded-lg px-2 py-1.5 border focus:outline-none bg-transparent ${statusClass}`}
            >
              {STATUS_LIST.map(s => (
                <option key={s} value={s} className="bg-zinc-900 text-white">{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.map(t => (
                <span key={t} className="flex items-center gap-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-full px-2 py-0.5 text-[10px]">
                  {t}
                  <button onClick={() => removeTag(t)} className="ml-0.5 text-zinc-500 hover:text-red-400 transition-colors">
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Notes preview */}
          {notes && !expanded && (
            <p className="text-xs text-zinc-500 italic mt-1.5 truncate">"{notes}"</p>
          )}
        </div>

        {/* Quick actions bar */}
        <div className="border-t border-zinc-800 flex">
          <button onClick={() => onChange({ status: "lesionado" })}
            className="flex-1 py-1.5 text-[10px] text-red-400 hover:bg-red-500/10 transition-colors font-medium">
            Lesión
          </button>
          <button onClick={() => onChange({ status: "diferenciado" })}
            className="flex-1 py-1.5 text-[10px] text-amber-400 hover:bg-amber-500/10 transition-colors font-medium border-l border-zinc-800">
            Diferenciado
          </button>
          <button onClick={() => onChange({ status: "disponible", tags: [] })}
            className="flex-1 py-1.5 text-[10px] text-emerald-400 hover:bg-emerald-500/10 transition-colors font-medium border-l border-zinc-800">
            Disponible
          </button>
          <button onClick={() => setExpanded(!expanded)}
            className="px-2 py-1.5 text-zinc-500 hover:text-white transition-colors border-l border-zinc-800">
            <ChevronDown size={13} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Expanded panel */}
        {expanded && (
          <div className="border-t border-zinc-800 p-3 space-y-3">
            {/* Etiquetas rápidas */}
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1">
                <Tag size={9} /> Etiquetas
              </p>
              <div className="flex flex-wrap gap-1 mb-2">
                {ALL_TAGS.map(t => (
                  <button key={t} onClick={() => tags.includes(t) ? removeTag(t) : addTag(t)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                      tags.includes(t)
                        ? "bg-zinc-600 text-white border-zinc-500"
                        : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white"
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
              <form onSubmit={handleCustomTag} className="flex gap-1">
                <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                  placeholder="Etiqueta personalizada..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none" />
                <button type="submit" className="px-2 py-1 bg-zinc-700 rounded-lg text-xs text-white hover:bg-zinc-600 transition-colors">+</button>
              </form>
            </div>

            {/* Nota */}
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1">
                <FileText size={9} /> Nota
              </p>
              <textarea
                value={notes}
                onChange={e => onChange({ notes: e.target.value })}
                placeholder="Observación del día..."
                rows={2}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none resize-none"
              />
            </div>

            {/* Historial */}
            <button onClick={() => setShowHistory(true)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
              <Clock size={11} /> Ver historial del jugador
            </button>
          </div>
        )}
      </div>

      {showHistory && (
        <PlayerHistoryModal
          player={player}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
}