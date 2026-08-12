import React from "react";
import { Clock, Lock, PencilLine } from "lucide-react";
import MinutesSubPanel from "@/components/performance/MinutesSubPanel";
import { useWorkspace } from "@/lib/WorkspaceContext";

export default function PerformanceMinutes() {
  const { isAdmin, can } = useWorkspace();
  const canEditYouth = isAdmin || can?.("create", "/performance/minutes") || can?.("edit", "/performance/minutes") || can?.("admin", "/performance/minutes");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <Clock size={22} className="text-zinc-400" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Minutos Jugados</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Minutos oficiales desde Partidos y carga manual de jugadores de Reserva que participan en Juveniles.</p>
          </div>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300">
          {canEditYouth ? <PencilLine size={13} className="text-cyan-300" /> : <Lock size={13} className="text-yellow-300" />}
          {canEditYouth ? "Carga manual habilitada" : "Solo lectura"}
        </div>
      </div>
      <MinutesSubPanel />
    </div>
  );
}