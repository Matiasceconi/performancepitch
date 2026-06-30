import React from "react";
import { Link } from "react-router-dom";
import { Clock, ChevronRight } from "lucide-react";

export default function MinutesSummaryCard() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Clock size={14} className="text-blue-400" /> Minutos
        </h2>
        <Link to="/performance" className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
          Ver minutos <ChevronRight size={14} />
        </Link>
      </div>
      <div className="p-4">
        <p className="text-zinc-500 text-sm">Seguimiento de minutos jugados por jugador.</p>
      </div>
    </div>
  );
}