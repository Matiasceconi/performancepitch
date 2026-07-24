// Resolvedor de marca dinámico para exportaciones multiclub.
// Reemplaza al CLUB_BRAND hardcodeado por una paleta que se obtiene
// del plantel activo (Squad) o, en su defecto, de una paleta neutra elegante.

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

// Construye el objeto de marca desde el plantel activo.
// Si el plantel no tiene colores configurados, usa paleta neutra.
export function resolveBrand(squad = {}) {
  const primary = squad.brand_primary || NEUTRAL.primary;
  const secondary = squad.brand_secondary || NEUTRAL.secondary;
  const accent = squad.brand_accent || NEUTRAL.accent;
  return {
    name: squad.club_name || squad.name || "Club",
    shortName: squad.club_short_name || (squad.club_name || squad.name || "CLUB").slice(0, 3).toUpperCase(),
    logoUrl: squad.club_logo_url || "",
    season: squad.season || "",
    squadName: squad.name || "Plantel",
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
    },
  };
}

// Versión simplificada para usar en componentes que antes importaban CLUB_BRAND directamente.
// Mantiene compatibilidad con nombres legacy (green, greenDark, yellow, etc.) mapeados a la paleta dinámica.
export function resolveBrandLegacy(squad = {}) {
  const brand = resolveBrand(squad);
  return {
    ...brand,
    colors: {
      ...brand.colors,
      // Alias legacy para compatibilidad con PDFs existentes
      green: brand.colors.primary,
      greenDark: brand.colors.primaryDark,
      greenDeep: brand.colors.primaryDeep,
      yellow: brand.colors.accent,
      yellowDark: brand.colors.accentDark,
      gold: brand.colors.accent,
      black: "#000000",
    },
  };
}