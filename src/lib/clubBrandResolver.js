// Resolvedor de marca dinámico para exportaciones multiclub.
// Orden de respaldo: InstitutionProfile → Squad (plantel activo) → paleta neutra.
// Mantiene compatibilidad con nombres legacy (green, greenDark, yellow, gold, etc.)
// para no romper los PDF existentes mientras se migran.

const NEUTRAL = {
  primary: "#1E293B",
  secondary: "#475569",
  accent: "#0EA5E9",
  ink: "#0F172A",
  muted: "#64748B",
  panel: "#F8FAFC",
  line: "#E2E8F0",
  white: "#FFFFFF",
};

// Paleta legada de Defensa y Justicia (clubBrand.js) usada solo como respaldo
// de migración cuando no existe InstitutionProfile ni datos en Squad.
const LEGACY_FALLBACK = {
  name: "Defensa y Justicia",
  shortName: "DyJ",
  logoUrl: "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/4379a507a_defensa.png",
  primary: "#00843D",
  secondary: "#005A34",
  accent: "#FFD400",
};

function hexToRgb(hex) {
  const clean = String(hex || "").replace("#", "");
  if (clean.length !== 6) return [0, 0, 0];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

// Luminancia relativa según WCAG para decidir contraste de texto.
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  const toLin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

// Devuelve "#FFFFFF" o "#0F172A" según qué color da mejor contraste sobre el fondo.
export function contrastText(bgHex) {
  return luminance(bgHex) > 0.55 ? "#0F172A" : "#FFFFFF";
}

// Oscurece un color hex por un factor (0-1).
export function darken(hex, factor = 0.18) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - factor), g * (1 - factor), b * (1 - factor));
}

// Aclara un color hex por un factor (0-1).
export function lighten(hex, factor = 0.18) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * factor, g + (255 - g) * factor, b + (255 - b) * factor);
}

// Detecta si el primer argumento es un InstitutionProfile (tiene official_name)
// o un Squad (tiene name/season pero no official_name). Permite que
// resolveBrand(squad) siga funcionando como antes (compatibilidad hacia atrás).
function looksLikeInstitution(obj) {
  return !!obj && typeof obj === "object" && !!obj.official_name;
}

// Resolvedor principal: recibe InstitutionProfile y Squad (respaldo).
// Si se llama con un solo argumento que es un Squad, lo trata como squad-only.
export function resolveInstitutionBrand(institution = null, squad = {}) {
  // Compatibilidad hacia atrás: resolveInstitutionBrand(squad)
  if (!institution && squad) { /* ok, institution null */ }
  if (institution && !looksLikeInstitution(institution) && !squad?.name) {
    // Se llamó como resolveInstitutionBrand(squad) sin segundo arg
    squad = institution;
    institution = null;
  }

  const instPrimary = institution?.brand_primary || squad?.brand_primary || LEGACY_FALLBACK.primary;
  const instSecondary = institution?.brand_secondary || squad?.brand_secondary || LEGACY_FALLBACK.secondary;
  const instAccent = institution?.brand_accent || squad?.brand_accent || LEGACY_FALLBACK.accent;

  const primary = instPrimary || NEUTRAL.primary;
  const secondary = instSecondary || NEUTRAL.secondary;
  const accent = instAccent || NEUTRAL.accent;

  const name = institution?.official_name || squad?.club_name || squad?.name || LEGACY_FALLBACK.name;
  const shortName = institution?.short_name || institution?.abbreviation || squad?.club_short_name || (name).slice(0, 3).toUpperCase() || LEGACY_FALLBACK.shortName;
  const logoUrl = institution?.shield_url || institution?.horizontal_logo_url || squad?.club_logo_url || LEGACY_FALLBACK.logoUrl;
  const season = institution?.default_season || squad?.season || "";
  const squadName = squad?.name || "Plantel";

  return {
    name,
    shortName,
    logoUrl,
    season,
    squadName,
    colors: {
      primary,
      primaryDark: darken(primary, 0.22),
      primaryDeep: darken(primary, 0.4),
      secondary,
      secondaryDark: darken(secondary, 0.22),
      accent,
      accentDark: darken(accent, 0.22),
      ink: NEUTRAL.ink,
      muted: NEUTRAL.muted,
      panel: NEUTRAL.panel,
      line: NEUTRAL.line,
      white: NEUTRAL.white,
      // Texto sobre cada color principal (auto-contraste)
      onPrimary: contrastText(primary),
      onSecondary: contrastText(secondary),
      onAccent: contrastText(accent),
      // Alias legacy para compatibilidad con PDFs existentes
      green: primary,
      greenDark: darken(primary, 0.22),
      greenDeep: darken(primary, 0.4),
      yellow: accent,
      yellowDark: darken(accent, 0.22),
      gold: accent,
      black: "#000000",
    },
  };
}

// Wrapper de compatibilidad: resolveBrand(squad) sigue funcionando como antes.
// Si se pasa un InstitutionProfile como primer arg, se usa como institución.
export function resolveBrand(institutionOrSquad = {}, squad = {}) {
  if (looksLikeInstitution(institutionOrSquad)) {
    return resolveInstitutionBrand(institutionOrSquad, squad);
  }
  // Comportamiento legacy: primer arg es un squad
  return resolveInstitutionBrand(null, institutionOrSquad);
}

// Versión simplificada para componentes que antes importaban CLUB_BRAND directamente.
export function resolveBrandLegacy(squad = {}) {
  return resolveInstitutionBrand(null, squad);
}