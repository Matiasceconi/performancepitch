import React, { useMemo, useState } from "react";
import moment from "moment";
import "moment/locale/es";
import { Activity, CalendarDays, Gauge, HeartPulse, Timer, Zap } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PlayerPhoto from "@/components/player/PlayerPhoto";

moment.locale("es");

const STATUS_LABELS = {
  diferenciados: "Diferenciado",
  diferenciado: "Diferenciado",
  kinesiologia: "Kinesiología",
  lesionados: "Lesionado",
  lesionado: "Lesionado",
  excluidos: "Diferenciado",
};

const GPS_PARAM_COLUMNS = [
  { key: "total_distance", label: "Distancia", unit: "m" },
  { key: "duration_minutes", label: "Min." },
  { key: "m_min", label: "m/min" },
  { key: "distance_19_8", label: "D>19.8", unit: "m" },
  { key: "distance_25", label: "D>25", unit: "m" },
  { key: "sprints", label: "Sprints" },
  { key: "acc_3", label: "ACC +3" },
  { key: "dec_3", label: "DEC -3" },
  { key: "player_load", label: "Player Load", unit: "u" },
  { key: "smax", label: "S Max" },
  { key: "max_speed", label: "Vel. máx" },
  { key: "rhie_bouts", label: "RHIE" },
];

const KPI_CARDS = [
  { key: "total_distance", label: "Distancia", unit: "m", icon: Activity, color: "text-emerald-300" },
  { key: "player_load", label: "Player Load", unit: "u", icon: Gauge, color: "text-blue-300" },
  { key: "distance_19_8", label: ">19.8 km/h", unit: "m", icon: Zap, color: "text-amber-300" },
  { key: "sprints", label: "Sprints", unit: "", icon: Timer, color: "text-red-300" },
];

function format(value, unit = "") {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const number = Number(value);
  const shown = number >= 100 ? Math.round(number).toLocaleString("es-AR") : number.toFixed(1);
  return `${shown}${unit ? ` ${unit}` : ""}`;
}

