import { base44 } from "@/api/base44Client";

export const SESSION_MD_CODES = ["MD-8", "MD-7", "MD-6", "MD-5", "MD-4", "MD-3", "MD-2", "MD-1", "MD", "MD+1", "MD+2", "MD+3", "Libre", "Otro"];

function compact(value) {
  return String(value || "").trim();
}

// ── Cálculo de MD desde un partido objetivo ────────────────────────────────
function parseDate(s) {
  if (!s) return null;
  return new Date(`${s}T12:00:00`);
}
function diffDays(a, b) {
  const da = parseDate(a), db = parseDate(b);
  if (!da || !db) return 0;
  return Math.round((da.getTime() - db.getTime()) / 86400000);
}
export function calculateMdCode(sessionDate, targetMatchDate) {
  if (!sessionDate || !targetMatchDate) return "";
  const diff = diffDays(targetMatchDate, sessionDate);
  if (diff === 0) return "MD";
  return `MD-${diff}`;
}
export function calculatePreviousMdCode(sessionDate, previousMatchDate) {
  if (!sessionDate || !previousMatchDate) return "";
  const diff = diffDays(sessionDate, previousMatchDate);
  if (diff === 0) return "MD";
  return `MD+${diff}`;
}
export function buildDisplayMdLabel(mdCode, previousMdCode) {
  if (mdCode && previousMdCode) return `${previousMdCode} / ${mdCode}`;
  return mdCode || previousMdCode || "";
}

export function buildPlanKey(plan = {}) {
  return [compact(plan.organization_id) || "org", compact(plan.squad_id), compact(plan.season_id), compact(plan.week_start)].join(":");
}

export function isArchivedPlan(plan = {}) {
  const status = String(plan.status || plan.migration_status || "").toLowerCase();
  return plan.archived === true || plan.operational === false || status === "superseded" || status === "archived" || status.includes("archiv") || status.includes("legacy_conflict") || status.includes("duplicate_archived");
}

export function operationalPlans(plans = []) {
  return (plans || []).filter((plan) => !isArchivedPlan(plan));
}

export function linkedSessionIdsFromDay(day = {}) {
  const fromDay = Array.isArray(day.linked_session_ids) ? day.linked_session_ids : [];
  const fromBlocks = (day.blocks || []).map((block) => block.session_id).filter(Boolean);
  return [...new Set([...fromDay, ...fromBlocks])];
}

