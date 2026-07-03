import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SPREADSHEET_ID = '1rcl45gx1ngyitLCwB37CHSfhHvEVlhZHXA6U0lb1eUw';

// Filas de leyenda/título que existen en la planilla y no son episodios reales
const IGNORE_NAME_PATTERNS = [
  'semestre', 'referencias', 'lesionados con alta', 'lesionados en tratamiento',
  'etapa de la rhb', 'consultas/', 'tratamiento sintomatico/ejercicios',
];

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

// Determina el estado inicial de un episodio nuevo en base al contenido de la fila.
// Solo se usa al CREAR: los episodios existentes conservan el estado que el staff médico
// haya asignado manualmente desde la app (no se pisa en cada sincronización).
function deriveInitialStatus({ hasEndDate, rehabStage, diagnosis, notes }) {
  const rhb = normalize(rehabStage);
  const text = normalize(diagnosis) + ' ' + normalize(notes);

  if (!hasEndDate) return 'Lesión activa';
  if (rhb.includes('reintegro')) return 'Reintegro';
  if (rhb.includes('retorno') || text.includes('alta medica') || text.includes('alta')) return 'Alta médica';
  if (text.includes('tratamiento sintomatico')) return 'Tratamiento sintomático';
  if (text.includes('consulta')) return 'Consulta';
  return 'Cerrado';
}

function isLegendRow(name) {
  const n = normalize(name);
  if (!n) return true;
  return IGNORE_NAME_PATTERNS.some((p) => n.includes(p));
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
    // Fila 0: título general (RESERVA 2026). Fila 1: encabezados reales. Datos desde la fila 2.
    const dataRows = rows.slice(2);
    if (dataRows.length === 0) {
      return Response.json({ success: true, created: 0, updated: 0, message: 'Sin filas de datos' });
    }

    const players = await base44.asServiceRole.entities.Player.list('-created_date', 1000);
    const playerByName = {};
    players.forEach((p) => { playerByName[normalize(p.full_name)] = p; });

    const existingRecords = await base44.asServiceRole.entities.MedicalRecord.list('-created_date', 2000);
    const existingByKey = {};
    existingRecords.forEach((r) => {
      const key = `${normalize(r.player_name)}|${normalize(r.diagnosis)}|${r.injury_date || ''}`;
      existingByKey[key] = r;
    });

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of dataRows) {
      const playerName = (row[0] || '').trim();
      const diagnosis = (row[2] || '').trim();

      if (isLegendRow(playerName) || !diagnosis) { skipped++; continue; }

      const player = playerByName[normalize(playerName)];
      const injuryDate = parseDate(row[4]);
      const expectedReturn = parseDate(row[5]);

      const key = `${normalize(playerName)}|${normalize(diagnosis)}|${injuryDate || ''}`;
      const existing = existingByKey[key];

      const payload = {
        player_name: playerName,
        player_id: player?.id || '',
        category_division: row[1] || '',
        diagnosis,
        affected_limb: row[3] || '',
        injury_date: injuryDate,
        expected_return: expectedReturn,
        days_lost: parseDays(row[6]),
        rehab_stage: row[7] || '',
        notes: row[8] || '',
      };
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

      if (existing) {
        // No se pisa el estado: puede haber sido reclasificado manualmente en la app
        await base44.asServiceRole.entities.MedicalRecord.update(existing.id, payload);
        updated++;
      } else {
        payload.status = deriveInitialStatus({
          hasEndDate: !!expectedReturn,
          rehabStage: row[7] || '',
          diagnosis,
          notes: row[8] || '',
        });
        const createdRecord = await base44.asServiceRole.entities.MedicalRecord.create(payload);
        existingByKey[key] = createdRecord;
        created++;
      }
    }

    return Response.json({ success: true, created, updated, skipped, total_rows: dataRows.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});