import React from "react";
import { WORK_BLOCKS, OBJECTIVE_COLORS } from "@/components/planning/microcyclePlanUtils";

export default function MicrocycleAreaLegend({ summary }) {
  return (
    <aside className="bg-white border border-zinc-100 rounded-2xl shadow-sm p-3 h-fit sticky top-3">
      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-3">Áreas de trabajo</p>
      <div className="space-y-2.5">
        {WORK_BLOCKS.map((item) => (
          <div key={item.type} className="flex items-center gap-2 text-[11px] font-black text-zinc-700">
            <span className="w-1.5 h-5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-zinc-100 pt-4">
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-3">Objetivos físicos</p>
        <div className="space-y-1.5">
          {Object.entries(OBJECTIVE_COLORS).filter(([label]) => label !== "Recuperación + Readaptación").map(([label, color]) => (
            <div key={label} className="rounded-lg px-2 py-1.5 text-[10px] font-black" style={{ backgroundColor: color.bg, color: color.text }}>{label}</div>
          ))}
        </div>
      </div>
      <div className="mt-5 rounded-xl bg-slate-950 text-white p-3">
        <p className="text-[10px] font-black uppercase mb-1">Carga semanal</p>
        <p className="text-xl font-black">{summary.total ? Math.round(summary.total) : 0}</p>
        <p className="text-[10px] text-slate-400">Player Load estimado</p>
      </div>
    </aside>
  );
}