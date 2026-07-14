import React from "react";
import moment from "moment";

function dayStatus(day, sessions, gpsBySession) {
  const linked = sessions.filter((s) => s.date === day.date);
  if ((day.event_type || day.type || "").toLowerCase().includes("partido") || day.md === "MD") return { label: "Partido", className: "border-blue-500/50 bg-blue-500/10 text-blue-200" };
  if (!linked.length) return { label: (day.is_rest_day || day.type === "Descanso") ? "Día libre" : "Sin sesión", className: "border-zinc-700 bg-zinc-950 text-zinc-400" };
  const withGps = linked.filter((s) => (gpsBySession[s.id] || []).length > 0).length;
  if (withGps) return { label: "GPS cargado", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" };
  return { label: "GPS pendiente", className: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300" };
}

export default function GpsMicrocycleDayHeader({ days = [], sessions = [], gpsBySession = {}, selectedDate, onSelectDate }) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-bold text-white">Días del microciclo</h3><p className="text-xs text-zinc-500">Fuente: Planificación Semanal</p></div></div><div className="flex gap-3 overflow-x-auto pb-1">{days.map((day) => { const status = dayStatus(day, sessions, gpsBySession); const linked = sessions.filter((s) => s.date === day.date); const active = day.date === selectedDate; return <button key={day.date} onClick={() => onSelectDate(day.date)} className={`min-w-[150px] rounded-2xl border p-3 text-left transition ${active ? "border-emerald-400 bg-emerald-500/15 shadow-lg shadow-emerald-950/30" : status.className}`}><div className="flex items-start justify-between gap-2"><p className="text-lg font-black text-white">{day.md || day.match_day_code || "—"}</p><span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[10px] text-zinc-300">{linked.length} ses.</span></div><p className="mt-1 text-xs font-semibold text-zinc-300">{moment(day.date).format("dddd")}</p><p className="text-xs text-zinc-500">{moment(day.date).format("DD/MM/YYYY")}</p><p className="mt-2 truncate text-xs text-zinc-300">{day.physical_objective || day.objetivo_fisico || day.objetivo || "Sin objetivo"}</p><span className="mt-2 inline-flex rounded-full bg-black/20 px-2 py-1 text-[10px] font-semibold">{status.label}</span></button>; })}</div></div>;
}