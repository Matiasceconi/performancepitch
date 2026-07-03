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
    if (rows.length < 2) {
      return Response.json({ success: true, created: 0, updated: 0, message: 'Sin filas de datos' });
    }

    const dataRows = rows.slice(1);

    const players = await base44.asServiceRole.entities.Player.list('-created_date', 1000);
    const playerByName = {};
    players.forEach((p) => { playerByName[normalize(p.full_name)] = p; });

    const existingRecords = await base44.asServiceRole.entities.MedicalRecord.list('-created_date', 1000);
    const existingByName = {};
    existingRecords.forEach((r) => { existingByName[normalize(r.player_name)] = r; });

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of dataRows) {
      const playerName = (row[1] || '').trim();
      if (!playerName) continue;

      const diagnosis = row[3] || '';
      if (!diagnosis) { skipped++; continue; }

      const player = playerByName[normalize(playerName)];
      const payload = {
        player_name: playerName,
        player_id: player?.id || '',
        category_division: row[2] || '',
        diagnosis,
        affected_limb: row[4] || '',
        injury_date: parseDate(row[5]),
        expected_return: parseDate(row[6]),
        days_lost: parseDays(row[7]),
        rehab_stage: row[8] || '',
        notes: row[9] || '',
      };
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

      const existing = existingByName[normalize(playerName)];
      if (existing) {
        await base44.asServiceRole.entities.MedicalRecord.update(existing.id, payload);
        updated++;
      } else {
        const createdRecord = await base44.asServiceRole.entities.MedicalRecord.create(payload);
        existingByName[normalize(playerName)] = createdRecord;
        created++;
      }
    }

    return Response.json({ success: true, created, updated, skipped, total_rows: dataRows.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});