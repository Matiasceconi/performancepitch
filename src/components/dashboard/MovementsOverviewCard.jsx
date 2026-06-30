import React, { useState } from "react";
import { ArrowUp, ArrowDown, ChevronDown } from "lucide-react";

// groups: [{ key, label, direction: "up"|"down", records, render: () => JSX }]
export default function MovementsOverviewCard({ groups }) {
  const [expanded, setExpanded] = useState(false);
  const visibleGroups = groups.filter(g => g.records.length > 0);
  const total = groups.reduce((sum, g) => sum + g.records.length, 0);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
          Movimientos
          <span className="text-xs font-normal text-indigo-300">({total})</span>
        </h2>
        {total > 0 && (
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
            {expanded ? "Ocultar" : "Ver detalle"} <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
      <div className="p-3">
        {total === 0 ? (
          <p className="text-zinc-600 text-sm text-center py-5">Sin movimientos hoy</p>
        ) : (
          <div className="space-y-1.5">
            {visibleGroups.map(g => (
              <div key={g.key} className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-700/60">
                <div className="flex items-center gap-2 min-w-0">
                  {g.direction === "up" ? <ArrowUp size={13} className="text-sky-400 shrink-0" /> : <ArrowDown size={13} className="text-orange-400 shrink-0" />}
                  <span className="text-sm text-zinc-300 truncate">{g.label}</span>
                </div>
                <span className="text-sm font-bold text-white shrink-0">{g.records.length}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {expanded && (
        <div className="border-t border-zinc-800 p-3 space-y-3">
          {visibleGroups.map(g => (
            <div key={g.key}>{g.render()}</div>
          ))}
        </div>
      )}
    </div>
  );
}