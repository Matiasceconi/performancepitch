import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function normalize(str) {
  return (str || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toDateStr(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function minutesToHHMMSS(mins) {
  if (mins == null || isNaN(mins)) return '';
  const totalSeconds = Math.round(mins * 60);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url requerido' }, { status: 400 });

    const extractResult = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: 'object',
        properties: {
          rows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                Fecha: { type: 'string' },
                Jugador: { type: 'string' },
                DIV: { type: 'string' },
                'E/P': { type: 'string' },
                TT: { type: 'number' },
                DT: { type: 'number' },
                'D_>14.4': { type: 'number' },
                'D_>19.8': { type: 'number' },
                'D_>25': { type: 'number' },
                N_Sprint: { type: 'number' },
                'Acc 2-3m/s': { type: 'number' },
                'EFF_ACC_2-3': { type: 'number' },
                'Acc +3m/s': { type: 'number' },
                'EFF_ACC+3': { type: 'number' },
                'Dec 2-3m/s': { type: 'number' },
                'EFF_DEC_2-3': { type: 'number' },
                'Dec +3m/s': { type: 'number' },
                'EFF_DEC+3': { type: 'number' },
                D_MPHI: { type: 'number' },
                RHIE: { type: 'number' },
                TPL: { type: 'number' },
                PLPM: { type: 'number' },
                Smax: { type: 'number' },
                Drel: { type: 'number' },
                RPE: { type: 'number' },
              },
            },
          },
        },
      },
    });

    if (extractResult.status !== 'success') {
      return Response.json({ error: extractResult.details || 'Error al leer el archivo' }, { status: 400 });
    }

    let rows = extractResult.output?.rows || extractResult.output || [];
    rows = rows.filter((r) => !r.DIV || String(r.DIV).toUpperCase() === 'RES');

    const squads = await base44.asServiceRole.entities.Squad.list();
    const reserveSquad = squads.find((s) => (s.name || '').toLowerCase().includes('reserva'));
    if (!reserveSquad) {
      return Response.json({ error: 'No se encontró un plantel llamado "Reserva"' }, { status: 400 });
    }

    const [players, aliases] = await Promise.all([
      base44.asServiceRole.entities.Player.list(),
      base44.asServiceRole.entities.PlayerAlias.list(),
    ]);
    const playerByNorm = {};
    players.forEach((p) => {
      const norm = normalize(p.full_name || `${p.first_name || ''} ${p.last_name || ''}`);
      if (norm) playerByNorm[norm] = p.id;
    });
    const aliasByNorm = {};
    aliases.forEach((a) => {
      if (a.normalized_alias) aliasByNorm[a.normalized_alias] = a.player_id;
    });

    const byDate = {};
    rows.forEach((r) => {
      const dateStr = toDateStr(r.Fecha);
      if (!dateStr) return;
      (byDate[dateStr] = byDate[dateStr] || []).push(r);
    });
    const fechas = Object.keys(byDate).sort();

    const existingSessions = await base44.asServiceRole.entities.TrainingSession.filter({
      squad_id: reserveSquad.id,
      import_source: 'excel_historico',
    });
    const sessionByDate = {};
    existingSessions.forEach((s) => { sessionByDate[s.date] = s; });

    let sessionsCreated = 0;
    let sessionsUpdated = 0;
    let gpsLoaded = 0;
    const unmatchedSet = new Set();
    const errors = [];
    const linkedPlayerIds = new Set();

    for (const dateStr of fechas) {
      const dateRows = byDate[dateStr];
      try {
        const avgTT = dateRows.reduce((sum, r) => sum + (r.TT || 0), 0) / dateRows.length;
        const [y, m, d] = dateStr.split('-');
        const title = `Sesión GPS Reserva - ${d}/${m}/${y}`;

        let session = sessionByDate[dateStr];
        if (session) {
          await base44.asServiceRole.entities.TrainingSession.update(session.id, {
            title,
            duration_minutes: Math.round(avgTT) || undefined,
          });
          sessionsUpdated++;
        } else {
          session = await base44.asServiceRole.entities.TrainingSession.create({
            title,
            date: dateStr,
            squad_id: reserveSquad.id,
            squad_name: reserveSquad.name,
            session_type: 'Otro',
            duration_minutes: Math.round(avgTT) || undefined,
            csv_label: 'Excel histórico',
            import_source: 'excel_historico',
          });
          sessionsCreated++;
        }

        const existingGps = await base44.asServiceRole.entities.SessionGPSData.filter({ session_id: session.id });
        const gpsByPlayer = {};
        existingGps.forEach((g) => { gpsByPlayer[g.player_id] = g; });

        const toCreate = [];
        const toUpdate = [];

        for (const row of dateRows) {
          const norm = normalize(row.Jugador);
          const playerId = playerByNorm[norm] || aliasByNorm[norm];
          if (!playerId) {
            unmatchedSet.add(row.Jugador);
            continue;
          }
          linkedPlayerIds.add(playerId);

          const payload = {
            session_id: session.id,
            player_id: playerId,
            player_name_original: row.Jugador,
            duration: minutesToHHMMSS(row.TT),
            total_distance: row.DT,
            m_min: row.TT ? row.DT / row.TT : undefined,
            distance_14_19_8: row['D_>14.4'],
            distance_19_8: row['D_>19.8'],
            distance_25: row['D_>25'],
            sprints: row.N_Sprint,
            acc_2_3_distance: row['Acc 2-3m/s'],
            acc_2_3_eff: row['EFF_ACC_2-3'],
            acc_3_distance: row['Acc +3m/s'],
            acc_3: row['EFF_ACC+3'],
            dec_2_3_distance: row['Dec 2-3m/s'],
            dec_2_3_eff: row['EFF_DEC_2-3'],
            dec_3_distance: row['Dec +3m/s'],
            dec_3: row['EFF_DEC+3'],
            hmld: row.D_MPHI,
            rhie_bouts: row.RHIE,
            player_load: row.TPL,
            player_load_per_min: row.PLPM,
            smax: row.Smax,
            max_vel_percent: row.Drel,
            extra_metrics: { 'E/P': row['E/P'], RPE: row.RPE },
            source_file: 'Excel histórico',
          };

          const existing = gpsByPlayer[playerId];
          if (existing) {
            toUpdate.push({ id: existing.id, ...payload });
          } else {
            toCreate.push(payload);
          }
        }

        if (toCreate.length > 0) {
          await base44.asServiceRole.entities.SessionGPSData.bulkCreate(toCreate);
          gpsLoaded += toCreate.length;
        }
        if (toUpdate.length > 0) {
          await base44.asServiceRole.entities.SessionGPSData.bulkUpdate(toUpdate);
          gpsLoaded += toUpdate.length;
        }
      } catch (e) {
        errors.push(`${dateStr}: ${e.message}`);
      }
    }

    return Response.json({
      fechas_detectadas: fechas.length,
      sesiones_creadas: sessionsCreated,
      sesiones_actualizadas: sessionsUpdated,
      registros_gps_cargados: gpsLoaded,
      jugadores_vinculados: linkedPlayerIds.size,
      jugadores_sin_reconocer: Array.from(unmatchedSet),
      errores: errors,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});