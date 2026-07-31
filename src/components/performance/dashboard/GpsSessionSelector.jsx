import React, { useMemo, useState, useRef, useEffect } from "react";
import moment from "moment";
import "moment/locale/es";
import { Search, ChevronDown, CheckCircle2, Clock, AlertCircle, X } from "lucide-react";

moment.locale("es");

export function gpsStatus(session, gpsBySession) {
  const rows = gpsBySession[session.id] || [];
  const hasProcessed = rows.some((r) => r.include_in_session_average !== false);
  if (hasProcessed) return { label: "Procesado", color: "text-emerald-400", Icon: CheckCircle2 };
  if (rows.length) return { label: "Pendiente", color: "text-amber-400", Icon: Clock };
  return { label: "Sin datos", color: "text-zinc-500", Icon: AlertCircle };
}

export function sessionLabel(session) {
  if (session.session_number) return `Sesión ${session.session_number}`;
  return session.title || "Sesión";
}

export default function GpsSessionSelector({ sessions, gpsBySession, selectedSessionId, onSelect, loading }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

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

  const selected = sorted.find((s) => s.id === selectedSessionId);

  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) { setOpen(false); setSearch(""); }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selectedStatus = selected ? gpsStatus(selected, gpsBySession) : null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-left hover:border-zinc-600 transition-colors"
      >
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-white shrink-0">{moment(selected.date).format("DD/MM/YYYY")}</span>
              <span className="text-sm text-zinc-300 truncate">{sessionLabel(selected)}</span>
              {selected.session_type && <span className="text-xs text-zinc-500 truncate hidden sm:inline">· {selected.session_type}</span>}
            </div>
          ) : (
            <span className="text-sm text-zinc-500">{loading ? "Cargando sesiones..." : "Seleccionar sesión"}</span>
          )}
        </div>
        {selectedStatus && (
          <span className={`flex items-center gap-1 text-xs font-semibold ${selectedStatus.color} shrink-0`}>
            <selectedStatus.Icon size={14} />
            <span className="hidden sm:inline">{selectedStatus.label}</span>
          </span>
        )}
        <ChevronDown size={18} className={`text-zinc-500 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
          <div className="p-3 border-b border-zinc-800">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por número, nombre, fecha o tipo..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-9 pr-9 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-zinc-500">No se encontraron sesiones</div>
            ) : (
              filtered.map((session) => {
                const status = gpsStatus(session, gpsBySession);
                const isSelected = session.id === selectedSessionId;
                return (
                  <button
                    key={session.id}
                    onClick={() => { onSelect(session.id); setOpen(false); setSearch(""); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/70 transition-colors border-b border-zinc-800/50 last:border-0 ${isSelected ? "bg-emerald-500/10" : ""}`}
                  >
                    <span className="text-sm font-bold text-white w-20 shrink-0">{moment(session.date).format("DD/MM/YYYY")}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-200 truncate">{sessionLabel(session)}</span>
                        {session.session_type && <span className="text-xs text-zinc-500 truncate">· {session.session_type}</span>}
                      </div>
                      {session.session_objective && <span className="text-xs text-zinc-500 truncate block">{session.session_objective}</span>}
                    </div>
                    <span className={`flex items-center gap-1 text-xs font-semibold ${status.color} shrink-0`}>
                      <status.Icon size={12} />
                      {status.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}