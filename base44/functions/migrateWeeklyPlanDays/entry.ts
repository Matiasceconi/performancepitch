import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function isMatchEvent(item) {
  return normalizeText(`${item?.title || ''} ${item?.event_type || ''} ${item?.type || ''}`).includes('partido');
}

function isTravelEvent(item) {
  const text = normalizeText(`${item?.title || ''} ${item?.event_type || ''} ${item?.type || ''}`);
  return text.includes('viaje') || text.includes('traslado') || text.includes('salida');
}

function isRestDay(day, events) {
  const dayText = normalizeText(`${day?.md || ''} ${day?.type || ''} ${day?.event_type || ''}`);
  const eventText = normalizeText(events.map((ev) => `${ev.title || ''} ${ev.event_type || ''} ${ev.type || ''}`).join(' '));
  return day?.is_rest_day === true || day?.auto_free === true || dayText.includes('libre') || dayText.includes('descanso') || eventText.includes('descanso') || eventText.includes('libre');
}

function planKey(plan) {
  return [plan.organization_id || 'org', plan.squad_id || '', plan.season_id || '', plan.week_start || ''].join(':');
}

function orderedDays(plan) {
  return (plan.days_data || []).filter(Boolean).map((day, index) => ({ ...day, __index: index })).sort((a, b) => Number(a.order ?? a.__index) - Number(b.order ?? b.__index));
}