function statusLabel(row) {
  const key = String(row?.row_status || "excluidos").toLowerCase();
  return STATUS_LABELS[key] || "Diferenciado";
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

function avg(rows, key) {
  const values = rows.map((row) => Number(row[key])).filter(Number.isFinite);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function KpiCard({ item, rows }) {
  const Icon = item.icon;
  const value = item.key === "m_min" ? avg(rows, item.key) : sum(rows, item.key);
  return (
    <div className="bg-zinc-950/70 border border-zinc-800 rounded-2xl p-4">
      <div className="flex items-center gap-2 text-zinc-500 text-xs font-semibold uppercase tracking-wider">
        <Icon size={15} className={item.color} /> {item.label}
      </div>
      <p className="text-2xl font-black text-white mt-2">{format(value, item.unit)}</p>
    </div>
  );
}

export default function GpsKinesiologyLoadTab({ sessions = [], gpsBySession = {}, cycleDays = [], playerMap = {} }) {
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const sessionMap = useMemo(() => Object.fromEntries(sessions.map((session) => [session.id, session])), [sessions]);
  const cycleDateSet = useMemo(() => new Set((cycleDays || []).map((day) => day.date).filter(Boolean)), [cycleDays]);

  const playersData = useMemo(() => {
    const byPlayer = {};
    Object.entries(gpsBySession).forEach(([sessionId, rows]) => {
      const session = sessionMap[sessionId];
      if (!session?.date || (cycleDateSet.size && !cycleDateSet.has(session.date))) return;
      rows.forEach((row) => {
        const isExcluded = row.include_in_session_average === false || (row.row_status && String(row.row_status).toLowerCase() !== "incluidos");
        if (!isExcluded) return;
        const player = playerMap[row.player_id] || {};
        const id = row.player_id || row.player_name;
        if (!id) return;
        if (!byPlayer[id]) byPlayer[id] = { id, player, name: row.player_name || player.full_name || player.name || "Jugador", rows: [], statuses: new Set() };
        byPlayer[id].rows.push({ ...row, date: session.date, session_title: session.title, objective: session.session_objective, md: session.match_day_code });
        byPlayer[id].statuses.add(statusLabel(row));
      });
    });
    return Object.values(byPlayer).map((item) => ({
      ...item,
      totalDistance: sum(item.rows, "total_distance"),
      totalLoad: sum(item.rows, "player_load"),
      sessions: new Set(item.rows.map((row) => row.session_id || row.date)).size,
      lastDate: [...item.rows].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]?.date,
    })).sort((a, b) => b.totalDistance - a.totalDistance);
  }, [gpsBySession, sessionMap, cycleDateSet, playerMap]);

  const selected = playersData.find((item) => item.id === selectedPlayerId) || playersData[0];
  const selectedRows = selected?.rows || [];
  const differentiatedSessionRows = useMemo(() => playersData.flatMap((item) => item.rows.map((row) => ({ ...row, playerName: item.name, playerPosition: item.player?.position || "—", status: [...item.statuses].join(" · ") }))).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.playerName).localeCompare(String(b.playerName))), [playersData]);
  const chartData = useMemo(() => selectedRows.map((row) => ({ 
    label: moment(row.date).format("dd DD/MM"),
    date: row.date,
    distancia: Math.round(Number(row.total_distance || 0)),
    carga: Math.round(Number(row.player_load || 0)),
    intensidad: Math.round(Number(row.m_min || 0)),
    alta: Math.round(Number(row.distance_19_8 || 0)),
    sprints: Math.round(Number(row.sprints || 0)),
  })).sort((a, b) => String(a.date).localeCompare(String(b.date))), [selectedRows]);

  if (!playersData.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center">
        <HeartPulse size={30} className="text-zinc-600 mx-auto mb-3" />
        <p className="text-white font-bold">Sin cargas diferenciadas en este microciclo</p>
        <p className="text-zinc-500 text-sm mt-1">Cuando haya jugadores en kinesiología, diferenciados o excluidos aparecerán acá.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-emerald-500/20 rounded-2xl p-5">
        <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Seguimiento para Kinesiología</p>
        <h2 className="text-2xl font-bold text-white mt-1">Jugadores diferenciados y en tratamiento</h2>
        <p className="text-zinc-400 text-sm mt-1">Carga semanal individual, fotos, estado y parámetros clave para controlar progresión y retorno.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Jugadores</p>
          {playersData.map((item) => (
            <button key={item.id} onClick={() => setSelectedPlayerId(item.id)} className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-colors ${selected?.id === item.id ? "bg-emerald-500/10 border-emerald-500/40" : "bg-zinc-950/50 border-zinc-800 hover:bg-zinc-800/60"}`}>
              <PlayerPhoto player={item.player} src={item.player?.photo_url} className="w-12 h-12 rounded-2xl object-cover border border-zinc-700" fallbackClassName="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center" textClassName="text-sm font-bold text-zinc-400" />
              <div className="min-w-0 flex-1">
                <p className="text-white font-bold truncate">{item.name}</p>
                <p className="text-xs text-zinc-500 truncate">{[...item.statuses].join(" · ")}</p>
                <p className="text-[11px] text-zinc-500 mt-1">{item.sessions} sesión{item.sessions !== 1 ? "es" : ""} · {format(item.totalDistance, "m")}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center gap-4">
              <PlayerPhoto player={selected.player} src={selected.player?.photo_url} className="w-20 h-20 rounded-3xl object-cover border border-zinc-700" fallbackClassName="w-20 h-20 rounded-3xl bg-zinc-800 border border-zinc-700 flex items-center justify-center" textClassName="text-xl font-bold text-zinc-400" />
              <div>
                <p className="text-2xl font-black text-white">{selected.name}</p>
                <p className="text-sm text-zinc-400">{selected.player?.position || "Sin posición"} · {[...selected.statuses].join(" · ")}</p>
                <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1"><CalendarDays size={12} />Último registro: {selected.lastDate ? moment(selected.lastDate).format("DD/MM/YYYY") : "—"}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {KPI_CARDS.map((item) => <KpiCard key={item.key} item={item} rows={selectedRows} />)}
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="text-white font-bold">Evolución semanal de carga</h3>
              <p className="text-zinc-500 text-sm mb-4">Distancia total y Player Load por sesión.</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 14, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="label" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={10} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12, color: "#fff" }} />
                    <Line type="monotone" dataKey="distancia" name="Distancia" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="carga" name="Player Load" stroke="#60a5fa" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="text-white font-bold">Parámetros de intensidad</h3>
              <p className="text-zinc-500 text-sm mb-4">m/min, alta intensidad y sprints para controlar progresión.</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 14, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="label" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={10} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12, color: "#fff" }} />
                    <Bar dataKey="intensidad" name="m/min" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="alta" name="D>19.8" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="sprints" name="Sprints" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h3 className="text-white font-bold">Sesiones de jugadores diferenciados</h3>
              <p className="text-zinc-500 text-sm mt-1">Tabla general con todos los parámetros cargados para cada jugador diferenciado del microciclo.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px] text-xs">
                <thead className="bg-zinc-800/60 text-zinc-500 uppercase">
                  <tr>
                    <th className="text-left px-4 py-2">Fecha</th>
                    <th className="text-left px-3 py-2">Jugador</th>
                    <th className="text-left px-3 py-2">Estado</th>
                    <th className="text-left px-3 py-2">Sesión</th>
                    <th className="text-left px-3 py-2">Objetivo</th>
                    {GPS_PARAM_COLUMNS.map((col) => <th key={col.key} className="text-center px-3 py-2 whitespace-nowrap">{col.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {differentiatedSessionRows.map((row, index) => (
                    <tr key={`${row.player_id || row.playerName}-${row.session_id || row.date}-${index}`} className={`border-t border-zinc-800/70 ${row.player_id === selected?.id ? "bg-emerald-500/5" : ""}`}>
                      <td className="px-4 py-2 text-zinc-300 whitespace-nowrap">{moment(row.date).format("DD/MM/YYYY")}</td>
                      <td className="px-3 py-2 text-white font-semibold whitespace-nowrap">{row.playerName}</td>
                      <td className="px-3 py-2 text-emerald-300 whitespace-nowrap">{row.status}</td>
                      <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">{row.session_title || row.md || "Sesión"}</td>
                      <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">{row.objective || "—"}</td>
                      {GPS_PARAM_COLUMNS.map((col) => <td key={col.key} className="px-3 py-2 text-center text-zinc-300 whitespace-nowrap">{format(row[col.key], col.unit)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}