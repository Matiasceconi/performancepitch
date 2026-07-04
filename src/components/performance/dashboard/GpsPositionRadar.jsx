import React, { useMemo, useState } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, ResponsiveContainer } from "recharts";
import { avg } from "../externalGpsLoadUtils";

const POSITION_GROUPS = {
  "Centrales": ["Defensor Central"],
  "Laterales": ["Lateral Derecho", "Lateral Izquierdo"],
  "Volantes": ["Mediocampista Central", "Volante Interno"],
  "Extremos": ["Extremo"],
  "Delanteros": ["Delantero Centro"],
};

const AXES = [
  { key: "rhie_bouts", label: "RHIE" },
  { key: "total_distance", label: "Distancia (m)" },
  { key: "smax", label: "S Max" },
  { key: "m_min", label: "m/min" },
  { key: "player_load", label: "Player Load" },
  { key: "sprints", label: "Sprints" },
  { key: "distance_25", label: "D>25 (m)" },
];

export default function GpsPositionRadar({ rows }) {
  const [group, setGroup] = useState("Volantes");

  const chartData = useMemo(() => {
    const positions = POSITION_GROUPS[group];
    const groupRows = rows.filter((r) => positions.includes(r.position));
    return AXES.map((ax) => {
      const teamAvg = avg(rows.map((r) => r[ax.key]));
      const groupAvg = avg(groupRows.map((r) => r[ax.key]));
      return {
        axis: ax.label,
        Plantel: 100,
        [group]: teamAvg ? Math.round(((groupAvg || 0) / teamAvg) * 100) : 0,
      };
    });
  }, [rows, group]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Comparación por posición</p>
        <div className="flex gap-1 flex-wrap">
          {Object.keys(POSITION_GROUPS).map((g) => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${group === g ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} outerRadius="75%">
            <PolarGrid stroke="#3f3f46" />
            <PolarAngleAxis dataKey="axis" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
            <PolarRadiusAxis tick={{ fill: "#71717a", fontSize: 9 }} />
            <Radar name="Plantel (promedio)" dataKey="Plantel" stroke="#71717a" fill="#71717a" fillOpacity={0.15} />
            <Radar name={group} dataKey={group} stroke="#34d399" fill="#34d399" fillOpacity={0.35} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}