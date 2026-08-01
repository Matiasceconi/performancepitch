import React from "react";
import { MapPin, Calendar, Trophy } from "lucide-react";

function fmtFull(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export default function NextMatchCard({ fixture, title, badgeText, badgeClass, iconClass }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <Calendar size={16} className={iconClass} /> {title}
        </h2>
        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${badgeClass}`}>{badgeText}</span>
      </div>
      {fixture ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 flex flex-col items-center gap-2 text-center">
              {fixture.homeLogo ? <img src={fixture.homeLogo} alt="" className="w-14 h-14 object-contain" onError={(e) => { e.target.style.display = "none"; }} /> : <div className="w-14 h-14 rounded-full bg-zinc-800" />}
              <span className="text-sm font-semibold text-white text-center">{fixture.homeTeam}</span>
              <span className="text-xs text-zinc-500">Local</span>
            </div>
            <div className="px-2"><span className="text-zinc-600 text-xs font-bold uppercase">vs</span></div>
            <div className="flex-1 flex flex-col items-center gap-2 text-center">
              {fixture.awayLogo ? <img src={fixture.awayLogo} alt="" className="w-14 h-14 object-contain" onError={(e) => { e.target.style.display = "none"; }} /> : <div className="w-14 h-14 rounded-full bg-zinc-800" />}
              <span className="text-sm font-semibold text-white text-center">{fixture.awayTeam}</span>
              <span className="text-xs text-zinc-500">Visitante</span>
            </div>
          </div>
          <div className="border-t border-zinc-800 pt-3 space-y-1.5">
            <p className="text-sm text-white font-medium capitalize">{fmtFull(fixture.date)}</p>
            <div className="flex items-center gap-2 text-xs text-zinc-400"><MapPin size={12} /> {fixture.venue || "Estadio a confirmar"}</div>
            <div className="flex items-center gap-2 text-xs text-zinc-400"><Trophy size={12} /> {fixture.round || "Fecha a confirmar"}</div>
          </div>
        </div>
      ) : (
        <p className="text-zinc-500 text-sm text-center py-8">No hay próximos partidos programados.</p>
      )}
    </div>
  );
}