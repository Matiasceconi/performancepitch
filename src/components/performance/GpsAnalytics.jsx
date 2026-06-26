import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { FileSpreadsheet, Activity, TrendingUp, BarChart2 } from "lucide-react";
import moment from "moment";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, RadarChart, Radar, PolarGrid, PolarAngleAxis, Legend,
  Cell,
} from "recharts";

const METRICS = [
  { key: "total_distance",   label: "Distancia Total (m)",  color: "#60a5fa", fmt: (v) => Math.round(v) },
  { key: "distance_hsr",    label: "19.8-25 km/h (m)",     color: "#34d399", fmt: (v) => Math.round(v) },
  { key: "sprint_distance", label: "+25 km/h (m)",          color: "#fbbf24", fmt: (v) => Math.round(v) },
  { key: "player_load",     label: "Player Load",           color: "#a78bfa", fmt: (v) => v.toFixed(0)  },
  { key: "max_velocity",    label: "Vel. Máx (km/h)",       color: "#f87171", fmt: (v) => v.toFixed(1)  },
  { key: "accelerations",   label: "Aceleraciones",         color: "#fb923c", fmt: (v) => Math.round(v) },
  { key: "decelerations",   label: "Desaceleraciones",      color: "#e879f9", fmt: (v) => Math.round(v) },
  { key: "sprint_efforts",  label: "Sprint Efforts",        color: "#2dd4bf", fmt: (v) => Math.round(v) },
];

const TABS = [
  { id: "session",    label: "Por Sesión",   icon: BarChart2 },
  { id: "evolution",  label: "Evolución",    icon: TrendingUp },
  { id: "comparison", label: "Comparar",     icon: Activity },
];

