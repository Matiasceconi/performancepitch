import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import {
  evaluationErrorResponse,
  requireEvaluationAccess,
  type EvaluationAction,
} from "../../shared/evaluationAccess.ts";
import {
  selectPrimaryAttempt,
  type PrimaryMetricConfig,
} from "../../shared/evaluationImportUtils.ts";

const DEFAULT_PRIMARY_CONFIG: Record<string, PrimaryMetricConfig> = {
  cmj: { primaryMetric: "Jump Height", primaryDirection: "higher", secondaryMetric: "RSI", secondaryDirection: "higher" },
  sj: { primaryMetric: "Jump Height", primaryDirection: "higher", secondaryMetric: null, secondaryDirection: "higher" },
  cmrj: { primaryMetric: "RSI", primaryDirection: "higher", secondaryMetric: "Jump Height", secondaryDirection: "higher" },
};

function configForTest(testKey: string, testDefinition: any): PrimaryMetricConfig {
  return {
    primaryMetric: testDefinition?.primary_metric_key || testDefinition?.priority_metrics?.[0] || DEFAULT_PRIMARY_CONFIG[testKey]?.primaryMetric || "",
    primaryDirection: testDefinition?.primary_direction || DEFAULT_PRIMARY_CONFIG[testKey]?.primaryDirection || "higher",
    secondaryMetric: testDefinition?.secondary_metric_key || testDefinition?.priority_metrics?.[1] || DEFAULT_PRIMARY_CONFIG[testKey]?.secondaryMetric || null,
    secondaryDirection: testDefinition?.secondary_direction || DEFAULT_PRIMARY_CONFIG[testKey]?.secondaryDirection || "higher",
  };
}

async function writeAudit(base44: any, user: any, data: any) {
  return base44.asServiceRole.entities.EvaluationAuditEvent.create({
    event_id: crypto.randomUUID(),
    actor_id: user.id,
    actor_name: user.full_name || user.name || user.email,
    actor_email: user.email,
    created_at: new Date().toISOString(),
    ...data,
  });
}

async function squadSessionsAndResults(base44: any, squadId: string) {
  const sessions = await base44.asServiceRole.entities.EvaluationSession.filter(
    { squad_id: squadId },
    "-assessment_date",
    200,
  );
  const sessionIds = new Set(sessions.map((session: any) => session.session_id));
  const allResults = await base44.asServiceRole.entities.EvaluationResult.list("-assessment_date", 5000);
  const results = allResults.filter((result: any) => sessionIds.has(result.session_id));
  return { sessions, results };
}

