import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ── Helpers de fecha (sin dependencias) ──────────────────────────────────
function parseDate(s) {
  if (!s) return null;
  return new Date(s + 'T12:00:00');
}
function diffDays(a, b) {
  const da = parseDate(a), db = parseDate(b);
  if (!da || !db) return 0;
  return Math.round((da.getTime() - db.getTime()) / 86400000);
}
function addDays(s, n) {
  const d = parseDate(s);
  if (!d) return '';
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function isoWeekStart(s) {
  const d = parseDate(s);
  if (!d) return '';
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(s, offset);
}

// ── Cálculo de MD ──────────────────────────────────────────────────────────
function mdCodeForDate(date, targetDate) {
  const diff = diffDays(targetDate, date);
  if (diff === 0) return 'MD';
  return `MD-${diff}`;
}
function previousMdCodeForDate(date, previousDate) {
  const diff = diffDays(date, previousDate);
  if (diff === 0) return 'MD';
  return `MD+${diff}`;
}
function displayMdLabel(mdCode, previousMdCode) {
  if (mdCode && previousMdCode) return `${previousMdCode} / ${mdCode}`;
  return mdCode || previousMdCode || '';
}

// ── Clave estable del plan ─────────────────────────────────────────────────
function buildAutoPlanKey(org, squad, season, targetMatchId) {
  return [org || 'org', squad || '', season || '', 'match', targetMatchId || ''].join(':');
}
function buildCalendarWeekPlanKey(org, squad, season, weekStart) {
  return [org || 'org', squad || '', season || '', 'cw', weekStart || ''].join(':');
}

// ── Tipo de microciclo ─────────────────────────────────────────────────────
function microcycleType(daysBetween, matchesInSameWeek) {
  if (matchesInSameWeek > 1) return 'Doble competencia';
  if (daysBetween <= 5) return 'Corto';
  if (daysBetween <= 8) return 'Normal';
  return 'Largo';
}

function isValidMatch(m) {
  if (!m || !m.date) return false;
  const status = String(m.status || '').toLowerCase();
  if (status === 'archivado' || status === 'cancelado') return false;
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const mode = payload.mode || 'execute';
    if (!['dry_run', 'execute'].includes(mode)) {
      return Response.json({ error: 'mode must be dry_run or execute' }, { status: 400 });
    }
    const dryRun = mode === 'dry_run';
    const squadId = payload.squad_id;
    const seasonId = payload.season_id || '';
    if (!squadId) return Response.json({ error: 'squad_id is required' }, { status: 400 });

    // ── Validar acceso al plantel ──────────────────────────────────────────
    const isAdmin = user.role === 'admin';
    if (!isAdmin) {
      const staffAccess = await base44.asServiceRole.entities.StaffAccess
        .filter({ user_id: user.id, squad_id: squadId }, '-created_date', 50)
        .catch(() => []);
      const hasAccess = (staffAccess || []).some((sa) => sa.squad_id === squadId);
      if (!hasAccess) {
        return Response.json({ error: 'Forbidden: no access to squad' }, { status: 403 });
      }
    }

    // ── Cargar fuentes ────────────────────────────────────────────────────
    const [matches, sessions, dayEvents, existingPlans, existingDays] = await Promise.all([
      base44.asServiceRole.entities.MatchReport.filter({ squad_id: squadId }, '-date', 1500),
      base44.asServiceRole.entities.TrainingSession.filter({ squad_id: squadId }, '-date', 3000),
      base44.asServiceRole.entities.DayEvent.filter({ squad_id: squadId }, 'date', 3000),
      base44.asServiceRole.entities.WeeklyPlan.filter({ squad_id: squadId }, '-week_start', 500),
      base44.asServiceRole.entities.WeeklyPlanDay.filter({ squad_id: squadId }, 'date', 5000).catch(() => []),
    ]);

    const scopedMatches = matches.filter(isValidMatch).filter((m) => !seasonId || !m.season_id || m.season_id === seasonId);
    const scopedSessions = sessions.filter((s) => !seasonId || !s.season_id || s.season_id === seasonId);
    const scopedEvents = dayEvents.filter((ev) => !seasonId || !ev.season_id || ev.season_id === seasonId);
    const scopedPlans = existingPlans.filter((p) => !seasonId || !p.season_id || p.season_id === seasonId);
    const scopedDays = existingDays.filter((d) => !seasonId || !d.season_id || d.season_id === seasonId);

    const sortedMatches = scopedMatches.slice().sort((a, b) => {
      const ka = `${a.date || ''} ${a.match_time || ''}`;
      const kb = `${b.date || ''} ${b.match_time || ''}`;
      return ka.localeCompare(kb);
    });

    const org = scopedPlans[0]?.organization_id || '';
    const now = new Date().toISOString();
    const plansByKey = new Map();
    scopedPlans.forEach((p) => { if (p.plan_key) plansByKey.set(p.plan_key, p); });
    const daysByPlanDate = new Map();
    scopedDays.forEach((d) => { daysByPlanDate.set(`${d.weekly_plan_id}|${d.date}`, d); });

    const result = {
      mode, squad_id: squadId, season_id: seasonId,
      matches_count: sortedMatches.length,
      sessions_count: scopedSessions.length,
      events_count: scopedEvents.length,
      microcycles: [],
      plans_created: 0, plans_updated: 0,
      days_created: 0, days_updated: 0,
      sessions_linked: 0, sessions_review: 0,
    };

    // ── Wrappers de escritura (no escriben en dry_run) ────────────────────
    async function writePlan(planKey, payload) {
      const existing = plansByKey.get(planKey);
      if (existing) {
        if (!dryRun) await base44.asServiceRole.entities.WeeklyPlan.update(existing.id, payload);
        result.plans_updated += 1;
        return existing;
      }
      if (dryRun) {
        const fake = { ...payload, id: `dry_plan_${planKey}` };
        plansByKey.set(planKey, fake);
        result.plans_created += 1;
        return fake;
      }
      const created = await base44.asServiceRole.entities.WeeklyPlan.create(payload);
      plansByKey.set(planKey, created);
      result.plans_created += 1;
      return created;
    }
    async function writeDay(dayKey, payload) {
      const existing = daysByPlanDate.get(dayKey);
      if (existing && existing.id) {
        if (!dryRun) await base44.asServiceRole.entities.WeeklyPlanDay.update(existing.id, payload);
        result.days_updated += 1;
        return existing;
      }
      if (dryRun) {
        const fake = { ...payload, id: `dry_day_${dayKey}` };
        daysByPlanDate.set(dayKey, fake);
        result.days_created += 1;
        return fake;
      }
      const created = await base44.asServiceRole.entities.WeeklyPlanDay.create(payload);
      daysByPlanDate.set(dayKey, created);
      result.days_created += 1;
      return created;
    }
    async function writeSession(sessionId, patch) {
      if (dryRun) { result.sessions_linked += 1; return; }
      await base44.asServiceRole.entities.TrainingSession.update(sessionId, patch);
      result.sessions_linked += 1;
    }

    // ── Construir microciclos match_to_match ──────────────────────────────
    const coveredSessionIds = new Set();
    const microcycles = [];
    sortedMatches.forEach((targetMatch, idx) => {
      const previousMatch = idx > 0 ? sortedMatches[idx - 1] : null;
      let periodStart, periodEnd;
      if (previousMatch) {
        periodStart = addDays(previousMatch.date, 1);
        periodEnd = targetMatch.date;
      } else {
        periodStart = addDays(targetMatch.date, -7);
        periodEnd = targetMatch.date;
        const earlierSessions = scopedSessions.filter((s) => s.date && s.date < periodStart && s.date <= targetMatch.date);
        if (earlierSessions.length) {
          const earliest = earlierSessions.reduce((min, s) => s.date < min ? s.date : min, earlierSessions[0].date);
          periodStart = earliest;
        }
      }
      if (!periodStart || !periodEnd) return;
      const daysBetween = diffDays(targetMatch.date, previousMatch ? previousMatch.date : periodStart);
      const matchesInSameWeek = sortedMatches.filter((m) => m !== targetMatch && isoWeekStart(m.date) === isoWeekStart(targetMatch.date)).length + 1;
      const mcType = previousMatch ? microcycleType(daysBetween, matchesInSameWeek) : 'Inicial';
      microcycles.push({
        target_match_id: targetMatch.id,
        previous_match_id: previousMatch ? previousMatch.id : '',
        period_start: periodStart, period_end: periodEnd,
        type: mcType, days_between: daysBetween,
      });
    });

    for (const mc of microcycles) {
      const planKey = buildAutoPlanKey(org, squadId, seasonId, mc.target_match_id);
      const plan = await writePlan(planKey, {
        organization_id: org, plan_key: planKey, squad_id: squadId,
        squad_name: scopedPlans[0]?.squad_name || '', season_id: seasonId,
        week_start: mc.period_start, week_end: mc.period_end,
        planning_mode: 'match_to_match',
        period_start: mc.period_start, period_end: mc.period_end,
        previous_match_id: mc.previous_match_id, target_match_id: mc.target_match_id,
        active_day_source: 'weekly_plan_day', auto_generated: true,
        generation_source: 'matches_and_sessions', sync_status: 'synced',
        needs_review: false, review_reasons: [], generated_at: now,
        last_source_change_at: now, status: 'active', updated_at: now,
        microcycle_meta: { week_type: mc.type, days_between: mc.days_between, range_label: `${mc.period_start} - ${mc.period_end}` },
      });
      const planId = plan.id;

      // Marcar planes previos del mismo target como superseded
      if (!dryRun) {
        scopedPlans.forEach((other) => {
          if (other.id === planId) return;
          if (other.target_match_id === mc.target_match_id && other.status !== 'superseded' && other.status !== 'archived') {
            base44.asServiceRole.entities.WeeklyPlan.update(other.id, { status: 'superseded', updated_at: now }).catch(() => {});
          }
        });
      }

      const targetMatch = sortedMatches.find((m) => m.id === mc.target_match_id);
      const previousMatch = mc.previous_match_id ? sortedMatches.find((m) => m.id === mc.previous_match_id) : null;
      let cursor = mc.period_start;
      let order = 0;
      while (cursor <= mc.period_end) {
        const mdCode = mdCodeForDate(cursor, mc.period_end);
        const prevMdCode = previousMatch ? previousMdCodeForDate(cursor, previousMatch.date) : '';
        const label = displayMdLabel(mdCode, prevMdCode);
        const isMatchDay = cursor === mc.period_end;
        const dayEventsForDate = scopedEvents.filter((ev) => ev.date === cursor);
        const isTravel = dayEventsForDate.some((ev) => {
          const t = String(`${ev.title || ''} ${ev.event_type || ''} ${ev.type || ''}`).toLowerCase();
          return t.includes('viaje') || t.includes('traslado');
        });
        const dayType = isMatchDay ? 'match' : isTravel ? 'travel' : 'training';

        const daySessions = scopedSessions
          .filter((s) => s.date === cursor)
          .sort((a, b) => {
            const ta = a.start_time || '', tb = b.start_time || '';
            if (ta !== tb) return ta.localeCompare(tb);
            if ((a.session_number || 0) !== (b.session_number || 0)) return (a.session_number || 0) - (b.session_number || 0);
            return String(a.created_date || '').localeCompare(String(b.created_date || ''));
          });
        daySessions.forEach((s) => coveredSessionIds.add(s.id));

        const dayKey = `${planId}|${cursor}`;
        const day = await writeDay(dayKey, {
          organization_id: org, weekly_plan_id: planId, squad_id: squadId, season_id: seasonId,
          date: cursor, order, day_type: dayType, md_code: mdCode, previous_md_code: prevMdCode,
          display_md_label: label,
          calendar_event_id: isMatchDay ? (targetMatch?.calendar_event_id || '') : '',
          match_id: isMatchDay ? mc.target_match_id : '',
          linked_session_ids: daySessions.map((s) => s.id), blocks: [], active: true,
          generated_source: 'motor', generated_at: now, needs_review: false, review_reasons: [],
          source_revision: (daysByPlanDate.get(dayKey)?.source_revision || 0) + 1,
        });

        for (const session of daySessions) {
          const patch = {
            weekly_plan_id: planId, weekly_plan_day_id: day.id,
            plan_sync_updated_at: now, md_reference_match_id: mc.target_match_id, md_calculated_at: now,
          };
          if (!session.md_manual_override) {
            patch.match_day_code = mdCode; patch.microcycle_day = mdCode; patch.md_source = 'calculated';
          } else {
            patch.md_source = 'manual_override';
          }
          const reviewReasons = [];
          if (String(session.session_type || '').toLowerCase().includes('descanso') && dayType !== 'rest') reviewReasons.push('rest_session_on_active_day');
          if (reviewReasons.length) { patch.planning_review_status = 'conflict'; patch.planning_review_reasons = reviewReasons; result.sessions_review += 1; }
          else { patch.planning_review_status = 'reviewed'; patch.planning_review_reasons = []; }
          await writeSession(session.id, patch);
        }

        cursor = addDays(cursor, 1);
        order += 1;
      }

      result.microcycles.push({ plan_id: planId, target_match_id: mc.target_match_id, period_start: mc.period_start, period_end: mc.period_end, type: mc.type, days: order });
    }

    // ── Sesiones sin microciclo → calendar_week fallback ───────────────────
    const uncoveredSessions = scopedSessions.filter((s) => !coveredSessionIds.has(s.id) && s.date);
    const sessionsByWeek = new Map();
    uncoveredSessions.forEach((s) => {
      const ws = isoWeekStart(s.date);
      if (!sessionsByWeek.has(ws)) sessionsByWeek.set(ws, []);
      sessionsByWeek.get(ws).push(s);
    });

    for (const [weekStart, weekSessions] of sessionsByWeek) {
      const planKey = buildCalendarWeekPlanKey(org, squadId, seasonId, weekStart);
      const weekEnd = addDays(weekStart, 6);
      const plan = await writePlan(planKey, {
        organization_id: org, plan_key: planKey, squad_id: squadId,
        squad_name: scopedPlans[0]?.squad_name || '', season_id: seasonId,
        week_start: weekStart, week_end: weekEnd, planning_mode: 'calendar_week',
        period_start: weekStart, period_end: weekEnd, active_day_source: 'weekly_plan_day',
        auto_generated: true, generation_source: 'calendar_week_fallback', sync_status: 'synced',
        needs_review: true, review_reasons: ['no_reference_match'], generated_at: now,
        last_source_change_at: now, status: 'active', updated_at: now,
        microcycle_meta: { week_type: 'Sin partido de referencia', range_label: `${weekStart} - ${weekEnd}` },
      });
      const planId = plan.id;
      let order = 0;
      let cursor = weekStart;
      while (cursor <= weekEnd) {
        const daySessions = scopedSessions.filter((s) => s.date === cursor).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
        const dayKey = `${planId}|${cursor}`;
        const day = await writeDay(dayKey, {
          organization_id: org, weekly_plan_id: planId, squad_id: squadId, season_id: seasonId,
          date: cursor, order, day_type: daySessions.length ? 'training' : 'rest',
          md_code: '', previous_md_code: '', display_md_label: '',
          linked_session_ids: daySessions.map((s) => s.id), blocks: [], active: true,
          generated_source: 'motor', generated_at: now, needs_review: true, review_reasons: ['no_reference_match'],
          source_revision: (daysByPlanDate.get(dayKey)?.source_revision || 0) + 1,
        });
        for (const session of daySessions) {
          const patch = {
            weekly_plan_id: planId, weekly_plan_day_id: day.id, plan_sync_updated_at: now,
            md_source: 'no_reference_match', md_reference_match_id: '', md_calculated_at: now,
            planning_review_status: 'reviewed', planning_review_reasons: [],
          };
          if (!session.md_manual_override) { patch.match_day_code = ''; patch.microcycle_day = ''; }
          await writeSession(session.id, patch);
        }
        cursor = addDays(cursor, 1);
        order += 1;
      }
    }

    return Response.json({ success: true, ...result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});