function countBy(values) {
  return values.reduce((acc, value) => {
    if (!value) return acc;
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function dateBetween(date, start, end) {
  if (!date) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function matchForDay(day, events, reports) {
  const byCalendarId = day.calendar_event_id ? events.find((event) => event.id === day.calendar_event_id) : null;
  const byMatchId = day.match_id ? reports.find((report) => report.id === day.match_id) : null;
  const eventMatch = byCalendarId?.match_id ? reports.find((report) => report.id === byCalendarId.match_id) : null;
  const dateMatches = events.filter((event) => event.date === day.date && isMatchEvent(event));
  return { byCalendarId, byMatchId, eventMatch, dateMatches };
}

function dayTypeFor(day, dayEvents, reports) {
  const matchInfo = matchForDay(day, dayEvents, reports);
  if (matchInfo.byCalendarId || matchInfo.byMatchId || matchInfo.eventMatch) return 'match';
  if (dayEvents.some(isTravelEvent)) return 'travel';
  if (isRestDay(day, dayEvents)) return 'rest';
  return 'training';
}

function conflictReason({ day, dateCount, rangeStart, rangeEnd, dayEvents, reports, sessionsForLegacyDay }) {
  const reasons = [];
  if (!day.day_id) reasons.push('missing_legacy_day_id');
  if (!dateBetween(day.date, rangeStart, rangeEnd)) reasons.push('out_of_range');
  if (dateCount[day.date] > 1) reasons.push('duplicate_date');
  const matchInfo = matchForDay(day, dayEvents, reports);
  if ((day.md || day.match_day_code) === 'MD' && !matchInfo.byCalendarId && !matchInfo.byMatchId && !matchInfo.eventMatch) reasons.push('md_without_real_match_link');
  if ((day.calendar_event_id || day.match_id) && !matchInfo.byCalendarId && !matchInfo.byMatchId && !matchInfo.eventMatch) reasons.push('broken_match_reference');
  sessionsForLegacyDay.forEach((session) => {
    if (session.date !== day.date) reasons.push(`session_date_mismatch:${session.id}`);
  });
  return unique(reasons).join(', ');
}

function buildJulyRepairProposal(events, reports) {
  const previousEvent = events.find((event) => event.date === '2026-07-13' && isMatchEvent(event));
  const targetEvent = events.find((event) => event.date === '2026-07-21' && isMatchEvent(event));
  const targetReport = targetEvent?.match_id ? reports.find((report) => report.id === targetEvent.match_id) : null;
  const previousReport = previousEvent?.match_id ? reports.find((report) => report.id === previousEvent.match_id) : null;
  return {
    period_start: '2026-07-14',
    period_end: '2026-07-21',
    previous_match: previousEvent ? { calendar_event_id: previousEvent.id, match_id: previousEvent.match_id || previousReport?.id || '', rival: previousEvent.rival || previousReport?.rival || '', date: previousEvent.date } : null,
    target_match: targetEvent ? { calendar_event_id: targetEvent.id, match_id: targetEvent.match_id || targetReport?.id || '', rival: targetEvent.rival || targetReport?.rival || '', date: targetEvent.date } : null,
    proposed_days: [
      { date: '2026-07-14', md_code: 'MD+1', day_type: 'training' },
      { date: '2026-07-15', md_code: 'MD-6', day_type: 'training' },
      { date: '2026-07-16', md_code: 'MD-5', day_type: 'training' },
      { date: '2026-07-17', md_code: 'MD-4', day_type: 'training' },
      { date: '2026-07-18', md_code: 'MD-3', day_type: 'training' },
      { date: '2026-07-19', md_code: 'MD-2', day_type: 'training' },
      { date: '2026-07-20', md_code: 'MD-1', day_type: 'training' },
      { date: '2026-07-21', md_code: 'MD', day_type: targetEvent ? 'match' : 'training', calendar_event_id: targetEvent?.id || '', match_id: targetEvent?.match_id || targetReport?.id || '' }
    ],
    note: 'Propuesta registrada en dry_run. No modifica sesiones GPS ni days_data.'
  };
}

function analyzePlan({ plan, allPlans, events, reports, sessions, existingDays }) {
  const days = orderedDays(plan);
  const rangeStart = plan.period_start || plan.week_start || days[0]?.date || '';
  const rangeEnd = plan.period_end || plan.week_end || days[days.length - 1]?.date || '';
  const dateCount = countBy(days.map((day) => day.date));
  const duplicateDates = Object.entries(dateCount).filter(([, count]) => count > 1).map(([date, count]) => ({ date, count }));
  const overlappingPlans = allPlans.filter((other) => other.id !== plan.id && (!plan.squad_id || !other.squad_id || plan.squad_id === other.squad_id) && (!plan.season_id || !other.season_id || plan.season_id === other.season_id) && orderedDays(other).some((otherDay) => otherDay.date && dateBetween(otherDay.date, rangeStart, rangeEnd))).map((other) => ({ id: other.id, plan_key: other.plan_key || planKey(other), week_start: other.week_start || '', week_end: other.week_end || '' }));
  const duplicatePlanKeys = allPlans.filter((other) => other.id !== plan.id && (other.plan_key || planKey(other)) === (plan.plan_key || planKey(plan))).map((other) => other.id);
  const migrated = [];
  const conflicts = [];
  const missingId = [];
  const outOfRange = [];
  const matchWithoutLink = [];
  const sessionDateMismatches = [];
  days.forEach((day) => {
    const dayEvents = events.filter((event) => event.date === day.date && (!plan.squad_id || !event.squad_id || event.squad_id === plan.squad_id) && (!plan.season_id || !event.season_id || event.season_id === plan.season_id));
    const scopedReports = reports.filter((report) => (!plan.squad_id || !report.squad_id || report.squad_id === plan.squad_id) && (!plan.season_id || !report.season_id || report.season_id === plan.season_id));
    const sessionsForLegacyDay = sessions.filter((session) => session.weekly_plan_id === plan.id && session.weekly_plan_day_id === day.day_id);
    const reason = conflictReason({ day, dateCount, rangeStart, rangeEnd, dayEvents, reports: scopedReports, sessionsForLegacyDay });
    const row = {
      weekly_plan_id: plan.id,
      date: day.date || '',
      order: Number(day.order ?? day.__index),
      legacy_day_id: day.day_id || '',
      source_days_data_index: day.__index,
      md_code: day.md || day.match_day_code || '',
      physical_objective: day.physical_objective || day.objetivo_fisico || day.objetivo || '',
      day_type: dayTypeFor(day, dayEvents, scopedReports),
      calendar_event_id: day.calendar_event_id || '',
      match_id: day.match_id || '',
      migration_status: reason ? 'conflict' : 'migrated',
      migration_conflict_reason: reason,
      active: !reason,
      already_exists: existingDays.some((existing) => existing.weekly_plan_id === plan.id && existing.legacy_day_id === (day.day_id || '') && existing.source_days_data_index === day.__index)
    };
    if (!day.day_id) missingId.push(row);
    if (!dateBetween(day.date, rangeStart, rangeEnd)) outOfRange.push(row);
    if (reason.includes('md_without_real_match_link')) matchWithoutLink.push(row);
    sessionsForLegacyDay.forEach((session) => { if (session.date !== day.date) sessionDateMismatches.push({ session_id: session.id, session_date: session.date, legacy_day_id: day.day_id || '', day_date: day.date || '' }); });
    if (reason) conflicts.push(row); else migrated.push(row);
  });
  return {
    plan: { id: plan.id, plan_key: plan.plan_key || planKey(plan), week_start: plan.week_start || '', week_end: plan.week_end || '', period_start: plan.period_start || '', period_end: plan.period_end || '', planning_mode: plan.planning_mode || 'match_to_match' },
    can_migrate_without_conflict: migrated,
    conflicts,
    duplicate_dates: duplicateDates,
    missing_legacy_day_id: missingId,
    out_of_range: outOfRange,
    session_date_mismatches: sessionDateMismatches,
    match_days_without_real_link: matchWithoutLink,
    duplicate_plan_keys: duplicatePlanKeys,
    overlapping_plans: overlappingPlans,
    existing_weekly_plan_days: existingDays.filter((day) => day.weekly_plan_id === plan.id).length
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const payload = await req.json().catch(() => ({}));
    const mode = payload.mode || (payload.execute ? 'execute' : 'dry_run');
    const planId = payload.weekly_plan_id || payload.plan_id || '';
    if (!['dry_run', 'execute'].includes(mode)) return Response.json({ error: 'mode must be dry_run or execute' }, { status: 400 });

    const [allPlans, events, reports, sessions, gpsRows, existingDays] = await Promise.all([
      base44.asServiceRole.entities.WeeklyPlan.list('-week_start', 500),
      base44.asServiceRole.entities.DayEvent.list('date', 3000),
      base44.asServiceRole.entities.MatchReport.list('-date', 1500),
      base44.asServiceRole.entities.TrainingSession.list('-date', 3000),
      base44.asServiceRole.entities.SessionGPSData.list('-created_date', 5000).catch(() => []),
      base44.asServiceRole.entities.WeeklyPlanDay.list('-date', 5000).catch(() => [])
    ]);

    const plans = planId ? allPlans.filter((plan) => plan.id === planId) : allPlans;
    const analyses = plans.map((plan) => analyzePlan({ plan, allPlans, events, reports, sessions, existingDays }));
    const gpsSessionIds = new Set(gpsRows.map((row) => row.session_id).filter(Boolean));
    const sessionsWithGpsInPlans = sessions.filter((session) => gpsSessionIds.has(session.id) && plans.some((plan) => plan.id === session.weekly_plan_id || orderedDays(plan).some((day) => day.date === session.date && (!plan.squad_id || !session.squad_id || plan.squad_id === session.squad_id) && (!plan.season_id || !session.season_id || plan.season_id === session.season_id))));
    const julyRepairProposal = buildJulyRepairProposal(events, reports);

    const summary = {
      mode,
      totals: {
        weekly_plans_analyzed: plans.length,
        existing_weekly_plan_days: existingDays.length,
        days_can_migrate_without_conflict: analyses.reduce((sum, item) => sum + item.can_migrate_without_conflict.length, 0),
        days_with_conflict: analyses.reduce((sum, item) => sum + item.conflicts.length, 0),
        duplicate_date_groups: analyses.reduce((sum, item) => sum + item.duplicate_dates.length, 0),
        out_of_range_days: analyses.reduce((sum, item) => sum + item.out_of_range.length, 0),
        missing_legacy_day_id_days: analyses.reduce((sum, item) => sum + item.missing_legacy_day_id.length, 0),
        session_date_mismatches: analyses.reduce((sum, item) => sum + item.session_date_mismatches.length, 0),
        match_days_without_real_link: analyses.reduce((sum, item) => sum + item.match_days_without_real_link.length, 0),
        sessions_with_gps_in_plan_scope: sessionsWithGpsInPlans.length
      },
      july_13_21_repair_proposal: julyRepairProposal,
      analyses
    };

    if (mode === 'dry_run') return Response.json({ success: true, dry_run: true, ...summary });

    const now = new Date().toISOString();
    let created = 0;
    let skippedExisting = 0;
    let plansUpdated = 0;
    for (const analysis of analyses) {
      const plan = plans.find((item) => item.id === analysis.plan.id);
      if (!plan) continue;
      if (!Array.isArray(plan.legacy_days_data_snapshot) || plan.legacy_days_data_snapshot.length === 0) {
        await base44.asServiceRole.entities.WeeklyPlan.update(plan.id, {
          legacy_days_data_snapshot: plan.days_data || [],
          planning_mode: plan.planning_mode || 'match_to_match',
          period_start: plan.period_start || plan.week_start || '',
          period_end: plan.period_end || plan.week_end || '',
          migration_status: analysis.conflicts.length ? 'conflict' : 'migrated',
          active_day_source: plan.active_day_source || 'days_data',
          updated_at: now
        });
        plansUpdated += 1;
      }
      const rows = [...analysis.can_migrate_without_conflict, ...analysis.conflicts];
      for (const row of rows) {
        if (row.already_exists) { skippedExisting += 1; continue; }
        await base44.asServiceRole.entities.WeeklyPlanDay.create({
          organization_id: plan.organization_id || '',
          weekly_plan_id: plan.id,
          squad_id: plan.squad_id || '',
          season_id: plan.season_id || '',
          date: row.date,
          order: row.order,
          day_type: row.day_type,
          md_code: row.md_code,
          physical_objective: row.physical_objective,
          calendar_event_id: row.calendar_event_id,
          match_id: row.match_id,
          notes: '',
          legacy_day_id: row.legacy_day_id,
          source_days_data_index: row.source_days_data_index,
          migration_status: row.migration_status,
          migration_conflict_reason: row.migration_conflict_reason,
          active: row.active,
          created_from_days_data: true
        });
        created += 1;
      }
    }

    return Response.json({ success: true, dry_run: false, created_weekly_plan_days: created, skipped_existing: skippedExisting, plans_updated: plansUpdated, ...summary });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});