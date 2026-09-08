import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { scoutingErrorResponse, requireScoutingAccess, type ScoutingAction } from "../../shared/scoutingAccess.ts";

const STAGES = ["discovered","longlist","watching","shortlist","priority","due_diligence","negotiation","signed","discarded"];
const RECOMMENDATIONS = ["strong_recommend","recommend","monitor","doubt","do_not_recommend"];

function nowISO() { return new Date().toISOString(); }
function clean(value: any, max = 2000) { return String(value ?? "").trim().slice(0, max); }
function num(value: any): number | null { const n = Number(value); return Number.isFinite(n) ? n : null; }
function date(value: any): string | null { const v = clean(value, 20); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; }
function normalizeName(value: any) {
  return clean(value, 300).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s'-]/g, " ").replace(/\s+/g, " ").trim();
}
function stableProspectKey(orgId: string, name: string, birthDate?: string | null, club?: string) {
  return [orgId, normalizeName(name), birthDate || "sin_fecha", normalizeName(club || "sin_club")].join("|");
}
function actorName(user: any) { return user?.full_name || user?.name || user?.email || "Usuario"; }
function isSameOrg(record: any, organizationId: string) { return record && record.organization_id === organizationId; }

async function resolveOrganization(base44: any) {
  const profiles = await base44.asServiceRole.entities.InstitutionProfile.filter({ active: true }, "created_date", 20).catch(() => []);
  const profile = profiles[0] || null;
  // En esta app cada instalación representa un club. InstitutionProfile es la raíz
  // estable disponible hoy; cuando exista Organization, este helper será el único punto a migrar.
  return { organization_id: profile?.id || "performancepitch-default", institution: profile };
}

async function getById(base44: any, entity: string, id: string) {
  if (!id) return null;
  const rows = await base44.asServiceRole.entities[entity].filter({ id }, "-created_date", 1).catch(() => []);
  return rows[0] || null;
}

async function assignableUsers(base44: any) {
  const [accessRows, users] = await Promise.all([
    base44.asServiceRole.entities.UserAccess.filter({ active: true }, "staff_name", 500).catch(() => []),
    base44.asServiceRole.entities.User.list("full_name", 500).catch(() => []),
  ]);
  const byEmail = new Map(users.map((u: any) => [String(u.email || "").toLowerCase(), u]));
  return accessRows.map((a: any) => {
    const u = byEmail.get(String(a.user_email || "").toLowerCase());
    return {
      id: u?.id || a.staff_id || a.id,
      staff_id: a.staff_id || null,
      name: a.user_name || a.staff_name || u?.full_name || a.user_email,
      email: a.user_email,
      role: a.role || "",
    };
  });
}

function averageFit(payload: any) {
  const buckets = [payload.technical_scores, payload.tactical_scores, payload.physical_scores, payload.mental_scores, payload.market_scores];
  const values: number[] = [];
  for (const bucket of buckets) {
    for (const raw of Object.values(bucket || {})) {
      const value = Number(raw);
      if (Number.isFinite(value) && value >= 0 && value <= 10) values.push(value);
    }
  }
  if (!values.length) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10);
}