function avg(arr) {
  const vals = arr.filter((v) => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

// ── TAB 1: Vista por Sesión ──────────────────────────────────────────────────
function SessionView({ sessions, reports }) {
  const sessionsWithData = useMemo(
    () => sessions.filter((s) => reports.some((r) => r.session_id === s.id || r.date === s.date)),
    [sessions, reports]
  );

  // Sesiones con CSV cargado en la propia sesión (csv_url) o con CatapultReport
  const allSessions = useMemo(() => {
    const sessionMap = new Map();
    sessions.forEach((s) => {
      const hasReports = reports.some((r) => r.session_id === s.id);
      const hasCsv = !!s.csv_url;
      if (hasReports || hasCsv) sessionMap.set(s.id, s);
    });
    return [...sessionMap.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [sessions, reports]);

  const [selectedId, setSelectedId] = useState(allSessions[0]?.id || "");
  const [activeMetric, setActiveMetric] = useState("total_distance");

  const sessionReports = useMemo(
    () => reports.filter((r) => r.session_id === selectedId),
    [reports, selectedId]
  );

  const selectedSession = sessions.find((s) => s.id === selectedId);

  const teamAvgs = useMemo(() => {
    const out = {};
    METRICS.forEach(({ key }) => { out[key] = avg(sessionReports.map((r) => r[key])); });
    return out;
  }, [sessionReports]);

  const metric = METRICS.find((m) => m.key === activeMetric);
  const chartData = useMemo(
    () =>
      sessionReports
        .filter((r) => r[activeMetric] != null)
        .sort((a, b) => (b[activeMetric] || 0) - (a[activeMetric] || 0))
        .map((r) => ({
          name: r.player_name?.split(" ").slice(-1)[0] || r.player_name,
          fullName: r.player_name,
          value: r[activeMetric],
        })),
    [sessionReports, activeMetric]
  );

  const COLORS = ["#60a5fa","#34d399","#fbbf24","#a78bfa","#f87171","#fb923c","#e879f9","#2dd4bf"];

  if (allSessions.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-14 text-center">
        <FileSpreadsheet size={40} className="text-zinc-700 mx-auto mb-3" />
        <p className="text-zinc-500 text-sm">No hay datos GPS cargados todavía.</p>
        <p className="text-zinc-600 text-xs mt-1">Cargá el CSV en cada sesión desde la sección Sesiones de Campo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Selector de sesión */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-500 flex-1 min-w-[200px]"
        >
          {allSessions.map((s) => (
            <option key={s.id} value={s.id}>
              {moment(s.date).format("DD/MM/YY")} — {s.title}
              {s.match_day_code ? ` (${s.match_day_code})` : ""}
            </option>
          ))}
        </select>
        {selectedSession && (
          <div className="flex gap-2 flex-wrap text-xs">
            {selectedSession.session_type && <span className="bg-zinc-800 text-zinc-400 px-2 py-1 rounded-lg">{selectedSession.session_type}</span>}
            {selectedSession.intensity && <span className="bg-zinc-800 text-zinc-400 px-2 py-1 rounded-lg">{selectedSession.intensity}</span>}
            {selectedSession.match_day_code && <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-lg">{selectedSession.match_day_code}</span>}
          </div>
        )}
      </div>

      {sessionReports.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
          <p className="text-zinc-600 text-sm">Esta sesión tiene CSV registrado pero los datos aún no fueron importados como registros GPS.</p>
          <p className="text-zinc-700 text-xs mt-1">Abrí la sesión y confirmá la importación desde el panel GPS.</p>
        </div>
      ) : (
        <>
          {/* KPIs promedio equipo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {METRICS.filter(({ key }) => teamAvgs[key] != null).map(({ key, label, color, fmt }) => (
              <div key={key} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
                <p className="text-zinc-500 text-xs">{label}</p>
                <p className="font-bold text-lg mt-1" style={{ color }}>{fmt(teamAvgs[key])}</p>
              </div>
            ))}
          </div>

          {/* Selector de métrica */}
          <div className="flex flex-wrap gap-1.5">
            {METRICS.map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setActiveMetric(key)}
                className="text-xs px-3 py-1.5 rounded-full border font-medium transition-colors"
                style={activeMetric === key
                  ? { backgroundColor: color, color: "#18181b", borderColor: color }
                  : { backgroundColor: "transparent", color: "#71717a", borderColor: "#3f3f46" }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Gráfico de barras por jugador */}
          {chartData.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-sm font-semibold text-white mb-4">{metric?.label} — por jugador</p>
              <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 30)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 50, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: "#d4d4d8" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
                    formatter={(val) => [metric?.fmt(val), metric?.label]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 10, fill: "#a1a1aa", formatter: (v) => metric?.fmt(v) }}>
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabla completa */}
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-800/80">
                  <th className="px-3 py-2.5 text-left text-zinc-400 font-semibold whitespace-nowrap">Jugador</th>
                  {METRICS.filter(({ key }) => sessionReports.some((r) => r[key] != null)).map(({ key, label }) => (
                    <th key={key} className="px-3 py-2.5 text-right text-zinc-400 font-semibold whitespace-nowrap">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessionReports.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? "bg-zinc-900" : "bg-zinc-800/30"}>
                    <td className="px-3 py-2 text-zinc-200 font-medium whitespace-nowrap">{row.player_name}</td>
                    {METRICS.filter(({ key }) => sessionReports.some((r) => r[key] != null)).map(({ key, fmt, color }) => (
                      <td key={key} className="px-3 py-2 text-right whitespace-nowrap font-mono" style={{ color: row[key] != null ? color : undefined }}>
                        {row[key] != null ? fmt(row[key]) : <span className="text-zinc-700">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── TAB 2: Evolución por jugador ─────────────────────────────────────────────
function EvolutionView({ reports }) {
  const allPlayers = useMemo(
    () => [...new Set(reports.map((r) => r.player_name).filter(Boolean))].sort(),
    [reports]
  );

  const allDates = useMemo(
    () => [...new Set(reports.map((r) => r.date).filter(Boolean))].sort(),
    [reports]
  );

  const [player, setPlayer] = useState(allPlayers[0] || "");
  const [dateFrom, setDateFrom] = useState(allDates[0] || "");
  const [dateTo, setDateTo] = useState(allDates[allDates.length - 1] || "");
  const [activeMetrics, setActiveMetrics] = useState(["total_distance", "player_load"]);

  function toggle(key) {
    setActiveMetrics((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  }

  const chartData = useMemo(() =>
    reports
      .filter((r) => r.player_name === player && r.date >= (dateFrom || "") && r.date <= (dateTo || "9999"))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({
        date: moment(r.date).format("DD/MM"),
        session: r.session_label || r.date,
        ...Object.fromEntries(METRICS.map((m) => [m.key, r[m.key] ?? null])),
      })),
    [reports, player, dateFrom, dateTo]
  );

  if (allPlayers.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-14 text-center">
        <p className="text-zinc-500 text-sm">No hay datos GPS cargados todavía.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Controles */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 text-xs">Jugador</label>
            <select value={player} onChange={(e) => setPlayer(e.target.value)}
              className="bg-zinc-800 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:outline-none min-w-[180px]">
              {allPlayers.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 text-xs">Desde</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="bg-zinc-800 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 text-xs">Hasta</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="bg-zinc-800 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:outline-none" />
          </div>
          <div className="pb-2">
            <p className="text-zinc-500 text-xs">Sesiones</p>
            <p className="text-white font-bold text-xl">{chartData.length}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map(({ key, label, color }) => {
            const on = activeMetrics.includes(key);
            return (
              <button key={key} onClick={() => toggle(key)}
                className="text-xs px-3 py-1.5 rounded-full border font-medium transition-colors"
                style={on ? { backgroundColor: color, color: "#18181b", borderColor: color } : { backgroundColor: "transparent", color: "#71717a", borderColor: "#3f3f46" }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
          <p className="text-zinc-500 text-sm">Sin datos para el jugador y rango seleccionados.</p>
        </div>
      ) : (
        activeMetrics.map((metricKey) => {
          const meta = METRICS.find((m) => m.key === metricKey);
          const vals = chartData.map((d) => d[metricKey]).filter((v) => v != null);
          const average = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
          return (
            <div key={metricKey} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta?.color }} />
                  {meta?.label}
                </h3>
                {average != null && (
                  <div className="flex gap-4 text-xs">
                    <span className="text-zinc-500">Prom: <span className="text-white font-semibold">{meta?.fmt(average)}</span></span>
                    <span className="text-green-400">Máx: <span className="font-semibold">{meta?.fmt(Math.max(...vals))}</span></span>
                    <span className="text-red-400">Mín: <span className="font-semibold">{meta?.fmt(Math.min(...vals))}</span></span>
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ left: 0, right: 30, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 11 }} width={55} tickFormatter={(v) => meta?.fmt(v)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [meta?.fmt(v), meta?.label]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.session || ""}
                  />
                  {average != null && (
                    <ReferenceLine y={average} stroke={meta?.color} strokeDasharray="4 4" strokeOpacity={0.5}
                      label={{ value: "prom", position: "right", fill: meta?.color, fontSize: 10 }} />
                  )}
                  <Line type="monotone" dataKey={metricKey} stroke={meta?.color} strokeWidth={2}
                    dot={{ r: 4, fill: meta?.color, strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── TAB 3: Comparar sesiones ─────────────────────────────────────────────────
function ComparisonView({ sessions, reports }) {
  const sessionOptions = useMemo(() => {
    const ids = [...new Set(reports.map((r) => r.session_id).filter(Boolean))];
    return ids
      .map((id) => sessions.find((s) => s.id === id))
      .filter(Boolean)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [sessions, reports]);

  const [idA, setIdA] = useState(sessionOptions[0]?.id || "");
  const [idB, setIdB] = useState(sessionOptions[1]?.id || "");

  const reportsA = useMemo(() => reports.filter((r) => r.session_id === idA), [reports, idA]);
  const reportsB = useMemo(() => reports.filter((r) => r.session_id === idB), [reports, idB]);
  const infoA = sessions.find((s) => s.id === idA);
  const infoB = sessions.find((s) => s.id === idB);

  const avgA = useMemo(() => Object.fromEntries(METRICS.map(({ key }) => [key, avg(reportsA.map((r) => r[key]))])), [reportsA]);
  const avgB = useMemo(() => Object.fromEntries(METRICS.map(({ key }) => [key, avg(reportsB.map((r) => r[key]))])), [reportsB]);

  const radarData = METRICS.map(({ key, label }) => {
    const max = Math.max(avgA[key] || 0, avgB[key] || 0);
    return {
      metric: label.split(" ")[0],
      A: max ? parseFloat(((avgA[key] || 0) / max * 100).toFixed(1)) : 0,
      B: max ? parseFloat(((avgB[key] || 0) / max * 100).toFixed(1)) : 0,
    };
  });

  if (sessionOptions.length < 2) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-14 text-center">
        <p className="text-zinc-500 text-sm">Necesitás al menos 2 sesiones con datos GPS para comparar.</p>
      </div>
    );
  }

  const SessionSelect = ({ value, onChange, label, color }) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-white font-semibold text-sm">{label}</span>
      </div>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-zinc-800 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:outline-none">
        {sessionOptions.map((s) => (
          <option key={s.id} value={s.id}>{moment(s.date).format("DD/MM/YY")} — {s.title}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <SessionSelect value={idA} onChange={setIdA} label="Sesión A" color="#60a5fa" />
        <SessionSelect value={idB} onChange={setIdB} label="Sesión B" color="#f87171" />
      </div>

      {reportsA.length > 0 && reportsB.length > 0 && (
        <>
          {/* Radar */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-sm font-semibold text-white mb-1">Comparación global (promedios equipo)</p>
            <p className="text-zinc-500 text-xs mb-4">Valores normalizados — el mayor de cada métrica = 100</p>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#27272a" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, color: "#fff", fontSize: 12 }}
                  formatter={(v, name) => [v, name === "A" ? infoA?.title : infoB?.title]} />
                <Legend formatter={(v) => v === "A" ? infoA?.title : infoB?.title} />
                <Radar name="A" dataKey="A" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.25} strokeWidth={2} />
                <Radar name="B" dataKey="B" stroke="#f87171" fill="#f87171" fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla comparativa */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800 grid grid-cols-4 text-xs font-semibold text-zinc-400">
              <span>Métrica</span>
              <span className="text-center text-blue-400">{infoA?.title || "Sesión A"}</span>
              <span className="text-center text-red-400">{infoB?.title || "Sesión B"}</span>
              <span className="text-center">Diferencia</span>
            </div>
            {METRICS.map(({ key, label, fmt }) => {
              const a = avgA[key], b = avgB[key];
              const diff = a != null && b != null ? a - b : null;
              const up = diff != null && diff > 0;
              return (
                <div key={key} className="grid grid-cols-4 border-b border-zinc-800/60 hover:bg-zinc-800/20 px-4 py-3 items-center">
                  <span className="text-zinc-300 text-xs font-medium">{label}</span>
                  <span className="text-center text-white text-sm font-bold">{a != null ? fmt(a) : "—"}</span>
                  <span className="text-center text-white text-sm font-bold">{b != null ? fmt(b) : "—"}</span>
                  <span className={`text-center text-xs font-semibold ${diff == null ? "text-zinc-600" : up ? "text-green-400" : "text-red-400"}`}>
                    {diff == null ? "—" : `${up ? "▲" : "▼"} ${fmt(Math.abs(diff))}`}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function GpsAnalytics() {
  const [sessions, setSessions] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("session");

  useEffect(() => {
    Promise.all([
      base44.entities.TrainingSession.list("-date", 200),
      base44.entities.CatapultReport.list("-date", 1000),
    ]).then(([s, r]) => {
      setSessions(s);
      setReports(r);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === id ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"
            }`}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === "session"    && <SessionView sessions={sessions} reports={reports} />}
      {tab === "evolution"  && <EvolutionView reports={reports} />}
      {tab === "comparison" && <ComparisonView sessions={sessions} reports={reports} />}
    </div>
  );
}