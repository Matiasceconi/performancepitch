import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const [records, unmatchedRows] = await Promise.all([
      base44.asServiceRole.entities.MedicalRecord.list('-created_date', 2000),
      base44.asServiceRole.entities.UnmatchedMedicalRow.filter({ status: 'pendiente' }, '-last_seen_at', 500),
    ]);

    const unlinkedRecords = records.filter((r) => !r.player_id);
    const notFoundRecords = records.filter((r) => r.not_found_in_last_sync === true);

    const groups = {};
    records.forEach((r) => {
      if (!r.player_id) return;
      const key = `${r.player_id}|${r.injury_date || ''}|${r.affected_limb || ''}|${(r.diagnosis || '').toLowerCase().trim()}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    const duplicateGroups = Object.entries(groups)
      .filter(([, recs]) => recs.length > 1)
      .map(([key, recs]) => ({ key, records: recs }));

    return Response.json({
      unmatchedRows,
      unlinkedRecords,
      notFoundRecords,
      duplicateGroups,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});