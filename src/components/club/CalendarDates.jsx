import React from "react";
import { CalendarDays } from "lucide-react";

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "short" }); }
  catch { return iso; }
}

export default function CalendarDates({ fixtures, teamName }) {
  const upcoming = (fixtures || [])
    .filter((f) => f.status === "scheduled" && (f.homeTeam === teamName || f.awayTeam === teamName))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <CalendarDays size={16} className="text-emerald-400" /> Próximas Fechas — Clausura
      </h2>
      {!upcoming.length ? (
        <p className="text-zinc-500 text-sm text-center py-6">No hay fechas programadas.</p>
      ) : (
        <div className="grid sm:grid-cols-3 gap-3">
          {upcoming.map((fx, i) => {
            const isHome = fx.homeTeam === teamName;
            const opponent = isHome ? fx.awayTeam : fx.homeTeam;
            const oppLogo = isHome ? fx.awayLogo : fx.homeLogo;
            return (
              <div key={i} className="bg-zinc-950/50 border border-zinc-800/60 rounded-xl p-3 text-center">
                <p className="text-xs font-bold text-emerald-400 uppercase mb-2">{fx.round || "Fecha"}</p>
                <div className="flex items-center justify-center gap-2 mb-2">
                  {oppLogo ? <img src={oppLogo} alt="" className="w-10 h-10 object-contain" onError={(e) => { e.target.style.display = "none"; }} /> : <div className="w-10 h-10 rounded-full bg-zinc-800" />}
                </div>
                <p className="text-sm font-medium text-white truncate">vs {opponent}</p>
                <p className="text-xs text-zinc-500 mt-1">{isHome ? "Local" : "Visitante"} · {fmtDate(fx.date)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}