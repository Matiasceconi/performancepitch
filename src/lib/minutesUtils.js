// Reglas únicas de validez para registros de MinutesRecord.
// Un registro de minutos solo es válido si depende de un partido real,
// activo (no archivado/eliminado), del plantel correspondiente, y con minutes > 0.

export function buildActiveMatchMap(matches) {
  const map = {};
  (matches || []).forEach((m) => {
    if (m.status !== "archivado") map[m.id] = m;
  });
  return map;
}

// options.squadId: si se pasa, exige que el partido pertenezca a ese plantel
// options.requirePositive: si es true (default), exige minutes > 0
export function getValidMinuteRecords(records, matches, options = {}) {
  const { squadId, requirePositive = true } = options;
  const matchMap = buildActiveMatchMap(matches);
  return (records || []).filter((r) => {
    const match = r.match_id ? matchMap[r.match_id] : null;
    if (!match) return false;
    if (squadId && match.squad_id !== squadId) return false;
    if (requirePositive && !(r.minutes > 0)) return false;
    return true;
  });
}