async function listPlayers(base44: any, squadId: string, results: any[]) {
  const [players, memberships] = await Promise.all([
    base44.asServiceRole.entities.Player.list("full_name", 3000),
    base44.asServiceRole.entities.SquadMembership.list("created_date", 5000).catch(() => []),
  ]);
  const playerMap = new Map(players.map((player: any) => [player.id, player]));
  const membershipIds = new Set(
    memberships
      .filter((membership: any) => membership.squad_id === squadId && membership.status !== "inactivo")
      .map((membership: any) => membership.player_id),
  );
  const squadPlayers = players.filter((player: any) => membershipIds.has(player.id) || player.squad_id === squadId);
  const byPlayer = new Map<string, any>();
  for (const result of results) {
    const key = result.player_id || `csv:${result.player_name_csv}`;
    if (!byPlayer.has(key)) {
      const player = result.player_id ? playerMap.get(result.player_id) : null;
      byPlayer.set(key, {
        id: result.player_id || key,
        realId: result.player_id || null,
        name: player?.full_name || result.player_name_csv || "Sin vincular",
        position: player?.position || "—",
        photoUrl: player?.photo_url || null,
        linked: !!result.player_id,
        linkValid: result.player_id ? playerMap.has(result.player_id) : false,
        tests: new Set<string>(),
        lastDate: result.assessment_date,
        resultCount: 0,
        pendingCount: 0,
      });
    }
    const entry = byPlayer.get(key);
    entry.tests.add(result.test_key);
    entry.resultCount += 1;
    if (result.assessment_date > entry.lastDate) entry.lastDate = result.assessment_date;
    if (["pending", "collision"].includes(result.linking_status)) entry.pendingCount += 1;
  }
  const evaluatedPlayers = [...byPlayer.values()].map((entry: any) => ({ ...entry, tests: [...entry.tests].sort() }));
  evaluatedPlayers.sort((a: any, b: any) => Number(b.linked) - Number(a.linked) || a.name.localeCompare(b.name));
  return { players, playerMap, squadPlayers, evaluatedPlayers };
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "overview");
    const squadId = body.squad_id || null;

    const permissionByAction: Record<string, EvaluationAction> = {
      overview: "view",
      players_index: "view",
      sessions: "view",
      squad_analysis: "view",
      config: "view",
      export: "export",
      save_threshold: "admin",
      delete_threshold: "admin",
      save_test_definition: "admin",
      save_metric_definition: "admin",
      toggle_alias: "admin",
      delete_alias: "admin",
      set_primary: "edit",
      restore_primary: "edit",
    };
    const permission = permissionByAction[action];
    if (!permission) return Response.json({ error: "Acción no válida" }, { status: 400 });
    const access = await requireEvaluationAccess(base44, user, squadId, permission);

    if (["overview", "players_index", "sessions", "squad_analysis", "export"].includes(action)) {
      const { sessions, results } = await squadSessionsAndResults(base44, squadId);
      const { players, squadPlayers, evaluatedPlayers } = await listPlayers(base44, squadId, results);
      if (action === "overview") {
        return Response.json({ capabilities: access.capabilities, sessions, evaluated_players: evaluatedPlayers });
      }
      if (action === "players_index") {
        return Response.json({ capabilities: access.capabilities, players: evaluatedPlayers });
      }
      if (action === "sessions") {
        const sessionResults = body.session_id
          ? results.filter((result: any) => result.session_id === body.session_id)
          : [];
        return Response.json({ capabilities: access.capabilities, sessions, results: sessionResults, players: squadPlayers });
      }
      if (action === "squad_analysis") {
        const sessionId = body.session_id || sessions[0]?.session_id;
        return Response.json({
          capabilities: access.capabilities,
          sessions,
          results: results.filter((result: any) => result.session_id === sessionId),
          players: squadPlayers,
        });
      }
      return Response.json({ capabilities: access.capabilities, sessions, results, players });
    }

    if (action === "config") {
      const [sources, testDefinitions, metricDefinitions, thresholds, aliases] = await Promise.all([
        base44.asServiceRole.entities.EvaluationSource.list("display_order", 100).catch(() => []),
        base44.asServiceRole.entities.EvaluationTestDefinition.list("display_order", 100).catch(() => []),
        base44.asServiceRole.entities.EvaluationMetricDefinition.list("display_order", 500).catch(() => []),
        base44.asServiceRole.entities.EvaluationThresholdConfig.filter({ active: true }).catch(() => []),
        base44.asServiceRole.entities.EvaluationPlayerAlias.list("alias_name", 1000).catch(() => []),
      ]);
      const applicableThresholds = thresholds
        .filter((item: any) => !item.squad_id || item.squad_id === squadId)
        .sort((left: any, right: any) => Number(left.squad_id === squadId) - Number(right.squad_id === squadId));
      const effectiveThresholds = [...new Map(applicableThresholds.map((item: any) => [
        `${item.source_key}|${item.test_key}|${item.metric_key}`,
        item,
      ])).values()];
      return Response.json({
        capabilities: access.capabilities,
        sources,
        test_definitions: testDefinitions,
        metric_definitions: metricDefinitions,
        thresholds: effectiveThresholds,
        aliases: aliases.filter((item: any) => !item.squad_id || item.squad_id === squadId),
      });
    }

    if (action === "save_threshold") {
      const form = body.threshold || {};
      if (!form.source_key || !form.test_key || !form.metric_key) {
        return Response.json({ error: "Fuente, prueba y métrica son obligatorias" }, { status: 400 });
      }
      if (!["sd", "percentage", "absolute"].includes(form.threshold_type)) {
        return Response.json({ error: "Tipo de umbral no válido" }, { status: 400 });
      }
      const thresholdData = {
        source_key: String(form.source_key),
        test_key: String(form.test_key),
        metric_key: String(form.metric_key),
        moderate_threshold: Number(form.moderate_threshold),
        important_threshold: Number(form.important_threshold),
        threshold_type: form.threshold_type,
        improvement_threshold: form.improvement_threshold == null ? null : Number(form.improvement_threshold),
        decline_threshold: form.decline_threshold == null ? null : Number(form.decline_threshold),
        asymmetry_threshold: form.asymmetry_threshold == null ? null : Number(form.asymmetry_threshold),
      };
      if (![thresholdData.moderate_threshold, thresholdData.important_threshold].every(Number.isFinite)) {
        return Response.json({ error: "Los umbrales moderado e importante deben ser numéricos" }, { status: 400 });
      }
      if (thresholdData.moderate_threshold < 0 || thresholdData.important_threshold < thresholdData.moderate_threshold) {
        return Response.json({ error: "El umbral importante debe ser mayor o igual que el moderado, y ambos no negativos" }, { status: 400 });
      }
      let version = 1;
      let previous: any = null;
      if (body.id) {
        const rows = await base44.asServiceRole.entities.EvaluationThresholdConfig.filter({ id: body.id }, "-created_date", 1);
        previous = rows[0] || null;
        if (previous) {
          if (previous.squad_id && previous.squad_id !== squadId) {
            return Response.json({ error: "Umbral fuera del plantel autorizado" }, { status: 403 });
          }
          if (previous.squad_id === squadId) {
            version = Number(previous.version || 1) + 1;
            await base44.asServiceRole.entities.EvaluationThresholdConfig.update(previous.id, {
              active: false,
              updated_by: user.id,
              updated_at: new Date().toISOString(),
            });
          }
        }
      }
      const created = await base44.asServiceRole.entities.EvaluationThresholdConfig.create({
        ...thresholdData,
        threshold_id: crypto.randomUUID(),
        squad_id: squadId,
        active: true,
        version,
        supersedes_threshold_id: previous?.threshold_id || null,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      });
      await writeAudit(base44, user, {
        event_type: "threshold_versioned",
        squad_id: squadId,
        reason: `Umbral ${thresholdData.test_key} · ${thresholdData.metric_key} v${version}`,
        metadata: { previous_id: previous?.id || null, current_id: created.id, threshold: thresholdData },
      });
      return Response.json({ threshold: created });
    }

    if (action === "delete_threshold") {
      if (!body.id) return Response.json({ error: "id requerido" }, { status: 400 });
      const rows = await base44.asServiceRole.entities.EvaluationThresholdConfig.filter({ id: body.id }, "-created_date", 1);
      const threshold = rows[0];
      if (!threshold || (threshold.squad_id && threshold.squad_id !== squadId)) {
        return Response.json({ error: "Umbral no encontrado" }, { status: 404 });
      }
      if (!threshold.squad_id) {
        return Response.json({ error: "El umbral global no puede desactivarse desde un plantel; editá para crear una versión local" }, { status: 403 });
      }
      await base44.asServiceRole.entities.EvaluationThresholdConfig.update(body.id, {
        active: false,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      });
      await writeAudit(base44, user, {
        event_type: "threshold_versioned",
        squad_id: squadId,
        reason: `Umbral ${threshold.test_key} · ${threshold.metric_key} desactivado`,
        metadata: { threshold_id: threshold.threshold_id, version: threshold.version || 1 },
      });
      return Response.json({ success: true });
    }

    if (action === "save_test_definition") {
      const definition = body.definition || {};
      if (!definition.test_key || !definition.source_key || !definition.name) {
        return Response.json({ error: "Fuente, clave y nombre son obligatorios" }, { status: 400 });
      }
      let saved;
      let previousDefinition: any = null;
      if (body.id) {
        const existing = await base44.asServiceRole.entities.EvaluationTestDefinition.filter({ id: body.id }, "-created_date", 1);
        const previous = existing[0];
        previousDefinition = previous || null;
        saved = await base44.asServiceRole.entities.EvaluationTestDefinition.update(body.id, {
          ...definition,
          config_version: Number(previous?.config_version || 1) + 1,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        });
      } else {
        saved = await base44.asServiceRole.entities.EvaluationTestDefinition.create({
          ...definition,
          config_version: 1,
          active: true,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        });
      }
      await writeAudit(base44, user, {
        event_type: "test_rule_updated",
        squad_id: squadId,
        reason: `Regla de mejor intento ${definition.test_key} v${saved.config_version || 1}`,
        metadata: {
          definition_id: saved.id,
          previous: previousDefinition ? { primary_metric_key: previousDefinition.primary_metric_key, primary_direction: previousDefinition.primary_direction, secondary_metric_key: previousDefinition.secondary_metric_key, secondary_direction: previousDefinition.secondary_direction, config_version: previousDefinition.config_version || 1 } : null,
          current: { primary_metric_key: definition.primary_metric_key, primary_direction: definition.primary_direction, secondary_metric_key: definition.secondary_metric_key, secondary_direction: definition.secondary_direction, config_version: saved.config_version || 1 },
        },
      });
      return Response.json({ definition: saved });
    }

    if (action === "save_metric_definition") {
      if (!body.id) return Response.json({ error: "id requerido" }, { status: 400 });
      const rows = await base44.asServiceRole.entities.EvaluationMetricDefinition.filter({ id: body.id }, "-created_date", 1);
      const previous = rows[0];
      if (!previous) return Response.json({ error: "Métrica no encontrada" }, { status: 404 });
      const requested = body.definition || {};
      const precision = Number(requested.precision);
      if (!Number.isInteger(precision) || precision < 0 || precision > 8) {
        return Response.json({ error: "La precisión debe ser un entero entre 0 y 8" }, { status: 400 });
      }
      const allowedDirections = ["higher_is_better", "lower_is_better", "range", "contextual", "none"];
      if (!allowedDirections.includes(requested.direction)) {
        return Response.json({ error: "Dirección no válida" }, { status: 400 });
      }
      const updated = await base44.asServiceRole.entities.EvaluationMetricDefinition.update(body.id, {
        metric_label: String(requested.metric_label || previous.metric_label),
        unit: String(requested.unit ?? previous.unit ?? ""),
        direction: requested.direction,
        precision,
        catalog_version: Number(previous.catalog_version || 1) + 1,
        active: requested.active !== false,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      });
      await writeAudit(base44, user, {
        event_type: "metric_catalog_updated",
        squad_id: squadId,
        reason: `Catálogo ${previous.metric_key} v${updated.catalog_version}`,
        metadata: {
          metric_id: previous.id,
          previous: { metric_label: previous.metric_label, unit: previous.unit, direction: previous.direction, precision: previous.precision, catalog_version: previous.catalog_version || 1 },
          current: { metric_label: updated.metric_label, unit: updated.unit, direction: updated.direction, precision: updated.precision, catalog_version: updated.catalog_version },
        },
      });
      return Response.json({ definition: updated });
    }

    if (action === "toggle_alias") {
      const aliases = await base44.asServiceRole.entities.EvaluationPlayerAlias.filter({ id: body.id }, "-created_date", 1);
      const alias = aliases[0];
      if (!alias || (alias.squad_id && alias.squad_id !== squadId)) {
        return Response.json({ error: "Alias no encontrado" }, { status: 404 });
      }
      const updated = await base44.asServiceRole.entities.EvaluationPlayerAlias.update(alias.id, { active: !alias.active });
      await writeAudit(base44, user, {
        event_type: "alias_changed",
        squad_id: squadId,
        player_id: alias.player_id,
        reason: alias.active ? "Alias desactivado" : "Alias activado",
        metadata: { alias_id: alias.id, alias_name: alias.alias_name },
      });
      return Response.json({ alias: updated });
    }

    if (action === "delete_alias") {
      const aliases = await base44.asServiceRole.entities.EvaluationPlayerAlias.filter({ id: body.id }, "-created_date", 1);
      const alias = aliases[0];
      if (!alias || (alias.squad_id && alias.squad_id !== squadId)) {
        return Response.json({ error: "Alias no encontrado" }, { status: 404 });
      }
      await base44.asServiceRole.entities.EvaluationPlayerAlias.delete(alias.id);
      await writeAudit(base44, user, {
        event_type: "alias_changed",
        squad_id: squadId,
        player_id: alias.player_id,
        reason: "Alias eliminado",
        metadata: { alias_id: alias.id, alias_name: alias.alias_name },
      });
      return Response.json({ success: true });
    }

    if (["set_primary", "restore_primary"].includes(action)) {
      const targetRows = await base44.asServiceRole.entities.EvaluationResult.filter(
        { result_id: body.result_id },
        "-created_date",
        1,
      );
      const target = targetRows[0];
      if (!target) return Response.json({ error: "Intento no encontrado" }, { status: 404 });
      const sessions = await base44.asServiceRole.entities.EvaluationSession.filter({ session_id: target.session_id }, "-assessment_date", 1);
      const session = sessions[0];
      if (!session || session.squad_id !== squadId) return Response.json({ error: "Intento fuera del plantel autorizado" }, { status: 403 });

      const allSessionResults = await base44.asServiceRole.entities.EvaluationResult.filter(
        { session_id: target.session_id },
        "attempt_number",
        1000,
      );
      const group = allSessionResults.filter((result: any) =>
        (result.player_id || result.player_name_csv) === (target.player_id || target.player_name_csv)
        && result.test_key === target.test_key
        && (result.test_side || "Bilateral") === (target.test_side || "Bilateral")
      );
      const previousPrimary = group.find((result: any) => result.is_primary) || null;
      let selected = target;
      let reason = String(body.reason || "").trim();
      let mode = "manual";

      if (action === "set_primary" && !reason) {
        return Response.json({ error: "El motivo es obligatorio" }, { status: 400 });
      }
      if (action === "restore_primary") {
        const testDefinitions = await base44.asServiceRole.entities.EvaluationTestDefinition.list("display_order", 100).catch(() => []);
        const definition = testDefinitions.find((item: any) => item.test_key === target.test_key);
        const config = configForTest(target.test_key, definition);
        const automatic = config.primaryMetric ? selectPrimaryAttempt(group.map((result: any) => ({
          result_id: result.result_id,
          attempt_number: result.attempt_number || 1,
          assessment_datetime: result.assessment_datetime,
          metrics: result.metrics || {},
          retest: result.retest,
        })), config) : null;
        selected = group.find((result: any) => result.result_id === automatic?.primaryId) || group[0];
        reason = automatic?.reason || "Primer intento por ausencia de regla configurada";
        mode = "automatic";
      }

      await base44.asServiceRole.entities.EvaluationResult.bulkUpdate(group.map((result: any) => ({
        id: result.id,
        is_primary: result.id === selected.id,
        primary_selection_mode: result.id === selected.id ? mode : "automatic",
        primary_reason: result.id === selected.id ? reason : "",
        primary_override_reason: result.id === selected.id && mode === "manual" ? reason : "",
        primary_selected_by: result.id === selected.id && mode === "manual" ? user.id : "",
        primary_selected_at: result.id === selected.id && mode === "manual" ? new Date().toISOString() : "",
        primary_review_required: false,
        automatic_candidate_result_id: mode === "automatic" ? selected.result_id : result.automatic_candidate_result_id || "",
        automatic_candidate_reason: mode === "automatic" ? reason : result.automatic_candidate_reason || "",
      })));
      await writeAudit(base44, user, {
        event_type: action === "set_primary" ? "primary_selected" : "primary_restored",
        squad_id: squadId,
        session_id: target.session_id,
        player_id: target.player_id,
        test_key: target.test_key,
        target_result_id: selected.result_id,
        previous_result_id: previousPrimary?.result_id || null,
        reason,
        metadata: { mode, test_side: target.test_side },
      });
      return Response.json({ success: true, selected_result_id: selected.result_id, mode, reason });
    }

    return Response.json({ error: "Acción no implementada" }, { status: 400 });
  } catch (error) {
    return evaluationErrorResponse(error);
  }
}
