import React from "react";
import { LayoutList, TrendingUp, GitCompareArrows, BatteryFull, Scale, Users, Grid3x3, Table2 } from "lucide-react";

const MODES = [
  { key: "resumen", label: "Resumen", icon: LayoutList },
  { key: "evolucion", label: "Evolución", icon: TrendingUp },
  { key: "comparar", label: "Comparar", icon: GitCompareArrows },
  { key: "bateria", label: "Batería", icon: BatteryFull },
  { key: "asimetrias", label: "Asimetrías", icon: Scale },
  { key: "plantel", label: "vs Plantel", icon: Users },
  { key: "mapa", label: "Mapa personal", icon: Grid3x3 },
  { key: "datos", label: "Datos completos", icon: Table2 },
];

export default function PlayerProfileModeSelector({ active, onChange }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-800 pb-px">
      {MODES.map((m) => {
        const isActive = active === m.key;
        return (
          <button
            key={m.key}
            onClick={() => onChange(m.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              isActive ? "text-blue-400 border-blue-400" : "text-zinc-400 hover:text-white border-transparent"
            }`}
          >
            <m.icon size={14} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}