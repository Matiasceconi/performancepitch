import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const METRICS = [
  { key: "total_distance", label: "Distancia" },
  { key: "player_load", label: "Player Load" },
  { key: "sprints", label: "Sprints" },
  { key: "acc_3", label: "Acc +3" },
  { key: "dec_3", label: "Dec +3" },
  { key: "smax", label: "V. Máx" },
];
function avg(values) { const clean = values.filter(v => Number.isFinite(Number(v))); return clean.length ? Math.round(clean.reduce((a, b) => a + Number(b), 0) / clean.length) : 0; }

export default function GpsTeamProfilePanel({ rows }) {
  const data = useMemo(() => METRICS.map(m => ({ metric: m.label, promedio: avg(rows.map(r => r[m.key])) })), [rows]);
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
      <div><h2 className="text-xl font-bold text-white">Perfil del equipo</h2><p className="text-zinc-500 text-sm">Promedio general del plantel en registros GPS cargados</p></div>
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" /><XAxis dataKey="metric" stroke="#71717a" fontSize={11} /><YAxis stroke="#71717a" fontSize={11} /><Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12, color: "#fff" }} /><Bar dataKey="promedio" fill="#3b82f6" radius={[8, 8, 0, 0]} /></BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}