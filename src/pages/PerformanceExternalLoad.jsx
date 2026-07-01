import React from "react";
import { Gauge } from "lucide-react";
import ExternalGpsLoad from "@/components/performance/ExternalGpsLoad";

export default function PerformanceExternalLoad() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Gauge size={22} className="text-zinc-400" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Carga Externa</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Rendimiento · GPS y métricas físicas del plantel activo</p>
        </div>
      </div>
      <ExternalGpsLoad />
    </div>
  );
}