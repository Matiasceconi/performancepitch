import { base44 } from "@/api/base44Client";

export const SESSION_MD_CODES = ["MD-6", "MD-5", "MD-4", "MD-3", "MD-2", "MD-1", "MD", "MD+1", "MD+2", "MD+3", "MD+4", "Libre", "Otro"];

function compact(value) {
  return String(value || "").trim();
}

export function buildPlanKey(plan = {}) {
  return [compact(plan.organization_id) || "org", compact(plan.squad_id), compact(plan.season_id), compact(plan.week_start)].join(":");
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
    md: day.md || day.match_day_code || "",
    physical_objective: day.physical_objective || day.objetivo_fisico || day.objetivo || "",
    is_rest_day: Boolean(day.is_rest_day || day.auto_free || day.md === "Libre"),
    match_id: day.match_id || day.partido_id || "",
    calendar_event_id: day.calendar_event_id || day.day_event_id || "",
    linked_session_ids: linkedSessionIdsFromDay(day),
  })).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

export function normalizePlanDay(day = {}) {
  return {
    match_day_code: day.md || "",
    microcycle_day: day.md || "",
    session_objective: day.physical_objective || day.objetivo_fisico || day.objetivo || "",
  };
}

function sameScope(plan, squadId, seasonId) {
  const sameSquad = !squadId || !plan.squad_id || plan.squad_id === squadId;
  const sameSeason = !seasonId || !plan.season_id || plan.season_id === seasonId;
  return sameSquad && sameSeason;
}

export function findPlanDay(plans = [], { date, squadId, seasonId, weeklyPlanId, weeklyPlanDayId }) {
  if (weeklyPlanId && weeklyPlanDayId) {
    const plan = plans.find((item) => item.id === weeklyPlanId && sameScope(item, squadId, seasonId));
    const day = normalizePlanDays(plan?.days_data || []).find((item) => item.day_id === weeklyPlanDayId);
    if (day) return { plan, day, values: normalizePlanDay(day) };
  }
  if (!date) return null;
  const candidates = plans
    .filter((plan) => sameScope(plan, squadId, seasonId))
    .filter((plan) => normalizePlanDays(plan.days_data || []).some((day) => day.date === date))
    .sort((a, b) => String(b.updated_at || b.week_start || "").localeCompare(String(a.updated_at || a.week_start || "")));
  const plan = candidates[0];
  const day = normalizePlanDays(plan?.days_data || []).find((item) => item.date === date);
  return day ? { plan, day, values: normalizePlanDay(day) } : null;
}

export async function getMicrocycleDefaults({ date, squadId, seasonId, weeklyPlanId, weeklyPlanDayId }) {
  if (!date && !weeklyPlanId) return null;
  const plans = squadId ? await base44.entities.WeeklyPlan.filter({ squad_id: squadId }, "-week_start", 100) : await base44.entities.WeeklyPlan.list("-week_start", 100);
  return findPlanDay(plans, { date, squadId, seasonId, weeklyPlanId, weeklyPlanDayId });
}

export function effectiveSessionMeta(session, planMatch) {
  const defaults = planMatch?.values || {};
  const md = session?.md_manual_override ? session.match_day_code : (defaults.match_day_code || session?.match_day_code || "");
  const objective = session?.physical_objective_manual_override ? session.session_objective : (defaults.session_objective || session?.session_objective || "");
  return { match_day_code: md, microcycle_day: md, session_objective: objective };
}

export function planDateRange(days = []) {
  const ordered = normalizePlanDays(days).filter((day) => day.date);
  return { week_start: ordered[0]?.date || "", week_end: ordered[ordered.length - 1]?.date || "" };
}

export async function syncSessionsWithWeeklyPlan(plan) {
  const days = normalizePlanDays(plan?.days_data || []);
  if (!plan?.id || !days.length) return 0;
  const dates = new Set(days.map((day) => day.date).filter(Boolean));
  const sessions = plan.squad_id ? await base44.entities.TrainingSession.filter({ squad_id: plan.squad_id }, "-date", 500) : await base44.entities.TrainingSession.list("-date", 500);
  const scoped = sessions.filter((session) => dates.has(session.date) && (!plan.season_id || !session.season_id || session.season_id === plan.season_id));
  let count = 0;
  const now = new Date().toISOString();
  await Promise.all(scoped.map(async (session) => {
    const day = days.find((item) => item.date === session.date);
    const values = normalizePlanDay(day);
    const patch = { weekly_plan_id: plan.id, weekly_plan_day_id: day.day_id, plan_sync_updated_at: now };
    if (values.match_day_code && !session.md_manual_override && session.match_day_code !== values.match_day_code) {
      patch.match_day_code = values.match_day_code;
      patch.microcycle_day = values.microcycle_day;
    }
    if (values.session_objective && !session.physical_objective_manual_override && session.session_objective !== values.session_objective) {
      patch.session_objective = values.session_objective;
    }
    const changed = Object.entries(patch).some(([key, value]) => session[key] !== value);
    if (changed) {
      count += 1;
      await base44.entities.TrainingSession.update(session.id, patch);
    }
  }));
  const linkedByDay = scoped.reduce((acc, session) => {
    const day = days.find((item) => item.date === session.date);
    if (!day) return acc;
    acc[day.day_id] = acc[day.day_id] || new Set(day.linked_session_ids || []);
    acc[day.day_id].add(session.id);
    return acc;
  }, {});
  const nextDays = days.map((day) => ({ ...day, linked_session_ids: Array.from(linkedByDay[day.day_id] || new Set(day.linked_session_ids || [])) }));
  await base44.entities.WeeklyPlan.update(plan.id, { days_data: nextDays, updated_at: now });
  return count;
}