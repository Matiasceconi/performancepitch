import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getValdSettings } from "../../shared/valdApi.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { squad_id } = body;

    const settings = await getValdSettings(base44);

    const query = squad_id ? { squad_id } : {};
    const tests = await base44.asServiceRole.entities.ValdTest.filter(query, "-test_date", 500);
    const profiles = await base44.asServiceRole.entities.ValdProfile.filter(squad_id ? { squad_id } : {}, "player_name", 500);
    const syncLogs = await base44.asServiceRole.entities.ValdSyncLog.list("-started_at", 10);

    const productCounts = {};
    const monthCounts = {};
    const playerTestCounts = {};

    for (const test of tests) {
      productCounts[test.product] = (productCounts[test.product] || 0) + 1;
      const month = (test.test_date || "").substring(0, 7);
      if (month) monthCounts[month] = (monthCounts[month] || 0) + 1;
      if (test.player_id) {
        playerTestCounts[test.player_id] = (playerTestCounts[test.player_id] || 0) + 1;
      }
    }

    const playersWithTests = Object.keys(playerTestCounts).length;
    const recentTests = tests.slice(0, 20);

    return Response.json({
      settings: settings ? { region: settings.region, last_sync_at: settings.last_sync_at, active: settings.active } : null,
      summary: {
        total_tests: tests.length,
        total_players_tested: playersWithTests,
        total_profiles: profiles.length,
        product_counts: productCounts,
        month_counts: monthCounts,
      },
      recent_tests: recentTests.map(t => ({
        id: t.id,
        player_name: t.player_name,
        product: t.product,
        test_type: t.test_type,
        test_date: t.test_date,
        test_side: t.test_side,
        metrics: t.metrics,
      })),
      sync_logs: syncLogs,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}