// Helper para cargar y sembrar el único perfil institucional activo.
// Orden de migración: datos institucionales de Squad → identidad neutra para completar en Administración.
// No crea duplicados: si ya existe un perfil activo, lo devuelve.

import { base44 } from "@/api/base44Client";

const GENERIC_SEED = {
  official_name: "Club",
  short_name: "Club",
  abbreviation: "CLUB",
  shield_url: "",
  brand_primary: "#1E293B",
  brand_secondary: "#475569",
  brand_accent: "#0EA5E9",
  language: "Español",
  timezone: "America/Argentina/Buenos_Aires",
  date_format: "DD/MM/YYYY",
  time_format: "24h",
  week_starts_on: "lunes",
  unit_system: "metrico",
  currency: "ARS",
  default_export_format: "PDF",
  default_paper_size: "A4",
  default_orientation: "portrait",
  show_performancepitch_brand: true,
  show_squad_name: true,
  show_season: true,
  show_export_date: true,
};

// Carga el perfil activo. Si no existe, lo siembra desde el primer Squad con
// datos de branding o, si no hay ninguno, desde la paleta legada.
export async function loadOrSeedInstitutionProfile() {
  try {
    const existing = await base44.entities.InstitutionProfile.filter({ active: true }, "-updated_at", 1);
    if (existing && existing.length > 0) {
      return existing[0];
    }
    // Sembrar: buscar el primer squad con datos de branding
    let seed = { ...GENERIC_SEED };
    try {
      const squads = await base44.entities.Squad.filter({ active: true }, "name", 50);
      const branded = squads.find(s => s.club_name || s.brand_primary || s.club_logo_url);
      if (branded) {
        seed = {
          ...seed,
          official_name: branded.club_name || seed.official_name,
          short_name: branded.club_short_name || seed.short_name,
          shield_url: branded.club_logo_url || seed.shield_url,
          brand_primary: branded.brand_primary || seed.brand_primary,
          brand_secondary: branded.brand_secondary || seed.brand_secondary,
          brand_accent: branded.brand_accent || seed.brand_accent,
          default_squad_id: branded.id || undefined,
          default_season: branded.season || seed.default_season,
        };
      }
    } catch { /* squads fetch falló: usar seed legado */ }

    const created = await base44.entities.InstitutionProfile.create({
      ...seed,
      active: true,
      updated_at: new Date().toISOString(),
    });
    return created;
  } catch (err) {
    console.error("loadOrSeedInstitutionProfile error:", err);
    return null;
  }
}

export async function updateInstitutionProfile(id, patch) {
  return base44.entities.InstitutionProfile.update(id, {
    ...patch,
    updated_at: new Date().toISOString(),
  });
}

export function isValidHex(hex) {
  return /^#[0-9A-Fa-f]{6}$/.test(String(hex || ""));
}