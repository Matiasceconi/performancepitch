import { base44 } from "@/api/base44Client";

export function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function getPlayerName(player) {
  return player?.full_name || [player?.first_name, player?.last_name].filter(Boolean).join(" ") || player?.name || "Jugador";
}

export function getPlayerNumber(player) {
  return player?.jersey_number || player?.number || "—";
}

export function getPositionGroup(position) {
  const normalized = normalizeText(position);
  if (["arquero", "portero", "goalkeeper", "gk"].some((value) => normalized.includes(value))) return "Arquero";
  if (["defensor", "central", "lateral", "back", "marcador"].some((value) => normalized.includes(value))) return "Defensor";
  if (["medioc", "volante", "medio", "midfielder", "interior"].some((value) => normalized.includes(value))) return "Mediocampista";
  if (["delanter", "punta", "extremo", "wing", "forward", "atacante"].some((value) => normalized.includes(value))) return "Delantero";
  return "Sin categoría";
}

export function isUnavailableStatus(status) {
  const normalized = normalizeText(status);
  return normalized.includes("lesion") || normalized.includes("no disponible") || normalized.includes("suspend");
}

function isActiveMembership(membership) {
  const status = normalizeText(membership?.status || "activo");
  return !["fuera del plantel", "fuera_del_plantel", "inactivo", "prestamo", "prestamo"].includes(status);
}

function sortPlayers(a, b) {
  const groupOrder = { "Arquero": 1, "Defensor": 2, "Mediocampista": 3, "Delantero": 4, "Sin categoría": 5 };
  const groupDiff = (groupOrder[getPositionGroup(a.position)] || 9) - (groupOrder[getPositionGroup(b.position)] || 9);
  if (groupDiff) return groupDiff;
  return Number(getPlayerNumber(a)) - Number(getPlayerNumber(b)) || getPlayerName(a).localeCompare(getPlayerName(b));
}

export function buildNameVariants(player) {
  const full = normalizeText(getPlayerName(player));
  const parts = full.split(" ").filter((part) => part.length > 2);
  return Array.from(new Set([full, ...parts, parts.slice(-2).join(" ").trim()].filter(Boolean)));
}

export async function loadMatchCallupState(match, fallbackPlayers = []) {
  const [callups, memberships, loadedPlayers] = await Promise.all([
    base44.entities.MatchCallup.filter({ match_id: match.id }, "created_date", 500).catch(() => []),
    match.squad_id ? base44.entities.SquadMembership.filter({ squad_id: match.squad_id }, "player_name", 800).catch(() => []) : Promise.resolve([]),
    fallbackPlayers.length ? Promise.resolve(fallbackPlayers) : base44.entities.Player.list("full_name", 800),
  ]);

  const allPlayers = loadedPlayers || [];
  const playerMap = new Map(allPlayers.map((player) => [player.id, player]));
  const activeMembershipIds = new Set((memberships || []).filter(isActiveMembership).map((membership) => membership.player_id));

  let availablePlayers = allPlayers.filter((player) => {
    if (player.active === false) return false;
    if (activeMembershipIds.size) return activeMembershipIds.has(player.id);
    if (match.squad_id) return player.squad_id === match.squad_id;
    return true;
  });

  const uniqueAvailable = new Map(availablePlayers.map((player) => [player.id, player]));
  const savedCallups = (callups || []).filter((callup) => callup.status !== "desconvocado");
  savedCallups.forEach((callup) => {
    const player = playerMap.get(callup.player_id);
    if (player && player.active !== false) uniqueAvailable.set(player.id, player);
  });
  availablePlayers = Array.from(uniqueAvailable.values()).sort(sortPlayers);

  return {
    availablePlayers,
    savedCallups,
    selectedPlayerIds: Array.from(new Set(savedCallups.map((callup) => callup.player_id).filter(Boolean))),
    allCallups: callups || [],
    playerMap,
  };
}

export async function saveMatchCallups({ match, selectedPlayerIds, availablePlayers, allCallups }) {
  const selected = Array.from(new Set(selectedPlayerIds.filter(Boolean)));
  const selectedSet = new Set(selected);
  const now = new Date().toISOString();
  const playerMap = new Map(availablePlayers.map((player) => [player.id, player]));
  const grouped = {};
  (allCallups || []).forEach((callup) => {
    if (!grouped[callup.player_id]) grouped[callup.player_id] = [];
    grouped[callup.player_id].push(callup);
  });

  const updates = [];
  const creates = [];

  selected.forEach((playerId) => {
    const player = playerMap.get(playerId) || {};
    const existing = grouped[playerId]?.[0];
    const payload = {
      match_id: match.id,
      player_id: playerId,
      squad_id: match.squad_id || "",
      club_id: match.club_id || "defensa-y-justicia",
      status: "convocado",
      callup_key: `${match.id}:${playerId}`,
      player_name: getPlayerName(player),
      player_number: Number(getPlayerNumber(player)) || null,
      player_position: player.position || "",
      updated_at: now,
    };
    if (existing) updates.push({ id: existing.id, ...payload });
    else creates.push({ ...payload, created_at: now });
    (grouped[playerId] || []).slice(1).forEach((duplicate) => updates.push({ id: duplicate.id, status: "desconvocado", updated_at: now }));
  });

  Object.entries(grouped).forEach(([playerId, rows]) => {
    if (!selectedSet.has(playerId)) rows.forEach((row) => {
      if (row.status !== "desconvocado") updates.push({ id: row.id, status: "desconvocado", updated_at: now });
    });
  });

  if (updates.length) await base44.entities.MatchCallup.bulkUpdate(updates);
  if (creates.length) await base44.entities.MatchCallup.bulkCreate(creates);

  const names = selected.map((id) => getPlayerName(playerMap.get(id))).filter(Boolean);
  await base44.entities.MatchReport.update(match.id, { squad_called: selected, squad_names: names });
  return loadMatchCallupState(match, availablePlayers);
}