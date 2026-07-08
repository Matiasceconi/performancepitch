import React, { useMemo } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, ResponsiveContainer, Tooltip } from "recharts";

const POSITION_ORDER = ["Delanteros", "Mediocampistas", "Defensas", "Arqueros"];
const POSITION_COLORS = {
  Delanteros: "#22c55e",
  Mediocampistas: "#60a5fa",
  Defensas: "#f59e0b",
  Arqueros: "#a78bfa",
};
const AXES = [
  { key: "total_distance", label: "Distancia" },
  { key: "player_load", label: "Player Load" },
  { key: "sprints", label: "Sprints" },
  { key: "m_min", label: "m/min" },
];

function average(values) {
  const nums = values.map((v) => Number(v)).filter(Number.isFinite);
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function normalizePositionGroup(positionGroup) {
  if (positionGroup === "Defensores") return "Defensas";
  return positionGroup;
}

export default function GpsPositionRadar({ rows = [] }) {
  const grouped = useMemo(() => {
    const map = Object.fromEntries(POSITION_ORDER.map((group) => [group, []]));
    rows.forEach((row) => {
      const group = normalizePositionGroup(row.position_group);
      if (map[group]) map[group].push(row);
    });
    return map;
  }, [rows]);

  const chartData = useMemo(() => {
    const teamAverages = Object.fromEntries(AXES.map((metric) => [metric.key, average(rows.map((r) => r[metric.key]))]));
    return AXES.map((metric) => {
      const item = { axis: metric.label };
      POSITION_ORDER.forEach((group) => {
        const groupAvg = average(grouped[group].map((r) => r[metric.key]));
        item[group] = teamAverages[metric.key] > 0 ? Math.round((groupAvg / teamAverages[metric.key]) * 100) : 0;
      });
      return item;
    });
  }, [rows, grouped]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="mb-3">
        <h3 className="text-white font-bold text-lg">Carga por posición</h3>
        <p className="text-zinc-500 text-sm">Comparativo relativo (%) contra el promedio general del microciclo.</p>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} outerRadius="76%">
            <PolarGrid stroke="#3f3f46" />
            <PolarAngleAxis dataKey="axis" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
            <PolarRadiusAxis tick={{ fill: "#71717a", fontSize: 9 }} domain={[0, 180]} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12, color: "#fff" }} formatter={(value) => `${value}%`} />
            {POSITION_ORDER.map((group) => (
              <Radar key={group} name={group} dataKey={group} stroke={POSITION_COLORS[group]} fill={POSITION_COLORS[group]} fillOpacity={0.18} />
            ))}
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}