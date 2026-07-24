// Resolución de identidad institucional para la pizarra.
// Prioridad: InstitutionProfile -> activeSquad -> paleta neutra.

const NEUTRAL = {
  name: "PerformancePitch",
  shortName: "PP",
  logoUrl: null,
  colors: {
    primary: "#3b82f6",
    secondary: "#22c55e",
    accent: "#facc15",
    onAccent: "#1a1a1a",
    background: "#0a0a0a",
  },
};

export function resolveTacticalBrand(workspace) {
  if (!workspace) return NEUTRAL;
  const { clubBrand, activeSquad, institutionProfile } = workspace;

  // InstitutionProfile tiene prioridad
  if (institutionProfile && institutionProfile.official_name) {
    return {
      name: institutionProfile.official_name,
      shortName: institutionProfile.short_name || institutionProfile.abbreviation || "PP",
      logoUrl: institutionProfile.shield_url || institutionProfile.horizontal_logo_url || null,
      colors: {
        primary: institutionProfile.brand_primary || NEUTRAL.colors.primary,
        secondary: institutionProfile.brand_secondary || NEUTRAL.colors.secondary,
        accent: institutionProfile.brand_accent || NEUTRAL.colors.accent,
        onAccent: pickOnColor(institutionProfile.brand_accent || NEUTRAL.colors.accent),
        background: institutionProfile.brand_background || NEUTRAL.colors.background,
      },
    };
  }

  // clubBrand del WorkspaceContext
  if (clubBrand && clubBrand.name) {
    return {
      name: clubBrand.name,
      shortName: clubBrand.shortName || clubBrand.name?.slice(0, 3).toUpperCase() || "PP",
      logoUrl: clubBrand.logoUrl || null,
      colors: {
        primary: clubBrand.colors?.primary || NEUTRAL.colors.primary,
        secondary: clubBrand.colors?.secondary || NEUTRAL.colors.secondary,
        accent: clubBrand.colors?.accent || NEUTRAL.colors.accent,
        onAccent: clubBrand.colors?.onAccent || NEUTRAL.colors.onAccent,
        background: clubBrand.colors?.background || NEUTRAL.colors.background,
      },
    };
  }

  // activeSquad como respaldo
  if (activeSquad && activeSquad.name) {
    return {
      name: activeSquad.club_name || activeSquad.name,
      shortName: activeSquad.club_short_name || activeSquad.name?.slice(0, 3).toUpperCase() || "PP",
      logoUrl: activeSquad.club_logo_url || null,
      colors: {
        primary: activeSquad.brand_primary || NEUTRAL.colors.primary,
        secondary: activeSquad.brand_secondary || NEUTRAL.colors.secondary,
        accent: activeSquad.brand_accent || NEUTRAL.colors.accent,
        onAccent: pickOnColor(activeSquad.brand_accent || NEUTRAL.colors.accent),
        background: NEUTRAL.colors.background,
      },
    };
  }

  return NEUTRAL;
}

// Calcula color de texto sobre un fondo (contraste WCAG simple)
function pickOnColor(hex) {
  if (!hex) return "#1a1a1a";
  const c = hex.replace("#", "");
  if (c.length < 6) return "#1a1a1a";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#1a1a1a" : "#ffffff";
}