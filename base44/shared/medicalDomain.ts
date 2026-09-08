export const AVAILABILITY = [
  "unavailable",
  "physiotherapy",
  "individual_field",
  "modified_training",
  "partial_integration",
  "full_training",
  "available_to_compete",
] as const;

export const REHAB_PHASES = [
  "clinical",
  "rehabilitation",
  "individual_field",
  "partial_integration",
  "full_training",
  "available",
] as const;

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

export function nowISO() {
  return new Date().toISOString();
}

export function normalizeLegacyLaterality(value: any) {
  const text = String(value || "").trim().toLowerCase();
  if (!text || text.includes("no corresponde")) return "not_applicable";
  if (/izq/.test(text)) return "left";
  if (/der/.test(text)) return "right";
  if (/bilat/.test(text)) return "bilateral";
  return "unknown";
}

export function mapLegacyMedicalStatusToAvailability(status: any, rehabStage?: any) {
  const s = String(status || "").toLowerCase();
  const r = String(rehabStage || "").toLowerCase();
  if (s === "alta") return "available_to_compete";
  if (s === "kinesiologia") return "physiotherapy";
  if (r.includes("campo") || r.includes("readapt")) return "individual_field";
  if (r.includes("retorno con el grupo") || r.includes("integraci")) return "partial_integration";
  if (s === "consulta") return "full_training";
  return "unavailable";
}

export function legacyStatusFromAvailability(availability: any, cleared = false) {
  if (cleared || availability === "available_to_compete") return "alta";
  if (availability === "physiotherapy") return "kinesiologia";
  if (["individual_field", "modified_training", "partial_integration", "full_training"].includes(String(availability))) return "en_recuperacion";
  return "lesionado";
}

export function isEpisodeExplicitlyClosed(episode: any) {
  return episode?.episode_state === "closed" || !!episode?.medical_clearance_date;
}

export function effectiveExpectedReturn(episode: any) {
  return episode?.expected_return_date || episode?.fecha_final_tto || null;
}

export function effectiveStartDate(episode: any) {
  return episode?.event_date || episode?.fecha_inicio_tto || null;
}

export function effectiveAvailability(episode: any) {
  if (episode?.availability) return episode.availability;
  if (episode?.medical_clearance_date) return "available_to_compete";
  // Legacy compatibility only. Importantly, fecha_final_tto NEVER implies clearance.
  return mapLegacyMedicalStatusToAvailability(episode?.medical_status, episode?.etapa_rhb);
}

export function chooseCurrentEpisode(episodes: any[]) {
  const active = (episodes || []).filter((e) => !isEpisodeExplicitlyClosed(e));
  if (!active.length) return null;
  return [...active].sort((a, b) => {
    const ad = effectiveStartDate(a) || a.updated_date || a.created_date || "";
    const bd = effectiveStartDate(b) || b.updated_date || b.created_date || "";
    return String(bd).localeCompare(String(ad));
  })[0] || null;
}

export function buildCurrentStatusPayload(episode: any, actor?: any) {
  const at = nowISO();
  if (!episode) {
    return {
      current_status: "disponible",
      availability: "available_to_compete",
      active_episode_id: "",
      restriction_summary: "",
      rehab_phase: "available",
      next_control_date: null,
      medical_clearance_date: null,
      updated_at: at,
      updated_by: actor?.full_name || actor?.email || "Sistema",
      updated_by_id: actor?.id || "",
    };
  }
  const availability = effectiveAvailability(episode);
  const cleared = !!episode.medical_clearance_date;
  return {
    current_status: legacyStatusFromAvailability(availability, cleared),
    availability,
    active_episode_id: episode.id,
    restriction_summary: episode.operational_note || "",
    rehab_phase: episode.rehab_phase || (availability === "physiotherapy" ? "rehabilitation" : availability === "individual_field" ? "individual_field" : availability === "partial_integration" ? "partial_integration" : availability === "full_training" ? "full_training" : undefined),
    next_control_date: episode.next_control_date || null,
    medical_clearance_date: episode.medical_clearance_date || null,
    updated_at: at,
    updated_by: actor?.full_name || actor?.email || "Sistema",
    updated_by_id: actor?.id || "",
  };
}

export function redactEpisodeForOperationalView(episode: any) {
  if (!episode) return episode;
  const {
    private_note,
    preliminary_diagnosis,
    confirmed_diagnosis,
    studies,
    treatment,
    description,
    observaciones,
    medical_clearance_note,
    ...operational
  } = episode;
  return operational;
}

export function redactFollowUpForOperationalView(followUp: any) {
  if (!followUp) return followUp;
  const { private_note, note, ...operational } = followUp;
  return operational;
}

export function buildMedicalEpisodeKey(playerId: string, date: string, type: string, summary: string) {
  return [playerId, date || "", type || "", summary || ""].map((v) => String(v).trim().toLowerCase()).join("|");
}
