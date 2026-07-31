import React, { useMemo, useState } from "react";
import moment from "moment";
import "moment/locale/es";
import { Search, CheckCircle2, Clock, AlertCircle, X, Target, Users } from "lucide-react";

moment.locale("es");

export function gpsStatus(session, gpsBySession) {
  const rows = gpsBySession[session.id] || [];
  const hasProcessed = rows.some((r) => r.include_in_session_average !== false);
  if (hasProcessed) return { label: "Procesado", color: "text-emerald-400", Icon: CheckCircle2, badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
  if (rows.length) return { label: "Pendiente", color: "text-amber-400", Icon: Clock, badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
  return { label: "Sin datos", color: "text-zinc-500", Icon: AlertCircle, badge: "bg-zinc-800 text-zinc-400 border-zinc-700" };
}

export function sessionLabel(session) {
  if (session.session_number) return `Sesión ${session.session_number}`;
  return session.title || "Sesión";
}

function gpsPlayerCount(session, gpsBySession) {
  const rows = (gpsBySession[session.id] || []).filter((r) => r.include_in_session_average !== false);
  return new Set(rows.map((r) => r.player_id).filter(Boolean)).size;
}

export default function GpsSessionSelector({ sessions, gpsBySession, selectedSessionIds = [], onToggle, loading }) {
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
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar sesión..."
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 pl-9 pr-9 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Horizontal scrollable row of cards */}
      {loading ? (
        <div className="text-sm text-zinc-500 py-8 text-center">Cargando sesiones...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-zinc-500 py-8 text-center">No se encontraron sesiones</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {filtered.map((session) => {
            const status = gpsStatus(session, gpsBySession);
            const isSelected = selectedSessionIds.includes(session.id);
            const playerCount = gpsPlayerCount(session, gpsBySession);
            return (
              <button
                key={session.id}
                onClick={() => onToggle(session.id)}
                className={`relative flex flex-col rounded-xl border p-4 text-left transition-all shrink-0 w-[200px] ${
                  isSelected
                    ? "border-emerald-500 bg-gradient-to-b from-emerald-950/40 to-zinc-950 shadow-[0_0_0_1px_rgba(16,185,129,0.4),0_18px_42px_rgba(0,0,0,0.35)]"
                    : "border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 hover:border-zinc-600"
                }`}
              >
                {isSelected && (
                  <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-[11px] font-black text-zinc-950">✓</span>
                )}

                {/* Header */}
                <div className="mb-2 pr-6">
                  <h4 className="text-sm font-bold text-white truncate">{sessionLabel(session)}</h4>
                  <p className="text-xs text-zinc-500 capitalize mt-0.5 truncate">
                    {moment(session.date).format("dddd DD/MM/YYYY")}
                  </p>
                </div>

                {/* Status badge */}
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border w-fit ${status.badge}`}>
                  <status.Icon size={10} />
                  {status.label}
                </span>

                {/* Footer metrics */}
                <div className="mt-auto pt-3 border-t border-zinc-800/70 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <Target size={11} className="text-zinc-500 shrink-0" />
                    <span className="text-zinc-500">Objetivo:</span>
                    <span className="font-semibold text-zinc-200 truncate">
                      {session.session_objective || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <Users size={11} className="text-zinc-500 shrink-0" />
                    <span className="text-zinc-500">Jugadores con GPS:</span>
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