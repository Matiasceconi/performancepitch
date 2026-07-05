import React from "react";
import { Calendar, Flame, Target, Trophy, Zap } from "lucide-react";

function SummaryCell({ label, value, sub, icon: Icon, accent = "text-blue-600" }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-r border-zinc-200 last:border-r-0 min-w-[170px]">
      <div className={`w-9 h-9 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-center ${accent}`}><Icon size={18} /></div>
      <div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-black text-zinc-950 leading-tight">{value || "—"}</p>
        {sub && <p className="text-[11px] text-zinc-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function MicrocycleTopSummary({ meta, activeSquad, activeSeasonId, startDateLabel, summary }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 divide-y md:divide-y-0 md:divide-x divide-zinc-200">
        <SummaryCell label={`Semana ${meta.week_number || "—"}`} value={startDateLabel} sub={activeSeasonId || activeSquad?.season || "Temporada"} icon={Calendar} />
        <SummaryCell label="Día actual" value={meta.current_md || "—"} sub="Estado competitivo" icon={Zap} accent="text-blue-600" />
        <SummaryCell label="Próximo partido" value={meta.next_match || "Sin definir"} sub="Calendario" icon={Trophy} accent="text-red-600" />
        <SummaryCell label="Tipo de semana" value={meta.week_type || "Normal"} sub="Modelo de carga" icon={Flame} accent="text-orange-600" />
        <SummaryCell label="Objetivo general" value={summary.status} sub="Automático" icon={Target} accent="text-zinc-700" />
        <div className="flex items-center justify-center px-5 py-4">
          <div className="relative w-16 h-16 rounded-full border-[7px] border-orange-500 flex items-center justify-center">
            <span className="text-sm font-black text-zinc-950">{summary.total > 3500 ? "80" : summary.total < 1600 ? "35" : "60"}%</span>
          </div>
          <div className="ml-3"><p className="text-[10px] font-black text-zinc-500 uppercase">Estado semana</p><p className="text-sm font-black text-red-600">{summary.status}</p></div>
        </div>
      </div>
    </div>
  );
}