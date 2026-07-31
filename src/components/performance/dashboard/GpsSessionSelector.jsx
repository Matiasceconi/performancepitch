import React, { useMemo, useState } from "react";
import moment from "moment";
import "moment/locale/es";
import { Search, CheckCircle2, Clock, AlertCircle, X, Target, Users } from "lucide-react";

moment.locale("es");

export function gpsStatus(session, gpsBySession) {
  const rows = gpsBySession[session.id] || [];
  const hasProcessed = rows.some((r) => r.include_in_session_average !== false);
  if (hasProcessed) return { label: "Procesado", color: "text-emerald-400", Icon: CheckCircle2, dot: "bg-emerald-400" };
  if (rows.length) return { label: "Pendiente", color: "text-amber-400", Icon: Clock, dot: "bg-amber-400" };
  return { label: "Sin datos", color: "text-zinc-500", Icon: AlertCircle, dot: "bg-zinc-600" };
}

export function sessionLabel(session) {
  if (session.session_number) return `Sesión ${session.session_number}`;
  return session.title || "Sesión";
}

function gpsPlayerCount(session, gpsBySession) {
  const rows = (gpsBySession[session.id] || []).filter((r) => r.include_in_session_average !== false);
  return new Set(rows.map((r) => r.player_id).filter(Boolean)).size;
}

export default function GpsSessionSelector({ sessions, gpsBySession, selectedSessionId, onSelect, loading }) {
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => [...sessions].sort((a, b) => {
    const dc = (b.date || "").localeCompare(a.date || "");
    if (dc !== 0) return dc;
    return (b.start_time || "").localeCompare(a.start_time || "");
  }), [sessions]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase().trim();
    return sorted.filter((s) => {
      const num = String(s.session_number || "");
      const title = String(s.title || "").toLowerCase();
      const type = String(s.session_type || "").toLowerCase();
      const date = moment(s.date).format("DD/MM/YYYY");
      return num.includes(q) || title.includes(q) || type.includes(q) || date.includes(q) || (s.date || "").includes(q);
    });
  }, [sorted, search]);

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar sesión por número, nombre, fecha o tipo..."
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 pl-9 pr-9 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Grid of session cards */}
      {loading ? (
        <div className="text-sm text-zinc-500 py-8 text-center">Cargando sesiones...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-zinc-500 py-8 text-center">No se encontraron sesiones</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((session) => {
            const status = gpsStatus(session, gpsBySession);
            const isSelected = session.id === selectedSessionId;
            const playerCount = gpsPlayerCount(session, gpsBySession);
            return (
              <button
                key={session.id}
                onClick={() => onSelect(session.id)}
                className={`group relative flex flex-col rounded-2xl border p-4 text-left transition-all ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/40"
                    : "border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800/60"
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{sessionLabel(session)}</h4>
                    <p className="text-xs text-zinc-500 capitalize mt-0.5 truncate">
                      {moment(session.date).format("dddd DD/MM/YYYY")}
                    </p>
                  </div>
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${status.color} bg-zinc-950 border border-zinc-800`}>
                    <status.Icon size={11} />
                    {status.label}
                  </span>
                </div>

                {/* Footer metrics */}
                <div className="mt-3 pt-3 border-t border-zinc-800/70 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-zinc-400 min-w-0">
                    <Target size={13} className="text-zinc-500 shrink-0" />
                    <span className="text-zinc-500 shrink-0">Objetivo:</span>
                    <span className="font-semibold text-zinc-200 truncate">
                      {session.session_objective || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-400 shrink-0">
                    <Users size={13} className="text-zinc-500" />
                    <span className="text-zinc-500">GPS:</span>
                    <span className="font-semibold text-white">{playerCount}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}