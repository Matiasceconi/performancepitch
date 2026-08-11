import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import {
  assessmentDateFromRow,
  assessmentTimeFromRow,
  athleteNameFromRow,
  autoSessionName,
  calculateFileHashes,
  computeCanonicalRowHash,
  computeIdempotencyKey,
  detectSourceKey,
  detectTestKeyFromContent,
  evaluationBlockId,
  extractAsymmetries,
  extractMetrics,
  getAttemptNumber,
  getField,
  isRetest,
  linkPlayer,
  metricHeaders,
  normalizeName,
  normalizeHeader,
  parseCsv,
  selectPrimaryAttempt,
  testKeyFromRow,
  type AliasInfo,
  type PlayerInfo,
  type PrimaryMetricConfig,
} from "../../shared/evaluationImportUtils.ts";
import {
  evaluationErrorResponse,
  requireEvaluationAccess,
} from "../../shared/evaluationAccess.ts";

type FileInput = { url: string; file_name: string; test_type?: string };
type ParsedRow = {
  row: Record<string, string>;
  fileIndex: number;
  fileName: string;
  rowNumber: number;
  sourceKey: string;
  testKey: string;
  assessmentDate: string;
  assessmentTime: string | null;
  playerName: string;
  blockId: string;
  canonicalHash?: string;
  duplicate?: boolean;
  duplicateReason?: string;
  resultId?: string;
};

const DEFAULT_PRIMARY_CONFIG: Record<string, PrimaryMetricConfig> = {
  cmj: { primaryMetric: "Jump Height", primaryDirection: "higher", secondaryMetric: "RSI", secondaryDirection: "higher" },
  sj: { primaryMetric: "Jump Height", primaryDirection: "higher", secondaryMetric: null, secondaryDirection: "higher" },
  cmrj: { primaryMetric: "RSI", primaryDirection: "higher", secondaryMetric: "Jump Height", secondaryDirection: "higher" },
};

function primaryConfig(testKey: string, definition: any): PrimaryMetricConfig {
  return {
    primaryMetric: definition?.primary_metric_key || definition?.priority_metrics?.[0] || DEFAULT_PRIMARY_CONFIG[testKey]?.primaryMetric || "",
    primaryDirection: definition?.primary_direction || DEFAULT_PRIMARY_CONFIG[testKey]?.primaryDirection || "higher",
    secondaryMetric: definition?.secondary_metric_key || definition?.priority_metrics?.[1] || DEFAULT_PRIMARY_CONFIG[testKey]?.secondaryMetric || null,
    secondaryDirection: definition?.secondary_direction || DEFAULT_PRIMARY_CONFIG[testKey]?.secondaryDirection || "higher",
  };
}

function normalizeSide(value: string): "Left" | "Right" | "Bilateral" | "N/A" {
  const side = String(value || "").trim().toLowerCase();
  if (["left", "l", "izquierda", "izq"].includes(side)) return "Left";
  if (["right", "r", "derecha", "der"].includes(side)) return "Right";
  if (["n/a", "na", "none"].includes(side)) return "N/A";
  return "Bilateral";
}

function chunks<T>(items: T[], size = 100): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size));
  return output;
}

async function bulkCreate(base44: any, entityName: string, records: any[]) {
  const created: any[] = [];
  for (const part of chunks(records)) {
    const result = await base44.asServiceRole.entities[entityName].bulkCreate(part);
    created.push(...result);
  }
  return created;
}

async function bulkUpdate(base44: any, entityName: string, records: any[]) {
  const updated: any[] = [];
  for (const part of chunks(records)) {
    const result = await base44.asServiceRole.entities[entityName].bulkUpdate(part);
    updated.push(...result);
  }
  return updated;
}

function buildPrecisionMap(metricDefinitions: any[], sourceKey: string, testKey: string) {
  const precision: Record<string, number> = {};
  let version = 1;
  for (const definition of metricDefinitions) {
    const appliesToTest = !definition.test_keys?.length || definition.test_keys.includes(testKey);
    if (definition.source_key !== sourceKey || !appliesToTest) continue;
    if (Number.isInteger(definition.precision)) {
      if (definition.csv_column) precision[definition.csv_column] = definition.precision;
      if (definition.csv_column) precision[normalizeHeader(definition.csv_column)] = definition.precision;
      if (definition.metric_key) precision[definition.metric_key] = definition.precision;
    }
    version = Math.max(version, Number(definition.catalog_version || 1));
  }
  return { precision, version };
}

function precisionForRow(metricDefinitions: any[], sourceKey: string, testKey: string, row: Record<string, string>) {
  const built = buildPrecisionMap(metricDefinitions, sourceKey, testKey);
  for (const header of metricHeaders(row)) {
    if (!Number.isInteger(built.precision[header]) && !Number.isInteger(built.precision[normalizeHeader(header)])) {
      built.precision[header] = 3;
      built.precision[normalizeHeader(header)] = 3;
    }
  }
  return built;
}

