import React from "react";
import PlayerPhoto from "@/components/player/PlayerPhoto";
import { CLUB_BRAND } from "@/lib/clubBrand";
import MatchBlockCard from "@/components/matchReports/MatchBlockCard";

export default function MatchReportPreview({ reportData, staffComment, onCommentChange }) {
  const { player, selected } = reportData;

  return (
    <div className="space-y-4">
      {/* Header del informe */}
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute right-4 top-4 opacity-30">
          <img src={CLUB_BRAND.logoUrl} alt="" className="w-16 h-16 object-contain" />
        </div>
        <div className="relative flex items-start gap-4">
          <PlayerPhoto
            player={player}
            className="w-20 h-20 rounded-xl object-cover border-2 border-white/30 shrink-0"
            fallbackClassName="w-20 h-20 rounded-xl bg-white/10 border-2 border-white/30 flex items-center justify-center"
            textClassName="text-2xl font-bold text-white"
          />
          <div className="flex-1 min-w-0">
            <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wide">Informe individual de rendimiento</p>
            <h2 className="text-2xl font-black leading-tight mt-0.5">{player?.full_name || "Jugador"}</h2>
            <p className="text-emerald-100 text-sm mt-1">{[player?.position, player?.squad_name, player?.division].filter(Boolean).join(" · ")}</p>
            <p className="text-emerald-50 text-xs mt-1">{selected.length} {selected.length === 1 ? "partido" : "partidos"} analizado{selected.length === 1 ? "" : "s"}</p>
          </div>
        </div>
      </div>

      {/* Per-match blocks (puntual, sin comparación) */}
      {selected.map((matchData) => (
        <MatchBlockCard key={matchData.match.id} matchData={matchData} />
      ))}

      {/* Comentario del staff */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <label className="text-sm font-bold text-white block mb-2">Comentario del área de Rendimiento</label>
        <textarea
          value={staffComment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Ej: Buen volumen total y valores altos de alta intensidad."
          rows={4}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white resize-none focus:outline-none focus:border-emerald-600"
        />
        <p className="text-[11px] text-zinc-500 mt-1.5">Este comentario se incluirá en el PDF si fue completado.</p>
      </div>
    </div>
  );
}