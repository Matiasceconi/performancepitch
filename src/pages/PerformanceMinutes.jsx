import React from "react";
import { Clock } from "lucide-react";
import MinutesSubPanel from "@/components/performance/MinutesSubPanel";

export default function PerformanceMinutes() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Clock size={22} className="text-zinc-400" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Minutos Jugados</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Rendimiento · Minutos por jugador y por partido del plantel activo</p>
        </div>
      </div>
      <MinutesSubPanel />
    </div>
  );
}