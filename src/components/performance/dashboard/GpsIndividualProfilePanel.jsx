import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const METRICS = [
  { key: "total_distance", label: "Distancia" },
  { key: "player_load", label: "Player Load" },
  { key: "sprints", label: "Sprints" },
  { key: "m_min", label: "m/min" },
];
function avg(values) { const clean = values.filter(v => Number.isFinite(Number(v))); return clean.length ? Math.round(clean.reduce((a, b) => a + Number(b), 0) / clean.length) : 0; }

export default function GpsIndividualProfilePanel({ rows, selectedPlayerId, onSelectPlayer }) {
  const players = useMemo(() => [...new Map(rows.map(r => [r.player_id, r.player_name])).entries()], [rows]);
  const data = useMemo(() => {
    const playerRows = rows.filter(r => r.player_id === selectedPlayerId);
    return METRICS.map(m => ({ metric: m.label, valor: avg(playerRows.map(r => r[m.key])) }));
  }, [rows, selectedPlayerId]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div><h2 className="text-xl font-bold text-white">Perfil individual</h2><p className="text-zinc-500 text-sm">Promedios del jugador seleccionado</p></div>
        <select value={selectedPlayerId || ""} onChange={e => onSelectPlayer(e.target.value)} className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-3 py-2">
          {players.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" /><XAxis dataKey="metric" stroke="#71717a" fontSize={11} /><YAxis stroke="#71717a" fontSize={11} /><Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12, color: "#fff" }} /><Bar dataKey="valor" fill="#22c55e" radius={[8, 8, 0, 0]} /></BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}