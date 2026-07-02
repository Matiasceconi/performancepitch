import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const [records, matches] = await Promise.all([
      base44.asServiceRole.entities.MinutesRecord.list('-created_date', 3000),
      base44.asServiceRole.entities.MatchReport.list('-date', 1000),
    ]);

    const matchMap = {};
    matches.forEach((m) => { matchMap[m.id] = m; });

    let autoRepaired = 0;
    const orphans = [];

    for (const r of records) {
      if (r.hidden_from_reports) continue;

      if (r.match_id && matchMap[r.match_id]) {
        continue; // válido
      }

      // Intentar auto-reparar por fecha + rival (coincidencia confiable)
      if (!r.match_id && r.match_date && r.rival) {
        const candidate = matches.find(
          (m) => m.date === r.match_date && (m.rival || '').trim().toLowerCase() === (r.rival || '').trim().toLowerCase()
        );
        if (candidate) {
          await base44.asServiceRole.entities.MinutesRecord.update(r.id, { match_id: candidate.id, squad_id: candidate.squad_id });
          autoRepaired++;
          continue;
        }
      }

      let reason = 'sin match_id';
      if (r.match_id && !matchMap[r.match_id]) reason = 'match_id inexistente (partido eliminado)';
      else if (!r.match_id) reason = 'sin match_id';

      orphans.push({
        id: r.id,
        player_id: r.player_id || null,
        player_name: r.player_name || '',
        match_label: r.match_label || (r.rival ? `vs ${r.rival}` : ''),
        match_date: r.match_date || null,
        minutes: r.minutes || 0,
        tournament: r.tournament || '',
        reason,
      });
    }

    return Response.json({ orphans, autoRepaired, totalScanned: records.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});