export function normalizePlanDays(days = []) {
  return (days || []).filter(Boolean).map((day, index) => ({
    ...day,
    day_id: day.day_id || `day-${index + 1}`,
    date: day.date || "",
    order: Number.isFinite(Number(day.order)) ? Number(day.order) : index,
    md: day.md || day.match_day_code || day.md_code || "",
    physical_objective: day.physical_objective || day.objetivo_fisico || day.objetivo || "",
    is_rest_day: Boolean(day.is_rest_day || day.auto_free || day.md === "Libre" || day.day_type === "rest"),
    match_id: day.match_id || day.partido_id || "",
    calendar_event_id: day.calendar_event_id || day.day_event_id || "",
    linked_session_ids: linkedSessionIdsFromDay(day),
  })).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

export function normalizeWeeklyPlanDay(day = {}, index = 0) {
  const md = day.md_code || day.match_day_code || day.md || "";
  return {
    ...day,
    day_id: day.id,
    weekly_plan_day_id: day.id,
    date: day.date || "",
    order: Number.isFinite(Number(day.order)) ? Number(day.order) : index,
    md,
    match_day_code: md,
    previous_md_code: day.previous_md_code || "",
    display_md_label: day.display_md_label || buildDisplayMdLabel(md, day.previous_md_code || ""),
    physical_objective: day.physical_objective || day.objetivo_fisico || day.objetivo || "",
    is_rest_day: day.day_type === "rest" || md === "Libre",
    linked_session_ids: Array.isArray(day.linked_session_ids) ? day.linked_session_ids : [],
    blocks: Array.isArray(day.blocks) ? day.blocks : [],
  };
}

export function daysForPlan(plan = {}, weeklyPlanDays = []) {
  if (Array.isArray(plan?.operational_days) && plan.operational_days.length) return normalizePlanDays(plan.operational_days);
  const activeDays = (weeklyPlanDays || [])
    .filter((day) => day.weekly_plan_id === plan?.id && day.active !== false)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .map((day, index) => normalizeWeeklyPlanDay(day, index));
  if (activeDays.length) return activeDays;
  return normalizePlanDays(plan?.days_data || []);
}

export function normalizePlanDay(day = {}) {
  const md = day.md || day.md_code || day.match_day_code || "";
  return {
    match_day_code: md,
    microcycle_day: md,
    session_objective: day.physical_objective || day.objetivo_fisico || day.objetivo || "",
    weekly_plan_day_id: day.weekly_plan_day_id || day.id || day.day_id || "",
    day_type: day.day_type || (day.is_rest_day ? "rest" : md === "MD" && day.match_id ? "match" : "training"),
    match_id: day.match_id || "",
    calendar_event_id: day.calendar_event_id || "",
  };
}

function sameScope(plan, squadId, seasonId) {
  const sameSquad = !squadId || !plan.squad_id || plan.squad_id === squadId;
  const sameSeason = !seasonId || !plan.season_id || plan.season_id === seasonId;
  return sameSquad && sameSeason;
}

// ── Resolver el plan generado que contiene una fecha ──────────────────────
export function findPlanDay(plans = [], { date, squadId, seasonId, weeklyPlanId, weeklyPlanDayId, weeklyPlanDays = [] }) {
  const candidates = operationalPlans(plans).filter((plan) => sameScope(plan, squadId, seasonId));
  if (weeklyPlanId && weeklyPlanDayId) {
    const plan = candidates.find((item) => item.id === weeklyPlanId);
    const day = daysForPlan(plan, weeklyPlanDays).find((item) => item.weekly_plan_day_id === weeklyPlanDayId || item.day_id === weeklyPlanDayId);
    if (day) return { plan, day, values: normalizePlanDay(day) };
  }
  if (!date) return null;
  const matches = candidates
    .filter((plan) => {
      const start = plan.period_start || plan.week_start;
      const end = plan.period_end || plan.week_end;
      if (start && date < start) return false;
      if (end && date > end) return false;
      return daysForPlan(plan, weeklyPlanDays).some((day) => day.date === date);
    })
    .sort((a, b) => String(b.updated_at || b.week_start || "").localeCompare(String(a.updated_at || a.week_start || "")));
  const plan = matches[0];
  const day = plan ? daysForPlan(plan, weeklyPlanDays).find((item) => item.date === date) : null;
  return day ? { plan, day, values: normalizePlanDay(day) } : null;
}

// ── Defaults para SessionForm: MD calculado desde el partido objetivo ─────
// El objetivo físico NO se hereda del Plan; la sesión es la fuente oficial.
export async function getMicrocycleDefaults({ date, squadId, seasonId, weeklyPlanId, weeklyPlanDayId }) {
  if (!date && !weeklyPlanId) return null;
  const [plans, weeklyPlanDays] = await Promise.all([
    squadId ? base44.entities.WeeklyPlan.filter({ squad_id: squadId }, "-week_start", 100) : base44.entities.WeeklyPlan.list("-week_start", 100),
    base44.entities.WeeklyPlanDay.list("date", 5000).catch(() => []),
  ]);
  const match = findPlanDay(plans, { date, squadId, seasonId, weeklyPlanId, weeklyPlanDayId, weeklyPlanDays });
  if (!match) return null;
  // Recalcular MD desde el partido objetivo si existe
  const targetMatchId = match.plan?.target_match_id;
  let calculatedMd = match.values.match_day_code;
  let mdSource = match.plan?.auto_generated ? "calculated" : "legacy";
  if (targetMatchId && date) {
    try {
      const targetMatch = await base44.entities.MatchReport.get(targetMatchId);
      if (targetMatch?.date) {
        calculatedMd = calculateMdCode(date, targetMatch.date);
        mdSource = "calculated";
      }
    } catch { /* sin partido objetivo, usar respaldo */ }
  }
  return {
    plan: match.plan,
    day: match.day,
    values: {
      ...match.values,
      match_day_code: calculatedMd,
      microcycle_day: calculatedMd,
      // session_objective intencionalmente vacío: la sesión es la fuente oficial
      session_objective: "",
      md_source: mdSource,
      target_match_id: targetMatchId || "",
    },
  };
}

// ── Meta efectiva de una sesión: prioriza la sesión, el plan es respaldo ──
export function effectiveSessionMeta(session, planMatch) {
  const defaults = planMatch?.values || {};
  const md = session?.match_day_code || defaults.match_day_code || "";
  const objective = session?.session_objective || defaults.session_objective || "";
  return {
    match_day_code: md,
    microcycle_day: session?.microcycle_day || md,
    session_objective: objective,
    md_source: session?.md_source || (session?.md_manual_override ? "manual_override" : ""),
  };
}

export function planDateRange(days = []) {
  const ordered = normalizePlanDays(days).filter((day) => day.date);
  return { week_start: ordered[0]?.date || "", week_end: ordered[ordered.length - 1]?.date || "" };
}

// ── Invocar el motor de planificación (nueva dirección) ───────────────────
export async function invokeRebuildPlanning({ squadId, seasonId, mode = "execute" }) {
  try {
    const res = await base44.functions.invoke("rebuildWeeklyPlanning", { squad_id: squadId, season_id: seasonId, mode });
    return res?.data || res;
  } catch (error) {
    console.error("invokeRebuildPlanning", error);
    return null;
  }
}

// ── Compatibilidad: ya no sincroniza Plan → Sesión.
// En su lugar invoca el motor que reconstruye desde partidos + sesiones.
export async function syncSessionsWithWeeklyPlan(plan, weeklyPlanDays = []) {
  if (!plan?.squad_id) return 0;
  const result = await invokeRebuildPlanning({ squadId: plan.squad_id, seasonId: plan.season_id, mode: "execute" });
  return result?.sessions_linked || 0;
}

// ── Detectar conflictos de planificación en una sesión ────────────────────
export function detectSessionConflicts(session, planDay) {
  const reasons = [];
  if (!session) return reasons;
  if (planDay && session.date && planDay.date && session.date !== planDay.date) reasons.push("session_date_mismatch");
  if (planDay?.day_type === "match" && String(session.session_type || "").toLowerCase().includes("descanso")) reasons.push("rest_session_on_match_day");
  if (session.md_manual_override && planDay?.md_code && session.match_day_code && session.match_day_code !== planDay.md_code) reasons.push("manual_md_mismatch");
  return reasons;
}