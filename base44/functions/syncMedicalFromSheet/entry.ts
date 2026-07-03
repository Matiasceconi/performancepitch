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
    if (rows.length < 3) {
      return Response.json({ success: true, created: 0, updated: 0, unmatched: 0, message: 'Sin filas de datos' });
    }
    // Fila 1 = título ("RESERVA 2026"), fila 2 = encabezados reales, datos desde fila 3
    const dataRows = rows.slice(2);

    const [players, aliases, existingRecords, unmatchedRows] = await Promise.all([
      base44.asServiceRole.entities.Player.list('-created_date', 1000),
      base44.asServiceRole.entities.PlayerAlias.list('-created_date', 2000),
      base44.asServiceRole.entities.MedicalRecord.list('-created_date', 1000),
      base44.asServiceRole.entities.UnmatchedMedicalRow.filter({ status: 'pendiente' }, '-created_date', 500),
    ]);

    const playerById = {};
    const playerByNormName = {};
    players.forEach((p) => {
      playerById[p.id] = p;
      playerByNormName[normalize(p.full_name)] = p;
    });

    const aliasByNormName = {};
    aliases.forEach((a) => { if (a.normalized_alias) aliasByNormName[a.normalized_alias] = a.player_id; });

    const unmatchedByNormName = {};
    unmatchedRows.forEach((u) => { if (u.normalized_name) unmatchedByNormName[u.normalized_name] = u; });

    const now = new Date().toISOString();
    let created = 0;
    let updated = 0;
    let unmatched = 0;
    const touchedIds = new Set();

    for (const row of dataRows) {
      const rawName = (row[0] || '').trim();
      if (!rawName) continue;
      const diagnosis = row[2] || '';
      if (!diagnosis) continue;

      const normName = normalize(rawName);
      const aliasPlayerId = aliasByNormName[normName];
      const player = (aliasPlayerId && playerById[aliasPlayerId]) || playerByNormName[normName];

      const sheetPayload = {
        category_division: row[1] || '',
        diagnosis,
        affected_limb: row[3] || '',
        injury_date: parseDate(row[4]),
        expected_return: parseDate(row[5]),
        days_lost: parseDays(row[6]),
        rehab_stage: row[7] || '',
        notes: row[8] || '',
      };
      Object.keys(sheetPayload).forEach((k) => sheetPayload[k] === undefined && delete sheetPayload[k]);

      if (!player) {
        // No se reconoce al jugador: NUNCA crear un Player. Enviar a lista de sin vincular.
        const existingUnmatched = unmatchedByNormName[normName];
        if (existingUnmatched) {
          await base44.asServiceRole.entities.UnmatchedMedicalRow.update(existingUnmatched.id, {
            sheet_row_data: { raw_name: rawName, ...sheetPayload },
            last_seen_at: now,
          });
        } else {
          await base44.asServiceRole.entities.UnmatchedMedicalRow.create({
            raw_name: rawName,
            normalized_name: normName,
            sheet_row_data: { raw_name: rawName, ...sheetPayload },
            status: 'pendiente',
            last_seen_at: now,
          });
        }
        unmatched++;
        continue;
      }

      // Detectar si ya existe una lesión igual para este jugador (player_id + fecha + zona + diagnóstico)
      const existing = existingRecords.find((r) =>
        r.player_id === player.id &&
        (r.injury_date || '') === (sheetPayload.injury_date || '') &&
        (r.affected_limb || '') === (sheetPayload.affected_limb || '') &&
        (r.diagnosis || '') === diagnosis
      );

      const isAlta = /alta/i.test(sheetPayload.rehab_stage || '');
      const payload = {
        player_id: player.id,
        player_name: player.full_name,
        ...sheetPayload,
        last_synced_at: now,
        not_found_in_last_sync: false,
      };

      if (existing) {
        if (isAlta) payload.status = 'Alta médica';
        await base44.asServiceRole.entities.MedicalRecord.update(existing.id, payload);
        touchedIds.add(existing.id);
        updated++;
      } else {
        payload.source = 'Google Sheets';
        payload.status = isAlta ? 'Alta médica' : 'Lesionado';
        const createdRecord = await base44.asServiceRole.entities.MedicalRecord.create(payload);
        existingRecords.push(createdRecord);
        touchedIds.add(createdRecord.id);
        created++;
      }
    }

    // Lesiones que venían de la planilla y desaparecieron: marcar, no borrar
    const toFlag = existingRecords.filter((r) =>
      r.source === 'Google Sheets' && r.player_id && !touchedIds.has(r.id) && !r.not_found_in_last_sync
    );
    if (toFlag.length > 0) {
      await base44.asServiceRole.entities.MedicalRecord.bulkUpdate(
        toFlag.map((r) => ({ id: r.id, not_found_in_last_sync: true }))
      );
    }

    return Response.json({ success: true, created, updated, unmatched, flagged_missing: toFlag.length, total_rows: dataRows.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});