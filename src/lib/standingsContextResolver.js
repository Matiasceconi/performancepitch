/**
 * Resolver compartido para determinar la división y competencia activa
 * a partir del plantel activo y las competencias configuradas.
 *
 * Flujo: activeSquadId → Competitions (squad_id / division) → provider_competition_id → API standings
 */

export const DIVISIONS = [
  { id: "primera", label: "Primera División", shortLabel: "Primera" },
  { id: "reserva", label: "Reserva", shortLabel: "Reserva" },
  { id: "juveniles", label: "Juveniles", shortLabel: "Juveniles" },
];

const YOUTH_PATTERNS = [
  /cuart/i, /quint/i, /sext/i, /s[eé]pt/i, /octav/i, /nov[eé]n/i,
  /juvenil/i, /sub-?\s?1[0-9]/i, /\b4\b/, /\b5\b/, /\b6\b/, /\b7\b/, /\b8\b/, /\b9\b/,
];

/**
 * Determina la división a partir del plantel activo.
 * @param {Object} squad - Plantel activo (de WorkspaceContext)
 * @returns {{ division: string, ageCategory: string|null } | null}
 */
export function squadToDivision(squad) {
  if (!squad?.name) return null;
  const name = squad.name.toLowerCase().trim();
  if (name.includes("primera")) return { division: "primera", ageCategory: null };
  if (name.includes("reserva")) return { division: "reserva", ageCategory: null };
  if (YOUTH_PATTERNS.some((re) => re.test(name))) {
    return { division: "juveniles", ageCategory: squad.name };
  }
  return null;
}

/**
 * Normaliza un texto para comparación de nombres de club/competencia.
 */
function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resuelve el contexto completo de standings para el plantel activo.
 *
 * @param {Object} params
 * @param {Object} params.activeSquad - Plantel activo
 * @param {string} params.activeSeasonId - Temporada activa
 * @param {Array} params.internalCompetitions - Registros de Competitions
 * @param {Array} params.apiCompetitions - Competencias desde la API (data.competitions)
 * @returns {Object} { division, ageCategory, competitionId, competitionName, available, reason }
 */
export function resolveActiveStandingsContext({ activeSquad, activeSeasonId, internalCompetitions = [], apiCompetitions = [] }) {
  const squadDivision = squadToDivision(activeSquad);
  const division = squadDivision?.division || "primera";
  const ageCategory = squadDivision?.ageCategory || null;

  // 1. Buscar competencia interna por squad_id
  let internalComp = (internalCompetitions || []).find(
    (c) => c.squad_id === activeSquad?.id && c.active !== false
  );

  // 2. Si no hay por squad_id, buscar por división
  if (!internalComp) {
    internalComp = (internalCompetitions || []).find(
      (c) => c.division === division && c.active !== false
    );
  }

  // 3. Resolver provider_competition_id
  let providerCompId = internalComp?.provider_competition_id || null;

  // 4. Si no hay provider_competition_id, intentar match por nombre con API
  if (!providerCompId && internalComp) {
    const internalNorm = normalizeText(internalComp.name);
    const apiMatch = (apiCompetitions || []).find(
      (a) => normalizeText(a.name).includes(internalNorm) || internalNorm.includes(normalizeText(a.name))
    );
    if (apiMatch) providerCompId = apiMatch.id;
  }

  // 5. Si todavía no hay, usar fallback por división (match por tipo de competencia)
  if (!providerCompId) {
    const fallbackByType = {
      primera: "liga",
      reserva: "torneo",
      juveniles: "juveniles",
    };
    const targetType = fallbackByType[division];
    const fallbackComp = (apiCompetitions || []).find((a) => {
      if (division === "primera") return normalizeText(a.name).includes("liga profesional");
      if (division === "reserva") return normalizeText(a.name).includes("reserve") || normalizeText(a.name).includes("proyeccion");
      return false;
    });
    if (fallbackComp) providerCompId = fallbackComp.id;
  }

  const apiComp = (apiCompetitions || []).find((c) => c.id === providerCompId);

  return {
    division,
    ageCategory,
    competitionId: providerCompId || null,
    competitionName: internalComp?.name || apiComp?.name || null,
    internalCompetitionId: internalComp?.id || null,
    available: !!apiComp,
    reason: !apiComp ? "Sin competencia vinculada en la API para esta división" : null,
  };
}

/**
 * Resuelve la competencia de la API para una división específica (cambio manual).
 */
export function resolveCompetitionByDivision(division, internalCompetitions = [], apiCompetitions = []) {
  // Buscar competencia interna por división
  const internalComp = (internalCompetitions || []).find(
    (c) => c.division === division && c.active !== false
  );

  let providerCompId = internalComp?.provider_competition_id || null;

  // Fallback por nombre
  if (!providerCompId) {
    const apiMatch = (apiCompetitions || []).find((a) => {
      if (division === "primera") return normalizeText(a.name).includes("liga profesional");
      if (division === "reserva") return normalizeText(a.name).includes("reserve") || normalizeText(a.name).includes("proyeccion");
      return false;
    });
    if (apiMatch) providerCompId = apiMatch.id;
  }

  const apiComp = (apiCompetitions || []).find((c) => c.id === providerCompId);

  return {
    division,
    competitionId: providerCompId || null,
    competitionName: internalComp?.name || apiComp?.name || null,
    available: !!apiComp,
    reason: !apiComp ? "Sin competencia vinculada en la API para esta división" : null,
  };
}

/**
 * Mapea el nombre del plantel juvenil a la categoría de FootballYouthStanding.
 * @returns {"4ta"|"5ta"|"6ta"|"7ma"|"8va"|"9na"|null}
 */
const YOUTH_CATEGORY_MAP = [
  { pattern: /cuart/, category: "4ta" },
  { pattern: /quint/, category: "5ta" },
  { pattern: /sext/, category: "6ta" },
  { pattern: /s[eé]pt/, category: "7ma" },
  { pattern: /octav/, category: "8va" },
  { pattern: /nov[eé]n/, category: "9na" },
];

export function squadToYouthCategory(squad) {
  if (!squad?.name) return null;
  const name = squad.name.toLowerCase().trim();
  for (const { pattern, category } of YOUTH_CATEGORY_MAP) {
    if (pattern.test(name)) return category;
  }
  return null;
}

/**
 * Extrae torneos y zonas disponibles de los standings de una competencia.
 */
export function extractTournamentsAndZones(standingsRows) {
  if (!Array.isArray(standingsRows)) return { tournaments: [], zones: [] };
  const tournaments = [...new Set(standingsRows.map((r) => r.tournament).filter(Boolean))];
  const zones = [...new Set(standingsRows.map((r) => r.group).filter(Boolean))];
  return { tournaments, zones };
}

/**
 * Encuentra la zona por defecto: la zona que contiene al club activo, o la primera.
 */
export function findDefaultZone(standingsRows, teamName) {
  if (!Array.isArray(standingsRows) || !standingsRows.length) return null;
  if (teamName) {
    const norm = normalizeText(teamName);
    const teamRow = standingsRows.find((r) => normalizeText(r.teamName) === norm);
    if (teamRow?.group) return teamRow.group;
  }
  return standingsRows[0]?.group || null;
}

/**
 * Encuentra el torneo por defecto: Clausura si existe, sino el primero.
 */
export function findDefaultTournament(tournaments) {
  if (!tournaments?.length) return null;
  const clausura = tournaments.find((t) => normalizeText(t).includes("clausura"));
  return clausura || tournaments[0];
}