import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import {
  calculateStats,
  zScore,
  pctChange,
  normalizeName,
} from "../../shared/evaluationImportUtils.ts";
import {
  calculateBaseline,
  determineSignal,
  detectAsymmetrySignal,
  detectAnomaly,
} from "../../shared/evaluationBaseline.ts";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { player_id, squad_id, period, date_from, date_to, test_keys, metric_keys, compare_session_ids } = body;

    if (!player_id) return Response.json({ error: "player_id es requerido" }, { status: 400 });

    // ── 1. Load canonical Player ────────────────────────────────────────────
    const players = await base44.asServiceRole.entities.Player.list("full_name", 1000);
    const player = players.find((p: any) => p.id === player_id);
    if (!player) return Response.json({ error: "Player no encontrado" }, { status: 404 });

    // ── 2. Validate squad membership (if squad_id provided) ──────────────────
    let memberships: any[] = [];
    try {
      memberships = await base44.asServiceRole.entities.SquadMembership.list("created_date", 1000);
    } catch { /* entity may not exist */ }
    const playerMemberships = memberships.filter((m: any) => m.player_id === player_id);
    const playerSquadIds = new Set([
      player.squad_id,
      ...playerMemberships.map((m: any) => m.squad_id),
    ].filter(Boolean));

    if (squad_id && !playerSquadIds.has(squad_id)) {
      return Response.json({ error: "El jugador no pertenece al plantel indicado" }, { status: 403 });
    }

    const activeSquadId = squad_id || player.squad_id || playerMemberships[0]?.squad_id || null;

    // ── 3. Load squads for names ─────────────────────────────────────────────
    const squads = await base44.asServiceRole.entities.Squad.list("name", 200);
    const squadMap = new Map(squads.map((s: any) => [s.id, s]));
    const playerSquad = activeSquadId ? squadMap.get(activeSquadId) : null;

    // ── 4. Load all sessions for this squad ──────────────────────────────────
    const allSessions = activeSquadId
      ? await base44.asServiceRole.entities.EvaluationSession.filter({ squad_id: activeSquadId }, "-assessment_date", 100)
      : await base44.asServiceRole.entities.EvaluationSession.list("-assessment_date", 100);

    // ── 5. Filter sessions by period ────────────────────────────────────────
    let filteredSessions = allSessions;
    if (period === "last_5") filteredSessions = allSessions.slice(0, 5);
    else if (period === "last_10") filteredSessions = allSessions.slice(0, 10);
    else if (period === "date_range" && date_from && date_to) {
      filteredSessions = allSessions.filter((s: any) => s.assessment_date >= date_from && s.assessment_date <= date_to);
    }

    const sessionIds = filteredSessions.map((s: any) => s.session_id);
    const sessionDatesSet = new Set(filteredSessions.map((s: any) => s.assessment_date));

    // ── 6. Load all results for this player ──────────────────────────────────
    const allPlayerResults = await base44.asServiceRole.entities.EvaluationResult.filter(
      { player_id },
      "assessment_date",
      1000
    );

    // Filter to sessions in range
    let playerResults = allPlayerResults.filter((r: any) => sessionIds.includes(r.session_id));
    if (test_keys?.length) playerResults = playerResults.filter((r: any) => test_keys.includes(r.test_key));

    // ── 7. Load historical results for baselines (all sessions before the latest in range) ─
    const latestDate = filteredSessions[0]?.assessment_date;
    const historicalResults = allPlayerResults.filter((r: any) =>
      r.assessment_date < latestDate && r.is_primary
    );

    // Group historical by test_key + metric_key
    const baselineMap = new Map<string, number[]>();
    for (const hr of historicalResults) {
      for (const [mk, mv] of Object.entries(hr.metrics || {})) {
        if (typeof mv !== "number" || !isFinite(mv)) continue;
        const key = `${hr.test_key}|${mk}`;
        if (!baselineMap.has(key)) baselineMap.set(key, []);
        baselineMap.get(key)!.push(mv);
      }
    }

    // ── 8. Load squad results for comparison (latest session in range) ──────
    const latestSessionId = filteredSessions[0]?.session_id;
    let squadResults: any[] = [];
    if (latestSessionId) {
      squadResults = await base44.asServiceRole.entities.EvaluationResult.filter(
        { session_id: latestSessionId, is_primary: true },
        "test_key",
        500
      );
    }

    // Group squad values by test_key|metric_key
    const squadValuesMap = new Map<string, number[]>();
    for (const sr of squadResults) {
      for (const [mk, mv] of Object.entries(sr.metrics || {})) {
        if (typeof mv !== "number" || !isFinite(mv)) continue;
        const key = `${sr.test_key}|${mk}`;
        if (!squadValuesMap.has(key)) squadValuesMap.set(key, []);
        squadValuesMap.get(key)!.push(mv);
      }
    }

    // ── 9. Load thresholds ──────────────────────────────────────────────────
    let thresholds: any[] = [];
    try {
      thresholds = await base44.asServiceRole.entities.EvaluationThresholdConfig.filter({ active: true });
    } catch { /* empty */ }

    // ── 10. Load metric definitions ──────────────────────────────────────────
    let metricDefs: any[] = [];
    try {
      metricDefs = await base44.asServiceRole.entities.EvaluationMetricDefinition.list("display_order", 200);
    } catch { /* empty */ }
    const metricDefMap = new Map(metricDefs.map((m: any) => [m.metric_key, m]));

    // ── 11. Load batteries for this player ───────────────────────────────────
    const batteries = await base44.asServiceRole.entities.EvaluationBattery.filter(
      { player_id },
      "created_date",
      200
    );

    // ── 12. Load import files for audit (file_name per result) ───────────────
    const fileIds = [...new Set(playerResults.map((r: any) => r.file_id).filter(Boolean))];
    let filesMap = new Map<string, any>();
    if (fileIds.length) {
      try {
        const allFiles = await base44.asServiceRole.entities.EvaluationImportFile.list("file_name", 200);
        filesMap = new Map(allFiles.map((f: any) => [f.file_id, f]));
      } catch { /* empty */ }
    }

    // ── 13. Build signals + baselines + squad comparison ─────────────────────
    const signals: any[] = [];
    const baselines: Record<string, any> = {};
    const squadComparison: Record<string, any> = {};

    for (const r of playerResults) {
      if (!r.is_primary) continue;
      for (const [mk, mv] of Object.entries(r.metrics || {})) {
        if (typeof mv !== "number" || !isFinite(mv)) continue;
        if (metric_keys?.length && !metric_keys.includes(mk)) continue;

        const mapKey = `${r.test_key}|${mk}`;

        // Baseline
        const histValues = baselineMap.get(mapKey) || [];
        const baseline = calculateBaseline(histValues, 3);
        if (!baselines[mapKey]) {
          baselines[mapKey] = {
            value: baseline.value,
            std: baseline.std,
            sufficient: baseline.sufficient,
            sessions_used: baseline.count,
            calculation: "mean",
          };
        }

        // Threshold
        const threshold = thresholds.find(
          (t: any) => t.source_key === r.source_key && t.test_key === r.test_key && t.metric_key === mk
        );
        const thresholdConfig = threshold
          ? { moderate: threshold.moderate_threshold, important: threshold.important_threshold, type: threshold.threshold_type }
          : null;

        // Signal
        const sig = determineSignal(mv, baseline.value, baseline.std, thresholdConfig);
        const anomaly = baseline.value !== null && baseline.std !== null
          ? detectAnomaly(mv, baseline.value, baseline.std)
          : { anomaly: false, reason: "" };

        signals.push({
          session_id: r.session_id,
          assessment_date: r.assessment_date,
          test_key: r.test_key,
          metric_key: mk,
          current_value: mv,
          baseline_value: baseline.value,
          change_abs: sig.changeAbs,
          change_pct: sig.changePct,
          z_score_individual: sig.zScoreIndividual,
          signal: sig.signal,
          reason: sig.reason + (anomaly.anomaly ? ` · ${anomaly.reason}` : ""),
          quality_status: r.quality_status,
          retest: r.retest,
        });

        // Squad comparison (only for latest session)
        if (r.session_id === latestSessionId) {
          const squadVals = squadValuesMap.get(mapKey) || [];
          const squadStats = calculateStats(squadVals);
          const sorted = [...squadVals].sort((a, b) => a - b);
          const percentile = sorted.length > 0
            ? Math.round((sorted.filter((v) => v <= mv).length / sorted.length) * 100)
            : null;
          squadComparison[mapKey] = {
            player_value: mv,
            squad_mean: squadStats.mean,
            squad_median: squadStats.median,
            squad_std: squadStats.std,
            squad_q1: sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.25)] : null,
            squad_q3: sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.75)] : null,
            squad_min: sorted[0] || null,
            squad_max: sorted[sorted.length - 1] || null,
            player_percentile: percentile,
            z_score_squad: zScore(mv, squadStats.mean, squadStats.std),
            squad_count: squadStats.count,
          };
        }
      }
    }

    // ── 14. Build response ───────────────────────────────────────────────────
    return Response.json({
      player: {
        id: player.id,
        full_name: player.full_name,
        first_name: player.first_name,
        last_name: player.last_name,
        position: player.position,
        position_group: player.position_group,
        squad_id: activeSquadId,
        squad_name: playerSquad?.name || player.squad_name || null,
        photo_url: player.photo_url || null,
        age: player.age || null,
        category: player.category || null,
        division: player.division || null,
        birth_date: player.birth_date || null,
        height: player.height || null,
        weight: player.weight || null,
        dominant_leg: player.dominant_leg || null,
        jersey_number: player.jersey_number || null,
        status: player.status || null,
      },
      sessions: filteredSessions.map((s: any) => ({
        session_id: s.session_id,
        assessment_date: s.assessment_date,
        name: s.name,
        context: s.context,
        test_keys: s.test_keys || [],
        total_players: s.total_players,
        total_results: s.total_results,
      })),
      batteries: batteries.map((b: any) => ({
        battery_id: b.battery_id,
        session_id: b.session_id,
        test_keys: b.test_keys || [],
        complete: b.complete,
        total_results: b.total_results,
      })),
      results: playerResults.map((r: any) => ({
        result_id: r.result_id,
        session_id: r.session_id,
        assessment_date: r.assessment_date,
        test_key: r.test_key,
        test_side: r.test_side,
        attempt_number: r.attempt_number,
        retest: r.retest,
        is_primary: r.is_primary,
        quality_status: r.quality_status,
        quality_notes: r.quality_notes,
        metrics: r.metrics || {},
        asymmetries: r.asymmetries || {},
        raw_row: r.raw_row || {},
        file_name: r.file_id ? filesMap.get(r.file_id)?.file_name || null : null,
        linking_status: r.linking_status,
      })),
      baselines,
      signals,
      squad_comparison: squadComparison,
      metric_definitions: metricDefs.map((m: any) => ({
        metric_key: m.metric_key,
        metric_label: m.metric_label,
        unit: m.unit,
        direction: m.direction,
        category: m.category,
        source_key: m.source_key,
        test_keys: m.test_keys || [],
      })),
      compare_sessions: compare_session_ids
        ? playerResults.filter((r: any) => compare_session_ids.includes(r.session_id))
        : null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}