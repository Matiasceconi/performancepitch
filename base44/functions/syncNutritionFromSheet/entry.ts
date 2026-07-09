import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';

const SOURCE_FILE_ID = '1tiZoeF9KjPyvntjBreRSsUhRsh1huMjm';
const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const SHEETS_MIME = 'application/vnd.google-apps.spreadsheet';

function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
}
function tokenKey(s) { return normalize(s).split(/\s+/).filter(Boolean).sort().join(' '); }
function parseNumber(v) {
  if (v === null || v === undefined || v === '') return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const cleaned = String(v).replace('%', '').replace(/\s/g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}
function parseDate(v) {
  if (!v) return undefined;
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) { let y = m[3]; if (y.length === 2) y = '20' + y; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return undefined;
}
function pickIndex(headers, variants) {
  const normalized = headers.map(normalize);
  for (const variant of variants) {
    const idx = normalized.findIndex((h) => h === normalize(variant) || h.includes(normalize(variant)));
    if (idx >= 0) return idx;
  }
  return -1;
}
function rowHash(obj) { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).slice(0, 120); }

async function ensureNativeCopy(base44, driveToken, meta) {
  const states = await base44.asServiceRole.entities.NutritionSyncState.filter({ source_file_id: SOURCE_FILE_ID }, '-created_date', 1);
  const state = states[0] || null;
  let native = state?.native_spreadsheet_id ? { id: state.native_spreadsheet_id, webViewLink: state.native_spreadsheet_url } : null;
  if (meta.mimeType === EXCEL_MIME && !native?.id) {
    const copyRes = await fetch(`https://www.googleapis.com/drive/v3/files/${SOURCE_FILE_ID}/copy?fields=id,name,mimeType,webViewLink`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${driveToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Antros grupales - Google Sheets', mimeType: SHEETS_MIME }),
    });
    if (copyRes.ok) native = await copyRes.json();
  }
  const payload = {
    source_file_id: SOURCE_FILE_ID,
    source_file_name: meta.name,
    source_mime_type: meta.mimeType,
    source_modified_time: meta.modifiedTime,
    native_spreadsheet_id: native?.id || state?.native_spreadsheet_id || '',
    native_spreadsheet_url: native?.webViewLink || state?.native_spreadsheet_url || '',
    last_synced_at: new Date().toISOString(),
  };
  if (state) await base44.asServiceRole.entities.NutritionSyncState.update(state.id, payload);
  else await base44.asServiceRole.entities.NutritionSyncState.create(payload);
  return payload;
}

