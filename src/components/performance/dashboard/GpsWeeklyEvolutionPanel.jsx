import React, { useMemo } from "react";
import moment from "moment";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { isGoalkeeper } from "@/components/squad/squadConstants";

const TARGET_FACTOR = { "Recuperación": .55, "Regenerativo": .55, "Activación": .7, "Velocidad": .85, "Velocidad Máxima": .85, "Aceleración": .9, "Tensión": .95, "Fuerza": .75, "Compensación": .7, "Volumen": 1.15, "Resistencia": 1.1, "Intermitente": 1, "Táctica": .8 };
const METRICS = [
  { key: "total_distance", label: "Distancia total", unit: "m", color: "#22c55e" },
  { key: "player_load", label: "Player Load", unit: "u", color: "#3b82f6" },
  { key: "sprints", label: "Sprints", unit: "", color: "#f59e0b" },
];

function avg(values) { const clean = values.filter(v => Number.isFinite(Number(v))); return clean.length ? Math.round(clean.reduce((a, b) => a + Number(b), 0) / clean.length) : 0; }

function MetricChart({ metric, data }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <div className="mb-3">
        <h3 className="text-white font-bold text-sm">{metric.label}</h3>
        <p className="text-zinc-500 text-xs">Realizado vs objetivo planificado por día</p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="day" stroke="#71717a" fontSize={11} />
            <YAxis stroke="#71717a" fontSize={11} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12, color: "#fff" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey={`${metric.key}_target`} name="Objetivo" fill="#52525b" radius={[6, 6, 0, 0]} />
            <Bar dataKey={metric.key} name="Realizado" fill={metric.color} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function GpsWeeklyEvolutionPanel({ sessions, gpsBySession, cycleDays, playerMap }) {
  const data = useMemo(() => {
    const days = cycleDays?.length ? cycleDays : Array.from({ length: 7 }, (_, i) => ({ date: moment().startOf("isoWeek").add(i, "days").format("YYYY-MM-DD"), objetivo: "Volumen" }));
    const allRows = Object.values(gpsBySession || {}).flat().filter(r => r.include_in_session_average !== false && !isGoalkeeper(playerMap[r.player_id]));
    const baseline = Object.fromEntries(METRICS.map(m => [m.key, avg(allRows.map(r => r[m.key]))]));

    return days.map(d => {
      const daySessions = sessions.filter(s => s.date === d.date);
      const rows = daySessions.flatMap(s => gpsBySession[s.id] || []).filter(r => r.include_in_session_average !== false && !isGoalkeeper(playerMap[r.player_id]));
      const factor = TARGET_FACTOR[d.objetivo] || 1;
      return {
        day: d.date ? moment(d.date).format("ddd DD/MM") : "—",
        objetivo: d.objetivo || "—",
        total_distance: avg(rows.map(r => r.total_distance)),
        total_distance_target: Math.round((baseline.total_distance || 0) * factor),
        player_load: avg(rows.map(r => r.player_load)),
        player_load_target: Math.round((baseline.player_load || 0) * factor),
        sprints: avg(rows.map(r => r.sprints)),
        sprints_target: Math.round((baseline.sprints || 0) * factor),
      };
    });
  }, [sessions, gpsBySession, cycleDays, playerMap]);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-5">
        <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">¿Cómo viene la semana?</p>
        <h2 className="text-2xl font-bold text-white mt-1">Evolución del microciclo</h2>
        <p className="text-zinc-400 text-sm mt-1">Cada variable tiene su propio gráfico de barras para comparar realizado vs objetivo planificado.</p>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {METRICS.map(metric => <MetricChart key={metric.key} metric={metric} data={data} />)}
      </div>
    </div>
  );
}