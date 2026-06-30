import React from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import { ChevronRight } from "lucide-react";

export default function LastSessionCard({ session }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-white">Última sesión</h2>
        <Link to="/sessions" className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
          Ver sesiones <ChevronRight size={14} />
        </Link>
      </div>
      <div className="p-4">
        {!session ? (
          <p className="text-zinc-600 text-sm text-center py-6">No hay sesiones cargadas</p>
        ) : (
          <div>
            <p className="text-white font-semibold text-sm">{session.title}</p>
            <p className="text-xs text-zinc-500 mt-1">{moment(session.date).format("DD/MM/YYYY")} · {session.session_type}</p>
          </div>
        )}
      </div>
    </div>
  );
}