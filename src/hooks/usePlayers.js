import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function usePlayers() {
  const { data: players = [], isLoading } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list("name", 100),
    staleTime: 1000 * 60 * 5, // 5 min cache
  });

  // Map by ID for O(1) lookup
  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));

  // Also map by normalized name as fallback
  const playerNameMap = Object.fromEntries(
    players.map((p) => [p.name?.trim().toLowerCase(), p])
  );

  function getPlayer(player_id, player_name) {
    if (player_id && playerMap[player_id]) return playerMap[player_id];
    if (player_name) return playerNameMap[player_name?.trim().toLowerCase()] || null;
    return null;
  }

  return { players, playerMap, getPlayer, isLoading };
}