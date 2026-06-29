import React, { useState, useEffect, useMemo } from "react";
import { Activity } from "lucide-react";
import { Clock, Users, FileSpreadsheet } from "lucide-react";
import moment from "moment";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";

const METRICS = [
  { key: "total_distance",   label: "Distancia (m)",      color: "#60a5fa", fmt: (v) => Math.round(v) },
  { key: "distance_hsr",    label: "19.8-25 km/h (m)",   color: "#34d399", fmt: (v) => Math.round(v) },
  { key: "sprint_distance", label: "+25 km/h (m)",        color: "#fbbf24", fmt: (v) => Math.round(v) },
  { key: "player_load",     label: "Player Load",         color: "#a78bfa", fmt: (v) => parseFloat(v).toFixed(0) },
  { key: "max_velocity",    label: "Vel. M\u00e1x (km/h)",    color: "#f87171", fmt: (v) => parseFloat(v).toFixed(1) },
  { key: "accelerations",   label: "Aceleraciones",       color: "#fb923c", fmt: (v) => Math.round(v) },
  { key: "decelerations",   label: "Desaceleraciones",    color: "#e879f9", fmt: (v) => Math.round(v) },
  { key: "sprint_efforts",  label: "Sprint Efforts",      color: "#2dd4bf", fmt: (v) => Math.round(v) },
];

function avg(arr) {
  const v = arr.filter((x) => x != null && !isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function getTrafficLight(value, teamAvg) {
  if (value == null || teamAvg == null || teamAvg === 0) return null;
  const pct = (value / teamAvg) * 100;
  if (pct > 90) return { color: "#ef4444", label: "Alto", bg: "bg-red-500/20 border-red-500/40", dot: "bg-red-500" };
  if (pct >= 60) return { color: "#f59e0b", label: "Medio", bg: "bg-yellow-500/20 border-yellow-500/40", dot: "bg-yellow-500" };
  return { color: "#22c55e", label: "Bajo", bg: "bg-green-500/20 border-green-500/40", dot: "bg-green-500" };
}

// ── CSV parser ──────────────────────────────────────────────────────────────
function matchColumn(raw) {
  const h = raw.toLowerCase().replace(/^\uFEFF/, "").trim();
  if (h === "name" || h === "jugador" || h === "player" || h === "nombre" || h === "athlete") return "player_name";
  if (h === "total duration" || h === "tot dur") return "total_duration";
  if (h.includes("total distance") || h === "tot dist (m)" || h === "tot dist") return "total_distance";
  if (h.startsWith("d") && h.includes("19")) return "distance_hsr";
  if ((h.startsWith("d+") || h.startsWith("d +")) && h.includes("25")) return "sprint_distance";
  if (h === "sprint efforts" || h === "sprint effs") return "sprint_efforts";
  if (h.includes("acc") && (h.includes("3mt") || h.includes("3 m"))) return "accelerations";
  if (h.includes("dec") && (h.includes("3mt") || h.includes("3 m"))) return "decelerations";
  if (h === "total player load" || h === "tot pl" || h === "player load") return "player_load";
  if (h.includes("maximum velocity") || h === "max vel (km/h)" || h === "max velocity (km/h)") return "max_velocity";
  if (h.includes("max vel") && h.includes("%")) return "max_velocity_percentage";
  if (h === "metros x min" || h === "m/min" || h === "meters per minute") return "meters_per_minute";
  return null;
}

function parseNum(val) {
  if (val == null || val === "" || val === "-") return null;
  const str = String(val).trim();
  const hasCommaDecimal = /^\d+,\d+$/.test(str) || /^\d{1,3}(\.\d{3})*,\d+$/.test(str);
  const cleaned = hasCommaDecimal ? str.replace(/\./g, "").replace(",", ".") : str.replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function splitCSVLine(line, sep) {
  const result = [];
  let cur = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === sep && !inQuotes) { result.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  result.push(cur.trim());
  return result;
}

function parseCatapultCSV(text) {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);
  const firstSemi = lines[0].split(";").length;
  const firstComma = lines[0].split(",").length;
  const sep = firstSemi > firstComma ? ";" : ",";
  let headerIdx = -1, headers = [];
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cols = splitCSVLine(lines[i], sep);
    const mapped = cols.filter((c) => matchColumn(c) !== null).length;
    const firstLow = cols[0]?.replace(/^\uFEFF/, "").toLowerCase().trim();
    if (firstLow === "name" || firstLow === "jugador" || firstLow === "athlete" || mapped >= 3) {
      headerIdx = i;
      headers = cols.map((c) => c.replace(/^\uFEFF/, ""));
      break;
    }
  }
  if (headerIdx === -1) return null;
  const fieldMap = {};
  headers.forEach((h, idx) => {
    const field = matchColumn(h);
    if (field) fieldMap[idx] = field;
    else if (idx === 0) fieldMap[idx] = "player_name";
  });
  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i], sep);
    const obj = {};
    Object.entries(fieldMap).forEach(([colIdx, field]) => {
      const raw = cols[parseInt(colIdx)];
      if (field === "player_name") obj[field] = raw || "";
      else obj[field] = parseNum(raw);
    });
    const name = (obj.player_name || "").trim();
    if (!name) continue;
    if (["total", "promedio", "average", "team", "totals"].includes(name.toLowerCase())) continue;
    rows.push(obj);
  }
  return rows;
}

