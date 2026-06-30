import React from "react";
import { Link } from "react-router-dom";
import { RefreshCw, ChevronRight } from "lucide-react";
import moment from "moment";

export default function DashboardTopBar({
  squadName, mdCode, nextMatch, refreshing, onRefresh,
  mySquads, selectedSquadId, onSelectSquad,
}) {
  return (
    <div className="space-y-3">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-5 flex-wrap">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Plantel</p>
            <p className="text-white font-bold text-sm mt-0.5">{squadName || "Todos"}</p>
          </div>
          <div className="w-px h-8 bg-zinc-800 hidden sm:block" />
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">MD</p>
            <p className="text-white font-bold text-sm mt-0.5">{mdCode || "—"}</p>
          </div>
          <div className="w-px h-8 bg-zinc-800 hidden sm:block" />
          <div className="min-w-0 max-w-[220px]">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Próximo partido</p>
            <p className="text-white font-bold text-sm mt-0.5 truncate">{nextMatch?.title || "Sin partido programado"}</p>
          </div>
          <div className="w-px h-8 bg-zinc-800 hidden sm:block" />
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Fecha</p>
            <p className="text-white font-bold text-sm mt-0.5 capitalize">{moment().format("dddd D MMM")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Actualizar
          </button>
          <Link to="/daily-squad"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium transition-colors">
            Gestionar estados <ChevronRight size={15} />
          </Link>
        </div>
      </div>

      {mySquads.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded-xl p-1 gap-1 flex-wrap">
            {mySquads.map(sq => (
              <button key={sq.id}
                onClick={() => onSelectSquad(sq)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedSquadId === sq.id ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"
                }`}>
                {sq.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}