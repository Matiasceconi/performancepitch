import React, { useMemo } from "react";
import moment from "moment";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { isGoalkeeper } from "@/components/squad/squadConstants";
import GpsTopAccumulatedPlayers from "./GpsTopAccumulatedPlayers";

const METRICS = [
  { key: "total_distance", label: "Distancia total", unit: "m", color: "#22c55e" },
  { key: "distance_19_8", label: "Dist. 19,8-25", unit: "m", color: "#f97316" },
  { key: "distance_25", label: "Dist. +25", unit: "m", color: "#ef4444" },
  { key: "player_load", label: "Player Load", unit: "u", color: "#3b82f6" },
  { key: "acc_3", label: "ACC +3", unit: "", color: "#a855f7" },
  { key: "dec_3", label: "DEC +3", unit: "", color: "#14b8a6" },
];

function avg(values) { const clean = values.filter(v => Number.isFinite(Number(v))); return clean.length ? Math.round(clean.reduce((a, b) => a + Number(b), 0) / clean.length) : 0; }

function MetricChart({ metric, data }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <div className="mb-3">
        <h3 className="text-white font-bold text-sm">{metric.label}</h3>
        <p className="text-zinc-500 text-xs">Carga realizada por día</p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="day" stroke="#71717a" fontSize={11} />
            <YAxis stroke="#71717a" fontSize={11} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12, color: "#fff" }} />
            <Bar dataKey={metric.key} name="Realizado" fill={metric.color} radius={[6, 6, 0, 0]}>
              <LabelList dataKey={metric.key} position="top" fill="#e4e4e7" fontSize={11} fontWeight={700} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function GpsWeeklyEvolutionPanel({ sessions, gpsBySession, cycleDays, playerMap }) {
  const data = useMemo(() => {
    const days = cycleDays?.length ? cycleDays : Array.from({ length: 7 }, (_, i) => ({ date: moment().startOf("isoWeek").add(i, "days").format("YYYY-MM-DD"), objetivo: "Volumen" }));
    return days.map(d => {
      const daySessions = sessions.filter(s => s.date === d.date);
      const rows = daySessions.flatMap(s => gpsBySession[s.id] || []).filter(r => r.include_in_session_average !== false && !isGoalkeeper(playerMap[r.player_id]));
      return {
        day: d.date ? moment(d.date).format("ddd DD/MM") : "—",
        objetivo: d.objetivo || "—",
        total_distance: avg(rows.map(r => r.total_distance)),
        distance_19_8: avg(rows.map(r => r.distance_19_8)),
        distance_25: avg(rows.map(r => r.distance_25)),
        player_load: avg(rows.map(r => r.player_load)),
        acc_3: avg(rows.map(r => r.acc_3)),
        dec_3: avg(rows.map(r => r.dec_3)),
      };
    });
  }, [sessions, gpsBySession, cycleDays, playerMap]);

  const cycleRows = useMemo(() => {
    const days = cycleDays?.length ? cycleDays : Array.from({ length: 7 }, (_, i) => ({ date: moment().startOf("isoWeek").add(i, "days").format("YYYY-MM-DD") }));
    const dates = new Set(days.map(d => d.date).filter(Boolean));
    return sessions
      .filter(s => dates.has(s.date))
      .flatMap(s => gpsBySession[s.id] || [])
      .filter(r => r.include_in_session_average !== false && !isGoalkeeper(playerMap[r.player_id]));
  }, [sessions, gpsBySession, cycleDays, playerMap]);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-5">
        <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">¿Cómo viene la semana?</p>
        <h2 className="text-2xl font-bold text-white mt-1">Evolución del microciclo</h2>
        <p className="text-zinc-400 text-sm mt-1">Cada variable tiene su propio gráfico de barras con etiquetas de datos sobre lo realizado.</p>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {METRICS.map(metric => <MetricChart key={metric.key} metric={metric} data={data} />)}
      </div>
      <GpsTopAccumulatedPlayers rows={cycleRows} playerMap={playerMap} metrics={METRICS} />
    </div>
  );
}