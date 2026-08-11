import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import {
  normalizeName,
  parseCsv,
  calculateFileHashes,
  computeCanonicalRowHash,
  computeRowHash,
  computeIdempotencyKey,
  linkPlayer,
  extractMetrics,
  extractAsymmetries,
  isRetest,
  getAttemptNumber,
  detectTestKey,
  detectTestKeyFromContent,
  detectDateFromContent,
  detectTimeFromContent,
  autoSessionName,
  METADATA_COLS,
  selectPrimaryAttempt,
  type PlayerInfo,
  type AliasInfo,
  type PrimaryMetricConfig,
} from "../../shared/evaluationImportUtils.ts";

// Default primary metric config per test (can be overridden by EvaluationTestDefinition)
const DEFAULT_PRIMARY_CONFIG: Record<string, PrimaryMetricConfig> = {
  cmj: { primaryMetric: "Jump Height", primaryDirection: "higher", secondaryMetric: "RSI", secondaryDirection: "higher" },
  sj: { primaryMetric: "Jump Height", primaryDirection: "higher", secondaryMetric: null, secondaryDirection: "higher" },
  cmrj: { primaryMetric: "RSI", primaryDirection: "higher", secondaryMetric: "Jump Height", secondaryDirection: "higher" },
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin")
      return Response.json({ error: "Forbidden — admin only" }, { status: 403 });

    const payload = await req.json();
    const action: string = payload.action || "dry_run";
    const assessmentDate: string = payload.assessment_date;
    const context: string = payload.context || "";
    let sessionName: string = payload.session_name || "";
    const squadId: string = payload.squad_id || null;
    const files: Array<{ url: string; test_type: string; file_name: string }> = payload.files || [];
    // Optional: player overrides from preview (csvName → playerId)
    const playerOverrides: Record<string, string> = payload.player_overrides || {};
    // Optional: remember aliases
    const rememberAliases: boolean = payload.remember_aliases !== false;

    if (!assessmentDate) return Response.json({ error: "assessment_date es requerido" }, { status: 400 });
    if (!squadId) return Response.json({ error: "squad_id es requerido — seleccioná un plantel antes de importar" }, { status: 400 });
    if (!files.length) return Response.json({ error: "files es requerido (al menos 1)" }, { status: 400 });

    // ── 1. Fetch + hash files ──────────────────────────────────────────────
    const fileMetas: Array<any> = [];
    const allRows: Array<{ row: Record<string, string>; testKey: string; fileName: string; fileUrl: string }> = [];

    for (const file of files) {
      const resp = await fetch(file.url);
      if (!resp.ok) {
        return Response.json({ error: `No se pudo descargar ${file.file_name}: ${resp.status}` }, { status: 400 });
      }
      const buf = await resp.arrayBuffer();
      const hashes = calculateFileHashes(buf);
      const text = Buffer.from(buf).toString("utf8");
      const rows = parseCsv(text);

      // Detect test key from CONTENT (headers + metric columns), not file name
      const headers = rows.length ? Object.keys(rows[0]) : [];
      const metricCols = headers.filter((h) => !METADATA_COLS.has(h));
      const testKey = detectTestKeyFromContent(headers, metricCols, file.file_name, file.test_type);

      // Detect date from content if available
      const detectedDate = detectDateFromContent(rows);
      const detectedTime = detectTimeFromContent(rows);

      fileMetas.push({
        file_name: file.file_name,
        test_type: file.test_type,
        test_key: testKey,
        detected_date: detectedDate,
        detected_time: detectedTime,
        size_bytes: hashes.sizeBytes,
        raw_file_sha256: hashes.rawFileSha256,
        canonical_content_sha256: hashes.canonicalContentSha256,
        encoding: hashes.encoding,
        has_bom: hashes.hasBOM,
        line_ending: hashes.lineEnding,
        file_url: file.url,
        row_count: rows.length,
        column_headers: headers,
      });

      for (const row of rows) {
        allRows.push({ row, testKey, fileName: file.file_name, fileUrl: file.url });
      }
    }

    // ── 2. Load DB players — CLUB-WIDE (not squad-limited) ─────────────────
    const dbPlayersRaw = await base44.asServiceRole.entities.Player.list("full_name", 2000);
    const squadsRaw = await base44.asServiceRole.entities.Squad.list("name", 200);
    const squadMap = new Map(squadsRaw.map((s: any) => [s.id, s]));
    const activeSquad = squadMap.get(squadId);
    if (!activeSquad) return Response.json({ error: "Plantel no encontrado" }, { status: 400 });

    // Load memberships for squad context
    let memberships: any[] = [];
    try {
      memberships = await base44.asServiceRole.entities.SquadMembership.list("created_date", 2000);
    } catch { /* entity may not exist */ }

    const membershipByPlayer = new Map<string, any[]>();
    for (const m of memberships) {
      if (!membershipByPlayer.has(m.player_id)) membershipByPlayer.set(m.player_id, []);
      membershipByPlayer.get(m.player_id).push(m);
    }

    // ALL players in the club (not just selected squad) — identity is club-wide
    const dbPlayers: PlayerInfo[] = dbPlayersRaw.map((p: any) => {
      const ms = membershipByPlayer.get(p.id) || [];
      const playerSquadId = p.squad_id || ms[0]?.squad_id || null;
      const squad = playerSquadId ? squadMap.get(playerSquadId) : null;
      return {
        id: p.id,
        fullName: p.full_name || p.name || "",
        normalized: normalizeName(p.full_name || p.name || ""),
        squadId: playerSquadId,
        squadName: squad?.name || null,
        organizationId: p.organization_id || p.club_id || null,
        position: p.position || null,
      };
    });

    // Load aliases — ALL active aliases for this organization (club-wide, not squad-limited)
    let aliasesRaw: any[] = [];
    try {
      aliasesRaw = await base44.asServiceRole.entities.EvaluationPlayerAlias.filter({ active: true });
    } catch { /* entity may be empty */ }
    const aliases: AliasInfo[] = aliasesRaw.map((a: any) => ({
      aliasNormalized: a.alias_normalized,
      playerId: a.player_id,
      playerName: a.player_name,
      externalPlayerId: a.external_player_id || null,
      sourceKey: a.source_key || null,
      organizationId: a.organization_id || null,
    }));

    // ── 3. Extract unique players from CSVs and link ────────────────────────
    const csvNames = new Set<string>();
    for (const item of allRows) {
      const name = item.row["Name"] || item.row["name"] || item.row["Athlete"] || item.row["athlete"] || "";
      if (name) csvNames.add(name);
    }

    const linkingResults = [...csvNames].sort().map((csvName) => {
      // Apply manual override from preview if provided
      if (playerOverrides[csvName]) {
        const player = dbPlayers.find((p) => p.id === playerOverrides[csvName]);
        if (player) {
          return {
            csvName,
            normalizedName: normalizeName(csvName),
            proposedPlayerId: player.id,
            proposedPlayerName: player.fullName,
            method: "manual_override",
            status: "exact_match" as const,
            reason: "Vinculación manual desde vista previa",
            candidateCount: 1,
          };
        }
      }
      return linkPlayer(csvName, dbPlayers, aliases, "forcedecks");
    });

    // ── 4. Detect duplicates using CANONICAL row hash ───────────────────────
    let existingResults: any[] = [];
    try {
      existingResults = await base44.asServiceRole.entities.EvaluationResult.filter(
        { assessment_date: assessmentDate },
        "created_date",
        1000
      );
    } catch { /* entity may be empty */ }
    const existingCanonicalHashes = new Set(existingResults.map((r: any) => r.row_sha256).filter(Boolean));

    // Load metric definitions for precision
    let metricDefs: any[] = [];
    try {
      metricDefs = await base44.asServiceRole.entities.EvaluationMetricDefinition.list("display_order", 200);
    } catch { /* empty */ }
    const metricPrecision: Record<string, number> = {};
    for (const md of metricDefs) {
      if (md.csv_column && md.value_type) {
        // precision: 2 for number, 0 for integer, 1 for percentage
        const p = md.value_type === "integer" ? 0 : md.value_type === "percentage" ? 1 : 2;
        metricPrecision[md.csv_column] = p;
        metricPrecision[md.csv_column.toLowerCase()] = p;
      }
    }

    const seenCanonicalHashes = new Set<string>();
    let duplicateCount = 0;
    let newCount = 0;
    let retestCount = 0;
    const rowStatuses: Array<{ index: number; status: "new" | "duplicate" | "error"; reason?: string }> = [];

    for (let i = 0; i < allRows.length; i++) {
      const item = allRows[i];
      const canonicalHash = computeCanonicalRowHash(item.row, metricPrecision);
      if (seenCanonicalHashes.has(canonicalHash) || existingCanonicalHashes.has(canonicalHash)) {
        duplicateCount++;
        rowStatuses.push({ index: i, status: "duplicate", reason: "Fila canónicamente idéntica a una existente" });
      } else {
        seenCanonicalHashes.add(canonicalHash);
        newCount++;
        rowStatuses.push({ index: i, status: "new" });
      }
      if (isRetest(item.row)) retestCount++;
    }

    // ── 5. Check for existing session on same date ──────────────────────────
    let existingSession: any = null;
    try {
      const existing = await base44.asServiceRole.entities.EvaluationSession.filter(
        { assessment_date: assessmentDate, squad_id: squadId },
        "-assessment_date",
        1
      );
      existingSession = existing[0] || null;
    } catch { /* empty */ }

    // ── 6. Auto-generate session name if not provided ────────────────────────
    const testKeys = [...new Set(fileMetas.map((f) => f.test_key))];
    if (!sessionName) {
      sessionName = autoSessionName(assessmentDate, testKeys);
    }

    // ── 7. Collect metric keys ─────────────────────────────────────────────
    const metricKeys = new Set<string>();
    for (const item of allRows) {
      for (const k of Object.keys(item.row)) {
        if (!METADATA_COLS.has(k) && item.row[k] !== "") {
          metricKeys.add(k);
        }
      }
    }

    // ── 8. Build summary ───────────────────────────────────────────────────
    const linked = linkingResults.filter((l) => l.status === "exact_match").length;
    const pending = linkingResults.filter((l) => l.status === "no_match").length;
    const collisions = linkingResults.filter((l) => l.status === "collision").length;
    const possible = linkingResults.filter((l) => l.status === "possible_match").length;

    const summary = {
      status: action,
      assessment_date: assessmentDate,
      detected_date: fileMetas[0]?.detected_date || null,
      detected_time: fileMetas[0]?.detected_time || null,
      context,
      session_name: sessionName,
      auto_session_name: autoSessionName(assessmentDate, testKeys),
      files: fileMetas,
      test_keys: testKeys,
      total_results: allRows.length,
      new_results: newCount,
      duplicate_results: duplicateCount,
      total_players: csvNames.size,
      linked_players: linked,
      pending_players: pending,
      collision_players: collisions,
      possible_match_players: possible,
      retest_results: retestCount,
      metric_keys: [...metricKeys].sort(),
      linking_preview: linkingResults,
      existing_session: existingSession ? {
        session_id: existingSession.session_id,
        name: existingSession.name,
        assessment_date: existingSession.assessment_date,
        total_results: existingSession.total_results,
        test_keys: existingSession.test_keys || [],
      } : null,
      row_statuses_summary: {
        new: newCount,
        duplicate: duplicateCount,
        error: 0,
      },
    };

    // ── 9. dry_run: return preview only ────────────────────────────────────
    if (action === "dry_run") {
      return Response.json(summary);
    }

    // ── 10. confirm: persist ────────────────────────────────────────────────
    if (action === "confirm") {
      const batchId = crypto.randomUUID();
      const orgId = null; // single-club app
      const squadName = activeSquad.name;

      // Use existing session if found and user chose to append, else create new
      let sessionId: string;
      let isExistingSession = false;
      if (existingSession && payload.append_to_existing !== false) {
        sessionId = existingSession.session_id;
        isExistingSession = true;
      } else {
        sessionId = crypto.randomUUID();
      }

      // Create ImportBatch
      const batch = await base44.asServiceRole.entities.EvaluationImportBatch.create({
        batch_id: batchId,
        status: "importing",
        ingestion_method: "csv",
        provider: "vald",
        source_key: "forcedecks",
        organization_id: orgId,
        squad_id: squadId,
        squad_name: squadName,
        assessment_date: assessmentDate,
        context,
        session_name: sessionName,
        test_keys: testKeys,
        total_results: allRows.length,
        total_players: csvNames.size,
        linked_players: linked,
        pending_players: pending,
        collision_players: collisions,
        duplicate_results: duplicateCount,
        retest_results: retestCount,
        linking_preview: linkingResults.map((l) => ({
          csv_name: l.csvName,
          normalized_name: l.normalizedName,
          proposed_player_id: l.proposedPlayerId,
          proposed_player_name: l.proposedPlayerName,
          method: l.method,
          status: l.status,
          reason: l.reason,
          candidate_count: l.candidateCount,
        })),
        triggered_by: user.id,
        dry_run_at: new Date().toISOString(),
      });

      // Create ImportFiles
      const fileIds: string[] = [];
      for (const fm of fileMetas) {
        const fileId = crypto.randomUUID();
        fileIds.push(fileId);
        await base44.asServiceRole.entities.EvaluationImportFile.create({
          file_id: fileId,
          batch_id: batchId,
          file_name: fm.file_name,
          source_key: "forcedecks",
          test_key: fm.test_key,
          size_bytes: fm.size_bytes,
          raw_file_sha256: fm.raw_file_sha256,
          canonical_content_sha256: fm.canonical_content_sha256,
          encoding: fm.encoding,
          has_bom: fm.has_bom,
          line_ending: fm.line_ending,
          file_url: fm.file_url,
          row_count: fm.row_count,
          column_headers: fm.column_headers,
          imported_by: user.id,
          imported_at: new Date().toISOString(),
        });
      }

      // Create or update EvaluationSession
      if (!isExistingSession) {
        await base44.asServiceRole.entities.EvaluationSession.create({
          session_id: sessionId,
          organization_id: orgId,
          squad_id: squadId,
          squad_name: squadName,
          assessment_date: assessmentDate,
          context,
          name: sessionName,
          source_keys: ["forcedecks"],
          test_keys: testKeys,
          total_players: csvNames.size,
          total_results: allRows.length,
          pending_results: pending,
          retest_results: retestCount,
          import_status: "completed",
          created_by: user.id,
          created_at: new Date().toISOString(),
        });
      }

      // ── Create aliases for manually confirmed links ──────────────────────
      if (rememberAliases) {
        for (const [csvName, playerId] of Object.entries(playerOverrides)) {
          if (!playerId) continue;
          const normalized = normalizeName(csvName);
          // Check if alias already exists
          const existing = aliases.find((a) => a.aliasNormalized === normalized && a.playerId === playerId);
          if (!existing) {
            try {
              await base44.asServiceRole.entities.EvaluationPlayerAlias.create({
                alias_name: csvName,
                alias_normalized: normalized,
                player_id: playerId,
                player_name: dbPlayers.find((p) => p.id === playerId)?.fullName || "",
                squad_id: squadId,
                squad_name: squadName,
                organization_id: orgId,
                source_key: "forcedecks",
                source: "manual_confirmation",
                confirmed_by: user.id,
                confirmed_at: new Date().toISOString(),
                active: true,
              });
            } catch (e) { /* ignore alias creation errors */ }
          }
        }
      }

      // ── Group rows by player → battery, select primary attempt ───────────
      const linkingMap = new Map(linkingResults.map((l) => [l.csvName, l]));
      const batteriesByPlayer = new Map<string, any>();
      const resultsToCreate: any[] = [];
      const seenInBatch = new Set<string>();
      // Group attempts by player+test for primary selection
      const attemptsByPlayerTest = new Map<string, any[]>();

      for (let i = 0; i < allRows.length; i++) {
        const item = allRows[i];
        const csvName = item.row["Name"] || item.row["name"] || item.row["Athlete"] || item.row["athlete"] || "";
        const linking = linkingMap.get(csvName);
        const canonicalHash = computeCanonicalRowHash(item.row, metricPrecision);

        // Skip exact duplicates (canonical)
        if (seenInBatch.has(canonicalHash)) continue;
        seenInBatch.add(canonicalHash);

        const playerId = linking?.proposedPlayerId || null;
        const player = playerId ? dbPlayers.find((p) => p.id === playerId) : null;
        const playerOrgId = player?.organizationId || orgId;
        const playerSquadId = player?.squadId || squadId;
        const playerSquadName = player?.squadName || squadName;

        // Build metrics
        const metrics: Record<string, number> = {};
        for (const key of Object.keys(item.row)) {
          if (METADATA_COLS.has(key)) continue;
          const raw = item.row[key];
          if (raw === "") continue;
          let s = String(raw).trim().replace(/\s/g, "");
          if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
          else if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");
          const val = parseFloat(s);
          if (!isNaN(val)) metrics[key] = val;
        }

        // Build asymmetries
        const asymmetries: Record<string, { magnitude: number; direction: string | null }> = {};
        for (const key of Object.keys(item.row)) {
          if (!key.toLowerCase().includes("asym") && !key.toLowerCase().includes("imbalance")) continue;
          const raw = item.row[key];
          if (raw === "") continue;
          let s = String(raw).trim().replace(/\s/g, "");
          if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
          const val = parseFloat(s);
          if (isNaN(val)) continue;
          asymmetries[key] = {
            magnitude: Math.abs(val),
            direction: val > 0 ? "R" : val < 0 ? "L" : null,
          };
        }

        const attemptNum = getAttemptNumber(item.row);
        const retest = isRetest(item.row);
        const resultId = crypto.randomUUID();

        // Get or create battery for this player
        const batteryKey = playerId || csvName;
        if (!batteriesByPlayer.has(batteryKey)) {
          batteriesByPlayer.set(batteryKey, {
            battery_id: crypto.randomUUID(),
            session_id: sessionId,
            player_id: playerId,
            player_name_csv: csvName,
            player_name_normalized: normalizeName(csvName),
            squad_id: playerSquadId,
            squad_name: playerSquadName,
            organization_id: playerOrgId,
            test_keys: new Set<string>(),
            total_results: 0,
            linking_status: linking?.status === "exact_match" ? "linked" : linking?.status === "collision" ? "collision" : "pending",
            linking_method: linking?.method || null,
            created_at: new Date().toISOString(),
          });
        }
        const battery = batteriesByPlayer.get(batteryKey);
        battery.test_keys.add(item.testKey);
        battery.total_results++;

        // Collect attempts for primary selection
        const attemptKey = `${batteryKey}|${item.testKey}`;
        if (!attemptsByPlayerTest.has(attemptKey)) attemptsByPlayerTest.set(attemptKey, []);
        attemptsByPlayerTest.get(attemptKey).push({
          result_id: resultId,
          attempt_number: attemptNum,
          assessment_datetime: item.row["Time"] || item.row["time"] || null,
          metrics,
          retest,
        });

        resultsToCreate.push({
          result_id: resultId,
          session_id: sessionId,
          battery_id: battery.battery_id,
          batch_id: batchId,
          player_id: playerId,
          player_name_csv: csvName,
          player_name_normalized: normalizeName(csvName),
          squad_id: playerSquadId,
          squad_name: playerSquadName,
          organization_id: playerOrgId,
          source_key: "forcedecks",
          test_key: item.testKey,
          test_side: item.row["Side"] || item.row["side"] || "Bilateral",
          attempt_number: attemptNum,
          retest,
          is_primary: false, // will be set after primary selection
          primary_reason: "",
          assessment_date: assessmentDate,
          metrics,
          asymmetries,
          raw_row: item.row,
          row_sha256: canonicalHash,
          linking_status: linking?.status === "exact_match" ? "linked" : linking?.status === "collision" ? "collision" : "pending",
          linking_method: linking?.method || null,
          quality_status: "ok",
          ingestion_method: "csv",
          provider: "vald",
          sync_status: "local_only",
          idempotency_key: computeIdempotencyKey(playerOrgId, item.fileName, item.row, metricPrecision),
          schema_version: 1,
          created_at: new Date().toISOString(),
        });
      }

      // ── Select primary attempt per player+test ───────────────────────────
      // Load test definitions for primary metric config
      let testDefs: any[] = [];
      try {
        testDefs = await base44.asServiceRole.entities.EvaluationTestDefinition.list("display_order", 50);
      } catch { /* empty */ }
      const testDefMap = new Map(testDefs.map((t: any) => [t.test_key, t]));

      const primarySelections = new Map<string, { primaryId: string; reason: string }>();
      for (const [attemptKey, attempts] of attemptsByPlayerTest) {
        const testKey = attemptKey.split("|")[1];
        const testDef = testDefMap.get(testKey);
        const config: PrimaryMetricConfig = testDef?.priority_metrics?.length
          ? {
              primaryMetric: testDef.priority_metrics[0],
              primaryDirection: (testDef as any).primary_direction || "higher",
              secondaryMetric: testDef.priority_metrics[1] || null,
              secondaryDirection: (testDef as any).secondary_direction || "higher",
            }
          : DEFAULT_PRIMARY_CONFIG[testKey] || { primaryMetric: "", primaryDirection: "higher", secondaryMetric: null, secondaryDirection: "higher" };

        if (config.primaryMetric) {
          const selection = selectPrimaryAttempt(attempts, config);
          if (selection) primarySelections.set(attemptKey, selection);
        } else {
          // No config — first non-retest is primary
          const firstNonRetest = attempts.find((a) => !a.retest) || attempts[0];
          if (firstNonRetest) primarySelections.set(attemptKey, { primaryId: firstNonRetest.result_id, reason: "Primer intento (sin config de métrica principal)" });
        }
      }

      // Apply primary selection
      for (const r of resultsToCreate) {
        const attemptKey = `${r.player_id || r.player_name_csv}|${r.test_key}`;
        const selection = primarySelections.get(attemptKey);
        if (selection && selection.primaryId === r.result_id) {
          r.is_primary = true;
          r.primary_reason = selection.reason;
        }
      }

      // Create batteries
      const batteryIds: string[] = [];
      for (const battery of batteriesByPlayer.values()) {
        battery.test_keys = [...battery.test_keys];
        battery.test_count = battery.test_keys.length;
        battery.complete = battery.test_keys.length === testKeys.length;
        batteryIds.push(battery.battery_id);
        await base44.asServiceRole.entities.EvaluationBattery.create(battery);
      }

      // Bulk create results
      const created = await base44.asServiceRole.entities.EvaluationResult.bulkCreate(resultsToCreate);

      // Update batch
      await base44.asServiceRole.entities.EvaluationImportBatch.update(batch.id, {
        status: "completed",
        file_ids: fileIds,
        session_id: sessionId,
        battery_ids: batteryIds,
        completed_at: new Date().toISOString(),
      });

      // Update session with battery counts
      const completeBatteries = [...batteriesByPlayer.values()].filter((b) => b.complete).length;
      const sessionFilter = await base44.asServiceRole.entities.EvaluationSession.filter({ session_id: sessionId });
      const sessionRecord = sessionFilter[0];
      if (sessionRecord) {
        const totalResults = (sessionRecord.total_results || 0) + (isExistingSession ? created.length : 0);
        await base44.asServiceRole.entities.EvaluationSession.update(sessionRecord.id, {
          total_batteries: (sessionRecord.total_batteries || 0) + batteriesByPlayer.size,
          complete_batteries: (sessionRecord.complete_batteries || 0) + completeBatteries,
          incomplete_batteries: (sessionRecord.incomplete_batteries || 0) + (batteriesByPlayer.size - completeBatteries),
          total_results: isExistingSession ? totalResults : created.length,
          total_players: isExistingSession ? Math.max(sessionRecord.total_players || 0, csvNames.size) : csvNames.size,
        });
      }

      return Response.json({
        status: "completed",
        batch_id: batchId,
        session_id: sessionId,
        appended_to_existing: isExistingSession,
        imported_results: created.length,
        new_results: newCount,
        duplicate_results: duplicateCount,
        total_batteries: batteriesByPlayer.size,
        complete_batteries: completeBatteries,
        linked_players: linked,
        pending_players: pending,
        collision_players: collisions,
        retest_results: retestCount,
      });
    }

    return Response.json({ error: "action must be dry_run or confirm" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}