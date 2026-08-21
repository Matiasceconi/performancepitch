import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlayerFromToken, computeEffectiveStatus } from "../../shared/complementaryStrength.ts";

// Inicio diario del jugador: cronograma del día + controles (Wellness/RPE principal)
// + entrenamientos complementarios de fuerza (hoy y próximos).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const auth = await resolvePlayerFromToken(base44, body.token);
    if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

    const { tokenRecord, today, context } = auth;
    const playerId = tokenRecord.player_id;
    const squadId = context.squad_id || tokenRecord.squad_id || '';
    const player = context.player;

    // ── A. Cronograma del día (DayEvent del plantel operativo) ──────────────
    let dayEvents = [];
    if (squadId) {
      dayEvents = await base44.asServiceRole.entities.DayEvent.filter(
        { squad_id: squadId, date: today },
        "start_time",
        100
      );
    }
    const schedule = dayEvents
      .map((e) => ({
        id: e.id,
        title: e.title,
        time: e.start_time || e.time || '',
        end_time: e.end_time || '',
        event_type: e.event_type || e.type || '',
        location: e.location || '',
        duration_minutes: e.duration_minutes || null,
        notes: e.notes || '',
        rival: e.rival || '',
      }))
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    // ── B. Wellness de hoy ─────────────────────────────────────────────────
    const wellnessRows = await base44.asServiceRole.entities.WellnessResponse.filter(
      { player_id: playerId, response_date: today },
      "-updated_at",
      1
    );
    const wellnessStatus = wellnessRows[0] ? 'completed' : 'pending';

    // ── B. RPE principal (sesiones colectivas de hoy) ───────────────────────
    const spRows = await base44.asServiceRole.entities.SessionPlayer.filter(
      { player_id: playerId },
      "-created_date",
      200
    );
    const sessionIds = [...new Set(spRows.map((sp) => sp.session_id))];
    const sessionMap = {};
    for (let i = 0; i < sessionIds.length; i += 50) {
      const batch = sessionIds.slice(i, i + 50);
      const rows = await base44.asServiceRole.entities.TrainingSession.filter(
        { id: { $in: batch } },
        "-date",
        200
      );
      rows.forEach((s) => { sessionMap[s.id] = s; });
    }
    const spBySession = {};
    spRows.forEach((sp) => { spBySession[sp.session_id] = sp; });

    const rpeSessions = [];
    const rpeCompletedSessions = [];
    for (const session of Object.values(sessionMap)) {
      if (session.date !== today) continue;
      if (session.status === 'cancelled') continue;
      const sp = spBySession[session.id];
      if (!sp) continue;
      if (sp.attendance === 'ausente' || sp.attendance === 'no_entrena') continue;
      const card = {
        session_id: session.id,
        title: session.title || 'Sesión',
        date: session.date,
        match_day_code: session.match_day_code || '',
        session_type: session.session_type || '',
      };
      if (sp.rpe != null) {
        rpeCompletedSessions.push({ ...card, rpe: sp.rpe, internal_load: sp.internal_load });
      } else {
        rpeSessions.push(card);
      }
    }

    // ── C. Fuerza complementaria ───────────────────────────────────────────
    // Asignaciones activas del jugador
    const assignments = await base44.asServiceRole.entities.ComplementaryStrengthPlanAssignment.filter(
      { player_id: playerId, status: 'active' },
      "-assigned_at",
      100
    );
    const planIds = [...new Set(assignments.map((a) => a.plan_id))];

    // Planes publicados asignados al jugador
    const plans = [];
    for (let i = 0; i < planIds.length; i += 50) {
      const batch = planIds.slice(i, i + 50);
      const rows = await base44.asServiceRole.entities.ComplementaryStrengthPlan.filter(
        { id: { $in: batch }, status: 'published' },
        "-updated_date",
        100
      );
      rows.forEach((p) => plans.push(p));
    }

    const publishedPlanIds = plans.map((p) => p.id);

    // Workouts publicados de esos planes
    let workouts = [];
    if (publishedPlanIds.length) {
      for (let i = 0; i < publishedPlanIds.length; i += 50) {
        const batch = publishedPlanIds.slice(i, i + 50);
        const rows = await base44.asServiceRole.entities.ComplementaryStrengthWorkout.filter(
          { plan_id: { $in: batch }, status: 'published' },
          "workout_date",
          500
        );
        workouts.push(...rows);
      }
    }

    const workoutIds = workouts.map((w) => w.id);

    // Ejecuciones existentes del jugador para esos workouts
    let executions = [];
    if (workoutIds.length) {
      for (let i = 0; i < workoutIds.length; i += 50) {
        const batch = workoutIds.slice(i, i + 50);
        const rows = await base44.asServiceRole.entities.ComplementaryStrengthExecution.filter(
          { workout_id: { $in: batch }, player_id: playerId },
          "-created_date",
          500
        );
        executions.push(...rows);
      }
    }
    const execByWorkout = {};
    executions.forEach((e) => { execByWorkout[e.workout_id] = e; });

    // Construir tarjetas de fuerza complementaria
    const strengthToday = [];
    const strengthUpcoming = [];
    for (const w of workouts) {
      const plan = plans.find((p) => p.id === w.plan_id);
      const exec = execByWorkout[w.id];
      const effectiveStatus = exec
        ? computeEffectiveStatus(exec, w.workout_date, today)
        : (w.workout_date < today ? 'pending_expired' : (w.workout_date === today ? 'available_today' : 'upcoming'));

      const card = {
        workout_id: w.id,
        plan_id: w.plan_id,
        plan_name: plan?.name || '',
        title: w.title || plan?.name || 'Entrenamiento',
        workout_date: w.workout_date,
        objective: w.objective || '',
        estimated_duration_minutes: w.estimated_duration_minutes || null,
        instructions: w.instructions || '',
        general_instructions: plan?.general_instructions || '',
        status: effectiveStatus || 'available_today',
        execution_id: exec?.id || null,
        started_at: exec?.started_at || null,
        rpe: exec?.rpe ?? null,
        not_completed_reason: exec?.not_completed_reason || null,
      };
      if (w.workout_date === today) strengthToday.push(card);
      else if (w.workout_date > today) strengthUpcoming.push(card);
    }
    strengthUpcoming.sort((a, b) => a.workout_date.localeCompare(b.workout_date));

    // ── D. Último informe publicado (no eliminado) ────────────────────────
    const allPlayerReports = await base44.asServiceRole.entities.PlayerMatchReport.filter(
      { player_id: playerId, status: 'published' },
      '-published_at',
      5
    ).catch(() => []);
    const activeReports = allPlayerReports.filter(r => !r.deleted_at);
    const latestReport = activeReports[0] || null;

    return Response.json({
      ok: true,
      player_first_name: tokenRecord.player_first_name || player.first_name || '',
      today,
      schedule,
      wellness: { status: wellnessStatus },
      rpe_sessions: rpeSessions,
      rpe_completed_sessions: rpeCompletedSessions,
      strength: {
        today: strengthToday,
        upcoming: strengthUpcoming,
      },
      latest_report: latestReport ? {
        id: latestReport.id,
        title: latestReport.title,
        report_type: latestReport.report_type,
        match_labels: latestReport.match_labels || [],
        match_dates: latestReport.match_dates || [],
        match_ids: latestReport.match_ids || [],
        published_at: latestReport.published_at,
      } : null,
    });
  } catch (error) {
    console.error('getPlayerDailyHome error:', error);
    return Response.json({ error: error.message || 'Error al cargar el inicio del día' }, { status: 500 });
  }
}