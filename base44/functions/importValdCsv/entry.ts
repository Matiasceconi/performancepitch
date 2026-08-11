import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import {
  normalizeName,
  parseCsv,
  calculateFileHashes,
  computeRowHash,
  linkPlayer,
  extractMetrics,
  isRetest,
  type PlayerInfo,
  type AliasInfo,
} from "../../shared/valdImportUtils.ts";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin")
      return Response.json({ error: "Forbidden — admin only" }, { status: 403 });

    const payload = await req.json();
    if (payload?.squad_id && Array.isArray(payload?.files)) {
      try {
        const forwarded = await base44.functions.invoke("importEvaluationCsv", payload);
        return Response.json(forwarded?.data ?? forwarded);
      } catch (forwardError) {
        const status = Number(forwardError?.response?.status || 500);
        const body = forwardError?.response?.data || { error: forwardError?.message || "Error al importar evaluaciones" };
        return Response.json(body, { status });
      }
    }

    const action: string = payload.action || "dry_run";
    const assessmentDate: string = payload.assessment_date;
    const files: Array<{ url: string; test_type: string; file_name: string }> =
      payload.files || [];

    if (!assessmentDate)
      return Response.json({ error: "assessment_date es requerido" }, { status: 400 });
    if (!files.length)
      return Response.json({ error: "files es requerido (al menos 1)" }, { status: 400 });

    // ── 1. Fetch + hash files ──────────────────────────────────────────────
    const fileMetas: Array<any> = [];
    const allRows: Array<{
      row: Record<string, string>;
      testType: string;
      fileName: string;
      fileUrl: string;
    }> = [];

    for (const file of files) {
      const resp = await fetch(file.url);
      if (!resp.ok) {
        return Response.json(
          { error: `No se pudo descargar ${file.file_name}: ${resp.status}` },
          { status: 400 }
        );
      }
      const buf = await resp.arrayBuffer();
      const hashes = calculateFileHashes(buf);
      const text = Buffer.from(buf).toString("utf8");
      const rows = parseCsv(text);

      fileMetas.push({
        file_name: file.file_name,
        test_type: file.test_type,
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
        allRows.push({ row, testType: file.test_type, fileName: file.file_name, fileUrl: file.url });
      }
    }

    // ── 2. Load DB players + aliases ───────────────────────────────────────
    const dbPlayersRaw = await base44.asServiceRole.entities.Player.list("full_name", 500);
    const squadsRaw = await base44.asServiceRole.entities.Squad.list("name", 200);
    const squadMap = new Map(squadsRaw.map((s: any) => [s.id, s]));

    let memberships: any[] = [];
    try {
      memberships = await base44.asServiceRole.entities.SquadMembership.list("created_date", 500);
    } catch {
      /* entity may not exist */
    }
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
      };
    });

    let aliasesRaw: any[] = [];
    try {
      aliasesRaw = await base44.asServiceRole.entities.ValdPlayerAlias.filter({ active: true });
    } catch {
      /* entity may be empty */
    }
    const aliases: AliasInfo[] = aliasesRaw.map((a: any) => ({
      aliasNormalized: a.alias_normalized,
      playerId: a.player_id,
      playerName: a.player_name,
    }));

    // ── 3. Extract unique players from CSVs ────────────────────────────────
    const csvNames = new Set<string>();
    for (const item of allRows) {
      const name = item.row["Name"] || item.row["name"] || "";
      if (name) csvNames.add(name);
    }

    const linkingResults = [...csvNames]
      .sort()
      .map((csvName) => linkPlayer(csvName, dbPlayers, aliases));

    // ── 4. Detect duplicates + retests ──────────────────────────────────────
    const seenRowHashes = new Set<string>();
    let duplicateCount = 0;
    let retestCount = 0;

    for (const item of allRows) {
      const hash = computeRowHash(item.row);
      if (seenRowHashes.has(hash)) {
        duplicateCount++;
      } else {
        seenRowHashes.add(hash);
      }
      if (isRetest(item.row)) retestCount++;
    }

    // ── 5. Build summary ───────────────────────────────────────────────────
    const linked = linkingResults.filter((l) => l.status === "exact_match").length;
    const pending = linkingResults.filter((l) => l.status === "no_match").length;
    const collisions = linkingResults.filter((l) => l.status === "collision").length;
    const possible = linkingResults.filter((l) => l.status === "possible_match").length;

    // Collect all metric keys (non-metadata columns)
    const metadataCols = new Set(["Name", "name", "Date", "date", "Test", "test", "Rep", "rep", "Attempt", "attempt", "Side", "side"]);
    const metricKeys = new Set<string>();
    for (const item of allRows) {
      for (const k of Object.keys(item.row)) {
        if (!metadataCols.has(k) && item.row[k] !== "") {
          metricKeys.add(k);
        }
      }
    }

    const summary = {
      status: action,
      assessment_date: assessmentDate,
      files: fileMetas,
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

    // ── 6. dry_run: return preview only ────────────────────────────────────
    if (action === "dry_run") {
      return Response.json(summary);
    }

    // ── 7. confirm: persist to entities ─────────────────────────────────────
    if (action === "confirm") {
      const batchId = crypto.randomUUID();

      // Create ImportBatch
      const batch = await base44.asServiceRole.entities.ValdImportBatch.create({
        batch_id: batchId,
        status: "importing",
        source: "csv_upload",
        assessment_date: assessmentDate,
        files: fileMetas,
        test_types: [...new Set(files.map((f) => f.test_type))],
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

      // Create AssessmentSession (one per batch)
      const sessionId = crypto.randomUUID();
      const session = await base44.asServiceRole.entities.ValdAssessmentSession.create({
        session_id: sessionId,
        batch_id: batchId,
        assessment_date: assessmentDate,
        squad_id: dbPlayers[0]?.squadId || null,
        squad_name: dbPlayers[0]?.squadName || null,
        organization_id: dbPlayers[0]?.organizationId || null,
        test_types: [...new Set(files.map((f) => f.test_type))],
        total_players: csvNames.size,
        total_results: allRows.length,
        created_by: user.id,
        created_at: new Date().toISOString(),
      });

      // Create TestResults
      const linkingMap = new Map(linkingResults.map((l) => [l.csvName, l]));
      const resultsToCreate: any[] = [];
      const seenInBatch = new Set<string>();

      for (const item of allRows) {
        const csvName = item.row["Name"] || item.row["name"] || "";
        const linking = linkingMap.get(csvName);
        const rowHash = computeRowHash(item.row);

        // Skip duplicates within this batch
        if (seenInBatch.has(rowHash)) continue;
        seenInBatch.add(rowHash);

        const retest = isRetest(item.row);
        if (retest) retestCount++;

        // Build metrics object (all non-metadata columns)
        const metrics: Record<string, number> = {};
        for (const key of Object.keys(item.row)) {
          if (metadataCols.has(key)) continue;
          const raw = item.row[key];
          if (raw === "") continue;
          const val = parseFloat(raw);
          if (!isNaN(val)) metrics[key] = val;
        }

        resultsToCreate.push({
          result_id: crypto.randomUUID(),
          session_id: sessionId,
          batch_id: batchId,
          assessment_date: assessmentDate,
          player_id: linking?.proposedPlayerId || null,
          player_name_csv: csvName,
          player_name_normalized: normalizeName(csvName),
          squad_id: linking?.proposedPlayerId
            ? dbPlayers.find((p) => p.id === linking.proposedPlayerId)?.squadId || null
            : null,
          squad_name: linking?.proposedPlayerId
            ? dbPlayers.find((p) => p.id === linking.proposedPlayerId)?.squadName || null
            : null,
          organization_id: linking?.proposedPlayerId
            ? dbPlayers.find((p) => p.id === linking.proposedPlayerId)?.organizationId || null
            : null,
          product: "ForceDecks",
          test_type: item.testType,
          test_side: item.row["Side"] || item.row["side"] || "Bilateral",
          retest,
          metrics,
          raw_row: item.row,
          row_sha256: rowHash,
          linking_status:
            linking?.status === "exact_match"
              ? "linked"
              : linking?.status === "collision"
              ? "collision"
              : "pending",
          linking_method: linking?.method || null,
          created_at: new Date().toISOString(),
        });
      }

      // Bulk create results (batch of up to 500)
      const created = await base44.asServiceRole.entities.ValdTestResult.bulkCreate(
        resultsToCreate
      );

      // Update batch status
      await base44.asServiceRole.entities.ValdImportBatch.update(batch.id, {
        status: "completed",
        imported_session_ids: [sessionId],
        completed_at: new Date().toISOString(),
      });

      return Response.json({
        status: "completed",
        batch_id: batchId,
        session_id: sessionId,
        imported_results: created.length,
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