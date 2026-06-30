import React from "react";
import { Link } from "react-router-dom";
import { Activity, ChevronRight } from "lucide-react";

export default function WeeklyLoadCard({ sessionsCount }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Activity size={14} className="text-emerald-400" /> Carga semanal
        </h2>
        <Link to="/catapult" className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
          Ver GPS <ChevronRight size={14} />
        </Link>
      </div>
      <div className="p-4">
        <p className="text-2xl font-bold text-white">{sessionsCount}</p>
        <p className="text-xs text-zinc-500 mt-0.5">Sesiones en los últimos 7 días</p>
      </div>
    </div>
  );
}