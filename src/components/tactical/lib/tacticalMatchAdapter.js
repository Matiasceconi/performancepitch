// Adaptador para importar formaciones desde MatchReport hacia la pizarra.
// No modifica MatchReport; solo lee sus datos para construir elementos.

import { createElement } from "./tacticalElementFactory";
import { buildFormationSlots } from "@/components/matches/tabs/formationSlots";

// Construye elementos de jugador desde la formación oficial de un partido
export function buildElementsFromMatch(match, players = []) {
  const system = match?.tactical_system || "4-3-3";
  const positions = Array.isArray(match?.formation_positions) ? match.formation_positions : [];
  const playerMap = new Map((players || []).map((p) => [p.id, p]));

  if (positions.length > 0) {
    // Usar formation_positions existente
    return positions.map((pos) => {
      const player = playerMap.get(pos.player_id);
      const isGK = pos.position_group === "Arquero" || player?.position === "Arquero";
      return createElement(isGK ? "goalkeeper" : "player", {
        x: (pos.x / 100) * 1600,
        y: (pos.y / 100) * 900,
        data: {
          player_id: pos.player_id || null,
          number: player?.jersey_number || pos.shirt_number || "",
          label: player?.full_name || pos.player_name || "",
          position: pos.slot_key || pos.position_group || "",
          color: "#3b82f6",
          isRival: false,
          captain: match?.captain_player_id === pos.player_id,
          snapshot: player
            ? { name: player.full_name, number: player.jersey_number, position: player.position, photo_url: player.photo_url }
            : null,
        },
      });
    });
  }

  // Sin formation_positions: usar buildFormationSlots para posiciones por defecto
  const slots = buildFormationSlots(system);
  return slots.map((slot, i) => {
    const player = players[i];
    const isGK = slot.slot_key === "ARQ";
    return createElement(isGK ? "goalkeeper" : "player", {
      x: (slot.x / 100) * 1600,
      y: (slot.y / 100) * 900,
      data: {
        player_id: player?.id || null,
        number: player?.jersey_number || "",
        label: player?.full_name || "",
        position: slot.slot_key,
        color: "#3b82f6",
        isRival: false,
        snapshot: player
          ? { name: player.full_name, number: player.jersey_number, position: player.position, photo_url: player.photo_url }
          : null,
      },
    });
  });
}

// Construye elementos del rival desde el partido
export function buildRivalElementsFromMatch(match) {
  const system = "4-4-2";
  const slots = buildFormationSlots(system);
  return slots.map((slot) => {
    const isGK = slot.slot_key === "ARQ";
    return createElement(isGK ? "goalkeeper" : "generic_player", {
      x: (slot.x / 100) * 1600,
      y: Math.abs(slot.y - 100) * 9, // espejar al lado rival
      data: {
        isRival: true,
        color: "#ef4444",
        position: slot.slot_key,
      },
    });
  });
}

// Construye el payload de formación oficial desde los elementos de la pizarra
// para aplicar explícitamente a MatchReport
export function buildOfficialFormationFromElements(elements, captainPlayerId = null) {
  const ownPlayers = (elements || []).filter(
    (el) => ["player", "goalkeeper"].includes(el.type) && !el.data?.isRival && el.data?.player_id
  );
  const positions = ownPlayers.map((el) => ({
    player_id: el.data.player_id,
    x: (el.x / 1600) * 100,
    y: (el.y / 900) * 100,
    slot_key: el.data.position || "",
    position_group: el.data.position || "",
    shirt_number: el.data.number ? Number(el.data.number) : null,
  }));
  return {
    tactical_system: null, // se calcula o se mantiene el existente
    formation_positions: positions,
    captain_player_id: captainPlayerId,
    formation_updated_at: new Date().toISOString(),
  };
}