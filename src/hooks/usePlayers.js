import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useEffect } from "react";

export function usePlayers() {
  const queryClient = useQueryClient();
  const { data: players = [], isLoading } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list("name", 100),
    staleTime: 1000 * 60 * 5, // 5 min cache
  });

  // Suscribirse a cambios en Player para actualizar fotos en tiempo real
  useEffect(() => {
    const unsubscribe = base44.entities.Player.subscribe((event) => {
      if (event.type === "update") {
        // Invalidar el cache para refrescar la lista de jugadores
        queryClient.invalidateQueries({ queryKey: ["players"] });
      }
    });
    return unsubscribe;
  }, [queryClient]);

  // Map by ID for O(1) lookup
  const playerMap = Object.fromEntries(players.map((p) => [p.id, { ...p, name: p.full_name || `${p.first_name} ${p.last_name}`.trim() }]));

  // Normalizar nombre: remover tildes y convertir a minúsculas
  const normalizeName = (name) => {
    return (name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  };

  // Obtener palabras clave del nombre (apellido + nombre)
  const getNameWords = (name) => {
    return normalizeName(name)
      .split(/\s+/)
      .filter(w => w.length > 2);
  };

  // Verificar si dos nombres coinciden (matching flexible)
  const namesMatch = (name1, name2) => {
    const words1 = getNameWords(name1);
    const words2 = getNameWords(name2);
    if (words1.length === 0 || words2.length === 0) return false;
    // Al menos 2 palabras deben coincidir (maneja variaciones de formato)
    const matches = words1.filter(w => words2.includes(w)).length;
    return matches >= Math.max(1, Math.min(words1.length, words2.length) - 1);
  };

  function getPlayer(player_id, player_name) {
    if (player_id && playerMap[player_id]) return playerMap[player_id];
    if (player_name) {
      // Buscar coincidencia exacta primero
      const normalized = normalizeName(player_name);
      for (const p of players) {
        const pName = p.full_name || `${p.first_name} ${p.last_name}`.trim();
        if (normalizeName(pName) === normalized) return { ...p, name: pName };
      }
      // Si no encuentra exacta, buscar por matching flexible
      for (const p of players) {
        const pName = p.full_name || `${p.first_name} ${p.last_name}`.trim();
        if (namesMatch(player_name, pName)) return { ...p, name: pName };
      }
    }
    return null;
  }

  const playersWithName = players.map((p) => ({ ...p, name: p.full_name || `${p.first_name} ${p.last_name}`.trim() }));

  return { players: playersWithName, playerMap, getPlayer, isLoading };
}