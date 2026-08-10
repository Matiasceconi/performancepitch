import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import {
  normalizeName,
  parseCsv,
  calculateFileHashes,
  computeRowHash,
  computeIdempotencyKey,
  linkPlayer,
  extractMetrics,
  extractAsymmetries,
  isRetest,
  getAttemptNumber,
  detectTestKey,
  METADATA_COLS,
  type PlayerInfo,
  type AliasInfo,
} from "../../shared/evaluationImportUtils.ts";

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
    const sessionName: string = payload.session_name || "";
    const files: Array<{ url: string; test_type: string; file_name: string }> = payload.files || [];

    if (!assessmentDate) return Response.json({ error: "assessment_date es requerido" }, { status: 400 });
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
      const testKey = detectTestKey(file.file_name, file.test_type);

      fileMetas.push({
        file_name: file.file_name,
        test_type: file.test_type,
        test_key: testKey,
        size_bytes: hashes.sizeBytes,
        raw_file_sha256: hashes.rawFileSha256,
        canonical_content_sha256: hashes.canonicalContentSha256,
        encoding: hashes.encoding,
        has_bom: hashes.hasBOM,
        line_ending: hashes.lineEnding,
        file_url: file.url,
        row_count: rows.length,
      });

      for (const row of rows) {
        allRows.push({ row, testKey, fileName: file.file_name, fileUrl: file.url });
      }
    }

    // ── 2. Load DB players + aliases ───────────────────────────────────────
    const dbPlayersRaw = await base44.asServiceRole.entities.Player.list("full_name", 500);
    const squadsRaw = await base44.asServiceRole.entities.Squad.list("name", 200);
    const squadMap = new Map(squadsRaw.map((s: any) => [s.id, s]));

    let memberships: any[] = [];
    try {
      memberships = await base44.asServiceRole.entities.SquadMembership.list("created_date", 500);
    } catch { /* entity may not exist */ }
    const membershipByPlayer = new Map<string, any[]>();
    for (const m of memberships) {
      if (!membershipByPlayer.has(m.player_id)) membershipByPlayer.set(m.player_id, []);
      membershipByPlayer.get(m.player_id).push(m);
    }

    const dbPlayers: PlayerInfo[] = dbPlayersRaw.map((p: any) => {
      const squad = p.squad_id ? squadMap.get(p.squad_id) : null;
      const ms = membershipByPlayer.get(p.id) || [];
      return {
        id: p.id,
        fullName: p.full_name || p.name || "",
        normalized: normalizeName(p.full_name || p.name || ""),
        squadId: p.squad_id || ms[0]?.squad_id || null,
        squadName: squad?.name || ms[0]?.squad_name || null,
        organizationId: p.organization_id || null,
        position: p.position || null,
      };
    });

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
    }));

    // ── 3. Extract unique players from CSVs ────────────────────────────────
    const csvNames = new Set<string>();
    for (const item of allRows) {
      const name = item.row["Name"] || item.row["name"] || "";
      if (name) csvNames.add(name);
    }
    const linkingResults = [...csvNames].sort().map((csvName) => linkPlayer(csvName, dbPlayers, aliases));

    // ── 4. Detect duplicates (within batch + against DB) ────────────────────
    // Check existing idempotency keys in DB
    const candidateIdempotencyKeys = allRows.map((item) => {
      const csvName = item.row["Name"] || item.row["name"] || "";
      const linking = linkingResults.find((l) => l.csvName === csvName);
      const orgId = linking?.proposedPlayerId
        ? dbPlayers.find((p) => p.id === linking.proposedPlayerId)?.organizationId || null
        : null;
      return computeIdempotencyKey(orgId, item.fileName, item.row);
    });

    let existingResults: any[] = [];
    try {
      existingResults = await base44.asServiceRole.entities.EvaluationResult.filter(
        { assessment_date: assessmentDate },
        "created_date",
        500
      );
    } catch { /* entity may be empty */ }
    const existingRowHashes = new Set(existingResults.map((r: any) => r.row_sha256).filter(Boolean));

    const seenRowHashes = new Set<string>();
    let duplicateCount = 0;
    let retestCount = 0;
    let alreadyImportedCount = 0;

    for (let i = 0; i < allRows.length; i++) {
      const item = allRows[i];
      const hash = computeRowHash(item.row);
      if (seenRowHashes.has(hash) || existingRowHashes.has(hash)) {
        duplicateCount++;
      } else {
        seenRowHashes.add(hash);
      }
      if (isRetest(item.row)) retestCount++;
    }

    // ── 5. Collect metric keys ─────────────────────────────────────────────
    const metricKeys = new Set<string>();
    for (const item of allRows) {
      for (const k of Object.keys(item.row)) {
        if (!METADATA_COLS.has(k) && item.row[k] !== "") {
          metricKeys.add(k);
        }
      }
    }

    // ── 6. Build summary ───────────────────────────────────────────────────
    const linked = linkingResults.filter((l) => l.status === "exact_match").length;
    const pending = linkingResults.filter((l) => l.status === "no_match").length;
    const collisions = linkingResults.filter((l) => l.status === "collision").length;
    const possible = linkingResults.filter((l) => l.status === "possible_match").length;
    const testKeys = [...new Set(fileMetas.map((f) => f.test_key))];

    const summary = {
      status: action,
      assessment_date: assessmentDate,
      context,
      session_name: sessionName,
      files: fileMetas,
      test_keys: testKeys,
      total_results: allRows.length,
      total_players: csvNames.size,
      linked_players: linked,
      pending_players: pending,
      collision_players: collisions,
      possible_match_players: possible,
      duplicate_results: duplicateCount,
      retest_results: retestCount,
      metric_keys: [...metricKeys].sort(),
      linking_preview: linkingResults,
    };

    // ── 7. dry_run: return preview only ────────────────────────────────────
    if (action === "dry_run") {
      return Response.json(summary);
    }

    // ── 8. confirm: persist atomically ─────────────────────────────────────
    if (action === "confirm") {
      const batchId = crypto.randomUUID();
      const sessionId = crypto.randomUUID();

      // Determine org/squad from first linked player
      const firstLinked = linkingResults.find((l) => l.status === "exact_match" && l.proposedPlayerId);
      const firstPlayer = firstLinked ? dbPlayers.find((p) => p.id === firstLinked.proposedPlayerId) : null;
      const orgId = firstPlayer?.organizationId || null;
      const squadId = firstPlayer?.squadId || null;
      const squadName = firstPlayer?.squadName || null;

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
          imported_by: user.id,
          imported_at: new Date().toISOString(),
        });
      }

      // Create EvaluationSession
      await base44.asServiceRole.entities.EvaluationSession.create({
        session_id: sessionId,
        organization_id: orgId,
        squad_id: squadId,
        squad_name: squadName,
        assessment_date: assessmentDate,
        context,
        name: sessionName || `Batería ${assessmentDate}`,
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

      // Group rows by player → battery
      const linkingMap = new Map(linkingResults.map((l) => [l.csvName, l]));
      const batteriesByPlayer = new Map<string, any>();
      const resultsToCreate: any[] = [];
      const seenInBatch = new Set<string>();

      for (const item of allRows) {
        const csvName = item.row["Name"] || item.row["name"] || "";
        const linking = linkingMap.get(csvName);
        const rowHash = computeRowHash(item.row);

        // Skip exact duplicates
        if (seenInBatch.has(rowHash)) continue;
        seenInBatch.add(rowHash);

        const playerId = linking?.proposedPlayerId || null;
        const player = playerId ? dbPlayers.find((p) => p.id === playerId) : null;
        const playerOrgId = player?.organizationId || orgId;
        const playerSquadId = player?.squadId || squadId;
        const playerSquadName = player?.squadName || squadName;

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

        // Build metrics
        const metrics: Record<string, number> = {};
        for (const key of Object.keys(item.row)) {
          if (METADATA_COLS.has(key)) continue;
          const raw = item.row[key];
          if (raw === "") continue;
          const val = parseFloat(raw);
          if (!isNaN(val)) metrics[key] = val;
        }

        // Build asymmetries (separate magnitude + direction)
        const asymmetries: Record<string, { magnitude: number; direction: string | null }> = {};
        for (const key of Object.keys(item.row)) {
          if (!key.toLowerCase().includes("asym") && !key.toLowerCase().includes("imbalance")) continue;
          const raw = item.row[key];
          if (raw === "") continue;
          const val = parseFloat(raw);
          if (isNaN(val)) continue;
          asymmetries[key] = {
            magnitude: Math.abs(val),
            direction: val > 0 ? "R" : val < 0 ? "L" : null,
          };
        }

        const attemptNum = getAttemptNumber(item.row);
        const retest = isRetest(item.row);

        resultsToCreate.push({
          result_id: crypto.randomUUID(),
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
          is_primary: !retest, // first attempt is primary by default
          primary_reason: retest ? "Retest marcado en CSV" : "Primer intento (no retest)",
          assessment_date: assessmentDate,
          metrics,
          asymmetries,
          raw_row: item.row,
          row_sha256: rowHash,
          linking_status: linking?.status === "exact_match" ? "linked" : linking?.status === "collision" ? "collision" : "pending",
          linking_method: linking?.method || null,
          quality_status: "ok",
          ingestion_method: "csv",
          provider: "vald",
          sync_status: "local_only",
          idempotency_key: computeIdempotencyKey(playerOrgId, item.fileName, item.row),
          schema_version: 1,
          created_at: new Date().toISOString(),
        });
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
      await base44.asServiceRole.entities.EvaluationSession.update(
        (await base44.asServiceRole.entities.EvaluationSession.filter({ session_id: sessionId }))[0]?.id,
        {
          total_batteries: batteriesByPlayer.size,
          complete_batteries: completeBatteries,
          incomplete_batteries: batteriesByPlayer.size - completeBatteries,
        }
      );

      return Response.json({
        status: "completed",
        batch_id: batchId,
        session_id: sessionId,
        imported_results: created.length,
        total_batteries: batteriesByPlayer.size,
        complete_batteries: completeBatteries,
        linked_players: linked,
        pending_players: pending,
        collision_players: collisions,
        duplicate_results: duplicateCount,
        retest_results: retestCount,
      });
    }

    return Response.json({ error: "action must be dry_run or confirm" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}