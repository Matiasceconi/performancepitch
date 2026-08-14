import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import moment from "moment";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Download,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PlayerPhoto from "@/components/player/PlayerPhoto";

const TABS = [
  { id: "reading", label: "Informe de lectura", source: "Informe de lectura" },
  { id: "skinfolds", label: "Seguimiento de pliegues", source: "Seguimiento de pliegues" },
  { id: "weight", label: "Seguimiento de peso", source: "Seguimiento de peso" },
];

const STATUS = {
  good: { label: "Dentro del objetivo", short: "Bien", badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30", dot: "bg-emerald-400" },
  watch: { label: "En observación", short: "Observar", badge: "bg-amber-500/10 text-amber-300 border-amber-500/30", dot: "bg-amber-400" },
  bad: { label: "Fuera del límite", short: "Prioridad", badge: "bg-red-500/10 text-red-300 border-red-500/30", dot: "bg-red-400" },
  no_data: { label: "Sin control", short: "Sin datos", badge: "bg-zinc-800 text-zinc-400 border-zinc-700", dot: "bg-zinc-500" },
};

function playerName(player) {
  return player?.full_name || `${player?.first_name || ""} ${player?.last_name || ""}`.trim() || "Jugador";
}

function latestByPlayer(records) {
  const map = {};
  records.forEach((record) => {
    const current = map[record.player_id];
    if (!current || String(record.fecha || "") > String(current.fecha || "")) map[record.player_id] = record;
  });
  return map;
}

function historiesByPlayer(records) {
  const map = {};
  records.forEach((record) => {
    if (!map[record.player_id]) map[record.player_id] = [];
    map[record.player_id].push(record);
  });
  Object.values(map).forEach((rows) => rows.sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || ""))));
  return map;
}

function statusFor(tab, record, limitFallback) {
  if (!record) return "no_data";
  if (tab === "weight") {
    const weight = Number(record.peso);
    const optimum = Number(record.peso_optimo);
    const observation = Number(record.peso_observacion);
    const limit = Number(record.peso_limite);
    if (!Number.isFinite(weight)) return "no_data";
    if (Number.isFinite(optimum) && weight <= optimum) return "good";
    if (Number.isFinite(limit) && weight > limit) return "bad";
    if (Number.isFinite(observation) || Number.isFinite(limit)) return "watch";
    return "no_data";
  }
  const sum = Number(record.sumatoria_6p);
  const limit = Number(record.limite_mm ?? limitFallback);
  if (!Number.isFinite(sum)) return "no_data";
  if (!Number.isFinite(limit)) return "no_data";
  return sum <= limit ? "good" : "bad";
}

function deltaFor(history, tab) {
  const metric = tab === "weight" ? "peso" : "sumatoria_6p";
  const values = history.map((row) => Number(row[metric])).filter(Number.isFinite);
  if (values.length < 2) return null;
  return values[values.length - 1] - values[values.length - 2];
}

function StatusBadge({ status }) {
  const meta = STATUS[status] || STATUS.no_data;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${meta.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, tone = "zinc" }) {
  const tones = {
    emerald: "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300",
    amber: "border-amber-500/25 bg-amber-500/[0.06] text-amber-300",
    red: "border-red-500/25 bg-red-500/[0.06] text-red-300",
    zinc: "border-zinc-800 bg-zinc-900 text-zinc-200",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-500">{label}</p>
        <Icon size={16} />
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-white">{value}</p>
    </div>
  );
}

