import React, { useState, useEffect } from "react";
import { MapPin, Clock, Tv } from "lucide-react";

function isToday(iso) {
  if (!iso) return false;
  try {
    const md = new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
    const td = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
    return md === td;
  } catch { return false; }
}

function getCountdown(iso) {
  if (!iso) return null;
  const diff = new Date(iso) - new Date();
  if (diff <= 0) return null;
  return { hours: Math.floor(diff / 3600000), minutes: Math.floor((diff % 3600000) / 60000) };
}

function fmtTime(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
}

export default function TodayMatchAlert({ fixture, title }) {
  const [countdown, setCountdown] = useState(() => getCountdown(fixture?.date));
  useEffect(() => {
    if (!fixture?.date) return;
    const id = setInterval(() => setCountdown(getCountdown(fixture.date)), 1000);
    return () => clearInterval(id);
  }, [fixture?.date]);

  if (!fixture || !isToday(fixture.date)) return null;
  const isHome = fixture.homeTeam === "Defensa y Justicia";
  const ring = isHome ? "border-emerald-500 shadow-emerald-500/20" : "border-red-500 shadow-red-500/20";

  return (
    <div className={`relative bg-zinc-900 border-2 ${ring} rounded-2xl p-5 shadow-lg animate-pulse`}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-black">HOY</span>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h2>
        </div>
        {countdown && <span className="text-sm text-zinc-300 font-medium">Comienza en {countdown.hours}h {countdown.minutes}min</span>}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 flex flex-col items-center gap-2 text-center">
          {fixture.homeLogo ? <img src={fixture.homeLogo} alt="" className="w-16 h-16 object-contain" onError={(e) => { e.target.style.display = "none"; }} /> : <div className="w-16 h-16 rounded-full bg-zinc-800" />}
          <span className="text-sm font-semibold text-white">{fixture.homeTeam}</span>
        </div>
        <div className="text-center shrink-0">
          <Clock size={24} className="text-zinc-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-white">{fmtTime(fixture.date)}</p>
        </div>
        <div className="flex-1 flex flex-col items-center gap-2 text-center">
          {fixture.awayLogo ? <img src={fixture.awayLogo} alt="" className="w-16 h-16 object-contain" onError={(e) => { e.target.style.display = "none"; }} /> : <div className="w-16 h-16 rounded-full bg-zinc-800" />}
          <span className="text-sm font-semibold text-white">{fixture.awayTeam}</span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-center gap-4 text-xs text-zinc-400 flex-wrap">
        {fixture.venue && <span className="flex items-center gap-1"><MapPin size={12} /> {fixture.venue}</span>}
        <span className="flex items-center gap-1"><Tv size={12} /> {fixture.round || "—"}</span>
      </div>
    </div>
  );
}