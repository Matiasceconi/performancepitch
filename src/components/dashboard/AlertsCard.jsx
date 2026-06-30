import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight } from "lucide-react";

export default function AlertsCard({ injuredCount, suspendedCount, discomfortCount }) {
  const alerts = [
    injuredCount > 0 && { label: "Jugadores lesionados", count: injuredCount, color: "text-red-300", bg: "bg-red-500/10", border: "border-red-500/30" },
    discomfortCount > 0 && { label: "Jugadores con molestias", count: discomfortCount, color: "text-yellow-300", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
    suspendedCount > 0 && { label: "Jugadores suspendidos", count: suspendedCount, color: "text-purple-300", bg: "bg-purple-500/10", border: "border-purple-500/30" },
  ].filter(Boolean);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-400" /> Alertas
        </h2>
        <Link to="/daily-squad" className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
          Ver detalle <ChevronRight size={14} />
        </Link>
      </div>
      <div className="p-3">
        {alerts.length === 0 ? (
          <p className="text-zinc-600 text-sm text-center py-5">Sin alertas activas</p>
        ) : (
          <div className="space-y-1.5">
            {alerts.map(a => (
              <div key={a.label} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${a.bg} ${a.border}`}>
                <span className={`text-sm font-medium ${a.color}`}>{a.label}</span>
                <span className={`text-sm font-bold ${a.color}`}>{a.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}