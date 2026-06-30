import React, { useState } from "react";
import { Users, Activity, AlertCircle, Zap, UserX, ArrowUp, ArrowUpCircle, Shield } from "lucide-react";
import DaySummaryCard from "./DaySummaryCard";
import DaySummaryDetailModal from "./DaySummaryDetailModal";

const COLORS = {
  blue:    { text: "text-blue-400" },
  emerald: { text: "text-emerald-400" },
  red:     { text: "text-red-400" },
  amber:   { text: "text-amber-400" },
  purple:  { text: "text-purple-400" },
  sky:     { text: "text-sky-400" },
  violet:  { text: "text-violet-400" },
  yellow:  { text: "text-yellow-400" },
};

export default function DaySummarySection({ squadRecords, byStatus, subenA, subenReservaAPrimera, playerMap, isGKFn, squadName }) {
  const [detail, setDetail] = useState(null); // { title, records }

  const disponibles = byStatus.disponible || [];
  const lesionados = byStatus.lesionado || [];
  const diferenciados = byStatus.diferenciado || [];
  const suspendidos = byStatus.suspendido || [];
  const arquerosDisponibles = disponibles.filter(ds => isGKFn(ds));

  const indicators = [
    { key: "total", label: "Total plantel", value: squadRecords.length, icon: Users, color: "blue", records: squadRecords },
    { key: "disponibles", label: "Disponibles", value: disponibles.length, icon: Activity, color: "emerald", records: disponibles },
    { key: "lesionados", label: "Lesionados", value: lesionados.length, icon: AlertCircle, color: "red", records: lesionados },
    { key: "diferenciados", label: "Diferenciados", value: diferenciados.length, icon: Zap, color: "amber", records: diferenciados },
    { key: "suspendidos", label: "Suspendidos", value: suspendidos.length, icon: UserX, color: "purple", records: suspendidos },
    { key: "subenA", label: squadName ? `Suben a ${squadName}` : "Suben a Reserva", value: subenA.length, icon: ArrowUp, color: "sky", records: subenA },
    { key: "subenPrimera", label: "Suben Reserva→Primera", value: subenReservaAPrimera.length, icon: ArrowUpCircle, color: "violet", records: subenReservaAPrimera },
    { key: "arqueros", label: "Arqueros disponibles", value: arquerosDisponibles.length, icon: Shield, color: "yellow", records: arquerosDisponibles },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-white mb-3">Resumen del Día</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {indicators.map(ind => (
          <DaySummaryCard
            key={ind.key}
            icon={ind.icon}
            label={ind.label}
            value={ind.value}
            colors={COLORS[ind.color]}
            onClick={() => setDetail({ title: ind.label, records: ind.records })}
          />
        ))}
      </div>

      {detail && (
        <DaySummaryDetailModal
          open={!!detail}
          onClose={() => setDetail(null)}
          title={detail.title}
          records={detail.records}
          playerMap={playerMap}
        />
      )}
    </div>
  );
}