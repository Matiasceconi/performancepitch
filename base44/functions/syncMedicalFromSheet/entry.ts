import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SPREADSHEET_ID = '1rcl45gx1ngyitLCwB37CHSfhHvEVlhZHXA6U0lb1eUw';

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function parseDate(str) {
  if (!str) return undefined;
  const s = String(str).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return undefined;
  let [, d, mo, y] = m;
  if (y.length === 2) y = '20' + y;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function parseDays(str) {
  if (!str) return undefined;
  const n = parseInt(String(str).replace(/[^0-9-]/g, ''), 10);
  return isNaN(n) ? undefined : n;
}

function computeMedicalStatus(diagnosis, expectedReturn, rehabStage) {
  const diag = normalize(diagnosis);
  const stage = normalize(rehabStage);
  if (diag.includes('consulta')) return 'consulta';
  if (diag.includes('tratamiento sintomatico') || diag.includes('sobrecarga')) return 'tratamiento_sintomatico';
  if (stage.includes('retorno con el grupo')) return 'alta_medica';
  if (expectedReturn) return 'alta_medica';
  if (stage.includes('avanzada') || stage.includes('readaptacion')) return 'en_recuperacion';
  return 'lesion_activa';
}

function buildSyncKey(playerKey, injuryDate, diagnosis, affectedLimb) {
  return `${playerKey}|${injuryDate || ''}|${normalize(diagnosis)}|${normalize(affectedLimb)}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    const range = 'A:J';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!resp.ok) {
      const errText = await resp.text();
      return Response.json({ error: `Google Sheets error: ${errText}` }, { status: 500 });
    }
    const sheetData = await resp.json();
    const rows = sheetData.values || [];
    if (rows.length < 2) {
      return Response.json({ success: true, created: 0, updated: 0, unlinked: 0, message: 'Sin filas de datos' });
    }

    const dataRows = rows.slice(1);

    // Nunca crear jugadores: solo buscar existentes por DNI, alias o nombre normalizado
    const players = await base44.asServiceRole.entities.Player.list('-created_date', 1000);
    const aliases = await base44.asServiceRole.entities.PlayerAlias.list('-created_date', 2000);

    const playerByName = {};
    players.forEach((p) => {
      if (p.full_name) playerByName[normalize(p.full_name)] = p;
    });
    const playerIdByAlias = {};
    aliases.forEach((a) => {
      if (a.normalized_alias) playerIdByAlias[a.normalized_alias] = a.player_id;
    });
    const playerById = {};
    players.forEach((p) => { playerById[p.id] = p; });

    const existingRecords = await base44.asServiceRole.entities.MedicalRecord.list('-created_date', 3000);
    const existingBySyncKey = {};
    existingRecords.forEach((r) => {
      if (r.sync_key) existingBySyncKey[r.sync_key] = r;
    });

    let created = 0;
    let updated = 0;
    let unlinked = 0;
    let skipped = 0;

    for (const row of dataRows) {
      const playerName = (row[1] || '').trim();
      if (!playerName) continue;

      const diagnosis = row[3] || '';
      if (!diagnosis) { skipped++; continue; }

      const normName = normalize(playerName);
      const aliasPlayerId = playerIdByAlias[normName];
      const player = (aliasPlayerId && playerById[aliasPlayerId]) || playerByName[normName] || null;

      const playerKey = player ? player.id : `unlinked:${normName}`;
      if (!player) unlinked++;

      const injuryDate = parseDate(row[5]);
      const expectedReturn = parseDate(row[6]);
      const affectedLimb = row[4] || '';
      const rehabStage = row[8] || '';

      const syncKey = buildSyncKey(playerKey, injuryDate, diagnosis, affectedLimb);
      const medicalStatus = computeMedicalStatus(diagnosis, expectedReturn, rehabStage);

      const payload = {
        player_name: playerName,
        player_id: player?.id || '',
        category_division: row[2] || '',
        diagnosis,
        affected_limb: affectedLimb,
        injury_date: injuryDate,
        expected_return: expectedReturn,
        days_lost: parseDays(row[7]),
        rehab_stage: rehabStage,
        notes: row[9] || '',
        medical_status: medicalStatus,
        sync_key: syncKey,
      };
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

      const existing = existingBySyncKey[syncKey];
      if (existing) {
        await base44.asServiceRole.entities.MedicalRecord.update(existing.id, payload);
        updated++;
      } else {
        const createdRecord = await base44.asServiceRole.entities.MedicalRecord.create(payload);
        existingBySyncKey[syncKey] = createdRecord;
        created++;
      }
    }

    return Response.json({ success: true, created, updated, unlinked, skipped, total_rows: dataRows.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});