// ── Componente ─────────────────────────────────────────────────────────────
export default function MatchGpsReport({ match }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeMetric, setActiveMetric] = useState("total_distance");

  useEffect(() => {
    if (!match.csv_url) return;
    setLoading(true);
    setError(false);
    fetch(match.csv_url)
      .then((r) => r.text())
      .then((text) => {
        const parsed = parseCatapultCSV(text);
        setRows(parsed || []);
        if (!parsed) setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [match.csv_url]);

  const metric = METRICS.find((m) => m.key === activeMetric);

  const teamAvgs = useMemo(() => {
    const out = {};
    METRICS.forEach(({ key }) => { out[key] = avg(rows.map((r) => r[key])); });
    return out;
  }, [rows]);

  const playerData = useMemo(() => {
    const byPlayer = {};
    rows.forEach((r) => {
      if (!r.player_name) return;
      if (!byPlayer[r.player_name]) byPlayer[r.player_name] = [];
      byPlayer[r.player_name].push(r);
    });
    return Object.entries(byPlayer).map(([name, prows]) => {
      const out = { player_name: name, shortName: name };
      METRICS.forEach(({ key }) => { out[key] = avg(prows.map((r) => r[key])); });
      return out;
    });
  }, [rows]);

  const chartData = useMemo(() =>
    playerData
      .filter((p) => p[activeMetric] != null)
      .sort((a, b) => (b[activeMetric] || 0) - (a[activeMetric] || 0))
      .map((p) => ({ ...p, value: p[activeMetric] })),
    [playerData, activeMetric]
  );

  const tableData = useMemo(() =>
    [...playerData].sort((a, b) => (b.total_distance || 0) - (a.total_distance || 0)),
    [playerData]
  );

  if (!match.csv_url) return null;

  const teamAvg = teamAvgs[activeMetric];

  return (
    <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-zinc-800/80 border-b border-zinc-700/50 flex items-center gap-2">
        <FileSpreadsheet size={14} className="text-green-400" />
        <p className="text-sm font-semibold text-white">Informe GPS del partido</p>
        {!loading && rows.length > 0 && (
          <span className="text-xs text-zinc-500 ml-auto">
            <Users size={11} className="inline mr-1" />{new Set(rows.map((r) => r.player_name)).size} jugadores
          </span>
        )}
      </div>

      {/* Contenido */}
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="flex items-center gap-2 text-zinc-500 text-xs">
              <div className="w-4 h-4 border border-zinc-600 border-t-white rounded-full animate-spin" />
              Analizando datos GPS...
            </div>
          </div>
        ) : error ? (
          <p className="text-red-400 text-xs text-center py-4">No se pudo leer el archivo CSV.</p>
        ) : rows.length === 0 ? (
          <p className="text-zinc-500 text-xs text-center py-4">Sin datos de jugadores en el CSV.</p>
        ) : (
          <>
            {/* KPIs del equipo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {METRICS.filter(({ key }) => teamAvgs[key] != null).slice(0, 4).map(({ key, label, color, fmt }) => (
                <div key={key} className="bg-zinc-900/80 border border-zinc-700/50 rounded-lg p-3 text-center">
                  <p className="text-zinc-500 text-[10px] tracking-wider uppercase">{label}</p>
                  <p className="font-bold text-base" style={{ color }}>{fmt(teamAvgs[key])}</p>
                  <p className="text-zinc-600 text-[10px]">prom. equipo</p>
                </div>
              ))}
            </div>

            {/* Selector métrica */}
            <div className="flex flex-wrap gap-1.5">
              {METRICS.map(({ key, label, color }) => (
                <button key={key} onClick={() => setActiveMetric(key)}
                  className="text-[10px] px-2.5 py-1 rounded-full border font-medium transition-all"
                  style={activeMetric === key
                    ? { backgroundColor: color, color: "#18181b", borderColor: color }
                    : { backgroundColor: "transparent", color: "#71717a", borderColor: "#3f3f46" }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Gráfico de barras */}
            {chartData.length > 0 && (
              <div className="bg-zinc-900/60 border border-zinc-700/50 rounded-xl p-4">
                <p className="text-xs font-semibold text-white mb-3 flex items-center gap-1.5">
                  <Activity size={12} style={{ color: metric?.color }} />
                  {metric?.label} — por jugador
                </p>
                <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 30)}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 50, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fill: "#71717a" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="shortName" width={80} tick={{ fontSize: 9, fill: "#d4d4d8" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }}
                      formatter={(val) => [metric?.fmt(val), metric?.label]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.player_name || ""}
                    />
                    {teamAvg != null && (
                      <ReferenceLine x={teamAvg} stroke={metric?.color} strokeDasharray="4 4" strokeOpacity={0.6}
                        label={{ value: "prom", position: "top", fill: metric?.color, fontSize: 9 }} />
                    )}
                    <Bar dataKey="value" radius={[0, 3, 3, 0]}
                      label={{ position: "right", fontSize: 9, fill: "#a1a1aa", formatter: (v) => metric?.fmt(v) }}>
                      {chartData.map((_, i) => <Cell key={i} fill={metric?.color} fillOpacity={0.75} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tabla de jugadores */}
            <div className="overflow-x-auto rounded-lg border border-zinc-700/50">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-zinc-800/80">
                    <th className="px-2.5 py-2 text-left text-zinc-400 font-semibold whitespace-nowrap">Jugador</th>
                    {METRICS.filter(({ key }) => tableData.some((r) => r[key] != null)).map(({ key, label }) => (
                      <th key={key} className="px-2.5 py-2 text-right text-zinc-400 font-semibold whitespace-nowrap">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-zinc-800/40 border-b border-zinc-700/50">
                    <td className="px-2.5 py-1.5 text-zinc-500 font-bold whitespace-nowrap text-[10px] uppercase tracking-wider">Prom. Equipo</td>
                    {METRICS.filter(({ key }) => tableData.some((r) => r[key] != null)).map(({ key, fmt, color }) => (
                      <td key={key} className="px-2.5 py-1.5 text-right whitespace-nowrap font-mono font-bold" style={{ color }}>
                        {teamAvgs[key] != null ? fmt(teamAvgs[key]) : <span className="text-zinc-700">—</span>}
                      </td>
                    ))}
                  </tr>
                  {tableData.map((row, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? "bg-zinc-900" : "bg-zinc-800/10"}>
                      <td className="px-2.5 py-1.5 text-zinc-200 font-medium whitespace-nowrap">{row.player_name}</td>
                      {METRICS.filter(({ key }) => tableData.some((r) => r[key] != null)).map(({ key, fmt }) => {
                        const val = row[key];
                        const light = getTrafficLight(val, teamAvgs[key]);
                        return (
                          <td key={key} className="px-2.5 py-1.5 text-right whitespace-nowrap">
                            {val != null ? (
                              <span className={`inline-flex items-center gap-1 justify-end font-mono font-semibold px-1.5 py-0.5 rounded border ${light?.bg || ""}`}
                                style={{ color: light?.color || "#a1a1aa" }}>
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${light?.dot || "bg-zinc-500"}`} />
                                {fmt(val)}
                              </span>
                            ) : (
                              <span className="text-zinc-700">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-zinc-600 text-[10px] text-center">{rows.length} registros · {tableData.length} jugadores</p>
          </>
        )}
      </div>
    </div>
  );
}