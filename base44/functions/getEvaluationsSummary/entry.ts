import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import {
  calculateStats,
  zScore,
  pctChange,
  type PlayerInfo,
} from "../../shared/evaluationImportUtils.ts";
import {
  calculateBaseline,
  determineSignal,
  detectAsymmetrySignal,
  detectAnomaly,
  calculateSquadZScores,
} from "../../shared/evaluationBaseline.ts";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { session_id, squad_id, source_key, test_key, metric_key } = body;

    // ── 1. Get latest session (or specified one) ───────────────────────────
    let session: any = null;
    if (session_id) {
      const sessions = await base44.asServiceRole.entities.EvaluationSession.filter({ session_id }, "-assessment_date", 1);
      session = sessions[0] || null;
    } else {
      const filter = squad_id ? { squad_id } : {};
      const sessions = await base44.asServiceRole.entities.EvaluationSession.list("-assessment_date", 1, filter);
      session = sessions[0] || null;
    }

    if (!session) {
      return Response.json({
        session: null,
        review_tray: [],
        change_map: { players: [], metrics: [] },
        secondary_info: {
          total_players: 0, coverage: 0, players_without_eval: 0,
          complete_batteries: 0, incomplete_batteries: 0,
          pending_results: 0, quality_warnings: 0, players_without_baseline: 0,
        },
        sessions_list: [],
      });
    }

    // ── 2. Get all sessions for this squad (for history) ─────────────────────
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

    // ── 4. Get historical results (all sessions before current, same squad) ──
    const sessionDates = allSessions
      .filter((s: any) => s.assessment_date < session.assessment_date)
      .map((s: any) => s.assessment_date);
    const historicalDates = new Set(sessionDates);

    let historicalResults: any[] = [];
    if (sessionDates.length) {
      // Fetch all results for this squad's sessions
      const allResults = await base44.asServiceRole.entities.EvaluationResult.filter(
        { squad_id: session.squad_id || undefined },
        "assessment_date",
        1000
      );
      historicalResults = allResults.filter((r: any) => historicalDates.has(r.assessment_date));
    }

    // ── 5. Load players for this squad ──────────────────────────────────────
    const playersRaw = await base44.asServiceRole.entities.Player.list("full_name", 500);
    const squadPlayers = session.squad_id
      ? playersRaw.filter((p: any) => p.squad_id === session.squad_id)
      : playersRaw;

    // ── 6. Load thresholds ──────────────────────────────────────────────────
    let thresholds: any[] = [];
    try {
      thresholds = await base44.asServiceRole.entities.EvaluationThresholdConfig.filter({ active: true });
    } catch { /* entity may be empty */ }

    // ── 7. Build baselines per player per metric ────────────────────────────
    // Group historical results by player + test_key + metric
    const baselineMap = new Map<string, { values: number[]; count: number }>();
    for (const hr of historicalResults) {
      if (!hr.is_primary) continue;
      const playerId = hr.player_id;
      if (!playerId) continue;
      for (const [mk, mv] of Object.entries(hr.metrics || {})) {
        if (typeof mv !== "number" || !isFinite(mv)) continue;
        const key = `${playerId}|${hr.test_key}|${mk}`;
        if (!baselineMap.has(key)) baselineMap.set(key, { values: [], count: 0 });
        baselineMap.get(key)!.values.push(mv);
      }
    }

    // ── 8. Build review tray ────────────────────────────────────────────────
    // For each current result (primary only), check against baseline
    const reviewItems: any[] = [];
    const changeMapPlayers = new Map<string, any>();
    const squadMetricValues = new Map<string, number[]>(); // metric_key → values for z-score

    for (const cr of currentResults) {
      if (!cr.is_primary) continue;
      const playerId = cr.player_id;
      const player = playerId ? squadPlayers.find((p: any) => p.id === playerId) : null;
      const playerName = player?.full_name || cr.player_name_csv || "Sin vincular";
      const position = player?.position || "—";

      for (const [mk, mv] of Object.entries(cr.metrics || {})) {
        if (typeof mv !== "number" || !isFinite(mv)) continue;

        // Collect squad values for this metric (for z-score)
        if (!squadMetricValues.has(mk)) squadMetricValues.set(mk, []);
        squadMetricValues.get(mk)!.push(mv);

        // Get baseline
        const baselineKey = `${playerId}|${cr.test_key}|${mk}`;
        const baselineData = baselineMap.get(baselineKey);
        const baseline = baselineData
          ? calculateBaseline(baselineData.values, 3)
          : { value: null, std: null, sufficient: false, count: 0 };

        // Get thresholds for this metric
        const threshold = thresholds.find(
          (t: any) => t.source_key === cr.source_key && t.test_key === cr.test_key && t.metric_key === mk
        );
        const thresholdConfig = threshold
          ? { moderate: threshold.moderate_threshold, important: threshold.important_threshold, type: threshold.threshold_type }
          : null;

        // Determine signal
        const signal = determineSignal(mv, baseline.value, baseline.std, thresholdConfig);

        // Detect anomaly
        const anomaly = baseline.value !== null && baseline.std !== null
          ? detectAnomaly(mv, baseline.value, baseline.std)
          : { anomaly: false, reason: "" };

        // Check asymmetries
        let asymmetryFlag = null;
        for (const [ak, av] of Object.entries(cr.asymmetries || {})) {
          const aThreshold = thresholds.find(
            (t: any) => t.source_key === cr.source_key && t.test_key === cr.test_key && t.metric_key === ak
          );
          const aResult = detectAsymmetrySignal(av.magnitude, aThreshold?.asymmetry_threshold || 10);
          if (aResult.flagged) {
            asymmetryFlag = { metric: ak, magnitude: av.magnitude, direction: av.direction, reason: aResult.reason };
            break;
          }
        }

        // Only add to review tray if there's a signal
        const hasSignal =
          signal.signal === "moderate" ||
          signal.signal === "important" ||
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
            cr.quality_status === "error" ? 2 :
            cr.linking_status === "collision" ? 1 :
            cr.linking_status === "pending" ? 1 : 0;

          reviewItems.push({
            player_id: playerId,
            player_name: playerName,
            position,
            test_key: cr.test_key,
            metric_key: mk,
            current_value: mv,
            baseline_value: baseline.value,
            baseline_sufficient: baseline.sufficient,
            baseline_sessions: baseline.count,
            change_abs: signal.changeAbs,
            change_pct: signal.changePct,
            z_score_individual: signal.zScoreIndividual,
            signal: signal.signal,
            severity_rank: severityRank,
            reason: signal.reason + (anomaly.anomaly ? ` · ${anomaly.reason}` : "") + (asymmetryFlag ? ` · ${asymmetryFlag.reason}` : ""),
            quality_status: cr.quality_status,
            linking_status: cr.linking_status,
            has_asymmetry: !!asymmetryFlag,
            result_id: cr.result_id,
          });
        }

        // Build change map entry
        if (playerId) {
          if (!changeMapPlayers.has(playerId)) {
            changeMapPlayers.set(playerId, {
              player_id: playerId,
              player_name: playerName,
              position,
              metrics: {},
            });
          }
          const playerEntry = changeMapPlayers.get(playerId);
          const mapKey = `${cr.test_key}|${mk}`;
          playerEntry.metrics[mapKey] = {
            current_value: mv,
            baseline_value: baseline.value,
            baseline_sufficient: baseline.sufficient,
            change_abs: signal.changeAbs,
            change_pct: signal.changePct,
            z_score_individual: signal.zScoreIndividual,
            signal: signal.signal,
            test_key: cr.test_key,
            metric_key: mk,
            assessment_date: cr.assessment_date,
          };
        }
      }
    }

    // ── 9. Calculate squad z-scores ─────────────────────────────────────────
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

    // ── 10. Sort review tray ─────────────────────────────────────────────────
    reviewItems.sort((a, b) => {
      if (b.severity_rank !== a.severity_rank) return b.severity_rank - a.severity_rank;
      // Quality: error > warning > ok
      const qRank = (s: string) => (s === "error" ? 2 : s === "warning" ? 1 : 0);
      if (qRank(b.quality_status) !== qRank(a.quality_status)) return qRank(b.quality_status) - qRank(a.quality_status);
      // Magnitude of z-score
      const zA = Math.abs(a.z_score_individual || 0);
      const zB = Math.abs(b.z_score_individual || 0);
      if (zB !== zA) return zB - zA;
      return 0;
    });

    // ── 11. Secondary info ───────────────────────────────────────────────────
    const evaluatedPlayerIds = new Set(currentResults.map((r: any) => r.player_id).filter(Boolean));
    const playersWithoutEval = squadPlayers.filter((p: any) => !evaluatedPlayerIds.has(p.id));
    const playersWithoutBaseline = [...changeMapPlayers.values()].filter((p: any) =>
      Object.values(p.metrics).some((m: any) => !m.baseline_sufficient)
    ).length;

    // ── 12. Return ───────────────────────────────────────────────────────────
    return Response.json({
      session: {
        session_id: session.session_id,
        assessment_date: session.assessment_date,
        name: session.name,
        context: session.context,
        squad_name: session.squad_name,
        test_keys: session.test_keys,
        source_keys: session.source_keys,
      },
      review_tray: reviewItems,
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
    return Response.json({ error: error.message }, { status: 500 });
  }
}