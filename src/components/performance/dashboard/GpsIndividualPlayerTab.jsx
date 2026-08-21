import React, { useState, useEffect, useMemo } from "react";
import { isGoalkeeper } from "@/components/squad/squadConstants";
import GpsPlayerMatchSidebar from "./GpsPlayerMatchSidebar";
import GpsPlayerMatchAnalysis from "./GpsPlayerMatchAnalysis";
import GpsPlayerMatchReports from "./GpsPlayerMatchReports";

export default function GpsIndividualPlayerTab({
  players,
  matchReports,
  matchGpsByMatch,
  competitionProfiles,
  squadName,
  squadId,
  seasonId,
}) {
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [subtab, setSubtab] = useState("analysis");

  // Auto-select first player and reset when squad changes
  useEffect(() => {
    const availablePlayers = players.filter((p) => !isGoalkeeper(p));
    if (availablePlayers.length > 0 && !availablePlayers.some((p) => p.id === selectedPlayerId)) {
      setSelectedPlayerId(availablePlayers[0].id);
    }
    if (availablePlayers.length === 0) {
      setSelectedPlayerId("");
    }
  }, [players, selectedPlayerId]);

  const selectedPlayer = useMemo(() => players.find((p) => p.id === selectedPlayerId), [players, selectedPlayerId]);
  const competitionProfile = useMemo(() => competitionProfiles.find((p) => p.player_id === selectedPlayerId), [competitionProfiles, selectedPlayerId]);

  const availablePlayers = players.filter((p) => !isGoalkeeper(p));

  if (availablePlayers.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-500 text-sm">No hay jugadores en el plantel activo.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <GpsPlayerMatchSidebar
        players={availablePlayers}
        selectedPlayerId={selectedPlayerId}
        onSelectPlayer={setSelectedPlayerId}
      />
      <div className="flex-1 min-w-0 space-y-4">
        {/* Subtabs */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
          <button
            onClick={() => setSubtab("analysis")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${subtab === "analysis" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"}`}
          >
            Análisis
          </button>
          <button
            onClick={() => setSubtab("reports")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${subtab === "reports" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"}`}
          >
            Reportes
          </button>
        </div>

        {subtab === "analysis" && selectedPlayer && (
          <GpsPlayerMatchAnalysis
            player={selectedPlayer}
            matchReports={matchReports}
            matchGpsByMatch={matchGpsByMatch}
            competitionProfile={competitionProfile}
            squadName={squadName}
            squadId={squadId}
            seasonId={seasonId}
          />
        )}

        {subtab === "reports" && selectedPlayer && (
          <GpsPlayerMatchReports
            playerId={selectedPlayer.id}
            squadId={squadId}
            seasonId={seasonId}
          />
        )}
      </div>
    </div>
  );
}