function summarizeBlocks(rows: ParsedRow[]) {
  const map = new Map<string, any>();
  for (const item of rows) {
    if (!map.has(item.blockId)) {
      map.set(item.blockId, {
        block_id: item.blockId,
        assessment_date: item.assessmentDate,
        assessment_time: item.assessmentTime,
        player_name: item.playerName,
        test_key: item.testKey,
        source_key: item.sourceKey,
        attempt_count: 0,
        result_count: 0,
        new_results: 0,
        duplicate_results: 0,
        files: new Set<string>(),
      });
    }
    const block = map.get(item.blockId);
    block.attempt_count += 1;
    block.result_count += 1;
    if (item.duplicate) block.duplicate_results += 1;
    else block.new_results += 1;
    block.files.add(item.fileName);
  }
  return [...map.values()].map((block) => ({ ...block, files: [...block.files] }));
}

export default async function (req: Request): Promise<Response> {
  let base44: any;
  let createdBatch: any = null;
  let persistedResultCount = 0;
  let persistedSessionCount = 0;
  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || "dry_run");
    const squadId = payload.squad_id || null;
    const files: FileInput[] = payload.files || [];
    const context = String(payload.context || "");
    const playerOverrides: Record<string, string> = payload.player_overrides || {};
    const rememberAliases = payload.remember_aliases !== false;

    await requireEvaluationAccess(base44, user, squadId, "create");
    if (!["dry_run", "confirm"].includes(action)) {
      return Response.json({ error: "action debe ser dry_run o confirm" }, { status: 400 });
    }
    if (!files.length) return Response.json({ error: "Seleccioná al menos un CSV" }, { status: 400 });
    if (files.length > 20) return Response.json({ error: "El máximo por lote es de 20 archivos" }, { status: 400 });

    const [squads, metricDefinitions, testDefinitions, sourceDefinitions] = await Promise.all([
      base44.asServiceRole.entities.Squad.list("name", 300),
      base44.asServiceRole.entities.EvaluationMetricDefinition.list("display_order", 1000).catch(() => []),
      base44.asServiceRole.entities.EvaluationTestDefinition.list("display_order", 200).catch(() => []),
      base44.asServiceRole.entities.EvaluationSource.list("display_order", 100).catch(() => []),
    ]);
    const activeSquad = squads.find((squad: any) => squad.id === squadId);
    if (!activeSquad) return Response.json({ error: "Plantel no encontrado" }, { status: 404 });
    const organizationId = activeSquad.organization_id || activeSquad.club_id || null;

    const fileMetas: any[] = [];
    const parsedRows: ParsedRow[] = [];
    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex];
      let parsedUrl: URL;
      try { parsedUrl = new URL(file.url); } catch { return Response.json({ error: `URL inválida para ${file.file_name}` }, { status: 400 }); }
      const forbiddenHost = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(parsedUrl.hostname);
      if (parsedUrl.protocol !== "https:" || forbiddenHost) {
        return Response.json({ error: `Origen de archivo no permitido para ${file.file_name}` }, { status: 400 });
      }
      const response = await fetch(parsedUrl.toString());
      if (!response.ok) {
        return Response.json({ error: `No se pudo descargar ${file.file_name}: ${response.status}` }, { status: 400 });
      }
      const declaredSize = Number(response.headers.get("content-length") || 0);
      if (declaredSize > 25 * 1024 * 1024) return Response.json({ error: `${file.file_name} supera el máximo de 25 MB` }, { status: 400 });
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 25 * 1024 * 1024) return Response.json({ error: `${file.file_name} supera el máximo de 25 MB` }, { status: 400 });
      const hashes = calculateFileHashes(buffer);
      const text = new TextDecoder("utf-8").decode(buffer);
      const rows = parseCsv(text);
      if (rows.length > 50000) return Response.json({ error: `${file.file_name} supera el máximo de 50.000 filas` }, { status: 400 });
      const headers = rows[0] ? Object.keys(rows[0]) : [];
      const detectedSource = detectSourceKey(headers, file.file_name);
      const sourceKey = detectedSource === "unknown" ? "forcedecks" : detectedSource;
      const fileTestKey = detectTestKeyFromContent(headers, headers, file.file_name, file.test_type || "");
      const dates = new Set<string>();
      const tests = new Set<string>();
      const times = new Set<string>();

      rows.forEach((row, rowIndex) => {
        const assessmentDate = assessmentDateFromRow(row);
        if (!assessmentDate) {
          throw new Error(`${file.file_name}, fila ${rowIndex + 2}: no contiene una fecha válida en el CSV (columnas admitidas: Date, Assessment Date, Test Date o Fecha)`);
        }
        const assessmentTime = assessmentTimeFromRow(row);
        const rowTestKey = testKeyFromRow(row);
        const testKey = rowTestKey !== "unknown" ? rowTestKey : fileTestKey;
        const playerName = athleteNameFromRow(row);
        if (!playerName) {
          throw new Error(`${file.file_name}, fila ${rowIndex + 2}: no se pudo identificar al jugador`);
        }
        const blockId = evaluationBlockId({ assessmentDate, assessmentTime, playerName, testKey });
        dates.add(assessmentDate);
        tests.add(testKey);
        if (assessmentTime) times.add(assessmentTime);
        parsedRows.push({
          row,
          fileIndex,
          fileName: file.file_name,
          rowNumber: rowIndex + 1,
          sourceKey,
          testKey,
          assessmentDate,
          assessmentTime,
          playerName,
          blockId,
        });
      });

      fileMetas.push({
        file_name: file.file_name,
        file_url: file.url,
        source_key: sourceKey,
        test_key: tests.size === 1 ? [...tests][0] : "multiple",
        detected_dates: [...dates].sort(),
        detected_test_keys: [...tests].sort(),
        detected_times: [...times].sort(),
        size_bytes: hashes.sizeBytes,
        raw_file_sha256: hashes.rawFileSha256,
        canonical_content_sha256: hashes.canonicalContentSha256,
        encoding: hashes.encoding,
        has_bom: hashes.hasBOM,
        line_ending: hashes.lineEnding,
        row_count: rows.length,
        column_headers: headers,
      });
    }

    const [playersRaw, memberships, aliasesRaw, existingResults, existingSessions] = await Promise.all([
      base44.asServiceRole.entities.Player.list("full_name", 3000),
      base44.asServiceRole.entities.SquadMembership.list("created_date", 5000).catch(() => []),
      base44.asServiceRole.entities.EvaluationPlayerAlias.filter({ active: true }, "alias_name", 2000).catch(() => []),
      base44.asServiceRole.entities.EvaluationResult.list("-assessment_date", 5000).catch(() => []),
      base44.asServiceRole.entities.EvaluationSession.filter({ squad_id: squadId }, "-assessment_date", 500).catch(() => []),
    ]);
    const squadMap = new Map(squads.map((squad: any) => [squad.id, squad]));
    const membershipsByPlayer = new Map<string, any[]>();
    for (const membership of memberships) {
      if (!membershipsByPlayer.has(membership.player_id)) membershipsByPlayer.set(membership.player_id, []);
      membershipsByPlayer.get(membership.player_id)!.push(membership);
    }
    const dbPlayers: PlayerInfo[] = playersRaw.map((player: any) => {
      const playerMemberships = membershipsByPlayer.get(player.id) || [];
      const membership = playerMemberships.find((item: any) => item.squad_id === squadId)
        || playerMemberships.find((item: any) => item.status !== "inactivo")
        || playerMemberships[0];
      const playerSquadId = membership?.squad_id || player.squad_id || null;
      const playerSquad = playerSquadId ? squadMap.get(playerSquadId) : null;
      return {
        id: player.id,
        fullName: player.full_name || player.name || "",
        normalized: normalizeName(player.full_name || player.name || ""),
        squadId: playerSquadId,
        squadName: playerSquadId ? squadMap.get(playerSquadId)?.name || null : null,
        organizationId: player.organization_id || playerSquad?.organization_id || playerSquad?.club_id || null,
        position: player.position || null,
      };
    });
    const clubPlayers = organizationId
      ? dbPlayers.filter((player) => player.organizationId === organizationId)
      : dbPlayers;
    const invalidOverride = Object.entries(playerOverrides).find(([, playerId]) => !clubPlayers.some((player) => player.id === playerId));
    if (invalidOverride) return Response.json({ error: `La vinculación manual de ${invalidOverride[0]} no pertenece al club autorizado` }, { status: 400 });
    const aliases: AliasInfo[] = aliasesRaw
      .filter((alias: any) => !organizationId || !alias.organization_id || alias.organization_id === organizationId)
      .map((alias: any) => ({
        aliasNormalized: alias.alias_normalized,
        playerId: alias.player_id,
        playerName: alias.player_name,
        externalPlayerId: alias.external_player_id || null,
        sourceKey: alias.source_key || null,
      }));

    const uniqueNames = [...new Set(parsedRows.map((item) => item.playerName))].sort();
    const linkingResults = uniqueNames.map((csvName) => {
      const overridden = playerOverrides[csvName];
      const player = overridden ? clubPlayers.find((item) => item.id === overridden) : null;
      if (player) {
        return {
          csvName,
          normalizedName: normalizeName(csvName),
          proposedPlayerId: player.id,
          proposedPlayerName: player.fullName,
          method: "manual_override",
          status: "exact_match" as const,
          reason: "Vinculación manual confirmada en la vista previa",
          candidateCount: 1,
          candidates: [player],
        };
      }
      const playerSources = [...new Set(parsedRows.filter((item) => item.playerName === csvName).map((item) => item.sourceKey))];
      return linkPlayer(csvName, clubPlayers, aliases, playerSources[0] || "forcedecks");
    });

    const scopedExistingResults = organizationId
      ? existingResults.filter((result: any) => result.organization_id === organizationId)
      : existingResults;
    const existingHashes = new Set(scopedExistingResults.map((result: any) => result.row_sha256).filter(Boolean));
    const seenHashes = new Set<string>();
    let duplicateCount = 0;
    for (const item of parsedRows) {
      const { precision, version } = precisionForRow(metricDefinitions, item.sourceKey, item.testKey, item.row);
      item.canonicalHash = computeCanonicalRowHash(item.row, precision);
      item.duplicate = existingHashes.has(item.canonicalHash) || seenHashes.has(item.canonicalHash);
      item.duplicateReason = existingHashes.has(item.canonicalHash)
        ? "Fila canónicamente idéntica a un resultado ya importado"
        : item.duplicate
          ? "Fila canónicamente idéntica dentro de este lote"
          : "";
      (item as any).precisionVersion = `${item.sourceKey}:${item.testKey}:v${version}`;
      if (item.duplicate) duplicateCount += 1;
      else seenHashes.add(item.canonicalHash);
    }

    const blocks = summarizeBlocks(parsedRows);
    const proposals = [...new Set(parsedRows.map((item) => item.assessmentDate))].sort().map((date) => {
      const dateRows = parsedRows.filter((item) => item.assessmentDate === date);
      const dateBlocks = blocks.filter((block) => block.assessment_date === date);
      const testKeys = [...new Set(dateRows.map((item) => item.testKey))].sort();
      const sameDateSessions = existingSessions.filter((session: any) => session.assessment_date === date);
      return {
        group_id: `date:${date}`,
        assessment_date: date,
        assessment_time: null,
        name: autoSessionName(date, testKeys),
        context,
        test_keys: testKeys,
        block_ids: dateBlocks.map((block) => block.block_id),
        blocks: dateBlocks,
        files: [...new Set(dateRows.map((item) => item.fileName))],
        total_results: dateRows.length,
        new_results: dateRows.filter((item) => !item.duplicate).length,
        duplicate_results: dateRows.filter((item) => item.duplicate).length,
        existing_sessions: sameDateSessions.map((session: any) => ({
          session_id: session.session_id,
          name: session.name,
          total_results: session.total_results || 0,
          total_players: session.total_players || 0,
          test_keys: session.test_keys || [],
        })),
        recommended_append_session_id: sameDateSessions[0]?.session_id || null,
      };
    });

    const summary = {
      status: action,
      files: fileMetas,
      session_proposals: proposals,
      blocks,
      total_results: parsedRows.length,
      new_results: parsedRows.length - duplicateCount,
      duplicate_results: duplicateCount,
      total_players: uniqueNames.length,
      linked_players: linkingResults.filter((item) => item.status === "exact_match").length,
      pending_players: linkingResults.filter((item) => item.status === "no_match").length,
      collision_players: linkingResults.filter((item) => item.status === "collision").length,
      possible_match_players: linkingResults.filter((item) => item.status === "possible_match").length,
      player_options: clubPlayers
        .map((player) => ({
          id: player.id,
          full_name: player.fullName,
          squad_name: player.squadName,
          position: player.position,
        }))
        .sort((left, right) => left.full_name.localeCompare(right.full_name)),
      linking_preview: linkingResults.map((item: any) => ({
        csv_name: item.csvName,
        normalized_name: item.normalizedName,
        proposed_player_id: item.proposedPlayerId,
        proposed_player_name: item.proposedPlayerName,
        method: item.method,
        status: item.status,
        reason: item.reason,
        candidates: (item.candidates || []).map((candidate: any) => ({
          id: candidate.id,
          full_name: candidate.fullName,
          squad_name: candidate.squadName,
          position: candidate.position,
        })),
      })),
    };
    if (action === "dry_run") return Response.json(summary);

    const sessionGroups = Array.isArray(payload.session_groups) ? payload.session_groups : [];
    if (!sessionGroups.length) {
      return Response.json({ error: "Confirmá explícitamente la agrupación de sesiones de la vista previa" }, { status: 400 });
    }
    const allNewBlockIds = new Set(blocks.filter((block) => block.new_results > 0).map((block) => block.block_id));
    const assignment = new Map<string, any>();
    for (const group of sessionGroups) {
      if (!group.assessment_date || !group.name || !Array.isArray(group.block_ids)) {
        return Response.json({ error: "Cada sesión debe tener fecha, nombre y bloques asignados" }, { status: 400 });
      }
      for (const blockId of group.block_ids) {
        if (assignment.has(blockId)) {
          return Response.json({ error: "Un bloque no puede pertenecer a dos sesiones" }, { status: 400 });
        }
        assignment.set(blockId, group);
      }
    }
    const missing = [...allNewBlockIds].filter((blockId) => !assignment.has(blockId));
    if (missing.length) {
      return Response.json({ error: `Hay ${missing.length} bloque(s) nuevos sin sesión asignada` }, { status: 400 });
    }
    for (const [blockId, group] of assignment) {
      const block = blocks.find((item) => item.block_id === blockId);
      if (block && block.assessment_date !== group.assessment_date) {
        return Response.json({ error: "No se puede mover un bloque a una fecha diferente" }, { status: 400 });
      }
    }

    const batchId = crypto.randomUUID();
    createdBatch = await base44.asServiceRole.entities.EvaluationImportBatch.create({
      batch_id: batchId,
      status: "importing",
      ingestion_method: "csv",
      provider: "vald",
      source_key: "multisource",
      organization_id: organizationId,
      squad_id: squadId,
      squad_name: activeSquad.name,
      assessment_date: proposals[0]?.assessment_date,
      context,
      session_name: proposals.length === 1 ? proposals[0].name : `${proposals.length} sesiones`,
      session_groups: sessionGroups,
      test_keys: [...new Set(parsedRows.map((item) => item.testKey))],
      total_results: parsedRows.length,
      total_players: uniqueNames.length,
      linked_players: summary.linked_players,
      pending_players: summary.pending_players,
      collision_players: summary.collision_players,
      duplicate_results: duplicateCount,
      retest_results: parsedRows.filter((item) => isRetest(item.row)).length,
      linking_preview: summary.linking_preview,
      triggered_by: user.id,
      dry_run_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
    });

    const sourceLabels: Record<string, { name: string; product_type: string }> = {
      forcedecks: { name: "ForceDecks", product_type: "jump" },
      nordbord: { name: "NordBord", product_type: "strength" },
      isopush: { name: "ISO Push", product_type: "strength" },
    };
    const sourceKeys = [...new Set(parsedRows.map((item) => item.sourceKey))];
    const missingSources = sourceKeys.filter((key) => !sourceDefinitions.some((source: any) => source.source_key === key));
    if (missingSources.length) {
      await bulkCreate(base44, "EvaluationSource", missingSources.map((key, index) => ({
        source_key: key,
        name: sourceLabels[key]?.name || key.toUpperCase(),
        provider: "vald",
        product_type: sourceLabels[key]?.product_type || "other",
        supports_csv: true,
        supports_api: false,
        active: true,
        display_order: sourceDefinitions.length + index,
      })));
    }
    const uniqueTests = [...new Map(parsedRows.map((item) => [`${item.sourceKey}|${item.testKey}`, { sourceKey: item.sourceKey, testKey: item.testKey }])).values()];
    const missingTests = uniqueTests.filter(({ sourceKey, testKey }) => !testDefinitions.some((definition: any) => definition.source_key === sourceKey && definition.test_key === testKey));
    if (missingTests.length) {
      await bulkCreate(base44, "EvaluationTestDefinition", missingTests.map(({ sourceKey, testKey }, index) => {
        const defaults = DEFAULT_PRIMARY_CONFIG[testKey];
        return {
          source_key: sourceKey,
          test_key: testKey,
          name: testKey.toUpperCase(),
          short_name: testKey.toUpperCase(),
          side_mode: testKey === "nordic" ? "unilateral" : "bilateral",
          supports_attempts: true,
          priority_metrics: [defaults?.primaryMetric, defaults?.secondaryMetric].filter(Boolean),
          primary_metric_key: defaults?.primaryMetric || "",
          primary_direction: defaults?.primaryDirection || "higher",
          secondary_metric_key: defaults?.secondaryMetric || "",
          secondary_direction: defaults?.secondaryDirection || "higher",
          config_version: 1,
          active: true,
          display_order: testDefinitions.length + index,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        };
      }));
    }
    const observedMetrics = new Map<string, { sourceKey: string; metricKey: string; testKeys: Set<string> }>();
    for (const item of parsedRows) {
      for (const header of metricHeaders(item.row)) {
        if (!observedMetrics.has(`${item.sourceKey}|${header}`)) observedMetrics.set(`${item.sourceKey}|${header}`, { sourceKey: item.sourceKey, metricKey: header, testKeys: new Set() });
        observedMetrics.get(`${item.sourceKey}|${header}`)!.testKeys.add(item.testKey);
      }
    }
    const missingMetrics = [...observedMetrics.values()].filter((observed) => !metricDefinitions.some((definition: any) => definition.source_key === observed.sourceKey && (definition.metric_key === observed.metricKey || definition.csv_column === observed.metricKey)));
    if (missingMetrics.length) {
      await bulkCreate(base44, "EvaluationMetricDefinition", missingMetrics.map((observed, index) => {
        const normalized = normalizeHeader(observed.metricKey);
        const isAsymmetry = normalized.includes("asym") || normalized.includes("imbalance");
        const lowerIsBetter = /time|duration|contact/.test(normalized) && !/flight/.test(normalized);
        return {
          metric_key: observed.metricKey,
          metric_label: observed.metricKey,
          metric_label_en: observed.metricKey,
          csv_column: observed.metricKey,
          source_key: observed.sourceKey,
          test_keys: [...observed.testKeys].sort(),
          unit: observed.metricKey.match(/[\[(]([^\]\)]+)[\]\)]/)?.[1] || "",
          direction: isAsymmetry ? "contextual" : lowerIsBetter ? "lower_is_better" : "higher_is_better",
          value_type: normalized.includes("%") || normalized.includes("percent") ? "percentage" : "number",
          precision: 3,
          catalog_version: 1,
          allows_negative: isAsymmetry,
          is_asymmetry: isAsymmetry,
          category: isAsymmetry ? "asymmetry" : /power|watt/.test(normalized) ? "power" : /force|newton/.test(normalized) ? "force" : /velocity|speed/.test(normalized) ? "velocity" : /rsi|reactive/.test(normalized) ? "reactive" : "performance",
          active: true,
          display_order: metricDefinitions.length + index,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        };
      }));
    }

    const fileRecords = fileMetas.map((meta, fileIndex) => ({
      file_id: crypto.randomUUID(),
      batch_id: batchId,
      file_name: meta.file_name,
      source_key: meta.source_key,
      test_key: meta.test_key,
      detected_dates: meta.detected_dates,
      detected_test_keys: meta.detected_test_keys,
      detected_times: meta.detected_times,
      size_bytes: meta.size_bytes,
      raw_file_sha256: meta.raw_file_sha256,
      canonical_content_sha256: meta.canonical_content_sha256,
      encoding: meta.encoding,
      has_bom: meta.has_bom,
      line_ending: meta.line_ending,
      file_url: meta.file_url,
      row_count: meta.row_count,
      column_headers: meta.column_headers,
      imported_by: user.id,
      imported_at: new Date().toISOString(),
      file_index: fileIndex,
    }));
    await bulkCreate(base44, "EvaluationImportFile", fileRecords.map(({ file_index, ...record }) => record));
    const fileIdByIndex = new Map(fileRecords.map((record) => [record.file_index, record.file_id]));

    if (rememberAliases) {
      for (const [csvName, playerId] of Object.entries(playerOverrides)) {
        const player = clubPlayers.find((item) => item.id === playerId);
        if (!player) continue;
        const playerSources = [...new Set(parsedRows.filter((item) => item.playerName === csvName).map((item) => item.sourceKey))];
        for (const sourceKey of playerSources) {
          const alreadyExists = aliasesRaw.some((alias: any) =>
            alias.alias_normalized === normalizeName(csvName)
            && alias.player_id === playerId
            && (!alias.source_key || alias.source_key === sourceKey)
          );
          if (alreadyExists) continue;
          await base44.asServiceRole.entities.EvaluationPlayerAlias.create({
            alias_name: csvName,
            alias_normalized: normalizeName(csvName),
            player_id: playerId,
            player_name: player.fullName,
            squad_id: squadId,
            squad_name: activeSquad.name,
            organization_id: organizationId,
            source_key: sourceKey,
            source: "manual_confirmation",
            confirmed_by: user.id,
            confirmed_at: new Date().toISOString(),
            active: true,
          });
        }
      }
    }

    const linkingMap = new Map(linkingResults.map((item: any) => [item.csvName, item]));
    const persistedSessions: any[] = [];
    const persistedSessionByGroupId = new Map<string, any>();
    const importedRows: any[] = [];

    for (const group of sessionGroups) {
      const groupRows = parsedRows.filter((item) => group.block_ids.includes(item.blockId));
      const newRows = groupRows.filter((item) => !item.duplicate);
      if (!newRows.length) continue;
      let session: any = null;
      if (group.append_to_session_id) {
        session = existingSessions.find((item: any) => item.session_id === group.append_to_session_id);
        if (!session || session.squad_id !== squadId || session.assessment_date !== group.assessment_date) {
          return Response.json({ error: "La sesión elegida para agregar resultados no coincide con plantel y fecha" }, { status: 400 });
        }
      }
      const sessionId = session?.session_id || crypto.randomUUID();
      const testKeys = [...new Set(groupRows.map((item) => item.testKey))].sort();
      if (!session) {
        session = await base44.asServiceRole.entities.EvaluationSession.create({
          session_id: sessionId,
          organization_id: organizationId,
          squad_id: squadId,
          squad_name: activeSquad.name,
          assessment_date: group.assessment_date,
          assessment_time: group.assessment_time || null,
          import_group_id: group.group_id || crypto.randomUUID(),
          context: group.context || context,
          name: group.name || autoSessionName(group.assessment_date, testKeys),
          source_keys: [...new Set(groupRows.map((item) => item.sourceKey))],
          test_keys: testKeys,
          total_players: 0,
          total_results: 0,
          import_status: "importing",
          created_by: user.id,
          created_at: new Date().toISOString(),
        });
      }

      const [existingSessionResults, existingBatteries] = await Promise.all([
        base44.asServiceRole.entities.EvaluationResult.filter({ session_id: sessionId }, "attempt_number", 5000).catch(() => []),
        base44.asServiceRole.entities.EvaluationBattery.filter({ session_id: sessionId }, "created_date", 1000).catch(() => []),
      ]);
      const batteryByPlayer = new Map(existingBatteries.map((battery: any) => [
        battery.player_id || `csv:${battery.player_name_csv}`,
        battery,
      ]));
      const batteriesToCreate: any[] = [];
      for (const item of newRows) {
        const linking = linkingMap.get(item.playerName);
        const playerKey = linking?.proposedPlayerId || `csv:${item.playerName}`;
        if (!batteryByPlayer.has(playerKey)) {
          const battery = {
            battery_id: crypto.randomUUID(),
            session_id: sessionId,
            player_id: linking?.proposedPlayerId || null,
            player_name_csv: item.playerName,
            player_name_normalized: normalizeName(item.playerName),
            squad_id: squadId,
            squad_name: activeSquad.name,
            organization_id: organizationId,
            test_keys: [],
            expected_test_keys: testKeys,
            test_count: 0,
            total_results: 0,
            complete: false,
            linking_status: linking?.status === "exact_match" ? "linked" : linking?.status === "collision" ? "collision" : "pending",
            linking_method: linking?.method || "no_match",
            created_at: new Date().toISOString(),
          };
          batteryByPlayer.set(playerKey, battery);
          batteriesToCreate.push(battery);
        }
      }
      if (batteriesToCreate.length) await bulkCreate(base44, "EvaluationBattery", batteriesToCreate);

      const resultsToCreate = newRows.map((item) => {
        const linking = linkingMap.get(item.playerName);
        const playerKey = linking?.proposedPlayerId || `csv:${item.playerName}`;
        const battery = batteryByPlayer.get(playerKey);
        const resultId = crypto.randomUUID();
        item.resultId = resultId;
        return {
          result_id: resultId,
          session_id: sessionId,
          battery_id: battery.battery_id,
          batch_id: batchId,
          player_id: linking?.proposedPlayerId || null,
          player_name_csv: item.playerName,
          player_name_normalized: normalizeName(item.playerName),
          squad_id: squadId,
          squad_name: activeSquad.name,
          organization_id: organizationId,
          source_key: item.sourceKey,
          test_key: item.testKey,
          test_side: normalizeSide(getField(item.row, ["Side", "Lado"])),
          attempt_number: getAttemptNumber(item.row),
          retest: isRetest(item.row),
          is_primary: false,
          primary_selection_mode: "automatic",
          primary_reason: "",
          primary_review_required: false,
          assessment_date: item.assessmentDate,
          assessment_datetime: item.assessmentTime ? `${item.assessmentDate}T${item.assessmentTime}` : null,
          metrics: extractMetrics(item.row),
          asymmetries: extractAsymmetries(item.row),
          raw_row: item.row,
          row_sha256: item.canonicalHash,
          duplicate_precision_version: (item as any).precisionVersion,
          file_id: fileIdByIndex.get(item.fileIndex),
          source_row_number: item.rowNumber,
          source_block_id: item.blockId,
          linking_status: linking?.status === "exact_match" ? "linked" : linking?.status === "collision" ? "collision" : "pending",
          linking_method: linking?.method || "no_match",
          quality_status: "ok",
          ingestion_method: "csv",
          provider: "vald",
          sync_status: "local_only",
          idempotency_key: computeIdempotencyKey(organizationId, item.sourceKey, item.row, precisionForRow(metricDefinitions, item.sourceKey, item.testKey, item.row).precision),
          schema_version: 2,
          created_at: new Date().toISOString(),
        };
      });
      const createdResults = await bulkCreate(base44, "EvaluationResult", resultsToCreate);
      persistedResultCount += createdResults.length;
      const allSessionResults = [...existingSessionResults, ...createdResults];

      const definitionMap = new Map(testDefinitions.map((definition: any) => [definition.test_key, definition]));
      const resultGroups = new Map<string, any[]>();
      for (const result of allSessionResults) {
        const key = [
          result.player_id || `csv:${result.player_name_csv}`,
          result.test_key,
          result.test_side || "Bilateral",
        ].join("|");
        if (!resultGroups.has(key)) resultGroups.set(key, []);
        resultGroups.get(key)!.push(result);
      }
      for (const [, resultGroup] of resultGroups) {
        const sample = resultGroup[0];
        const config = primaryConfig(sample.test_key, definitionMap.get(sample.test_key));
        const automatic = config.primaryMetric
          ? selectPrimaryAttempt(resultGroup.map((result: any) => ({
              result_id: result.result_id,
              attempt_number: result.attempt_number || 1,
              assessment_datetime: result.assessment_datetime,
              metrics: result.metrics || {},
              retest: result.retest,
            })), config)
          : null;
        const automaticResult = resultGroup.find((result: any) => result.result_id === automatic?.primaryId) || resultGroup[0];
        const manualPrimary = resultGroup.find((result: any) =>
          result.is_primary && result.primary_selection_mode === "manual"
        );
        const selected = manualPrimary || automaticResult;
        const updates = resultGroup.map((result: any) => ({
          id: result.id,
          is_primary: result.id === selected.id,
          primary_selection_mode: result.id === selected.id
            ? manualPrimary ? "manual" : "automatic"
            : result.primary_selection_mode || "automatic",
          primary_reason: result.id === selected.id
            ? manualPrimary?.primary_override_reason || automatic?.reason || "Primer intento"
            : "",
          primary_review_required: result.id === selected.id && !!manualPrimary && automaticResult.id !== manualPrimary.id,
          automatic_candidate_result_id: automaticResult.result_id,
          automatic_candidate_reason: automatic?.reason || "Primer intento",
        }));
        await bulkUpdate(base44, "EvaluationResult", updates);
      }

      const finalResults = await base44.asServiceRole.entities.EvaluationResult.filter({ session_id: sessionId }, "attempt_number", 5000);
      const finalBatteries = await base44.asServiceRole.entities.EvaluationBattery.filter({ session_id: sessionId }, "created_date", 1000);
      const batteryUpdates = finalBatteries.map((battery: any) => {
        const batteryResults = finalResults.filter((result: any) => result.battery_id === battery.battery_id);
        const presentTests = [...new Set(batteryResults.map((result: any) => result.test_key))].sort();
        const expectedTests = [...new Set([...(battery.expected_test_keys || []), ...testKeys])].sort();
        return {
          id: battery.id,
          test_keys: presentTests,
          expected_test_keys: expectedTests,
          test_count: presentTests.length,
          total_results: batteryResults.length,
          complete: expectedTests.every((testKey) => presentTests.includes(testKey)),
        };
      });
      if (batteryUpdates.length) await bulkUpdate(base44, "EvaluationBattery", batteryUpdates);
      const evaluatedPlayerKeys = new Set(finalResults.map((result: any) => result.player_id || `csv:${result.player_name_csv}`));
      const completeBatteries = batteryUpdates.filter((battery: any) => battery.complete).length;
      const sessionUpdate = await base44.asServiceRole.entities.EvaluationSession.update(session.id, {
        name: group.name || session.name,
        context: group.context || session.context || context,
        assessment_time: group.assessment_time || session.assessment_time || null,
        source_keys: [...new Set([...(session.source_keys || []), ...groupRows.map((item) => item.sourceKey)])],
        test_keys: [...new Set([...(session.test_keys || []), ...groupRows.map((item) => item.testKey)])].sort(),
        total_players: evaluatedPlayerKeys.size,
        total_batteries: batteryUpdates.length,
        complete_batteries: completeBatteries,
        incomplete_batteries: batteryUpdates.length - completeBatteries,
        total_results: finalResults.length,
        pending_results: finalResults.filter((result: any) => ["pending", "collision"].includes(result.linking_status)).length,
        retest_results: finalResults.filter((result: any) => result.retest).length,
        import_status: "completed",
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      });
      persistedSessions.push(sessionUpdate);
      persistedSessionByGroupId.set(group.group_id, sessionUpdate);
      importedRows.push(...newRows);
      persistedSessionCount += 1;

      await base44.asServiceRole.entities.EvaluationAuditEvent.create({
        event_id: crypto.randomUUID(),
        event_type: "import_confirmed",
        organization_id: organizationId,
        squad_id: squadId,
        session_id: sessionId,
        reason: session ? "Importación confirmada" : "Sesión creada desde importación",
        actor_id: user.id,
        actor_name: user.full_name || user.name || user.email,
        actor_email: user.email,
        metadata: {
          batch_id: batchId,
          imported_results: newRows.length,
          duplicate_results: groupRows.filter((item) => item.duplicate).length,
          block_ids: group.block_ids,
        },
        created_at: new Date().toISOString(),
      });
    }

    const rowRecords = parsedRows.map((item) => {
      const assignedGroup = assignment.get(item.blockId);
      const persistedSession = persistedSessionByGroupId.get(assignedGroup?.group_id);
      return {
        row_id: crypto.randomUUID(),
        file_id: fileIdByIndex.get(item.fileIndex),
        batch_id: batchId,
        session_id: persistedSession?.session_id || null,
        source_block_id: item.blockId,
        assessment_date: item.assessmentDate,
        assessment_time: item.assessmentTime,
        row_number: item.rowNumber,
        row_sha256: item.canonicalHash,
        raw_content: item.row,
        normalized_result_id: item.resultId || null,
        status: item.duplicate ? "duplicate" : item.resultId ? "imported" : "skipped",
        errors: [],
        warnings: item.duplicate ? [item.duplicateReason] : [],
      };
    });
    if (rowRecords.length) await bulkCreate(base44, "EvaluationImportRow", rowRecords);

    await base44.asServiceRole.entities.EvaluationImportBatch.update(createdBatch.id, {
      status: "completed",
      file_ids: fileRecords.map((record) => record.file_id),
      session_id: persistedSessions[0]?.session_id || null,
      session_ids: persistedSessions.map((session) => session.session_id),
      battery_ids: [],
      completed_at: new Date().toISOString(),
    });

    return Response.json({
      status: "completed",
      batch_id: batchId,
      sessions: persistedSessions.map((session) => ({
        session_id: session.session_id,
        assessment_date: session.assessment_date,
        name: session.name,
        total_results: session.total_results,
        total_players: session.total_players,
      })),
      imported_results: importedRows.length,
      duplicate_results: duplicateCount,
      linked_players: summary.linked_players,
      pending_players: summary.pending_players,
      collision_players: summary.collision_players,
    });
  } catch (error) {
    if (createdBatch && base44) {
      try {
        await base44.asServiceRole.entities.EvaluationImportBatch.update(createdBatch.id, {
          status: persistedResultCount || persistedSessionCount ? "partial" : "failed",
          error_message: (error as any)?.message || "Error interno",
          completed_at: new Date().toISOString(),
        });
      } catch { /* keep original error */ }
    }
    if (persistedResultCount || persistedSessionCount) {
      return Response.json({
        error: `La importación quedó parcial: ${(error as any)?.message || "error interno"}. Revisá el lote antes de reintentar.`,
        status: "partial",
        batch_id: createdBatch?.batch_id || null,
        persisted_results: persistedResultCount,
        persisted_sessions: persistedSessionCount,
      }, { status: 500 });
    }
    return evaluationErrorResponse(error);
  }
}
