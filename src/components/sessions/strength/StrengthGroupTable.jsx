import React from "react";
import { Droppable } from "@hello-pangea/dnd";
import { UserRound } from "lucide-react";
import StrengthStationRow from "@/components/sessions/strength/StrengthStationRow";

const GROUP_META = {
  restaura: {
    title: "GRUPO RESTAURA",
    subtitle: "Ejercicios de restauración / recuperación",
    border: "border-red-500/40",
    bg: "bg-red-500/10",
    text: "text-red-400",
  },
  compensa: {
    title: "GRUPO COMPENSA",
    subtitle: "Ejercicios de compensación / rendimiento",
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
  },
};

export default function StrengthGroupTable({ group, stations, squadId, handlers }) {
  const meta = GROUP_META[group];

  return (
    <div className={`bg-zinc-900 border ${meta.border} rounded-xl overflow-hidden min-w-0`}>
      <div className={`flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-800 ${meta.bg}`}>
        <div className="flex items-center gap-3 min-w-0">
          <UserRound size={22} className={meta.text} />
          <div className="min-w-0">
            <p className={`text-xs font-bold ${meta.text}`}>{meta.title}</p>
            <p className="text-[10px] text-zinc-400 truncate">{meta.subtitle}</p>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-lg border ${meta.border} ${meta.text} bg-zinc-950/40 shrink-0`}>
          {stations.length} ejercicios
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              <th className="text-center py-2 px-2 text-zinc-500 font-medium w-12">N°</th>
              <th className="text-left py-2 px-2 text-zinc-500 font-medium">Ejercicio</th>
              <th className="text-left py-2 px-2 text-zinc-500 font-medium">Volumen</th>
              <th className="text-left py-2 px-2 text-zinc-500 font-medium">Series</th>
              <th className="text-left py-2 px-2 text-zinc-500 font-medium">Reps</th>
              <th className="text-left py-2 px-2 text-zinc-500 font-medium">Tiempo</th>
              <th className="text-left py-2 px-2 text-zinc-500 font-medium">Pausa</th>
              <th className="text-left py-2 px-2 text-zinc-500 font-medium">RIR</th>
              <th className="text-left py-2 px-2 text-zinc-500 font-medium">Objetivo</th>
              <th className="text-left py-2 px-2 text-zinc-500 font-medium">Grupo</th>
              <th className="text-left py-2 px-2 text-zinc-500 font-medium">Vector</th>
              <th className="text-left py-2 px-2 text-zinc-500 font-medium">Método</th>
              <th className="text-left py-2 px-2 text-zinc-500 font-medium">Tipo</th>
              <th className="text-left py-2 px-2 text-zinc-500 font-medium">Obs.</th>
              <th className="py-2 px-2"></th>
            </tr>
          </thead>
          <Droppable droppableId={group}>
            {(provided) => (
              <tbody ref={provided.innerRef} {...provided.droppableProps}>
                {stations.map((station, index) => (
                  <StrengthStationRow
                    key={station.id}
                    station={station}
                    index={index}
                    squadId={squadId}
                    compact
                    onChange={handlers.onChange}
                    onBlurField={handlers.onBlurField}
                    onPickLibrary={handlers.onPickLibrary}
                    onDuplicate={handlers.onDuplicate}
                    onDelete={handlers.onDelete}
                    onMoveUp={() => handlers.onMoveInGroup(group, index, -1)}
                    onMoveDown={() => handlers.onMoveInGroup(group, index, 1)}
                    isLast={index === stations.length - 1}
                  />
                ))}
                {stations.length === 0 && (
                  <tr><td colSpan={15} className="text-center text-zinc-600 py-6">Sin ejercicios en este grupo</td></tr>
                )}
                {provided.placeholder}
              </tbody>
            )}
          </Droppable>
        </table>
      </div>
    </div>
  );
}