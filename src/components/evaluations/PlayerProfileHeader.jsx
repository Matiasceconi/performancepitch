import React from "react";
import { Calendar, Activity, FlaskConical, AlertTriangle, ExternalLink, AlertCircle } from "lucide-react";
import PlayerPhoto from "@/components/player/PlayerPhoto";
import { fmtDate, signalColor, SIGNAL_LABELS } from "@/lib/evaluationChartUtils";

export default function PlayerProfileHeader({ player, sessionCount, lastSession, baselineSessions, activeSignals, onOpenFicha }) {
  if (!player) return null;
  const linked = !!player.id;
  const hasInconsistentLink = player.link_valid === false;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-start gap-4">
        {/* Photo */}
        {linked ? (
          <PlayerPhoto player={player} className="w-16 h-16 rounded-xl object-cover border border-zinc-700 shrink-0" fallbackClassName="w-16 h-16 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center" textClassName="text-xl font-bold text-zinc-400" />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
            <AlertCircle size={24} className="text-red-400" />
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-white">{player.full_name || player.player_name_csv || "Sin vincular"}</h2>
            {hasInconsistentLink && (
              <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-300 text-xs font-semibold border border-red-500/30 flex items-center gap-1">
                <AlertTriangle size={11} /> Vínculo inconsistente — requiere revisión
              </span>
            )}
            {!linked && (
              <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-300 text-xs font-semibold border border-red-500/30">Sin vincular</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400 flex-wrap">
            <span>{player.position || "—"}</span>
            <span>·</span>
            <span>{player.squad_name || "—"}</span>
            {player.age && <><span>·</span><span>{player.age} años</span></>}
            {player.division && <><span>·</span><span>{player.division}</span></>}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 mt-3 text-xs flex-wrap">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Calendar size={13} className="text-blue-400" />
              <span>Última: <span className="text-white font-medium">{lastSession ? fmtDate(lastSession.assessment_date) : "—"}</span></span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Activity size={13} className="text-emerald-400" />
              <span>Fechas: <span className="text-white font-medium">{sessionCount}</span></span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400">
              <FlaskConical size={13} className="text-purple-400" />
              <span>Base: <span className="text-white font-medium">{baselineSessions} fechas</span></span>
            </div>
            {activeSignals > 0 && (
              <div className="flex items-center gap-1.5 text-orange-400">
                <AlertTriangle size={13} />
                <span className="font-medium">{activeSignals} señal(es) activa(s)</span>
              </div>
            )}
          </div>
        </div>

        {/* Open ficha */}
        {linked && onOpenFicha && (
          <button onClick={onOpenFicha} className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium flex items-center gap-1.5 shrink-0">
            <ExternalLink size={14} /> Ficha
          </button>
        )}
      </div>
    </div>
  );
}