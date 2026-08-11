import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import {
  calculateStats,
  zScore,
  pctChange,
  normalizeName,
  type PlayerInfo,
} from "../../shared/evaluationImportUtils.ts";
import {
  calculateBaseline,
  determineSignal,
  detectAsymmetrySignal,
  detectAnomaly,
  calculateSquadZScores,
  calculateRecentChange,
  classifyChange,
  evaluateReferenceChange,
  type ThresholdConfig,
} from "../../shared/evaluationBaseline.ts";
import { evaluationErrorResponse, requireEvaluationAccess } from "../../shared/evaluationAccess.ts";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const body = await req.json().catch(() => ({}));
    const { session_id, squad_id } = body;
    await requireEvaluationAccess(base44, user, squad_id, "view");

    // ── 1. Get latest session (or specified one) ───────────────────────────
    let session: any = null;
    if (session_id) {
      const sessions = await base44.asServiceRole.entities.EvaluationSession.filter({ session_id }, "-assessment_date", 1);
      session = sessions[0] || null;
      if (session && session.squad_id !== squad_id) {
        return Response.json({ error: "Sesión fuera del plantel autorizado" }, { status: 403 });
      }
    } else {
      const sessions = squad_id
        ? await base44.asServiceRole.entities.EvaluationSession.filter({ squad_id }, "-assessment_date", 1)
        : await base44.asServiceRole.entities.EvaluationSession.list("-assessment_date", 1);
      session = sessions[0] || null;
    }

    if (!session) {
      return Response.json({
        session: null,
        review_tray: [],
        improvements: [],
        declines: [],
        mixed_signals: [],
        change_map: { players: [], metrics: [] },
        secondary_info: {
          total_players: 0, coverage: 0, players_without_eval: 0,
          complete_batteries: 0, incomplete_batteries: 0,
          pending_results: 0, quality_warnings: 0, players_without_baseline: 0,
        },
        sessions_list: [],
      });
    }

    // ── 2. Get all sessions for this squad ──────────────────────────────────
    const allSessions = await base44.asServiceRole.entities.EvaluationSession.filter(
      { squad_id: session.squad_id || undefined },
      "-assessment_date",
      50
    );

    // ── 3. Get results for current session ──────────────────────────────────
    const currentResults = await base44.asServiceRole.entities.EvaluationResult.filter(
      { session_id: session.session_id },
      "test_key",
      500
    );

    // ── 4. Get previous session (most recent before current) ────────────────
    const previousSessions = allSessions.filter((s: any) =>
      s.assessment_date < session.assessment_date && s.session_id !== session.session_id
    );
    const previousSession = previousSessions[0] || null;

    let previousResults: any[] = [];
    if (previousSession) {
      previousResults = await base44.asServiceRole.entities.EvaluationResult.filter(
        { session_id: previousSession.session_id, is_primary: true },
        "test_key",
        500
      );
    }

    // ── 5. Get historical results for baselines ─────────────────────────────
    const sessionDates = allSessions
      .filter((s: any) => s.assessment_date < session.assessment_date)
      .map((s: any) => s.assessment_date);
    const historicalDates = new Set(sessionDates);

    let historicalResults: any[] = [];
    if (sessionDates.length) {
      const allResults = await base44.asServiceRole.entities.EvaluationResult.filter(
        { squad_id: session.squad_id || undefined },
        "assessment_date",
        2000
      );
      historicalResults = allResults.filter((r: any) => historicalDates.has(r.assessment_date) && r.is_primary);
    }

    // ── 6. Load players ─────────────────────────────────────────────────────
    const playersRaw = await base44.asServiceRole.entities.Player.list("full_name", 2000);
    const playerMap = new Map(playersRaw.map((p: any) => [p.id, p]));
    let memberships: any[] = [];
    try {
      memberships = await base44.asServiceRole.entities.SquadMembership.list("created_date", 2000);
    } catch { /* empty */ }
    const squadPlayerIds = new Set(memberships.filter((m: any) => m.squad_id === session.squad_id && m.status !== "inactivo").map((m: any) => m.player_id));
    const squadPlayers = session.squad_id
      ? playersRaw.filter((p: any) => squadPlayerIds.has(p.id) || p.squad_id === session.squad_id)
      : playersRaw;

    // ── 7. Load thresholds and metric definitions ──────────────────────────
    let thresholds: any[] = [];
    try {
      thresholds = await base44.asServiceRole.entities.EvaluationThresholdConfig.filter({ active: true }, "-updated_at", 500);
    } catch { /* empty */ }

    let metricDefs: any[] = [];
    try {
      metricDefs = await base44.asServiceRole.entities.EvaluationMetricDefinition.list("display_order", 200);
    } catch { /* empty */ }
    const metricDefMap = new Map(metricDefs.map((m: any) => [m.metric_key, m]));

    // ── 8. Build baselines per player per metric ────────────────────────────
    const baselineMap = new Map<string, { values: number[]; count: number }>();
    for (const hr of historicalResults) {
      const playerId = hr.player_id;
      if (!playerId) continue;
      for (const [mk, mv] of Object.entries(hr.metrics || {})) {
        if (typeof mv !== "number" || !isFinite(mv)) continue;
        const key = `${playerId}|${hr.test_key}|${mk}`;
        if (!baselineMap.has(key)) baselineMap.set(key, { values: [], count: 0 });
        baselineMap.get(key)!.values.push(mv);
      }
    }

    // ── 9. Build previous session values per player+test+metric ────────────
    const previousMap = new Map<string, number>();
    const historicalNewestFirst = [...historicalResults].sort((a: any, b: any) =>
      String(b.assessment_date || "").localeCompare(String(a.assessment_date || ""))
    );
    for (const pr of historicalNewestFirst) {
      if (!pr.player_id) continue;
      for (const [mk, mv] of Object.entries(pr.metrics || {})) {
        if (typeof mv !== "number" || !isFinite(mv)) continue;
        const key = `${pr.player_id}|${pr.test_key}|${mk}`;
        if (!previousMap.has(key)) previousMap.set(key, mv);
      }
    }

    // ── 10. Build review tray, improvements, declines, mixed signals ───────
    const reviewItems: any[] = [];
    const improvementsMap = new Map<string, any>();
    const declinesMap = new Map<string, any>();
    const mixedSignalsMap = new Map<string, any>();
    const changeMapPlayers = new Map<string, any>();
    const squadMetricValues = new Map<string, number[]>();

    for (const cr of currentResults) {
      if (!cr.is_primary) continue;
      const playerId = cr.player_id;
      const player = playerId ? playerMap.get(playerId) : null;
      const playerName = player?.full_name || cr.player_name_csv || "Sin vincular";
      const position = player?.position || "—";
      const photoUrl = player?.photo_url || null;

      for (const [mk, mv] of Object.entries(cr.metrics || {})) {
        if (typeof mv !== "number" || !isFinite(mv)) continue;

        // Collect squad values
        if (!squadMetricValues.has(mk)) squadMetricValues.set(mk, []);
        squadMetricValues.get(mk)!.push(mv);

        // Get baseline
        const baselineKey = `${playerId}|${cr.test_key}|${mk}`;
        const baselineData = baselineMap.get(baselineKey);
        const baseline = baselineData
          ? calculateBaseline(baselineData.values, 3)
          : { value: null, std: null, sufficient: false, count: 0, config_version: "mean_last_3_v1" };

        // Get previous session value
        const previousValue = playerId ? previousMap.get(baselineKey) ?? null : null;
        const recentChange = calculateRecentChange(mv, previousValue);

        // Get metric direction
        const metricDef = metricDefMap.get(mk);
        const direction = metricDef?.direction || "higher_is_better";

        // Get thresholds
        const threshold = thresholds.find(
          (t: any) => t.squad_id === session.squad_id && t.source_key === cr.source_key && t.test_key === cr.test_key && t.metric_key === mk
        ) || thresholds.find(
          (t: any) => !t.squad_id && t.source_key === cr.source_key && t.test_key === cr.test_key && t.metric_key === mk
        );
        const thresholdConfig: ThresholdConfig | null = threshold
          ? {
              moderate: threshold.moderate_threshold,
              important: threshold.important_threshold,
              type: threshold.threshold_type,
              improvement_threshold: threshold.improvement_threshold ?? null,
              decline_threshold: threshold.decline_threshold ?? null,
              direction: direction as any,
            }
          : null;

        // Determine signal vs baseline
        const signal = determineSignal(mv, baseline.value, baseline.std, thresholdConfig);

        // Detect anomaly
        const anomaly = baseline.value !== null && baseline.std !== null
          ? detectAnomaly(mv, baseline.value, baseline.std)
          : { anomaly: false, reason: "" };

        // Check asymmetries
        let asymmetryFlag = null;
        for (const [ak, av] of Object.entries(cr.asymmetries || {})) {
          const aThreshold = thresholds.find(
            (t: any) => t.squad_id === session.squad_id && t.source_key === cr.source_key && t.test_key === cr.test_key && t.metric_key === ak
          ) || thresholds.find(
            (t: any) => !t.squad_id && t.source_key === cr.source_key && t.test_key === cr.test_key && t.metric_key === ak
          );
          const aResult = detectAsymmetrySignal((av as any).magnitude, aThreshold?.asymmetry_threshold || 10);
          if (aResult.flagged) {
            asymmetryFlag = { metric: ak, magnitude: (av as any).magnitude, direction: (av as any).direction, reason: aResult.reason };
            break;
          }
        }

        // Classify change (improvement/decline/mixed)
        const classification = classifyChange(
          { changeAbs: recentChange.changeAbs, hasPrevious: recentChange.hasPrevious },
          { changeAbs: signal.changeAbs, baselineSufficient: baseline.sufficient },
          direction as any
        );
        const previousComparison = evaluateReferenceChange(
          mv,
          previousValue,
          thresholdConfig,
          direction as any,
          baseline.std,
        );
        const baselineComparison = evaluateReferenceChange(
          mv,
          baseline.value,
          thresholdConfig,
          direction as any,
          baseline.std,
        );
        const relevantOutcomes = [previousComparison, baselineComparison]
          .filter((comparison) => comparison.relevant)
          .map((comparison) => comparison.outcome);
        const isMixedRelevant = relevantOutcomes.includes("improvement") && relevantOutcomes.includes("decline");
        const isImprovementRelevant = relevantOutcomes.includes("improvement") && !relevantOutcomes.includes("decline");
        const isDeclineRelevant = relevantOutcomes.includes("decline") && !relevantOutcomes.includes("improvement");

        const baseItem = {
          player_id: playerId,
          player_name: playerName,
          player_photo_url: photoUrl,
          player_csv_name: cr.player_name_csv,
          position,
          test_key: cr.test_key,
          metric_key: mk,
          metric_label: metricDef?.metric_label || mk,
          unit: metricDef?.unit || "",
          direction,
          current_value: mv,
          previous_value: previousValue,
          has_previous: recentChange.hasPrevious,
          recent_change_abs: recentChange.changeAbs,
          recent_change_pct: recentChange.changePct,
          baseline_value: baseline.value,
          baseline_sufficient: baseline.sufficient,
          baseline_sessions: baseline.count,
          change_abs: signal.changeAbs,
          change_pct: signal.changePct,
          z_score_individual: signal.zScoreIndividual,
          signal: signal.signal,
          classification: { ...classification, is_mixed: isMixedRelevant || classification.is_mixed },
          previous_comparison: previousComparison,
          baseline_comparison: baselineComparison,
          reason: signal.reason + (anomaly.anomaly ? ` · ${anomaly.reason}` : "") + (asymmetryFlag ? ` · ${asymmetryFlag.reason}` : ""),
          quality_status: cr.quality_status,
          linking_status: cr.linking_status,
          link_valid: playerId ? playerMap.has(playerId) : false,
          has_asymmetry: !!asymmetryFlag,
          result_id: cr.result_id,
        };

        // Add to review tray if there's a signal or quality issue
        const hasSignal =
          signal.signal === "moderate" ||
          signal.signal === "important" ||
          previousComparison.relevant ||
          baselineComparison.relevant ||
          anomaly.anomaly ||
          asymmetryFlag !== null ||
          cr.quality_status !== "ok" ||
          cr.linking_status === "pending" ||
          cr.linking_status === "collision";

        if (hasSignal) {
          const severityRank =
            signal.signal === "important" ? 3 :
            anomaly.anomaly ? 3 :
            asymmetryFlag ? 2 :
            signal.signal === "moderate" ? 2 :
            previousComparison.relevant || baselineComparison.relevant ? 2 :
            cr.quality_status === "error" ? 2 :
            cr.linking_status === "collision" ? 1 :
            cr.linking_status === "pending" ? 1 : 0;
          reviewItems.push({ ...baseItem, severity_rank: severityRank });
        }

        // Add to improvements/declines/mixed
        if (isMixedRelevant) {
          if (!mixedSignalsMap.has(playerId)) {
            mixedSignalsMap.set(playerId, {
              player_id: playerId,
              player_name: playerName,
              player_photo_url: photoUrl,
              position,
              metrics: [],
            });
          }
          mixedSignalsMap.get(playerId).metrics.push(baseItem);
        } else if (isImprovementRelevant) {
          if (!improvementsMap.has(playerId)) {
            improvementsMap.set(playerId, {
              player_id: playerId,
              player_name: playerName,
              player_photo_url: photoUrl,
              position,
              metrics: [],
            });
          }
          improvementsMap.get(playerId).metrics.push(baseItem);
        } else if (isDeclineRelevant) {
          if (!declinesMap.has(playerId)) {
            declinesMap.set(playerId, {
              player_id: playerId,
              player_name: playerName,
              player_photo_url: photoUrl,
              position,
              metrics: [],
            });
          }
          declinesMap.get(playerId).metrics.push(baseItem);
        }

        // Build change map entry
        if (playerId) {
          if (!changeMapPlayers.has(playerId)) {
            changeMapPlayers.set(playerId, {
              player_id: playerId,
              player_name: playerName,
              player_photo_url: photoUrl,
              player_csv_name: cr.player_name_csv,
              position,
              metrics: {},
            });
          }
          const playerEntry = changeMapPlayers.get(playerId);
          const mapKey = `${cr.test_key}|${mk}`;
          playerEntry.metrics[mapKey] = {
            current_value: mv,
            previous_value: previousValue,
            has_previous: recentChange.hasPrevious,
            recent_change_abs: recentChange.changeAbs,
            recent_change_pct: recentChange.changePct,
            baseline_value: baseline.value,
            baseline_sufficient: baseline.sufficient,
            change_abs: signal.changeAbs,
            change_pct: signal.changePct,
            z_score_individual: signal.zScoreIndividual,
            signal: signal.signal,
            classification: classification,
            previous_comparison: previousComparison,
            baseline_comparison: baselineComparison,
            test_key: cr.test_key,
            metric_key: mk,
            assessment_date: cr.assessment_date,
          };
        }
      }
    }

    // ── 11. Calculate squad z-scores ────────────────────────────────────────
    for (const [mk, values] of squadMetricValues) {
      const stats = calculateStats(values);
      for (const [, playerEntry] of changeMapPlayers) {
        for (const [mapKey, entry] of Object.entries(playerEntry.metrics)) {
          if (entry.metric_key === mk) {
            entry.z_score_squad = zScore(entry.current_value, stats.mean, stats.std);
          }
        }
      }
    }

    // ── 12. Sort review tray ────────────────────────────────────────────────
    reviewItems.sort((a, b) => {
      if (b.severity_rank !== a.severity_rank) return b.severity_rank - a.severity_rank;
      const qRank = (s: string) => (s === "error" ? 2 : s === "warning" ? 1 : 0);
      if (qRank(b.quality_status) !== qRank(a.quality_status)) return qRank(b.quality_status) - qRank(a.quality_status);
      const zA = Math.abs(a.z_score_individual || 0);
      const zB = Math.abs(b.z_score_individual || 0);
      return zB - zA;
    });

    // Sort improvements/declines by magnitude relative to threshold
    const sortByMagnitude = (a: any, b: any) => {
      const magA = Math.abs(a.change_pct || 0);
      const magB = Math.abs(b.change_pct || 0);
      return magB - magA;
    };
    for (const [, entry] of improvementsMap) entry.metrics.sort(sortByMagnitude);
    for (const [, entry] of declinesMap) entry.metrics.sort(sortByMagnitude);
    for (const [, entry] of mixedSignalsMap) entry.metrics.sort(sortByMagnitude);

    // ── 13. Secondary info ──────────────────────────────────────────────────
    const evaluatedPlayerIds = new Set(currentResults.map((r: any) => r.player_id).filter(Boolean));
    const playersWithoutEval = squadPlayers.filter((p: any) => !evaluatedPlayerIds.has(p.id));
    const playersWithoutBaseline = [...changeMapPlayers.values()].filter((p: any) =>
      Object.values(p.metrics).some((m: any) => !m.baseline_sufficient)
    ).length;

    // ── 14. Return ──────────────────────────────────────────────────────────
    return Response.json({
      session: {
        session_id: session.session_id,
        assessment_date: session.assessment_date,
        name: session.name,
        context: session.context,
        squad_name: session.squad_name,
        squad_id: session.squad_id,
        test_keys: session.test_keys,
        source_keys: session.source_keys,
        total_players: session.total_players,
        total_results: session.total_results,
      },
      previous_session: previousSession ? {
        session_id: previousSession.session_id,
        assessment_date: previousSession.assessment_date,
        name: previousSession.name,
      } : null,
      review_tray: reviewItems,
      improvements: [...improvementsMap.values()],
      declines: [...declinesMap.values()],
      mixed_signals: [...mixedSignalsMap.values()],
      change_map: {
        players: [...changeMapPlayers.values()],
        metrics: [...squadMetricValues.keys()],
      },
      secondary_info: {
        total_players: session.total_players,
        coverage: squadPlayers.length > 0 ? Math.round((evaluatedPlayerIds.size / squadPlayers.length) * 100) : 0,
        players_without_eval: playersWithoutEval.length,
        complete_batteries: session.complete_batteries,
        incomplete_batteries: session.incomplete_batteries,
        pending_results: session.pending_results,
        quality_warnings: session.quality_warnings,
        players_without_baseline: playersWithoutBaseline,
      },
      sessions_list: allSessions.map((s: any) => ({
        session_id: s.session_id,
        assessment_date: s.assessment_date,
        name: s.name,
        context: s.context,
        squad_name: s.squad_name,
        total_players: s.total_players,
        total_results: s.total_results,
        test_keys: s.test_keys,
      })),
    });
  } catch (error) {
    return evaluationErrorResponse(error);
  }
}
