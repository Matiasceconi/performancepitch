import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const GK_ALIASES = new Set(['arquero', 'arq', 'gk', 'goalkeeper', 'portero', 'golero', 'guardameta', 'arqueros']);

function resolvePlayerType(player) {
  if (!player) return 'jugador_campo';
  if (player.player_type === 'arquero') return 'arquero';
  const pos = (player.position || '').toLowerCase().trim();
  return GK_ALIASES.has(pos) ? 'arquero' : 'jugador_campo';
}

function avgOf(rows, key) {
  const vals = rows.map((r) => r[key]).filter((v) => typeof v === 'number' && v > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function maxOf(rows, key) {
  const vals = rows.map((r) => r[key]).filter((v) => typeof v === 'number');
  return vals.length ? Math.max(...vals) : 0;
}

async function upsert(base44, entityName, query, data) {
  const existing = await base44.asServiceRole.entities[entityName].filter(query, '-created_date', 1);
  if (existing.length > 0) {
    await base44.asServiceRole.entities[entityName].update(existing[0].id, data);
  } else {
    await base44.asServiceRole.entities[entityName].create({ ...query, ...data });
  }
}

async function buildProfileData(rows) {
  return {
    total_sessions: new Set(rows.map((r) => r.session_id)).size,
    avg_total_distance: avgOf(rows, 'total_distance'),
    avg_m_min: avgOf(rows, 'm_min'),
    avg_distance_19_8: avgOf(rows, 'distance_19_8'),
    avg_distance_25: avgOf(rows, 'distance_25'),
    avg_sprints: avgOf(rows, 'sprints'),
    avg_acc_3: avgOf(rows, 'acc_3'),
    avg_dec_3: avgOf(rows, 'dec_3'),
    avg_player_load: avgOf(rows, 'player_load'),
    avg_smax: avgOf(rows, 'smax'),
    max_smax: maxOf(rows, 'smax'),
    updated_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    let squadIds = [];
    if (body.full) {
      const allSquads = await base44.asServiceRole.entities.Squad.list('-created_date', 200);
      squadIds = allSquads.map((s) => s.id);
    } else if (body.squad_id) {
      squadIds = [body.squad_id];
    }

    if (squadIds.length === 0) {
      return Response.json({ error: 'No se proporcionó squad_id' }, { status: 400 });
    }

    const players = await base44.asServiceRole.entities.Player.list('-created_date', 2000);
    const playerMap = {};
    players.forEach((p) => { playerMap[p.id] = p; });

    const allGps = await base44.asServiceRole.entities.SessionGPSData.list('-created_date', 10000);

    let profilesUpdated = 0;
    let microcycleProfilesUpdated = 0;

    for (const squadId of squadIds) {
      const sessions = await base44.asServiceRole.entities.TrainingSession.filter({ squad_id: squadId }, '-date', 2000);
      const sessionMap = {};
      sessions.forEach((s) => { sessionMap[s.id] = s; });

      const normalRows = allGps
        .filter((r) => sessionMap[r.session_id] && r.include_in_session_average !== false)
        .map((r) => {
          const s = sessionMap[r.session_id];
          const player = playerMap[r.player_id];
          return { ...r, date: s.date, md: s.match_day_code || 'Otro', player_type: resolvePlayerType(player) };
        });

      if (normalRows.length === 0) continue;

      const fieldRows = normalRows.filter((r) => r.player_type !== 'arquero');
      const gkRows = normalRows.filter((r) => r.player_type === 'arquero');

      const groups = [
        { type: 'campo', rows: fieldRows },
        { type: 'arqueros', rows: gkRows },
        { type: 'total', rows: normalRows },
      ];

      for (const g of groups) {
        if (g.rows.length === 0) continue;
        const data = await buildProfileData(g.rows);
        await upsert(base44, 'TeamGPSProfile', { squad_id: squadId, player_type: g.type }, data);
        profilesUpdated++;

        const mdGroups = {};
        g.rows.forEach((r) => {
          const md = r.md || 'Otro';
          if (!mdGroups[md]) mdGroups[md] = [];
          mdGroups[md].push(r);
        });

        for (const [md, mdRows] of Object.entries(mdGroups)) {
          const mdData = await buildProfileData(mdRows);
          await upsert(base44, 'TeamGPSMicrocycleProfile', { squad_id: squadId, md, player_type: g.type }, {
            sessions_count: mdData.total_sessions,
            avg_total_distance: mdData.avg_total_distance,
            avg_m_min: mdData.avg_m_min,
            avg_distance_19_8: mdData.avg_distance_19_8,
            avg_distance_25: mdData.avg_distance_25,
            avg_sprints: mdData.avg_sprints,
            avg_acc_3: mdData.avg_acc_3,
            avg_dec_3: mdData.avg_dec_3,
            avg_player_load: mdData.avg_player_load,
            avg_smax: mdData.avg_smax,
            max_smax: mdData.max_smax,
            updated_at: mdData.updated_at,
          });
          microcycleProfilesUpdated++;
        }
      }
    }

    return Response.json({ success: true, squads_processed: squadIds.length, profilesUpdated, microcycleProfilesUpdated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});