export default function NutritionDashboard({ players, assessments, interpretations, activeSquad }) {
  const [activeTab, setActiveTab] = useState("reading");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");

  const readingRecords = useMemo(
    () => interpretations.filter((row) => row.player_id && row.found_in_last_sync !== false && row.source_sheet_name === "Informe de lectura"),
    [interpretations]
  );
  const skinfoldRecords = useMemo(
    () => assessments.filter((row) => row.player_id && row.found_in_last_sync !== false && (row.source_sheet_name === "Seguimiento de pliegues" || row.tipo_medicion === "Seguimiento de pliegues")),
    [assessments]
  );
  const weightRecords = useMemo(
    () => assessments.filter((row) => row.player_id && row.found_in_last_sync !== false && (row.source_sheet_name === "Seguimiento de peso" || row.tipo_medicion === "Seguimiento de peso")),
    [assessments]
  );

  const records = activeTab === "reading" ? readingRecords : activeTab === "skinfolds" ? skinfoldRecords : weightRecords;
  const histories = useMemo(() => historiesByPlayer(records), [records]);
  const latest = useMemo(() => latestByPlayer(records), [records]);
  const latestReading = useMemo(() => latestByPlayer(readingRecords), [readingRecords]);

  const rows = useMemo(() => players.map((player) => {
    const record = latest[player.id];
    const history = histories[player.id] || [];
    const limitFallback = latestReading[player.id]?.limite_mm;
    const status = statusFor(activeTab, record, limitFallback);
    return { player, record, history, status, delta: deltaFor(history, activeTab), limitFallback };
  }), [players, latest, histories, latestReading, activeTab]);

  const counts = useMemo(() => rows.reduce((acc, row) => {
    acc[row.status] += 1;
    return acc;
  }, { good: 0, watch: 0, bad: 0, no_data: 0 }), [rows]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const matchesName = playerName(row.player).toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = statusFilter === "all" || row.status === statusFilter;
    return matchesName && matchesStatus;
  }).sort((a, b) => {
    const priority = { bad: 0, watch: 1, good: 2, no_data: 3 };
    return priority[a.status] - priority[b.status] || playerName(a.player).localeCompare(playerName(b.player));
  }), [rows, query, statusFilter]);

  const priorityRows = useMemo(() => rows.filter((row) => row.status === "bad" || row.status === "watch").sort((a, b) => {
    if (a.status !== b.status) return a.status === "bad" ? -1 : 1;
    const aValue = activeTab === "weight" ? Number(a.record?.peso) - Number(a.record?.peso_limite) : Number(a.record?.sumatoria_6p) - Number(a.record?.limite_mm ?? a.limitFallback);
    const bValue = activeTab === "weight" ? Number(b.record?.peso) - Number(b.record?.peso_limite) : Number(b.record?.sumatoria_6p) - Number(b.record?.limite_mm ?? b.limitFallback);
    return bValue - aValue;
  }).slice(0, 5), [rows, activeTab]);

  useEffect(() => {
    if (!selectedPlayerId || !rows.some((row) => row.player.id === selectedPlayerId)) {
      const preferred = rows.find((row) => row.status === "bad") || rows.find((row) => row.record) || rows[0];
      setSelectedPlayerId(preferred?.player.id || "");
    }
  }, [activeTab, rows, selectedPlayerId]);

  const selected = rows.find((row) => row.player.id === selectedPlayerId) || null;
  const metricKey = activeTab === "weight" ? "peso" : "sumatoria_6p";
  const unit = activeTab === "weight" ? "kg" : "mm";
  const selectedTarget = activeTab === "weight"
    ? Number(selected?.record?.peso_optimo)
    : Number(selected?.record?.limite_mm ?? selected?.limitFallback);
  const chartData = (selected?.history || []).map((row) => ({
    date: moment(row.fecha).format("DD/MM"),
    value: Number(row[metricKey]),
  })).filter((row) => Number.isFinite(row.value));

  function mainValue(row) {
    const value = activeTab === "weight" ? row.record?.peso : row.record?.sumatoria_6p;
    return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)} ${unit}` : "—";
  }

  function targetLabel(row) {
    if (!row.record) return "—";
    if (activeTab === "weight") {
      const optimum = Number(row.record.peso_optimo);
      const observation = Number(row.record.peso_observacion);
      const limit = Number(row.record.peso_limite);
      if (![optimum, observation, limit].some(Number.isFinite)) return "—";
      return `${Number.isFinite(optimum) ? optimum.toFixed(1) : "—"} / ${Number.isFinite(limit) ? limit.toFixed(1) : "—"} kg`;
    }
    const limit = Number(row.record.limite_mm ?? row.limitFallback);
    return Number.isFinite(limit) ? `≤ ${limit.toFixed(1)} mm` : "—";
  }

  function handleExport() {
    const tabLabel = TABS.find((tab) => tab.id === activeTab)?.label || "Nutrición";
    const output = filteredRows.map((row) => ({
      Jugador: playerName(row.player),
      Posición: row.player.position || "",
      Fecha: row.record?.fecha || "",
      Medición: activeTab === "weight" ? row.record?.peso ?? "" : row.record?.sumatoria_6p ?? "",
      Unidad: unit,
      Objetivo: targetLabel(row),
      Diferencia: row.delta ?? "",
      Estado: STATUS[row.status].label,
    }));
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(output);
    worksheet["!cols"] = [{ wch: 27 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 9 }, { wch: 18 }, { wch: 12 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(workbook, worksheet, tabLabel.slice(0, 31));
    XLSX.writeFile(workbook, `nutricion-${activeTab}-${moment().format("YYYYMMDD-HHmm")}.xlsx`);
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-1 overflow-x-auto border-b border-zinc-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setStatusFilter("all"); }}
            className={`whitespace-nowrap border-b-2 px-4 pb-3 text-sm font-semibold transition-colors ${activeTab === tab.id ? "border-emerald-400 text-emerald-300" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard icon={Users} label="Plantel activo" value={players.length} />
        <MetricCard icon={CheckCircle2} label="Dentro del objetivo" value={counts.good} tone="emerald" />
        <MetricCard icon={AlertTriangle} label="En observación" value={counts.watch} tone="amber" />
        <MetricCard icon={Activity} label="Fuera del límite" value={counts.bad} tone="red" />
        <MetricCard icon={Users} label="Sin control" value={counts.no_data} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(290px,0.8fr)]">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 md:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Evolución individual</p>
              <div className="mt-2 flex items-center gap-3">
                {selected && <PlayerPhoto player={selected.player} className="h-11 w-11 rounded-full border border-zinc-700 object-cover" fallbackClassName="h-11 w-11 rounded-full border border-zinc-700 bg-zinc-800 flex items-center justify-center" />}
                <div>
                  <h2 className="text-base font-bold text-white">{selected ? playerName(selected.player) : "Sin jugador seleccionado"}</h2>
                  <p className="text-xs text-zinc-500">{selected?.player.position || activeSquad?.name || ""}</p>
                </div>
              </div>
            </div>
            {selected && <StatusBadge status={selected.status} />}
          </div>

          {chartData.length ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 18, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis stroke="#71717a" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={["dataMin - 2", "dataMax + 2"]} />
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12 }} labelStyle={{ color: "#a1a1aa" }} formatter={(value) => [`${Number(value).toFixed(1)} ${unit}`, "Medición"]} />
                  {Number.isFinite(selectedTarget) && <ReferenceLine y={selectedTarget} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: "Objetivo", fill: "#fbbf24", fontSize: 10 }} />}
                  <Line type="monotone" dataKey="value" stroke="#34d399" strokeWidth={3} dot={{ r: 4, fill: "#09090b", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-zinc-800 text-sm text-zinc-600">Todavía no hay mediciones para graficar</div>
          )}

          {selected?.record && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-zinc-950 p-3"><p className="text-[11px] text-zinc-600">Último control</p><p className="mt-1 font-semibold text-zinc-200">{moment(selected.record.fecha).format("DD/MM/YYYY")}</p></div>
              <div className="rounded-xl bg-zinc-950 p-3"><p className="text-[11px] text-zinc-600">Valor actual</p><p className="mt-1 font-semibold text-white">{mainValue(selected)}</p></div>
              <div className="rounded-xl bg-zinc-950 p-3"><p className="text-[11px] text-zinc-600">Objetivo / límite</p><p className="mt-1 font-semibold text-amber-300">{targetLabel(selected)}</p></div>
              <div className="rounded-xl bg-zinc-950 p-3"><p className="text-[11px] text-zinc-600">Cambio</p><p className={`mt-1 font-semibold ${selected.delta == null ? "text-zinc-500" : selected.delta <= 0 ? "text-emerald-300" : "text-red-300"}`}>{selected.delta == null ? "—" : `${selected.delta > 0 ? "+" : ""}${selected.delta.toFixed(1)} ${unit}`}</p></div>
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 md:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Atención prioritaria</p>
              <p className="mt-1 text-xs text-zinc-600">Ordenado por desvío del objetivo</p>
            </div>
            <AlertTriangle size={18} className="text-amber-400" />
          </div>
          <div className="mt-4 space-y-2">
            {priorityRows.length === 0 && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4 text-sm text-emerald-300">No hay jugadores fuera de objetivo en este informe.</div>}
            {priorityRows.map((row) => (
              <button key={row.player.id} onClick={() => setSelectedPlayerId(row.player.id)} className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-left transition hover:border-zinc-700 hover:bg-zinc-800/60">
                <PlayerPhoto player={row.player} className="h-10 w-10 rounded-full border border-zinc-700 object-cover" fallbackClassName="h-10 w-10 rounded-full border border-zinc-700 bg-zinc-800 flex items-center justify-center" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-200">{playerName(row.player)}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{mainValue(row)} · {STATUS[row.status].short}</p>
                </div>
                <span className={`h-2.5 w-2.5 rounded-full ${STATUS[row.status].dot}`} />
              </button>
            ))}
          </div>
        </aside>
      </div>

      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="flex flex-col gap-3 border-b border-zinc-800 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-bold text-white">Estado del plantel</h2>
            <p className="text-xs text-zinc-500">{filteredRows.length} de {players.length} jugadores · {activeSquad?.name || "Plantel activo"}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar jugador..." className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 pl-9 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-500 sm:w-56" />
            </div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-300 outline-none focus:border-emerald-500">
              <option value="all">Todos los estados</option>
              <option value="good">Dentro del objetivo</option>
              <option value="watch">En observación</option>
              <option value="bad">Fuera del límite</option>
              <option value="no_data">Sin control</option>
            </select>
            <button onClick={handleExport} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-600/40 bg-emerald-600/10 px-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-600/20"><Download size={15} /> Excel</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-zinc-950/50 text-left text-[11px] uppercase tracking-wide text-zinc-600">
              <tr><th className="px-4 py-3">Jugador</th><th className="px-4 py-3">Último control</th><th className="px-4 py-3">Valor actual</th><th className="px-4 py-3">Objetivo / límite</th><th className="px-4 py-3">Cambio</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Evolución</th></tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.player.id} className="border-t border-zinc-800/70 transition hover:bg-zinc-800/30">
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><PlayerPhoto player={row.player} className="h-10 w-10 rounded-full border border-zinc-700 object-cover" fallbackClassName="h-10 w-10 rounded-full border border-zinc-700 bg-zinc-800 flex items-center justify-center" /><div><p className="font-semibold text-zinc-100">{playerName(row.player)}</p><p className="text-xs text-zinc-600">{row.player.position || "Sin posición"}</p></div></div></td>
                  <td className="px-4 py-3 text-zinc-400">{row.record?.fecha ? moment(row.record.fecha).format("DD/MM/YYYY") : "—"}</td>
                  <td className="px-4 py-3 text-base font-bold text-white">{mainValue(row)}</td>
                  <td className="px-4 py-3 font-medium text-zinc-400">{targetLabel(row)}</td>
                  <td className={`px-4 py-3 font-semibold ${row.delta == null ? "text-zinc-600" : row.delta <= 0 ? "text-emerald-300" : "text-red-300"}`}>
                    <span className="inline-flex items-center gap-1">{row.delta == null ? "—" : <>{row.delta <= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}{row.delta > 0 ? "+" : ""}{row.delta.toFixed(1)} {unit}</>}</span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                  <td className="px-4 py-3 text-right"><button disabled={!row.record} onClick={() => setSelectedPlayerId(row.player.id)} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-emerald-500/50 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-30">Ver gráfico</button></td>
                </tr>
              ))}
              {filteredRows.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-zinc-600">No hay jugadores con estos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
