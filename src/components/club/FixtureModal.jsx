import React from "react";
import { X } from "lucide-react";

const COMPETITION_ID = "6a6d7e6852dc4637a1cf1260";

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "short" }); }
  catch { return iso; }
}

export default function FixtureModal({ fixtures, teamName, onClose }) {
  const teamFixtures = (fixtures || [])
    .filter((f) => f.competitionId === COMPETITION_ID && (f.homeTeam === teamName || f.awayTeam === teamName))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Fixture Completo — Clausura Reserva</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="space-y-2">
          {teamFixtures.map((fx, i) => {
            const isHome = fx.homeTeam === teamName;
            const opponent = isHome ? fx.awayTeam : fx.homeTeam;
            const oppLogo = isHome ? fx.awayLogo : fx.homeLogo;
            const status = fx.status === "finished" ? `${fx.homeScore} - ${fx.awayScore}` : fx.status === "scheduled" ? "Programado" : "—";
            return (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/60">
                <span className="text-xs text-zinc-500 w-20 shrink-0">{fx.round || "—"}</span>
                <span className={`text-xs font-bold w-5 shrink-0 ${isHome ? "text-emerald-400" : "text-blue-400"}`}>{isHome ? "L" : "V"}</span>
                {oppLogo ? <img src={oppLogo} alt="" className="w-6 h-6 object-contain shrink-0" onError={(e) => { e.target.style.display = "none"; }} /> : <div className="w-6 h-6 rounded-full bg-zinc-800 shrink-0" />}
                <span className="flex-1 text-sm text-white truncate">vs {opponent}</span>
                <span className="text-xs text-zinc-400 shrink-0">{fmtDate(fx.date)}</span>
                <span className="text-xs font-bold text-white shrink-0 w-20 text-right">{status}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}