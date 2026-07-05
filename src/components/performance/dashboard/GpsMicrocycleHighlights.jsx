import React from "react";
import { fmt } from "./gpsMicrocycleReportUtils";

function initials(name) {
  return (name || "J").split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export default function GpsMicrocycleHighlights({ highlights }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="text-white font-bold text-lg">Destacados del microciclo</h3>
        <p className="text-zinc-500 text-sm">Líderes del grupo principal por variable acumulada o pico máximo.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {highlights.map(({ metric, best }) => (
          <div key={metric.key} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: metric.color }}>{metric.label}</p>
            {best ? (
              <div className="flex items-center gap-3">
                {best.player?.photo_url ? (
                  <img src={best.player.photo_url} alt={best.name} className="w-12 h-12 rounded-full object-cover border border-zinc-700" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-300">{initials(best.name)}</div>
                )}
                <div className="min-w-0">
                  <p className="text-white font-bold truncate">{best.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{best.player?.position || "Sin posición"}</p>
                  <p className="text-sm font-bold mt-1" style={{ color: metric.color }}>{fmt(best.value, metric.unit)}</p>
                </div>
              </div>
            ) : <p className="text-sm text-zinc-500">Sin datos</p>}
          </div>
        ))}
      </div>
    </div>
  );
}