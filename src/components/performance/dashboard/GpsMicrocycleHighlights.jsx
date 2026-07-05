import React from "react";
import { fmt } from "./gpsMicrocycleReportUtils";

const MEDALS = ["🥇", "🥈", "🥉"];
function initials(name) { return (name || "J").split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase(); }

function PlayerRank({ item, metric, index }) {
  return <div className="flex items-center gap-3 rounded-xl bg-zinc-900/70 border border-zinc-800 p-3"><div className="text-lg w-7 text-center">{MEDALS[index]}</div>{item.player?.photo_url ? <img src={item.player.photo_url} alt={item.name} className="w-11 h-11 rounded-full object-cover border border-zinc-700" /> : <div className="w-11 h-11 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">{initials(item.name)}</div>}<div className="min-w-0 flex-1"><p className="text-white font-bold text-sm truncate">{item.name}</p><p className="text-xs text-zinc-500 truncate">{item.player?.position || "Sin posición"}</p></div><div className="text-right"><p className="font-bold text-sm" style={{ color: metric.color }}>{fmt(item.value, metric.unit)}</p></div></div>;
}

export default function GpsMicrocycleHighlights({ highlights }) {
  return <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5"><div className="mb-4"><h3 className="text-white font-bold text-lg">Destacados del microciclo</h3><p className="text-zinc-500 text-sm">Ranking TOP 3 por variable con jugadores del grupo principal.</p></div><div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{highlights.map(({ metric, top }) => <div key={metric.key} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4"><p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: metric.color }}>{metric.label}</p><div className="space-y-2">{top?.length ? top.map((item, index) => <PlayerRank key={`${metric.key}-${item.name}`} item={item} metric={metric} index={index} />) : <p className="text-sm text-zinc-500">Sin datos</p>}</div></div>)}</div></div>;
}