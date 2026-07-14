import React from "react";
import moment from "moment";
import { CalendarDays, X } from "lucide-react";

function dayStatus(day, sessions, gpsBySession) {
  const linked = sessions.filter((s) => s.date === day.date);
  if ((day.event_type || day.type || "").toLowerCase().includes("partido") || day.md === "MD") return { label: "Partido", className: "border-blue-500/50 bg-blue-500/10 text-blue-200" };
  if (!linked.length) return { label: (day.is_rest_day || day.type === "Descanso") ? "Día libre" : "Sin sesión", className: "border-zinc-700 bg-zinc-950 text-zinc-400" };
  const withGps = linked.filter((s) => (gpsBySession[s.id] || []).length > 0).length;
  if (withGps === linked.length) return { label: "GPS completo", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" };
  if (withGps) return { label: "GPS parcial", className: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300" };
  return { label: "GPS pendiente", className: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300" };
}

function selectionLabel(days, selectedDates) {
  const selected = days.filter((day) => selectedDates.includes(day.date));
  if (!selected.length) return "Sin días seleccionados";
  const names = selected.map((day) => moment(day.date).format("dddd"));
  if (names.length === 1) return `${names[0]} seleccionado`;
  if (names.length === days.length) return "Semana completa seleccionada";
  return `${names.length} días seleccionados · ${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

export default function GpsMicrocycleDayHeader({ days = [], sessions = [], gpsBySession = {}, selectedDates = [], onToggleDate, onSelectAll, onClear }) {
  return <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-lime-300">{selectionLabel(days, selectedDates)}</p><div className="flex gap-2"><button onClick={onSelectAll} className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white"><CalendarDays size={13} /> Toda la semana</button><button onClick={onClear} className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white"><X size={13} /> Limpiar selección</button></div></div><div className="flex gap-3 overflow-x-auto pb-1">{days.map((day) => { const status = dayStatus(day, sessions, gpsBySession); const linked = sessions.filter((s) => s.date === day.date); const active = selectedDates.includes(day.date); return <button key={day.date} onClick={() => onToggleDate(day.date)} className={`min-w-[150px] rounded-xl border p-3 text-left transition ${active ? "border-lime-400 bg-lime-500/15 shadow-lg shadow-lime-950/30" : status.className}`}><div className="flex items-start justify-between gap-2"><p className="text-sm font-black text-white">{day.md || day.match_day_code || "—"}</p>{active && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-lime-400 text-xs font-black text-zinc-950">✓</span>}</div><p className="mt-1 text-xs font-semibold text-zinc-200">{moment(day.date).format("dddd")}</p><p className="text-xs text-zinc-500">{moment(day.date).format("DD/MM")}</p><p className="mt-2 truncate text-xs text-zinc-300">{day.physical_objective || day.objetivo_fisico || day.objetivo || "Sin objetivo"}</p><div className="mt-2 flex items-center justify-between gap-2"><span className="rounded-full bg-black/20 px-2 py-1 text-[10px] font-semibold">{status.label}</span><span className="text-[10px] text-zinc-500">{linked.length} ses.</span></div></button>; })}</div></div>;
}