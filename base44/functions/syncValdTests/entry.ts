import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ensureValidToken, getValdSettings, getTestUrl, extractMetrics } from "../../shared/valdApi.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { product, date_from, date_to } = body;
    if (!product) return Response.json({ error: 'Product is required' }, { status: 400 });

    const settings = await getValdSettings(base44);
    if (!settings) return Response.json({ error: 'VALD settings not configured' }, { status: 400 });

    const token = await ensureValidToken(base44, settings);
    const url = new URL(getTestUrl(settings.region, product));
    if (date_from) url.searchParams.set("dateFrom", date_from);
    if (date_to) url.searchParams.set("dateTo", date_to);

    const syncId = crypto.randomUUID();
    const syncLog = await base44.asServiceRole.entities.ValdSyncLog.create({
      sync_id: syncId,
      product,
      status: "started",
      started_at: new Date().toISOString(),
      triggered_by: user.email || "manual",
    });

    const resp = await fetch(url.toString(), { headers: { "Authorization": `Bearer ${token}` } });
    if (!resp.ok) {
      const text = await resp.text();
      await base44.asServiceRole.entities.ValdSyncLog.update(syncLog.id, {
        status: "failed",
        error_message: `Fetch failed (${resp.status}): ${text}`,
        completed_at: new Date().toISOString(),
      });
      throw new Error(`VALD tests fetch failed (${resp.status}): ${text}`);
    }
    const data = await resp.json();
    const tests = data.tests || data.items || (Array.isArray(data) ? data : []);

    const existing = await base44.asServiceRole.entities.ValdTest.filter({ product }, "-test_date", 500);
    const existingMap = new Map(existing.map(t => [t.test_id, t]));

    const profiles = await base44.asServiceRole.entities.ValdProfile.list("vald_profile_id", 500);
    const profileMap = new Map(profiles.map(p => [p.vald_profile_id, p]));

    let imported = 0, updated = 0;
    for (const test of tests) {
      const testId = test.id || test.testId || test.test_id;
      if (!testId) continue;

      const valdProfileId = test.profileId || test.profile_id || test.athleteId || "";
      const profile = profileMap.get(valdProfileId);
      const playerName = profile?.player_name || test.athleteName || test.profileName || "";
      const playerId = profile?.player_id || null;
      const squadId = profile?.squad_id || null;
      const squadName = profile?.squad_name || null;

      const testData = {
        test_id: testId,
        vald_profile_id: valdProfileId,
        player_id: playerId,
        player_name: playerName,
        squad_id: squadId,
        squad_name: squadName,
        product,
        test_date: test.date || test.testDate || test.created || new Date().toISOString(),
        test_type: test.type || test.testType || test.name || "Unknown",
        test_side: test.side || test.limb || "Bilateral",
        raw_data: test,
        metrics: extractMetrics(product, test),
        notes: test.notes || "",
        synced_at: new Date().toISOString(),
      };

      const existingTest = existingMap.get(testId);
      if (existingTest) {
        await base44.asServiceRole.entities.ValdTest.update(existingTest.id, testData);
        updated++;
      } else {
        await base44.asServiceRole.entities.ValdTest.create(testData);
        imported++;
      }
    }

    await base44.asServiceRole.entities.ValdSyncLog.update(syncLog.id, {
      status: "completed",
      tests_fetched: tests.length,
      tests_imported: imported,
      tests_updated: updated,
      completed_at: new Date().toISOString(),
    });

    await base44.asServiceRole.entities.ValdSettings.update(settings.id, {
      last_sync_at: new Date().toISOString(),
    });

    return Response.json({ success: true, sync_id: syncId, fetched: tests.length, imported, updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}