function extractRowsFromWorkbook(workbook) {
  const all = [];
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: '' });
    let headerRow = 0;
    let bestScore = -1;
    for (let i = 0; i < Math.min(rows.length, 12); i++) {
      const h = rows[i] || [];
      const score = ['nombre', 'fecha', 'peso', 'talla', 'sumatoria', 'grasa'].reduce((acc, word) => acc + (h.some((c) => normalize(c).includes(word)) ? 1 : 0), 0);
      if (score > bestScore) { bestScore = score; headerRow = i; }
    }
    const headers = rows[headerRow] || [];
    const idx = {
      playerId: pickIndex(headers, ['player_id', 'id jugador']), dni: pickIndex(headers, ['dni', 'documento']), name: pickIndex(headers, ['nombre del jugador', 'jugador', 'nombre']), fecha: pickIndex(headers, ['fecha']), edad: pickIndex(headers, ['edad']), talla: pickIndex(headers, ['talla', 'altura']), peso: pickIndex(headers, ['peso']), sum6p: pickIndex(headers, ['sumatoria 6p', 'sumatoria', '6p']), imo: pickIndex(headers, ['imo']), pctMM: pickIndex(headers, ['% mm', 'porcentaje masa muscular', 'masa muscular']), kgMM: pickIndex(headers, ['kg mm', 'kg masa muscular']), pctGrasa: pickIndex(headers, ['% mg', '% grasa', 'porcentaje grasa']), kgGrasa: pickIndex(headers, ['kg grasa', 'kg mg']), categoria: pickIndex(headers, ['division', 'división', 'categoria', 'categoría']), obs: pickIndex(headers, ['observaciones', 'observacion']), tipo: pickIndex(headers, ['tipo medicion', 'tipo medición', 'tipo'])
    };
    for (let r = headerRow + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const name = idx.name >= 0 ? row[idx.name] : row[0];
      if (!name || normalize(name).includes('nombre')) continue;
      all.push({ sheetName, rowNumber: r + 1, row, idx });
    }
  }
  return all;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const drive = await base44.asServiceRole.connectors.getConnection('googledrive');
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${SOURCE_FILE_ID}?fields=id,name,mimeType,modifiedTime,webViewLink`, { headers: { Authorization: `Bearer ${drive.accessToken}` } });
    if (!metaRes.ok) return Response.json({ error: await metaRes.text() }, { status: 500 });
    const meta = await metaRes.json();
    const syncState = await ensureNativeCopy(base44, drive.accessToken, meta);

    let workbook;
    if (meta.mimeType === EXCEL_MIME) {
      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${SOURCE_FILE_ID}?alt=media`, { headers: { Authorization: `Bearer ${drive.accessToken}` } });
      if (!fileRes.ok) return Response.json({ error: await fileRes.text() }, { status: 500 });
      const buf = await fileRes.arrayBuffer();
      workbook = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true });
    } else if (meta.mimeType === SHEETS_MIME) {
      const sheets = await base44.asServiceRole.connectors.getConnection('googlesheets');
      const sheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SOURCE_FILE_ID}/values/A:Z`, { headers: { Authorization: `Bearer ${sheets.accessToken}` } });
      if (!sheetRes.ok) return Response.json({ error: await sheetRes.text() }, { status: 500 });
      const values = (await sheetRes.json()).values || [];
      const ws = XLSX.utils.aoa_to_sheet(values);
      workbook = { SheetNames: ['Hoja 1'], Sheets: { 'Hoja 1': ws } };
    } else {
      return Response.json({ error: `Formato no soportado: ${meta.mimeType}` }, { status: 400 });
    }

    const rows = extractRowsFromWorkbook(workbook);
    const [players, aliases, existing] = await Promise.all([
      base44.asServiceRole.entities.Player.list('-created_date', 5000),
      base44.asServiceRole.entities.PlayerAlias.list('-created_date', 5000),
      base44.asServiceRole.entities.NutritionAssessment.list('-fecha', 5000),
    ]);

    const playerById = {}, byDni = {}, byName = {}, byToken = {};
    players.forEach((p) => {
      const full = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
      playerById[p.id] = p;
      if (p.dni) byDni[String(p.dni).replace(/\D/g, '')] = p;
      if (p.document_number) byDni[String(p.document_number).replace(/\D/g, '')] = p;
      byName[normalize(full)] = p;
      byToken[tokenKey(full)] = p;
    });
    const aliasToPlayer = {};
    aliases.forEach((a) => { if (a.normalized_alias) aliasToPlayer[a.normalized_alias] = a.player_id; });
    const byKey = {}, byUnlinkedSignature = {};
    existing.forEach((e) => {
      if (e.nutrition_assessment_key) byKey[e.nutrition_assessment_key] = e;
      byUnlinkedSignature[`${normalize(e.player_name_original)}|${e.fecha || ''}|${normalize(e.tipo_medicion || 'Antropometría')}`] = e;
    });

    let created = 0, updated = 0, linked = 0, unlinked = 0, duplicates = 0, errors = 0, skipped_incomplete = 0;
    const seenIds = new Set();
    for (const item of rows) {
      try {
        const { row, idx, sheetName, rowNumber } = item;
        const originalName = String(idx.name >= 0 ? row[idx.name] : row[0] || '').trim();
        const fecha = parseDate(idx.fecha >= 0 ? row[idx.fecha] : '');
        if (!originalName || !fecha) { skipped_incomplete++; continue; }
        const dni = idx.dni >= 0 ? String(row[idx.dni] || '').replace(/\D/g, '') : '';
        let player = null;
        const explicitId = idx.playerId >= 0 ? String(row[idx.playerId] || '').trim() : '';
        if (explicitId && playerById[explicitId]) player = playerById[explicitId];
        if (!player && dni && byDni[dni]) player = byDni[dni];
        const normName = normalize(originalName);
        if (!player && aliasToPlayer[normName] && playerById[aliasToPlayer[normName]]) player = playerById[aliasToPlayer[normName]];
        if (!player && byName[normName]) player = byName[normName];
        if (!player && byToken[tokenKey(originalName)]) player = byToken[tokenKey(originalName)];
        const isLinked = !!player;
        if (isLinked) linked++; else unlinked++;
        const tipo = String(idx.tipo >= 0 ? row[idx.tipo] || '' : '').trim() || 'Antropometría';
        const keyOwner = isLinked ? player.id : `unlinked:${normName}`;
        const key = `${keyOwner}|${fecha}|${normalize(tipo)}`;
        const signature = `${normName}|${fecha}|${normalize(tipo)}`;
        const payload = {
          player_id: isLinked ? player.id : '', squad_id: isLinked ? (player.squad_id || '') : '', season_id: isLinked ? (player.season_id || '') : '',
          source_sheet_row_id: `${sheetName}:${rowNumber}`, player_name_original: originalName, source_dni: dni,
          fecha, tipo_medicion: tipo,
          edad: parseNumber(idx.edad >= 0 ? row[idx.edad] : ''), talla: parseNumber(idx.talla >= 0 ? row[idx.talla] : ''), peso: parseNumber(idx.peso >= 0 ? row[idx.peso] : ''),
          sumatoria_6p: parseNumber(idx.sum6p >= 0 ? row[idx.sum6p] : ''), imo: parseNumber(idx.imo >= 0 ? row[idx.imo] : ''),
          porcentaje_masa_muscular: parseNumber(idx.pctMM >= 0 ? row[idx.pctMM] : ''), kg_masa_muscular: parseNumber(idx.kgMM >= 0 ? row[idx.kgMM] : ''),
          porcentaje_grasa: parseNumber(idx.pctGrasa >= 0 ? row[idx.pctGrasa] : ''), kg_grasa: parseNumber(idx.kgGrasa >= 0 ? row[idx.kgGrasa] : ''),
          categoria_division: String(idx.categoria >= 0 ? row[idx.categoria] || '' : sheetName), observaciones: String(idx.obs >= 0 ? row[idx.obs] || '' : ''),
          nutrition_assessment_key: key, linked: isLinked, source: 'google_drive', source_file_id: SOURCE_FILE_ID, source_file_mime_type: meta.mimeType,
          row_hash: rowHash(row), found_in_last_sync: true, last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        };
        Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
        const existingMatch = byKey[key] || (isLinked ? byUnlinkedSignature[signature] : null);
        if (seenIds.has(existingMatch?.id)) { duplicates++; continue; }
        if (existingMatch) {
          await base44.asServiceRole.entities.NutritionAssessment.update(existingMatch.id, payload);
          byKey[key] = { ...existingMatch, ...payload };
          seenIds.add(existingMatch.id);
          updated++;
        } else {
          const createdRec = await base44.asServiceRole.entities.NutritionAssessment.create({ ...payload, created_at: new Date().toISOString() });
          byKey[key] = createdRec;
          seenIds.add(createdRec.id);
          created++;
        }
      } catch (_e) { errors++; }
    }

    let notFoundMarked = 0;
    for (const rec of existing) {
      if (rec.source_file_id === SOURCE_FILE_ID && !seenIds.has(rec.id) && rec.found_in_last_sync !== false) {
        await base44.asServiceRole.entities.NutritionAssessment.update(rec.id, { found_in_last_sync: false, updated_at: new Date().toISOString() });
        notFoundMarked++;
      }
    }
    const result = { success: true, file_name: meta.name, file_type: meta.mimeType === EXCEL_MIME ? 'Excel (.xlsx)' : 'Google Sheets nativo', native_spreadsheet_id: syncState.native_spreadsheet_id, native_spreadsheet_url: syncState.native_spreadsheet_url, rows_read: rows.length, linked, unlinked, created, updated, duplicates_avoided: duplicates, skipped_incomplete, not_found_marked: notFoundMarked, errors };
    const states = await base44.asServiceRole.entities.NutritionSyncState.filter({ source_file_id: SOURCE_FILE_ID }, '-created_date', 1);
    if (states[0]) await base44.asServiceRole.entities.NutritionSyncState.update(states[0].id, { last_synced_at: new Date().toISOString(), last_sync_result: result });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});