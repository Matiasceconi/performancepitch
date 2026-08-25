import React, { useEffect, useMemo, useState } from "react";
import { isGoalkeeper } from "@/components/squad/squadConstants";
import GpsPlayerMatchSidebar from "./GpsPlayerMatchSidebar";
import GpsPlayerMatchAnalysis from "./GpsPlayerMatchAnalysis";
import GpsPlayerMatchReports from "./GpsPlayerMatchReports";

const SECTIONS = [
  ["summary", "Resumen"],
  ["matches", "Partidos"],
  ["evolution", "Evolución"],
  ["comparison", "Comparación"],
  ["reports", "Reportes"],
];

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
  const [section, setSection] = useState("summary");
  const availablePlayers = useMemo(() => players.filter((player) => !isGoalkeeper(player)), [players]);

  useEffect(() => {
    if (availablePlayers.length && !availablePlayers.some((player) => player.id === selectedPlayerId)) {
      setSelectedPlayerId(availablePlayers[0].id);
    } else if (!availablePlayers.length) {
      setSelectedPlayerId("");
    }
  }, [availablePlayers, selectedPlayerId]);

  const selectedPlayer = players.find((player) => player.id === selectedPlayerId);
  const competitionProfile = competitionProfiles.find((profile) => profile.player_id === selectedPlayerId);

  if (!availablePlayers.length) {
    return <div className="py-16 text-center text-sm text-zinc-500">No hay jugadores en el plantel activo.</div>;
  }

  return (
    <div className="flex flex-col xl:flex-row gap-4">
      <GpsPlayerMatchSidebar
        players={availablePlayers}
        selectedPlayerId={selectedPlayerId}
        onSelectPlayer={(id) => { setSelectedPlayerId(id); setSection("summary"); }}
      />
      <div className="flex-1 min-w-0 space-y-4">
        <div className="overflow-x-auto">
          <div className="flex min-w-max items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
            {SECTIONS.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${section === key ? "bg-emerald-600 text-white shadow-sm" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {section === "reports" ? (
          <GpsPlayerMatchReports playerId={selectedPlayer?.id} squadId={squadId} seasonId={seasonId} />
        ) : selectedPlayer ? (
          <GpsPlayerMatchAnalysis
            view={section}
            player={selectedPlayer}
            matchReports={matchReports}
            matchGpsByMatch={matchGpsByMatch}
            competitionProfile={competitionProfile}
            squadName={squadName}
            squadId={squadId}
            seasonId={seasonId}
          />
        ) : null}
      </div>
    </div>
  );
}
