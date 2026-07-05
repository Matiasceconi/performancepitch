import React, { useMemo, useState } from "react";
import { Filter, X } from "lucide-react";
import { resolvePositionGroup } from "@/components/squad/squadConstants";

const STATUS_OPTIONS = [
  ["incluidos", "Incluidos"],
  ["excluidos", "Excluidos"],
  ["diferenciado", "Diferenciados"],
  ["kinesiologia", "Kinesiología"],
];

const TYPE_OPTIONS = [["campo", "Campo"], ["arqueros", "Arqueros"]];
const MD_OPTIONS = ["MD-4", "MD-3", "MD-2", "MD-1", "MD", "MD+1"];

function SelectField({ label, value, onChange, options, allLabel }) {
  return <label className="space-y-1"><span className="text-xs font-semibold text-zinc-400">{label}</span><select value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"><option value="">{allLabel || "Todos"}</option>{options.map((opt) => Array.isArray(opt) ? <option key={opt[0]} value={opt[0]}>{opt[1]}</option> : <option key={opt} value={opt}>{opt}</option>)}</select></label>;
}

export function getMicrocycleFilterLabels(filters, { players = [], sessions = [], metrics = [] }) {
  const labels = [];
  const player = players.find((p) => p.id === filters.playerId);
  const session = sessions.find((s) => s.id === filters.sessionId);
  const metric = metrics.find((m) => m.key === filters.metricKey);
  if (player) labels.push(player.full_name || `${player.first_name || ""} ${player.last_name || ""}`.trim());
  if (filters.position) labels.push(filters.position);
  if (filters.positionGroup) labels.push(filters.positionGroup);
  if (filters.playerType) labels.push(filters.playerType === "arqueros" ? "Arqueros" : "Campo");
  if (filters.status) labels.push(STATUS_OPTIONS.find((o) => o[0] === filters.status)?.[1] || filters.status);
  if (filters.md) labels.push(filters.md);
  if (session) labels.push(session.title || "Sesión");
  if (filters.date) labels.push(filters.date);
  if (metric) labels.push(metric.label);
  return labels;
}

export default function GpsMicrocycleFiltersPanel({ filters, onApply, players, sessions, cycleDays, metrics }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters || {});
  const sortedPlayers = useMemo(() => [...players].filter(Boolean).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "")), [players]);
  const positions = useMemo(() => [...new Set(sortedPlayers.map((p) => p.position).filter(Boolean))].sort(), [sortedPlayers]);
  const positionGroups = useMemo(() => [...new Set(sortedPlayers.map((p) => p.position_group || resolvePositionGroup(p.position)).filter(Boolean))].sort(), [sortedPlayers]);
  const cycleDates = useMemo(() => new Set((cycleDays || []).map((d) => d.date)), [cycleDays]);
  const cycleSessions = useMemo(() => sessions.filter((s) => cycleDates.has(s.date)).sort((a, b) => (a.date || "").localeCompare(b.date || "")), [sessions, cycleDates]);
  const dateOptions = useMemo(() => [...cycleDates].filter(Boolean).sort(), [cycleDates]);

  function update(key, value) { setDraft((prev) => ({ ...prev, [key]: value })); }
  function clear() { setDraft({}); onApply({}); setOpen(false); }
  function apply() { onApply(draft); setOpen(false); }

  return <><button onClick={() => { setDraft(filters || {}); setOpen(true); }} className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-bold"><Filter size={16} />Filtrar resumen</button>{open && <div className="fixed inset-0 z-50 bg-black/70 flex justify-end"><div className="w-full max-w-md h-full bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col"><div className="p-5 border-b border-zinc-800 flex items-center justify-between"><div><h3 className="text-white font-bold text-lg">Filtros del microciclo</h3><p className="text-zinc-500 text-sm">El resumen, rankings y PDF se actualizan al aplicar.</p></div><button onClick={() => setOpen(false)} className="p-2 text-zinc-400 hover:text-white"><X size={18} /></button></div><div className="p-5 space-y-4 overflow-y-auto flex-1"><SelectField label="Jugador" value={draft.playerId} onChange={(v) => update("playerId", v)} allLabel="Todos los jugadores" options={sortedPlayers.map((p) => [p.id, p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()])} /><SelectField label="Posición" value={draft.position} onChange={(v) => update("position", v)} options={positions} /><SelectField label="Grupo de posición" value={draft.positionGroup} onChange={(v) => update("positionGroup", v)} options={positionGroups} /><SelectField label="Campo / Arqueros" value={draft.playerType} onChange={(v) => update("playerType", v)} options={TYPE_OPTIONS} /><SelectField label="Estado" value={draft.status} onChange={(v) => update("status", v)} options={STATUS_OPTIONS} /><SelectField label="Día del microciclo" value={draft.md} onChange={(v) => update("md", v)} options={MD_OPTIONS} /><SelectField label="Sesión" value={draft.sessionId} onChange={(v) => update("sessionId", v)} allLabel="Todas las sesiones" options={cycleSessions.map((s) => [s.id, `${s.date || ""} · ${s.title || "Sesión"}`])} /><SelectField label="Fecha" value={draft.date} onChange={(v) => update("date", v)} options={dateOptions} /><SelectField label="Variable GPS" value={draft.metricKey} onChange={(v) => update("metricKey", v)} allLabel="Todas las variables" options={metrics.map((m) => [m.key, m.label])} /></div><div className="p-5 border-t border-zinc-800 flex gap-2"><button onClick={clear} className="flex-1 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded-xl text-sm font-bold">Limpiar filtros</button><button onClick={apply} className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold">Aplicar filtros</button></div></div></div>}</>;
}