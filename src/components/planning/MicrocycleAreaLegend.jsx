import React from "react";

const AREAS = [
  ["Campo", "#16a34a"],
  ["Gimnasio", "#2563eb"],
  ["Táctico / DT", "#f97316"],
  ["Preventivo", "#8b5cf6"],
  ["Vuelta a la calma", "#06b6d4"],
  ["Observaciones", "#71717a"],
];

export default function MicrocycleAreaLegend({ summary }) {
  return (
    <aside className="bg-white border border-zinc-200 rounded-xl shadow-sm p-3 h-fit sticky top-3">
      <p className="text-[11px] font-black text-zinc-500 uppercase tracking-wider mb-3">Áreas</p>
      <div className="space-y-3">
        {AREAS.map(([label, color]) => (
          <div key={label} className="flex items-center gap-2 text-xs font-bold text-zinc-700">
            <span className="w-1.5 h-6 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-xl bg-slate-950 text-white p-3">
        <p className="text-[10px] font-black uppercase mb-2">Carga externa</p>
        {["Distancia total", "D > 19.8 km/h", "D > 25 km/h", "Aceleraciones", "Desaceleraciones", "Player Load"].map((m, i) => (
          <div key={m} className="flex items-center gap-2 text-[9px] text-slate-300 mb-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ["#2563eb", "#3b82f6", "#f97316", "#facc15", "#22c55e", "#8b5cf6"][i] }} />
            <span className="flex-1 uppercase">{m}</span>
          </div>
        ))}
        <p className="text-[18px] font-black mt-3">{summary.total ? Math.round(summary.total) : 0}</p>
        <p className="text-[10px] text-slate-400">Player Load semanal</p>
      </div>
    </aside>
  );
}