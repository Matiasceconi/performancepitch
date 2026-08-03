import React from "react";
import { Clock } from "lucide-react";

function daysUntil(iso) {
  if (!iso) return null;
  const match = new Date(iso);
  if (isNaN(match.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const matchDay = new Date(match.getFullYear(), match.getMonth(), match.getDate());
  return Math.round((matchDay - today) / 86400000);
}

export default function MatchCountdown({ date, size = "sm" }) {
  const days = daysUntil(date);
  if (days === null) return null;

  let label, cls;
  if (days < 0) { label = "Jugado"; cls = "bg-zinc-800 text-zinc-500"; }
  else if (days === 0) { label = "Hoy"; cls = "bg-red-500 text-white animate-pulse"; }
  else if (days === 1) { label = "Mañana"; cls = "bg-orange-500 text-white"; }
  else { label = `En ${days} días`; cls = "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"; }

  const sizeCls = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1";

  return (
    <span className={`inline-flex items-center gap-1 rounded-lg font-bold shrink-0 ${sizeCls} ${cls}`}>
      <Clock size={12} /> {label}
    </span>
  );
}