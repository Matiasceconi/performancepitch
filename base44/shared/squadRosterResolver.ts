// Resolución central del plantel operativo real para una fecha.
// Usa SquadMembership (status: "activo", effective_from/effective_to) +
// DailySquadStatus (movimientos temporales del día).
// No utiliza Player.squad_id como fuente definitiva.

function isTemporaryActive(ds: any): boolean {
  return !!(
    ds &&
    ds.temporary &&
    ds.active_in_target_squad &&
    ds.movement_status !== 'finalizado' &&
    ds.target_squad_id
  );
}

// Resuelve el contexto operativo de un jugador para una fecha:
// plantel efectivo, temporada y organización.
export async function resolvePlayerContextForDate(base44: any, playerId: string, date: string) {
  if (!playerId || !date) return null;

  const player = await base44.asServiceRole.entities.Player.get(playerId).catch(() => null);
  if (!player) return null;

  // 1. Membresía vigente en la fecha
  const memberships = await base44.asServiceRole.entities.SquadMembership.filter(
    { player_id: playerId, status: 'activo' },
    '-effective_from',
    50
  );
  const validMembership = memberships.find((m: any) => {
    if (m.effective_from && m.effective_from > date) return false;
    if (m.effective_to && m.effective_to < date) return false;
    return true;
  });

  let baseSquadId = validMembership?.squad_id || player.squad_id || '';
  let baseSquadName = validMembership?.squad_name || '';

  // 2. Movimiento temporal del día
  const dayStatuses = await base44.asServiceRole.entities.DailySquadStatus.filter(
    { date, player_id: playerId },
    '-updated_at',
    5
  );
  const ds = dayStatuses[0];

  let effectiveSquadId = baseSquadId;
  let effectiveSquadName = baseSquadName;

  if (isTemporaryActive(ds) && ds.target_squad_id !== baseSquadId) {
    effectiveSquadId = ds.target_squad_id;
    effectiveSquadName = ds.target_squad_name || '';
  }

  // 3. Temporada del plantel efectivo
  let seasonId = '';
  if (effectiveSquadId) {
    const squad = await base44.asServiceRole.entities.Squad.get(effectiveSquadId).catch(() => null);
    if (squad) {
      effectiveSquadName = effectiveSquadName || squad.name;
      seasonId = squad.season || '';
    }
  }

  return {
    player,
    squad_id: effectiveSquadId,
    squad_name: effectiveSquadName,
    season_id: seasonId,
    organization_id: player.club_id || '',
    ds,
    membership: validMembership || null,
  };
}

// Resuelve la lista de jugadores de un plantel para una fecha,
// aplicando movimientos temporales (excluye los que se fueron temporalmente,
// incluye visitantes temporales).
export async function resolveSquadRosterForDate(base44: any, squadId: string, date: string) {
  if (!squadId || !date) return [];

  const [memberships, dayStatuses] = await Promise.all([
    base44.asServiceRole.entities.SquadMembership.filter(
      { squad_id: squadId, status: 'activo' },
      '-effective_from',
      500
    ),
    base44.asServiceRole.entities.DailySquadStatus.filter(
      { date },
      '-updated_at',
      500
    ),
  ]);

  // Membresías estables vigentes en la fecha
  const stableMembers = memberships.filter((m: any) => {
    if (m.effective_from && m.effective_from > date) return false;
    if (m.effective_to && m.effective_to < date) return false;
    return true;
  });

  const statusById: Record<string, any> = {};
  dayStatuses.forEach((ds: any) => { statusById[ds.player_id] = ds; });

  // IDs a buscar: estables + visitantes temporales hacia este plantel
  const allPlayerIds = new Set<string>();
  stableMembers.forEach((m: any) => allPlayerIds.add(m.player_id));
  dayStatuses.forEach((ds: any) => {
    if (isTemporaryActive(ds) && ds.target_squad_id === squadId) {
      allPlayerIds.add(ds.player_id);
    }
  });

  // Fetch jugadores por ids (en lotes)
  const idList = Array.from(allPlayerIds);
  const playerMap: Record<string, any> = {};
  for (let i = 0; i < idList.length; i += 100) {
    const batch = idList.slice(i, i + 100);
    const rows = await base44.asServiceRole.entities.Player.filter(
      { id: { $in: batch }, active: { $ne: false } },
      'last_name',
      500
    );
    rows.forEach((p: any) => { playerMap[p.id] = p; });
  }

  const result: any[] = [];
  const seen = new Set<string>();

  // Membresías estables, excluyendo los que se fueron temporalmente
  stableMembers.forEach((m: any) => {
    const player = playerMap[m.player_id];
    if (!player) return;
    const ds = statusById[m.player_id];
    if (isTemporaryActive(ds) && ds.target_squad_id !== squadId) return;
    result.push({ player, ds: ds || null, membership: m });
    seen.add(m.player_id);
  });

  // Visitantes temporales hacia este plantel
  dayStatuses.forEach((ds: any) => {
    if (isTemporaryActive(ds) && ds.target_squad_id === squadId && !seen.has(ds.player_id)) {
      const player = playerMap[ds.player_id];
      if (player) {
        result.push({ player, ds, membership: null });
        seen.add(ds.player_id);
      }
    }
  });

  return result;
}