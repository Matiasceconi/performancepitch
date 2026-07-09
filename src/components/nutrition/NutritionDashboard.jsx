import React from "react";
import moment from "moment";
import { Users, Calendar, Scale, Activity, Percent, Dumbbell, AlertTriangle } from "lucide-react";

function avg(rows, field) {
  const nums = rows.map(r => Number(r[field])).filter(Number.isFinite);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}
function fmt(n, d = 1) { return n ? n.toFixed(d) : "—"; }
function Stat({ icon: Icon, label, value, color = "text-white", sub }) {
  return <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"><Icon size={15} className={color} /><p className={`text-2xl font-bold mt-2 ${color}`}>{value}</p><p className="text-xs text-zinc-500">{label}</p>{sub && <p className="text-[10px] text-zinc-600 mt-1">{sub}</p>}</div>;
}

export default function NutritionDashboard({ assessments, playerCount = 0 }) {
  const linked = assessments.filter(a => a.linked && a.player_id);
  const latestDate = assessments.map(a => a.fecha).filter(Boolean).sort().pop();
  const latestRows = latestDate ? linked.filter(a => a.fecha === latestDate) : linked;
  const latestByPlayer = new Map();
  linked.forEach(a => { if (!latestByPlayer.has(a.player_id) || (a.fecha || "") > (latestByPlayer.get(a.player_id).fecha || "")) latestByPlayer.set(a.player_id, a); });
  const staleLimit = moment().subtract(45, "days").format("YYYY-MM-DD");
  const stale = [...latestByPlayer.values()].filter(a => (a.fecha || "") < staleLimit).length;
  const alerts = latestRows.filter(a => (a.porcentaje_grasa && a.porcentaje_grasa >= 18) || (a.sumatoria_6p && a.sumatoria_6p >= 80));
  return <div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3"><Stat icon={Users} label="Jugadores evaluados" value={new Set(linked.map(a => a.player_id)).size} sub={`${playerCount || "—"} jugadores oficiales`} color="text-emerald-400" /><Stat icon={Calendar} label="Última medición" value={latestDate ? moment(latestDate).format("DD/MM") : "—"} color="text-blue-400" /><Stat icon={AlertTriangle} label="Sin medición reciente" value={stale} color="text-yellow-400" /><Stat icon={Scale} label="Prom. peso" value={`${fmt(avg(latestRows, "peso"))} kg`} color="text-white" /><Stat icon={Activity} label="Prom. Sum. 6P" value={fmt(avg(latestRows, "sumatoria_6p"))} color="text-orange-400" /><Stat icon={Percent} label="Prom. % grasa" value={`${fmt(avg(latestRows, "porcentaje_grasa"))}%`} color="text-pink-400" /><Stat icon={Dumbbell} label="Prom. kg MM" value={`${fmt(avg(latestRows, "kg_masa_muscular"))} kg`} color="text-purple-400" /></div>{alerts.length > 0 && <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4"><p className="text-sm font-semibold text-amber-300 flex items-center gap-2"><AlertTriangle size={15} /> Alertas nutricionales ({alerts.length})</p><p className="text-xs text-amber-200/70 mt-1">Jugadores con % grasa o sumatoria 6P por encima de los umbrales de seguimiento.</p></div>}</div>;
}