import React from "react";
import { Clock } from "lucide-react";
import { getDateKeyInTimezone, matchDateValue, zonedMatchDate } from "@/lib/clubCompetitionUtils";

function dayDifference(dateKey, timeZone) {
  if (!dateKey) return null;
  const today = getDateKeyInTimezone(timeZone);
  const a = new Date(`${today}T12:00:00Z`);
  const b = new Date(`${dateKey}T12:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86400000);
}

export default function MatchCountdown({ match, date, time, timeZone = "America/Argentina/Buenos_Aires", size = "sm" }) {
  const normalizedMatch = match || { matchDate: String(date || "").slice(0, 10), matchTime: time || "" };
  const dateKey = matchDateValue(normalizedMatch) || String(date || "").slice(0, 10);
  const days = dayDifference(dateKey, timeZone);
  if (days === null) return null;

  let label;
  let cls;
  if (days < 0) {
    label = "Jugado";
    cls = "bg-zinc-800 text-zinc-500";
  } else if (days === 0) {
    const start = zonedMatchDate(normalizedMatch, timeZone);
    const diff = start ? start.getTime() - Date.now() : null;
    if (diff != null && diff > 0 && diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.max(0, Math.floor((diff % 3600000) / 60000));
      label = hours > 0 ? `En ${hours}h ${minutes}m` : `En ${minutes} min`;
    } else {
      label = "Hoy";
    }
    cls = "bg-red-500 text-white";
  } else if (days === 1) {
    label = "Mañana";
    cls = "bg-orange-500 text-white";
  } else {
    label = `En ${days} días`;
    cls = "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30";
  }

  const sizeCls = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1";

  return (
    <span className={`inline-flex items-center gap-1 rounded-lg font-bold shrink-0 ${sizeCls} ${cls}`}>
      <Clock size={12} /> {label}
    </span>
  );
}
