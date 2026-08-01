import { normalizeClubText } from "@/lib/rivalClubs";

/**
 * Resuelve la identidad canónica de un club a partir de datos del proveedor.
 * Prioridad: RivalClub.shield_url > providerLogo > null (placeholder)
 *
 * @param {Array} clubs - lista de RivalClub
 * @param {Array} mappings - lista de ExternalTeamMapping
 * @param {Object} params - { provider, providerTeamId, providerTeamName, providerLogoUrl }
 * @returns {Object} { rival_club_id, canonicalName, shieldUrl, providerLogo, status, confidence, club }
 */
export function resolveClubIdentity(clubs, mappings, { provider = "api_sports", providerTeamId, providerTeamName, providerLogoUrl } = {}) {
  // 1. Buscar por mapping exacto provider + providerTeamId
  if (providerTeamId != null) {
    const pid = String(providerTeamId);
    const mapping = mappings.find(m => m.provider === provider && String(m.provider_team_id) === pid);
    if (mapping?.rival_club_id) {
      const club = clubs.find(c => c.id === mapping.rival_club_id);
      if (club) {
        return {
          rival_club_id: club.id,
          canonicalName: club.official_name || club.short_name || providerTeamName || "",
          shieldUrl: club.shield_url || null,
          providerLogo: providerLogoUrl || null,
          status: mapping.status || "verified",
          confidence: mapping.confidence || "high",
          club,
        };
      }
    }
  }

  // 2. Buscar por nombre normalizado en RivalClub
  if (providerTeamName) {
    const n = normalizeClubText(providerTeamName);
    if (n) {
      const club = clubs.find(c => {
        const names = [c.official_name, c.short_name, ...(c.aliases || [])]
          .map(normalizeClubText)
          .filter(Boolean);
        return names.includes(n);
      });
      if (club) {
        return {
          rival_club_id: club.id,
          canonicalName: club.official_name || club.short_name || providerTeamName,
          shieldUrl: club.shield_url || null,
          providerLogo: providerLogoUrl || null,
          status: "auto_matched",
          confidence: "medium",
          club,
        };
      }
    }
  }

  // 3. Sin match — usar logo del proveedor como respaldo temporal
  return {
    rival_club_id: null,
    canonicalName: providerTeamName || "",
    shieldUrl: null,
    providerLogo: providerLogoUrl || null,
    status: "unmatched",
    confidence: "low",
    club: null,
  };
}

/**
 * Devuelve la URL del escudo que debe mostrarse.
 * Prioridad: shieldUrl (interno) > providerLogo (API) > null
 */
export function resolveShield(resolved) {
  if (!resolved) return null;
  return resolved.shieldUrl || resolved.providerLogo || null;
}