function bucketAverage(bucket: any): number | null {
  const values = Object.values(bucket || {}).map(Number).filter((value) => Number.isFinite(value) && value >= 0 && value <= 10);
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function reportSummary(report: any) {
  if (!report) return null;
  return {
    id: report.id,
    observation_date: report.observation_date,
    recommendation: report.recommendation,
    fit_score: report.fit_score,
    confidence_score: report.confidence_score,
    sample_quality: report.sample_quality,
    role_profile_id: report.role_profile_id,
    role_profile_name: report.role_profile_name,
    summary: report.summary,
    category_scores: {
      technical: bucketAverage(report.technical_scores),
      tactical: bucketAverage(report.tactical_scores),
      physical: bucketAverage(report.physical_scores),
      mental: bucketAverage(report.mental_scores),
      market: bucketAverage(report.market_scores),
    },
  };
}

async function overview(base44: any, organizationId: string, capabilities: any) {
  const [prospects, needs, assignments, reports, watchlists, watchlistItems, roleProfiles, squads, players, staff, shadowPlans, shadowSlots, meetings, decisions] = await Promise.all([
    base44.asServiceRole.entities.ScoutingProspect.filter({ organization_id: organizationId }, "-updated_at", 1000).catch(() => []),
    base44.asServiceRole.entities.RecruitmentNeed.filter({ organization_id: organizationId }, "-updated_at", 500).catch(() => []),
    base44.asServiceRole.entities.ScoutingAssignment.filter({ organization_id: organizationId }, "-created_at", 1000).catch(() => []),
    base44.asServiceRole.entities.ScoutingReport.filter({ organization_id: organizationId }, "-observation_date", 2000).catch(() => []),
    base44.asServiceRole.entities.ScoutingWatchlist.filter({ organization_id: organizationId, active: true }, "name", 300).catch(() => []),
    base44.asServiceRole.entities.ScoutingWatchlistItem.filter({ organization_id: organizationId, status: "active" }, "order", 3000).catch(() => []),
    base44.asServiceRole.entities.ScoutingRoleProfile.filter({ organization_id: organizationId, active: true }, "name", 300).catch(() => []),
    base44.asServiceRole.entities.Squad.filter({ active: true }, "name", 100).catch(() => []),
    base44.asServiceRole.entities.Player.filter({ active: true }, "full_name", 3000).catch(() => []),
    assignableUsers(base44),
    base44.asServiceRole.entities.ShadowSquadPlan.filter({ organization_id: organizationId, status: { $ne: "archived" } }, "-updated_at", 200).catch(() => []),
    base44.asServiceRole.entities.ShadowSquadSlot.filter({ organization_id: organizationId, status: { $ne: "remove" } }, "rank", 2000).catch(() => []),
    base44.asServiceRole.entities.RecruitmentMeeting.filter({ organization_id: organizationId, status: { $ne: "archived" } }, "-meeting_date", 300).catch(() => []),
    base44.asServiceRole.entities.RecruitmentDecision.filter({ organization_id: organizationId }, "-created_at", 2000).catch(() => []),
  ]);
  return { capabilities, prospects, needs, assignments, reports, watchlists, watchlist_items: watchlistItems, role_profiles: roleProfiles, squads, players, staff, shadow_plans: shadowPlans, shadow_slots: shadowSlots, meetings, decisions };
}

async function linkProspectToNeed(base44: any, organizationId: string, prospectId: string, needId: string) {
  if (!needId) return null;
  const need = await getById(base44, "RecruitmentNeed", needId);
  if (!isSameOrg(need, organizationId)) throw new Error("Necesidad de recruitment no encontrada");
  const prospectIds = [...new Set([...(need.prospect_ids || []), prospectId])];
  return base44.asServiceRole.entities.RecruitmentNeed.update(need.id, { prospect_ids: prospectIds, updated_at: nowISO() });
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "overview");
    const permissionByAction: Record<string, ScoutingAction> = {
      overview: "view",
      prospect_detail: "view",
      create_prospect: "create",
      update_prospect: "edit",
      change_stage: "edit",
      create_need: "create",
      update_need: "edit",
      link_prospect_to_need: "edit",
      create_assignment: "create",
      update_assignment: "edit",
      create_report: "create",
      create_watchlist: "create",
      add_watchlist_item: "edit",
      remove_watchlist_item: "edit",
      create_role_profile: "create",
      update_role_profile: "edit",
      comparison: "view",
      create_shadow_plan: "create",
      update_shadow_plan: "edit",
      save_shadow_slot: "edit",
      create_meeting: "create",
      update_meeting: "edit",
      meeting_detail: "view",
      record_meeting_decision: "edit",
    };
    const permission = permissionByAction[action];
    if (!permission) return Response.json({ error: "Acción de Scouting no válida" }, { status: 400 });
    const access = await requireScoutingAccess(base44, user, permission, body.squad_id || null);
    const { organization_id: organizationId, institution } = await resolveOrganization(base44);

    if (action === "overview") {
      const data = await overview(base44, organizationId, access.capabilities);
      return Response.json({ ...data, organization_id: organizationId, institution });
    }

    if (action === "prospect_detail") {
      const prospect = await getById(base44, "ScoutingProspect", String(body.prospect_id || ""));
      if (!isSameOrg(prospect, organizationId)) return Response.json({ error: "Prospecto no encontrado" }, { status: 404 });
      const [reports, assignments, events, items, watchlists, needs, roleProfiles] = await Promise.all([
        base44.asServiceRole.entities.ScoutingReport.filter({ organization_id: organizationId, prospect_id: prospect.id }, "-observation_date", 500).catch(() => []),
        base44.asServiceRole.entities.ScoutingAssignment.filter({ organization_id: organizationId, prospect_id: prospect.id }, "-created_at", 500).catch(() => []),
        base44.asServiceRole.entities.RecruitmentPipelineEvent.filter({ organization_id: organizationId, prospect_id: prospect.id }, "-created_at", 500).catch(() => []),
        base44.asServiceRole.entities.ScoutingWatchlistItem.filter({ organization_id: organizationId, prospect_id: prospect.id, status: "active" }, "order", 500).catch(() => []),
        base44.asServiceRole.entities.ScoutingWatchlist.filter({ organization_id: organizationId, active: true }, "name", 300).catch(() => []),
        base44.asServiceRole.entities.RecruitmentNeed.filter({ organization_id: organizationId }, "-updated_at", 500).catch(() => []),
        base44.asServiceRole.entities.ScoutingRoleProfile.filter({ organization_id: organizationId, active: true }, "name", 300).catch(() => []),
      ]);
      return Response.json({ capabilities: access.capabilities, prospect, reports, assignments, pipeline_events: events, watchlist_items: items, watchlists, needs, role_profiles: roleProfiles });
    }

    if (action === "create_prospect") {
      const fullName = clean(body.full_name || [body.first_name, body.last_name].filter(Boolean).join(" "), 300);
      if (!fullName) return Response.json({ error: "El nombre del prospecto es obligatorio" }, { status: 400 });
      const birthDate = date(body.birth_date);
      const currentClub = clean(body.current_club_name, 300);
      const prospectKey = stableProspectKey(organizationId, fullName, birthDate, currentClub);
      const duplicate = await base44.asServiceRole.entities.ScoutingProspect.filter({ organization_id: organizationId, prospect_key: prospectKey }, "-created_at", 2).catch(() => []);
      if (duplicate.length) return Response.json({ error: "Ya existe un prospecto con la misma identidad, fecha de nacimiento y club", existing_prospect_id: duplicate[0].id }, { status: 409 });
      const stage = STAGES.includes(body.pipeline_stage) ? body.pipeline_stage : "discovered";
      const created = await base44.asServiceRole.entities.ScoutingProspect.create({
        organization_id: organizationId,
        prospect_key: prospectKey,
        status: "active",
        pipeline_stage: stage,
        first_name: clean(body.first_name, 120),
        last_name: clean(body.last_name, 120),
        full_name: fullName,
        normalized_name: normalizeName(fullName),
        birth_date: birthDate,
        nationality: clean(body.nationality, 120),
        second_nationality: clean(body.second_nationality, 120),
        position: clean(body.position, 120),
        secondary_positions: Array.isArray(body.secondary_positions) ? body.secondary_positions.map((x: any) => clean(x, 120)).filter(Boolean) : [],
        role_profile_ids: Array.isArray(body.role_profile_ids) ? body.role_profile_ids : [],
        dominant_leg: ["right","left","both","unknown"].includes(body.dominant_leg) ? body.dominant_leg : "unknown",
        height_cm: num(body.height_cm), weight_kg: num(body.weight_kg), photo_url: clean(body.photo_url, 1000),
        current_club_name: currentClub, current_club_id: clean(body.current_club_id, 200), current_competition: clean(body.current_competition, 300), country: clean(body.country, 120),
        market_value_estimate: num(body.market_value_estimate), market_value_currency: clean(body.market_value_currency, 10) || "USD",
        contract_end_date: date(body.contract_end_date), ownership_status: ["owned","loan","free_agent","unknown"].includes(body.ownership_status) ? body.ownership_status : "unknown",
        agent_name: clean(body.agent_name, 300), agent_contact: clean(body.agent_contact, 500), passport_notes: clean(body.passport_notes, 1000), foreign_player_status: clean(body.foreign_player_status, 300),
        availability_status: ["unknown","available","potentially_available","not_available"].includes(body.availability_status) ? body.availability_status : "unknown",
        availability_verified_at: clean(body.availability_verified_at, 100), availability_source: clean(body.availability_source, 500),
        source_type: ["manual","provider","scout_report","referral","other"].includes(body.source_type) ? body.source_type : "manual",
        source_name: clean(body.source_name, 300), external_ids: body.external_ids || {}, tags: Array.isArray(body.tags) ? body.tags.map((x: any) => clean(x, 100)).filter(Boolean) : [], internal_notes: clean(body.internal_notes, 5000),
        created_by_id: user.id, created_by_name: actorName(user), created_at: nowISO(), updated_by_id: user.id, updated_by_name: actorName(user), updated_at: nowISO(),
      });
      await base44.asServiceRole.entities.RecruitmentPipelineEvent.create({ organization_id: organizationId, prospect_id: created.id, recruitment_need_id: clean(body.recruitment_need_id, 200), from_stage: "", to_stage: stage, reason: "Alta de prospecto", decision_note: clean(body.decision_note, 2000), actor_user_id: user.id, actor_name: actorName(user), created_at: nowISO() });
      if (body.recruitment_need_id) await linkProspectToNeed(base44, organizationId, created.id, body.recruitment_need_id);
      return Response.json({ prospect: created });
    }

    if (action === "update_prospect") {
      const prospect = await getById(base44, "ScoutingProspect", String(body.prospect_id || ""));
      if (!isSameOrg(prospect, organizationId)) return Response.json({ error: "Prospecto no encontrado" }, { status: 404 });
      const allowed = ["first_name","last_name","full_name","birth_date","nationality","second_nationality","position","secondary_positions","role_profile_ids","dominant_leg","height_cm","weight_kg","photo_url","current_club_name","current_club_id","current_competition","country","market_value_estimate","market_value_currency","contract_end_date","ownership_status","agent_name","agent_contact","passport_notes","foreign_player_status","availability_status","availability_verified_at","availability_source","source_type","source_name","external_ids","tags","internal_notes","status"];
      const changes: any = {};
      for (const key of allowed) if (body[key] !== undefined) changes[key] = body[key];
      if (changes.full_name) changes.normalized_name = normalizeName(changes.full_name);
      if (changes.birth_date !== undefined) changes.birth_date = date(changes.birth_date);
      if (changes.contract_end_date !== undefined) changes.contract_end_date = date(changes.contract_end_date);
      const nextName = changes.full_name || prospect.full_name;
      const nextBirth = changes.birth_date !== undefined ? changes.birth_date : prospect.birth_date;
      const nextClub = changes.current_club_name !== undefined ? changes.current_club_name : prospect.current_club_name;
      changes.prospect_key = stableProspectKey(organizationId, nextName, nextBirth, nextClub);
      changes.updated_by_id = user.id; changes.updated_by_name = actorName(user); changes.updated_at = nowISO();
      const updated = await base44.asServiceRole.entities.ScoutingProspect.update(prospect.id, changes);
      return Response.json({ prospect: updated });
    }

    if (action === "change_stage") {
      const prospect = await getById(base44, "ScoutingProspect", String(body.prospect_id || ""));
      if (!isSameOrg(prospect, organizationId)) return Response.json({ error: "Prospecto no encontrado" }, { status: 404 });
      const stage = clean(body.to_stage, 80);
      if (!STAGES.includes(stage)) return Response.json({ error: "Etapa de pipeline inválida" }, { status: 400 });
      if (stage === prospect.pipeline_stage) return Response.json({ prospect });
      const updated = await base44.asServiceRole.entities.ScoutingProspect.update(prospect.id, { pipeline_stage: stage, updated_by_id: user.id, updated_by_name: actorName(user), updated_at: nowISO() });
      await base44.asServiceRole.entities.RecruitmentPipelineEvent.create({ organization_id: organizationId, prospect_id: prospect.id, recruitment_need_id: clean(body.recruitment_need_id, 200), from_stage: prospect.pipeline_stage || "", to_stage: stage, reason: clean(body.reason, 1000) || "Cambio de etapa", decision_note: clean(body.decision_note, 3000), evidence_report_ids: Array.isArray(body.evidence_report_ids) ? body.evidence_report_ids : [], actor_user_id: user.id, actor_name: actorName(user), created_at: nowISO() });
      return Response.json({ prospect: updated });
    }

    if (action === "create_need") {
      const title = clean(body.title, 300);
      if (!title) return Response.json({ error: "El título de la necesidad es obligatorio" }, { status: 400 });
      const created = await base44.asServiceRole.entities.RecruitmentNeed.create({ organization_id: organizationId, squad_id: clean(body.squad_id, 200), squad_name: clean(body.squad_name, 200), season_id: clean(body.season_id, 100), title, position: clean(body.position, 120), role_profile_id: clean(body.role_profile_id, 200), priority: ["low","medium","high","critical"].includes(body.priority) ? body.priority : "medium", time_horizon: ["current_window","next_window","6_months","12_months","24_months"].includes(body.time_horizon) ? body.time_horizon : "next_window", reason: clean(body.reason, 3000), current_player_id: clean(body.current_player_id, 200), requirements: body.requirements || {}, budget_min: num(body.budget_min), budget_max: num(body.budget_max), budget_currency: clean(body.budget_currency, 10) || "USD", status: "open", prospect_ids: [], owner_user_id: clean(body.owner_user_id, 200), owner_name: clean(body.owner_name, 300), target_date: date(body.target_date), notes: clean(body.notes, 5000), created_by_id: user.id, created_by_name: actorName(user), created_at: nowISO(), updated_at: nowISO() });
      return Response.json({ need: created });
    }

    if (action === "update_need") {
      const need = await getById(base44, "RecruitmentNeed", String(body.need_id || ""));
      if (!isSameOrg(need, organizationId)) return Response.json({ error: "Necesidad no encontrada" }, { status: 404 });
      const allowed = ["squad_id","squad_name","season_id","title","position","role_profile_id","priority","time_horizon","reason","current_player_id","requirements","budget_min","budget_max","budget_currency","status","owner_user_id","owner_name","target_date","notes"];
      const changes: any = { updated_at: nowISO() };
      for (const key of allowed) if (body[key] !== undefined) changes[key] = body[key];
      if (changes.target_date !== undefined) changes.target_date = date(changes.target_date);
      if (["filled","cancelled"].includes(changes.status)) changes.closed_at = nowISO();
      const updated = await base44.asServiceRole.entities.RecruitmentNeed.update(need.id, changes);
      return Response.json({ need: updated });
    }

    if (action === "link_prospect_to_need") {
      const prospect = await getById(base44, "ScoutingProspect", String(body.prospect_id || ""));
      if (!isSameOrg(prospect, organizationId)) return Response.json({ error: "Prospecto no encontrado" }, { status: 404 });
      const need = await linkProspectToNeed(base44, organizationId, prospect.id, String(body.need_id || ""));
      return Response.json({ need });
    }

    if (action === "create_assignment") {
      const prospect = await getById(base44, "ScoutingProspect", String(body.prospect_id || ""));
      if (!isSameOrg(prospect, organizationId)) return Response.json({ error: "Prospecto no encontrado" }, { status: 404 });
      if (!body.assigned_to_user_id) return Response.json({ error: "Seleccioná un scout/responsable" }, { status: 400 });
      const created = await base44.asServiceRole.entities.ScoutingAssignment.create({ organization_id: organizationId, prospect_id: prospect.id, recruitment_need_id: clean(body.recruitment_need_id, 200), assigned_to_user_id: clean(body.assigned_to_user_id, 200), assigned_to_name: clean(body.assigned_to_name, 300), assigned_by_user_id: user.id, assigned_by_name: actorName(user), assignment_type: ["video","live_match","data_review","background_check","follow_up"].includes(body.assignment_type) ? body.assignment_type : "video", match_date: date(body.match_date), match_label: clean(body.match_label, 300), competition: clean(body.competition, 300), video_url: clean(body.video_url, 1200), instructions: clean(body.instructions, 4000), due_date: date(body.due_date), priority: ["low","medium","high","critical"].includes(body.priority) ? body.priority : "medium", status: "pending", created_at: nowISO(), updated_at: nowISO() });
      return Response.json({ assignment: created });
    }

    if (action === "update_assignment") {
      const assignment = await getById(base44, "ScoutingAssignment", String(body.assignment_id || ""));
      if (!isSameOrg(assignment, organizationId)) return Response.json({ error: "Asignación no encontrada" }, { status: 404 });
      const allowed = ["assigned_to_user_id","assigned_to_name","assignment_type","match_date","match_label","competition","video_url","instructions","due_date","priority","status"];
      const changes: any = { updated_at: nowISO() };
      for (const key of allowed) if (body[key] !== undefined) changes[key] = body[key];
      if (changes.match_date !== undefined) changes.match_date = date(changes.match_date);
      if (changes.due_date !== undefined) changes.due_date = date(changes.due_date);
      if (changes.status === "completed") changes.completed_at = nowISO();
      const updated = await base44.asServiceRole.entities.ScoutingAssignment.update(assignment.id, changes);
      return Response.json({ assignment: updated });
    }

    if (action === "create_report") {
      const prospect = await getById(base44, "ScoutingProspect", String(body.prospect_id || ""));
      if (!isSameOrg(prospect, organizationId)) return Response.json({ error: "Prospecto no encontrado" }, { status: 404 });
      const observationDate = date(body.observation_date) || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
      const recommendation = RECOMMENDATIONS.includes(body.recommendation) ? body.recommendation : "monitor";
      const derivedFit = averageFit(body);
      const fitScore = num(body.fit_score) ?? derivedFit;
      const created = await base44.asServiceRole.entities.ScoutingReport.create({ organization_id: organizationId, prospect_id: prospect.id, recruitment_need_id: clean(body.recruitment_need_id, 200), assignment_id: clean(body.assignment_id, 200), report_type: ["video","live","data","background","composite"].includes(body.report_type) ? body.report_type : "video", observation_date: observationDate, match_date: date(body.match_date), match_label: clean(body.match_label, 300), competition: clean(body.competition, 300), opponent: clean(body.opponent, 300), minutes_observed: num(body.minutes_observed), role_profile_id: clean(body.role_profile_id, 200), role_profile_name: clean(body.role_profile_name, 300), technical_scores: body.technical_scores || {}, tactical_scores: body.tactical_scores || {}, physical_scores: body.physical_scores || {}, mental_scores: body.mental_scores || {}, market_scores: body.market_scores || {}, technical_note: clean(body.technical_note, 5000), tactical_note: clean(body.tactical_note, 5000), physical_note: clean(body.physical_note, 5000), mental_note: clean(body.mental_note, 5000), market_note: clean(body.market_note, 5000), strengths: Array.isArray(body.strengths) ? body.strengths.map((x: any) => clean(x, 500)).filter(Boolean) : [], risks: Array.isArray(body.risks) ? body.risks.map((x: any) => clean(x, 500)).filter(Boolean) : [], questions_to_verify: Array.isArray(body.questions_to_verify) ? body.questions_to_verify.map((x: any) => clean(x, 500)).filter(Boolean) : [], clips: Array.isArray(body.clips) ? body.clips : [], attachments: Array.isArray(body.attachments) ? body.attachments : [], recommendation, fit_score: fitScore === null ? null : Math.max(0, Math.min(100, fitScore)), confidence_score: Math.max(0, Math.min(100, num(body.confidence_score) ?? 50)), sample_quality: ["low","medium","high"].includes(body.sample_quality) ? body.sample_quality : "medium", summary: clean(body.summary, 7000), status: body.status === "draft" ? "draft" : "submitted", author_user_id: user.id, author_name: actorName(user), created_at: nowISO(), updated_at: nowISO() });
      if (body.assignment_id) {
        const assignment = await getById(base44, "ScoutingAssignment", body.assignment_id);
        if (isSameOrg(assignment, organizationId) && assignment.prospect_id === prospect.id) await base44.asServiceRole.entities.ScoutingAssignment.update(assignment.id, { status: "completed", report_id: created.id, completed_at: nowISO(), updated_at: nowISO() });
      }
      return Response.json({ report: created, fit_method: body.fit_score == null && derivedFit != null ? "promedio transparente de criterios 0-10" : "manual" });
    }

    if (action === "create_watchlist") {
      const name = clean(body.name, 300);
      if (!name) return Response.json({ error: "El nombre de la lista es obligatorio" }, { status: 400 });
      const created = await base44.asServiceRole.entities.ScoutingWatchlist.create({ organization_id: organizationId, name, description: clean(body.description, 2000), watchlist_type: ["longlist","shortlist","shadow_squad","monitoring","custom"].includes(body.watchlist_type) ? body.watchlist_type : "custom", recruitment_need_id: clean(body.recruitment_need_id, 200), squad_id: clean(body.squad_id, 200), season_id: clean(body.season_id, 100), visibility: ["private","department","club"].includes(body.visibility) ? body.visibility : "department", owner_user_id: user.id, owner_name: actorName(user), active: true, created_at: nowISO(), updated_at: nowISO() });
      return Response.json({ watchlist: created });
    }

    if (action === "add_watchlist_item") {
      const [watchlist, prospect] = await Promise.all([getById(base44, "ScoutingWatchlist", String(body.watchlist_id || "")), getById(base44, "ScoutingProspect", String(body.prospect_id || ""))]);
      if (!isSameOrg(watchlist, organizationId) || !isSameOrg(prospect, organizationId)) return Response.json({ error: "Lista o prospecto no encontrado" }, { status: 404 });
      const existing = await base44.asServiceRole.entities.ScoutingWatchlistItem.filter({ organization_id: organizationId, watchlist_id: watchlist.id, prospect_id: prospect.id, status: "active" }, "-added_at", 1).catch(() => []);
      if (existing[0]) return Response.json({ item: existing[0] });
      const created = await base44.asServiceRole.entities.ScoutingWatchlistItem.create({ organization_id: organizationId, watchlist_id: watchlist.id, prospect_id: prospect.id, recruitment_need_id: clean(body.recruitment_need_id, 200), order: num(body.order) ?? 0, priority: ["low","medium","high","critical"].includes(body.priority) ? body.priority : "medium", status: "active", note: clean(body.note, 2000), added_by_id: user.id, added_by_name: actorName(user), added_at: nowISO() });
      return Response.json({ item: created });
    }

    if (action === "remove_watchlist_item") {
      const item = await getById(base44, "ScoutingWatchlistItem", String(body.item_id || ""));
      if (!isSameOrg(item, organizationId)) return Response.json({ error: "Elemento no encontrado" }, { status: 404 });
      const updated = await base44.asServiceRole.entities.ScoutingWatchlistItem.update(item.id, { status: "removed", removed_at: nowISO() });
      return Response.json({ item: updated });
    }

    if (action === "create_role_profile") {
      const name = clean(body.name, 300);
      if (!name) return Response.json({ error: "El nombre del perfil de rol es obligatorio" }, { status: 400 });
      const created = await base44.asServiceRole.entities.ScoutingRoleProfile.create({ organization_id: organizationId, name, position_group: clean(body.position_group, 120), position: clean(body.position, 120), description: clean(body.description, 3000), tactical_model: clean(body.tactical_model, 3000), technical_criteria: Array.isArray(body.technical_criteria) ? body.technical_criteria : [], tactical_criteria: Array.isArray(body.tactical_criteria) ? body.tactical_criteria : [], physical_criteria: Array.isArray(body.physical_criteria) ? body.physical_criteria : [], mental_criteria: Array.isArray(body.mental_criteria) ? body.mental_criteria : [], market_criteria: Array.isArray(body.market_criteria) ? body.market_criteria : [], age_min: num(body.age_min), age_max: num(body.age_max), preferred_foot: ["any","right","left","both"].includes(body.preferred_foot) ? body.preferred_foot : "any", min_height_cm: num(body.min_height_cm), max_market_value: num(body.max_market_value), market_currency: clean(body.market_currency, 10) || "USD", tags: Array.isArray(body.tags) ? body.tags.map((x: any) => clean(x, 100)).filter(Boolean) : [], active: true, version: 1, created_by_id: user.id, created_by_name: actorName(user), created_at: nowISO(), updated_by_id: user.id, updated_at: nowISO() });
      return Response.json({ role_profile: created });
    }

    if (action === "update_role_profile") {
      const profile = await getById(base44, "ScoutingRoleProfile", String(body.role_profile_id || ""));
      if (!isSameOrg(profile, organizationId)) return Response.json({ error: "Perfil de rol no encontrado" }, { status: 404 });
      const allowed = ["name","position_group","position","description","tactical_model","technical_criteria","tactical_criteria","physical_criteria","mental_criteria","market_criteria","age_min","age_max","preferred_foot","min_height_cm","max_market_value","market_currency","tags","active"];
      const changes: any = { version: Number(profile.version || 1) + 1, updated_by_id: user.id, updated_at: nowISO() };
      for (const key of allowed) if (body[key] !== undefined) changes[key] = body[key];
      const updated = await base44.asServiceRole.entities.ScoutingRoleProfile.update(profile.id, changes);
      return Response.json({ role_profile: updated });
    }

    return Response.json({ error: "Acción no implementada" }, { status: 400 });
  } catch (error) {
    return scoutingErrorResponse(error);
  }
}
