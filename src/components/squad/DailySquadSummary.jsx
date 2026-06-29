import React from "react";

const CARDS = [
  { key: "total",        label: "Total",        color: "text-white" },
  { key: "disponibles",  label: "Disponibles",  color: "text-emerald-400" },
  { key: "lesionados",   label: "Lesionados",   color: "text-red-400" },
  { key: "molestias",    label: "Molestias",    color: "text-orange-400" },
  { key: "diferenciados",label: "Diferenciados",color: "text-amber-400" },
  { key: "suspendidos",  label: "Suspendidos",  color: "text-yellow-400" },
  { key: "bajan",        label: "Bajan",        color: "text-pink-400" },
  { key: "suben",        label: "Suben",        color: "text-violet-400" },
  { key: "convocados",   label: "Convocados",   color: "text-blue-400" },
  { key: "ausentes",     label: "Ausentes",     color: "text-zinc-400" },
];

export default function DailySquadSummary({ data }) {
  return (
    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
      {CARDS.map(({ key, label, color }) => (
        <div key={key} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
          <p className={`text-2xl font-bold ${color}`}>{data[key] ?? 0}</p>
          <p className="text-[10px] text-zinc-500 mt-1 leading-tight">{label}</p>
        </div>
      ))}
    </div>
  );
}