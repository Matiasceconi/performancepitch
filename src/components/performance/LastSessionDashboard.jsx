import React, { useMemo } from "react";
import { Clock, Users, Zap } from "lucide-react";
import moment from "moment";

const METRICS = [
  { key: "total_distance",   label: "Distancia (m)",      color: "#60a5fa", fmt: (v) => Math.round(v) },
  { key: "distance_hsr",    label: "19.8-25 km/h (m)",   color: "#34d399", fmt: (v) => Math.round(v) },
  { key: "sprint_distance", label: "+25 km/h (m)",         color: "#fbbf24", fmt: (v) => Math.round(v) },
  { key: "player_load",     label: "Player Load",          color: "#a78bfa", fmt: (v) => v.toFixed(0)  },
  { key: "max_velocity",    label: "Vel. Máx (km/h)",     color: "#f87171", fmt: (v) => v.toFixed(1)  },
  { key: "accelerations",   label: "Aceleraciones",        color: "#fb923c", fmt: (v) => Math.round(v) },
  { key: "decelerations",   label: "Desaceleraciones",     color: "#e879f9", fmt: (v) => Math.round(v) },
  { key: "sprint_efforts",  label: "Sprint Efforts",       color: "#2dd4bf", fmt: (v) => Math.round(v) },
];

function avg(arr) {
  const v = arr.filter((x) => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export default function LastSessionDashboard({ session, rows }) {
  const teamAvgs = useMemo(() => {
    const out = {};
    METRICS.forEach(({ key }) => { out[key] = avg(rows.map((r) => r[key])); });
    return out;
  }, [rows]);

  const topPlayers = useMemo(() => {
    const byPlayer = {};
    rows.forEach((r) => {
      if (!byPlayer[r.player_name]) byPlayer[r.player_name] = [];
      byPlayer[r.player_name].push(r);
    });
    return Object.entries(byPlayer)
      .map(([name, playerRows]) => ({
        player_name: name,
        total_distance: avg(playerRows.map((r) => r.total_distance)),
        player_load: avg(playerRows.map((r) => r.player_load)),
        max_velocity: Math.max(...playerRows.map((r) => r.max_velocity || 0)),
      }))
      .sort((a, b) => (b.total_distance || 0) - (a.total_distance || 0))
      .slice(0, 5);
  }, [rows]);

  if (!session || !rows || rows.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
        <p className="text-zinc-500 text-sm">Sin datos para mostrar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">{session.title}</h2>
            <div className="flex items-center gap-4 text-zinc-400 text-sm">
              <div className="flex items-center gap-1">
                <Clock size={14} />
                <span>{moment(session.date).format("DD [de] MMMM YYYY")}</span>
              </div>
              {session.match_day_code && (
                <div className="px-2.5 py-1 bg-blue-900/50 text-blue-300 rounded-full text-xs font-semibold">
                  {session.match_day_code}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-zinc-500 text-xs">Jugadores</p>
            <p className="text-white text-2xl font-bold">{new Set(rows.map(r => r.player_name)).size}</p>
          </div>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: "total_distance", label: "Distancia total (m)" },
          { key: "player_load", label: "Player Load promedio" },
          { key: "max_velocity", label: "Vel. máxima (km/h)" },
          { key: "sprint_distance", label: "Sprint (m)" },
        ].map(({ key, label }) => {
          const metric = METRICS.find(m => m.key === key);
          const val = key === "max_velocity" 
            ? Math.max(...rows.map(r => r[key] || 0))
            : teamAvgs[key];
          return (
            <div key={key} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-zinc-500 text-xs mb-2">{label}</p>
              <p className="text-white text-xl font-bold" style={{ color: metric?.color }}>
                {metric?.fmt(val) || "—"}
              </p>
            </div>
          );
        })}
      </div>

      {/* Top 5 Jugadores */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users size={16} className="text-zinc-400" />
          <h3 className="text-sm font-semibold text-white">Top Desempeño</h3>
        </div>
        <div className="space-y-2">
          {topPlayers.map((player, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-zinc-800/40 rounded-lg">
              <div>
                <p className="text-white font-medium text-sm">{player.player_name}</p>
                <p className="text-zinc-500 text-xs">
                  {Math.round(player.total_distance || 0)}m · PL: {Math.round(player.player_load || 0)} · Vel: {player.max_velocity?.toFixed(1)}km/h
                </p>
              </div>
              <div className="text-right">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">#{idx + 1}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla completa */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-zinc-800/80">
              <th className="px-3 py-2.5 text-left text-zinc-400 font-semibold whitespace-nowrap sticky left-0 bg-zinc-800/80">Jugador</th>
              <th className="px-3 py-2.5 text-right text-zinc-400 font-semibold whitespace-nowrap">Distancia (m)</th>
              <th className="px-3 py-2.5 text-right text-zinc-400 font-semibold whitespace-nowrap">Player Load</th>
              <th className="px-3 py-2.5 text-right text-zinc-400 font-semibold whitespace-nowrap">Vel. Máx</th>
              <th className="px-3 py-2.5 text-right text-zinc-400 font-semibold whitespace-nowrap">Sprint (m)</th>
              <th className="px-3 py-2.5 text-right text-zinc-400 font-semibold whitespace-nowrap">Aceles</th>
            </tr>
          </thead>
          <tbody>
            {topPlayers.map((player, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? "bg-zinc-900" : "bg-zinc-800/30"}>
                <td className="px-3 py-2 text-zinc-200 font-medium whitespace-nowrap sticky left-0 bg-inherit">{player.player_name}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap font-mono text-blue-400">{Math.round(player.total_distance || 0)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap font-mono text-purple-400">{Math.round(player.player_load || 0)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap font-mono text-red-400">{player.max_velocity?.toFixed(1)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap font-mono text-yellow-400">—</td>
                <td className="px-3 py-2 text-right whitespace-nowrap font-mono text-orange-400">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}