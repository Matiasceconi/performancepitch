import React from "react";

const COLORS = { W: "bg-emerald-500", D: "bg-yellow-500", L: "bg-red-500" };

export default function FormDots({ form }) {
  if (!form) return <span className="text-zinc-600 text-xs">—</span>;
  const chars = form.slice(-5).split("");
  return (
    <div className="flex items-center gap-1 justify-center">
      {chars.map((c, i) => (
        <span key={i} className={`w-2 h-2 rounded-full ${COLORS[c] || "bg-zinc-600"}`} title={c === "W" ? "Ganó" : c === "D" ? "Empató" : "Perdió"} />
      ))}
    </div>
  );
}