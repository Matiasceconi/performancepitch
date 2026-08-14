import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';

const SOURCE_FILE_ID = '1tiZoeF9KjPyvntjBreRSsUhRsh1huMjm';
const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const SHEETS_MIME = 'application/vnd.google-apps.spreadsheet';
const READING_LOGICAL = 'Informe de lectura';
const SKINFOLD_LOGICAL = 'Seguimiento de pliegues';
const WEIGHT_LOGICAL = 'Seguimiento de peso';
const READING_ALIASES = ['Informe de lectura', 'Informe de 1 lectura', 'Informe 1 (Lectura)'];
const SKINFOLD_ALIASES = ['Seguimiento de pliegues'];
const WEIGHT_ALIASES = ['Seguimiento de peso', 'Seguimiento de pesos'];
const MONTHS = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4,
  may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agos: 8,
  agosto: 8, sep: 9, sept: 9, septiembre: 9, oct: 10, octubre: 10,
  nov: 11, noviembre: 11, dic: 12, diciembre: 12,
};

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenKey(value) {
  return normalize(value).split(/\s+/).filter(Boolean).sort().join(' ');
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const cleaned = String(value)
    .replace('%', '')
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseDate(value, fallbackYear = '') {
  if (!value) return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }

  const raw = String(value).trim().replace(/[()]/g, '');
  let match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;

  match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) {
    let year = match[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }

  match = raw.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (match && fallbackYear) {
    return `${fallbackYear}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }

  match = normalize(raw).match(/^(\d{1,2})[-/ ]([a-z]+)$/);
  if (match && fallbackYear) {
    const month = MONTHS[match[2]];
    if (month) return `${fallbackYear}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  return undefined;
}

function parsePeriod(rows) {
  const text = rows.slice(0, 6).flat().join(' ');
  const year = (text.match(/20\d{2}/) || [''])[0];
  const range = text.match(/(\d{1,2})[/-](\d{1,2})\s*-\s*(\d{1,2})[/-](\d{1,2})/);
  if (!range || !year) return { start: '', end: '', year };
  return {
    start: `${year}-${range[2].padStart(2, '0')}-${range[1].padStart(2, '0')}`,
    end: `${year}-${range[4].padStart(2, '0')}-${range[3].padStart(2, '0')}`,
    year,
  };
}

function findSheetName(sheetNames, aliases) {
  return sheetNames.find((name) => aliases.some((alias) => normalize(name) === normalize(alias)))
    || sheetNames.find((name) => aliases.some((alias) => normalize(name).includes(normalize(alias))));
}

function lastDefined(values) {
  const valid = values.filter((value) => value !== undefined);
  return valid.length ? valid[valid.length - 1] : undefined;
}

function previousDefined(values) {
  const valid = values.filter((value) => value !== undefined);
  return valid.length > 1 ? valid[valid.length - 2] : undefined;
}

function rowHash(value) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(value)))).slice(0, 120);
}

function rawObject(row) {
  return Object.fromEntries(row.map((value, index) => [`c${index + 1}`, value]));
}

function levenshtein(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let index = 0; index < rows; index++) matrix[index][0] = index;
  for (let index = 0; index < cols; index++) matrix[0][index] = index;
  for (let row = 1; row < rows; row++) {
    for (let col = 1; col < cols; col++) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

async function getWorkbook(base44, driveToken, metadata) {
  if (metadata.mimeType === EXCEL_MIME) {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${SOURCE_FILE_ID}?alt=media`, {
      headers: { Authorization: `Bearer ${driveToken}` },
    });
    if (!response.ok) throw new Error(await response.text());
    const buffer = await response.arrayBuffer();
    return XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
  }

  if (metadata.mimeType === SHEETS_MIME) {
    const sheetsConnection = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const metadataResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SOURCE_FILE_ID}?fields=sheets.properties.title`,
      { headers: { Authorization: `Bearer ${sheetsConnection.accessToken}` } },
    );
    if (!metadataResponse.ok) throw new Error(await metadataResponse.text());
    const titles = (await metadataResponse.json()).sheets.map((sheet) => sheet.properties.title);
    const requestedNames = [
      findSheetName(titles, READING_ALIASES),
      findSheetName(titles, SKINFOLD_ALIASES),
      findSheetName(titles, WEIGHT_ALIASES),
    ].filter(Boolean);
    const workbook = { SheetNames: [], Sheets: {} };
    for (const title of requestedNames) {
      const range = encodeURIComponent(`'${title}'!A:AZ`);
      const valuesResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SOURCE_FILE_ID}/values/${range}`,
        { headers: { Authorization: `Bearer ${sheetsConnection.accessToken}` } },
      );
      if (!valuesResponse.ok) throw new Error(await valuesResponse.text());
      const values = (await valuesResponse.json()).values || [];
      workbook.SheetNames.push(title);
      workbook.Sheets[title] = XLSX.utils.aoa_to_sheet(values);
    }
    return workbook;
  }

  throw new Error(`Formato no soportado: ${metadata.mimeType}`);
}

function extractReadings(workbook) {
  const sheetName = findSheetName(workbook.SheetNames, READING_ALIASES);
  if (!sheetName) return { sheetName: '', rows: [] };
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: '' });
  const period = parsePeriod(rows);
  const headerRow = rows.findIndex((row) => row.some((cell) => normalize(cell).includes('nombres')) && row.some((cell) => normalize(cell).includes('triceps')));
  const extracted = [];

  for (let index = headerRow + 1; index < rows.length; index++) {
    const row = rows[index] || [];
    const originalName = String(row[1] || '').trim();
    if (!originalName || normalize(originalName).includes('promedio')) continue;
    const cuts = [12, 13, 14, 15].map((column) => parseNumber(row[column]));
    const current = lastDefined(cuts);
    if (current === undefined || !period.end) continue;
    extracted.push({
      sourceSheetName: sheetName,
      logicalSheetName: READING_LOGICAL,
      rowNumber: index + 1,
      originalName,
      fecha: period.end,
      period,
      row,
      cuts,
    });
  }
  return { sheetName, rows: extracted };
}

function extractSkinfolds(workbook) {
  const sheetName = findSheetName(workbook.SheetNames, SKINFOLD_ALIASES);
  if (!sheetName) return { sheetName: '', rows: [] };
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: '' });
  const extracted = [];
  let currentName = '';
  let currentGroup = '';

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index] || [];
    const first = String(row[0] || '').trim();
    const second = normalize(row[1]);
    const groupCell = row.find((cell) => normalize(cell).startsWith('grupo'));
    if (groupCell) currentGroup = String(groupCell).trim();

    const isPlayerHeader = first
      && normalize(first) !== 'nombres:'
      && !normalize(first).startsWith('grupo')
      && second.includes('fecha');
    if (isPlayerHeader) currentName = first;

    const inlineDate = parseDate(row[1]);
    if (first && inlineDate && normalize(first) !== 'nombres:') currentName = first;
    const fecha = inlineDate;
    const sumatoria = parseNumber(row[9]);
    const peso = parseNumber(row[2]);
    if (!currentName || !fecha || (sumatoria === undefined && peso === undefined)) continue;

    extracted.push({
      sourceSheetName: sheetName,
      logicalSheetName: SKINFOLD_LOGICAL,
      rowNumber: index + 1,
      originalName: currentName,
      fecha,
      group: currentGroup,
      row,
    });
  }
  return { sheetName, rows: extracted };
}

function extractWeights(workbook) {
  const sheetName = findSheetName(workbook.SheetNames, WEIGHT_ALIASES);
  if (!sheetName) return { sheetName: '', rows: [] };
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: '' });
  const headerRow = rows.findIndex((row) => row.some((cell) => normalize(cell) === 'nombre') && row.some((cell) => normalize(cell).includes('peso optimo')));
  const dateRow = rows[headerRow + 1] || [];
  const numericDates = dateRow.slice(7).map((cell) => parseDate(cell)).filter(Boolean);
  const fallbackYear = numericDates[0]?.slice(0, 4) || String(new Date().getUTCFullYear());
  const dateColumns = [];
  for (let column = 7; column < dateRow.length; column++) {
    const fecha = parseDate(dateRow[column], fallbackYear);
    if (fecha) dateColumns.push({ column, fecha });
  }

  const extracted = [];
  for (let index = headerRow + 2; index < rows.length; index++) {
    const row = rows[index] || [];
    const originalName = String(row[1] || '').trim();
    if (!originalName) continue;
    for (const { column, fecha } of dateColumns) {
      const peso = parseNumber(row[column]);
      if (peso === undefined) continue;
      extracted.push({
        sourceSheetName: sheetName,
        logicalSheetName: WEIGHT_LOGICAL,
        rowNumber: index + 1,
        columnNumber: column + 1,
        originalName,
        fecha,
        row,
        peso,
      });
    }
  }
  return { sheetName, rows: extracted };
}

function buildPlayerResolver(players, aliases) {
  const playerById = {};
  const byDni = {};
  const byName = {};
  const byToken = {};
  const aliasByName = {};
  const aliasByToken = {};
  const candidates = [];

  players.forEach((player) => {
    const fullName = player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim();
    const normalized = normalize(fullName);
    const token = tokenKey(fullName);
    playerById[player.id] = player;
    if (player.dni) byDni[String(player.dni).replace(/\D/g, '')] = player;
    if (player.document_number) byDni[String(player.document_number).replace(/\D/g, '')] = player;
    if (normalized) byName[normalized] = player;
    if (player.normalized_name) byName[normalize(player.normalized_name)] = player;
    if (token) byToken[token] = player;
    candidates.push({ normalized, token, player });
  });

  aliases.forEach((alias) => {
    const player = playerById[alias.player_id];
    if (!player) return;
    const normalized = normalize(alias.normalized_alias || alias.alias_name);
    const token = tokenKey(alias.alias_name || alias.normalized_alias);
    if (normalized) {
      if (!(normalized in aliasByName)) aliasByName[normalized] = player;
      else if (aliasByName[normalized]?.id !== player.id) aliasByName[normalized] = null;
    }
    if (token) {
      if (!(token in aliasByToken)) aliasByToken[token] = player;
      else if (aliasByToken[token]?.id !== player.id) aliasByToken[token] = null;
    }
  });

  return function resolve(originalName, explicitId = '', dni = '') {
    if (explicitId && playerById[explicitId]) return playerById[explicitId];
    if (dni && byDni[dni]) return byDni[dni];
    const normalized = normalize(originalName);
    const token = tokenKey(originalName);
    if (byName[normalized]) return byName[normalized];
    if (byToken[token]) return byToken[token];
    if (aliasByName[normalized]) return aliasByName[normalized];
    if (aliasByToken[token]) return aliasByToken[token];
    const abbreviatedParts = normalized.split(/\s+/).filter(Boolean);
    if (abbreviatedParts.length === 2 && abbreviatedParts.some((part) => part.length === 1)) {
      const initial = abbreviatedParts.find((part) => part.length === 1);
      const surname = abbreviatedParts.find((part) => part.length > 1);
      const abbreviatedMatches = players.filter((player) => {
        const nameParts = normalize(player.full_name || `${player.first_name || ''} ${player.last_name || ''}`)
          .split(/\s+/)
          .filter(Boolean);
        return nameParts.includes(surname) && nameParts.some((part) => part.startsWith(initial));
      });
      if (abbreviatedMatches.length === 1) return abbreviatedMatches[0];
    }
    const fuzzy = candidates
      .map((candidate) => ({
        player: candidate.player,
        score: Math.min(
          levenshtein(normalized, candidate.normalized),
          levenshtein(token, candidate.token),
        ),
      }))
      .filter((candidate) => candidate.score <= 2)
      .sort((a, b) => a.score - b.score);
    if (fuzzy.length === 1) return fuzzy[0].player;
    if (fuzzy.length > 1 && fuzzy[0].score < fuzzy[1].score) return fuzzy[0].player;
    return null;
  };
}

function stageUpsert(payload, keyField, byKey, byRow, seenIds, creates, updates) {
  const key = payload[keyField];
  const existing = byKey[key] || byRow[payload.source_sheet_row_id];
  if (existing) {
    updates.push({ id: existing.id, ...payload });
    byKey[key] = { ...existing, ...payload };
    seenIds.add(existing.id);
    return 'updated';
  }
  creates.push({ ...payload, created_at: new Date().toISOString() });
  byKey[key] = payload;
  return 'created';
}

async function bulkWrite(entity, creates, updates, chunkSize = 100) {
  for (let index = 0; index < creates.length; index += chunkSize) {
    await entity.bulkCreate(creates.slice(index, index + chunkSize));
  }
  for (let index = 0; index < updates.length; index += chunkSize) {
    await entity.bulkUpdate(updates.slice(index, index + chunkSize));
  }
}

async function findSyncState(base44) {
  const states = await base44.asServiceRole.entities.NutritionSyncState.filter(
    { source_file_id: SOURCE_FILE_ID },
    '-created_date',
    1,
  );
  return states[0] || null;
}

async function updateSyncState(base44, existingState, metadata, values) {
  const now = new Date();
  const payload = {
    source_file_id: SOURCE_FILE_ID,
    source_file_name: metadata.name,
    source_mime_type: metadata.mimeType,
    source_modified_time: metadata.modifiedTime,
    last_checked_at: now.toISOString(),
    next_sync_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    ...values,
  };
  if (existingState) await base44.asServiceRole.entities.NutritionSyncState.update(existingState.id, payload);
  else await base44.asServiceRole.entities.NutritionSyncState.create(payload);
}

Deno.serve(async (req) => {
  const startedAt = new Date().toISOString();
  try {
    const args = await req.json().catch(() => ({}));
    const force = Boolean(args?.force);
    const base44 = createClientFromRequest(req);
    const drive = await base44.asServiceRole.connectors.getConnection('googledrive');
    const metadataResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${SOURCE_FILE_ID}?fields=id,name,mimeType,modifiedTime,webViewLink`,
      { headers: { Authorization: `Bearer ${drive.accessToken}` } },
    );
    if (!metadataResponse.ok) throw new Error(await metadataResponse.text());
    const metadata = await metadataResponse.json();
    const existingState = await findSyncState(base44);

    if (!force
      && existingState?.source_modified_time === metadata.modifiedTime
      && existingState?.last_sync_result?.schema_version === 3) {
      const unchangedResult = {
        success: true,
        unchanged: true,
        schema_version: 3,
        message: 'El archivo no tuvo cambios desde la última sincronización.',
        checked_at: new Date().toISOString(),
      };
      await updateSyncState(base44, existingState, metadata, {
        sync_status: 'up_to_date',
        last_sync_result: unchangedResult,
      });
      return Response.json(unchangedResult);
    }

    const [squads, allPlayers, memberships, aliases] = await Promise.all([
      base44.asServiceRole.entities.Squad.list('name', 500),
      base44.asServiceRole.entities.Player.list('full_name', 5000),
      base44.asServiceRole.entities.SquadMembership.list('-created_date', 5000),
      base44.asServiceRole.entities.PlayerAlias.list('-created_date', 5000),
    ]);
    const targetSquad = squads.find((squad) => squad.id === existingState?.target_squad_id)
      || squads.find((squad) => squad.active !== false && normalize(squad.name) === 'reserva' && String(squad.season || '') === '2026')
      || squads.find((squad) => squad.active !== false && normalize(squad.name) === 'reserva');
    if (!targetSquad) throw new Error('No se encontró el plantel activo Reserva para vincular Nutrición.');

    const activeMemberships = memberships.filter((membership) => (
      membership.squad_id === targetSquad.id
      && membership.status === 'activo'
      && !membership.effective_to
    ));
    const rosterIds = new Set(activeMemberships.map((membership) => membership.player_id));
    allPlayers.forEach((player) => {
      if (player.squad_id === targetSquad.id && player.active !== false) rosterIds.add(player.id);
    });
    const rosterPlayers = allPlayers.filter((player) => rosterIds.has(player.id) && player.active !== false);
    const rosterAliases = aliases.filter((alias) => rosterIds.has(alias.player_id));
    const resolvePlayer = buildPlayerResolver(rosterPlayers, rosterAliases);

    const workbook = await getWorkbook(base44, drive.accessToken, metadata);
    const readingExtract = extractReadings(workbook);
    const skinfoldExtract = extractSkinfolds(workbook);
    const weightExtract = extractWeights(workbook);

    const [existingAssessments, existingInterpretations] = await Promise.all([
      base44.asServiceRole.entities.NutritionAssessment.list('-fecha', 5000),
      base44.asServiceRole.entities.NutritionInterpretation.list('-fecha', 5000),
    ]);

    const assessmentByKey = {};
    const assessmentByRow = {};
    const interpretationByKey = {};
    const interpretationByRow = {};
    existingAssessments.forEach((record) => {
      if (record.nutrition_assessment_key) assessmentByKey[record.nutrition_assessment_key] = record;
      if (record.source_sheet_row_id) assessmentByRow[record.source_sheet_row_id] = record;
    });
    existingInterpretations.forEach((record) => {
      if (record.nutrition_interpretation_key) interpretationByKey[record.nutrition_interpretation_key] = record;
      if (record.source_sheet_row_id) interpretationByRow[record.source_sheet_row_id] = record;
    });

    const counters = {
      assessments_created: 0,
      assessments_updated: 0,
      interpretations_created: 0,
      interpretations_updated: 0,
      unresolved_assessments: 0,
      unresolved_interpretations: 0,
      errors: 0,
    };
    const unresolvedSamples = [];
    const seenAssessmentIds = new Set();
    const seenInterpretationIds = new Set();
    const assessmentsToCreate = [];
    const assessmentsToUpdate = [];
    const interpretationsToCreate = [];
    const interpretationsToUpdate = [];
    const now = new Date().toISOString();
    const seasonId = String(targetSquad.season || existingState?.target_season_id || '');

    skinfoldExtract.rows.forEach((item) => {
      try {
        const player = resolvePlayer(item.originalName);
        if (!player) {
          counters.unresolved_assessments++;
          if (unresolvedSamples.length < 20) unresolvedSamples.push({ sheet: SKINFOLD_LOGICAL, row: item.rowNumber, name: item.originalName });
          return;
        }
        const key = `${player.id}|${item.fecha}|seguimiento_pliegues`;
        const payload = {
          player_id: player.id,
          club_id: player.club_id || '',
          squad_id: targetSquad.id,
          season_id: seasonId,
          source_sheet_name: SKINFOLD_LOGICAL,
          source_sheet_row_id: `${SKINFOLD_LOGICAL}:${item.rowNumber}`,
          source_row_number: item.rowNumber,
          source_group: item.group,
          player_name_original: item.originalName,
          normalized_player_name: normalize(item.originalName),
          fecha: item.fecha,
          tipo_medicion: SKINFOLD_LOGICAL,
          peso: parseNumber(item.row[2]),
          triceps: parseNumber(item.row[3]),
          subescapular: parseNumber(item.row[4]),
          supraespinal: parseNumber(item.row[5]),
          abdominal: parseNumber(item.row[6]),
          muslo: parseNumber(item.row[7]),
          pantorrilla: parseNumber(item.row[8]),
          sumatoria_6p: parseNumber(item.row[9]),
          zona_media_mm: [parseNumber(item.row[5]), parseNumber(item.row[6])].filter((value) => value !== undefined).reduce((sum, value) => sum + value, 0),
          nutrition_assessment_key: key,
          linked: true,
          source: 'google_drive',
          source_file_id: SOURCE_FILE_ID,
          source_file_mime_type: metadata.mimeType,
          row_hash: rowHash(item.row),
          raw_values: rawObject(item.row),
          found_in_last_sync: true,
          last_synced_at: now,
          updated_at: now,
        };
        Object.keys(payload).forEach((keyName) => payload[keyName] === undefined && delete payload[keyName]);
        const status = stageUpsert(
          payload,
          'nutrition_assessment_key',
          assessmentByKey,
          assessmentByRow,
          seenAssessmentIds,
          assessmentsToCreate,
          assessmentsToUpdate,
        );
        counters[status === 'created' ? 'assessments_created' : 'assessments_updated']++;
      } catch (_error) {
        counters.errors++;
      }
    });

    weightExtract.rows.forEach((item) => {
      try {
        const player = resolvePlayer(item.originalName);
        if (!player) {
          counters.unresolved_assessments++;
          if (unresolvedSamples.length < 20) unresolvedSamples.push({ sheet: WEIGHT_LOGICAL, row: item.rowNumber, name: item.originalName });
          return;
        }
        const key = `${player.id}|${item.fecha}|seguimiento_peso`;
        const payload = {
          player_id: player.id,
          club_id: player.club_id || '',
          squad_id: targetSquad.id,
          season_id: seasonId,
          source_sheet_name: WEIGHT_LOGICAL,
          source_sheet_row_id: `${WEIGHT_LOGICAL}:${item.rowNumber}:${item.columnNumber}`,
          source_row_number: item.rowNumber,
          player_name_original: item.originalName,
          normalized_player_name: normalize(item.originalName),
          categoria_division: String(item.row[0] || '').trim(),
          fecha: item.fecha,
          tipo_medicion: WEIGHT_LOGICAL,
          peso: item.peso,
          peso_optimo: parseNumber(item.row[3]),
          peso_observacion: parseNumber(item.row[4]),
          peso_limite: parseNumber(item.row[6]),
          nutrition_assessment_key: key,
          linked: true,
          source: 'google_drive',
          source_file_id: SOURCE_FILE_ID,
          source_file_mime_type: metadata.mimeType,
          row_hash: rowHash({ row: item.row, column: item.columnNumber, fecha: item.fecha }),
          raw_values: rawObject(item.row),
          found_in_last_sync: true,
          last_synced_at: now,
          updated_at: now,
        };
        Object.keys(payload).forEach((keyName) => payload[keyName] === undefined && delete payload[keyName]);
        const status = stageUpsert(
          payload,
          'nutrition_assessment_key',
          assessmentByKey,
          assessmentByRow,
          seenAssessmentIds,
          assessmentsToCreate,
          assessmentsToUpdate,
        );
        counters[status === 'created' ? 'assessments_created' : 'assessments_updated']++;
      } catch (_error) {
        counters.errors++;
      }
    });

    readingExtract.rows.forEach((item) => {
      try {
        const player = resolvePlayer(item.originalName);
        if (!player) {
          counters.unresolved_interpretations++;
          if (unresolvedSamples.length < 20) unresolvedSamples.push({ sheet: READING_LOGICAL, row: item.rowNumber, name: item.originalName });
          return;
        }
        const current = lastDefined(item.cuts);
        const previous = previousDefined(item.cuts);
        const key = `${player.id}|${item.fecha}|informe_1_lectura`;
        const payload = {
          player_id: player.id,
          club_id: player.club_id || '',
          squad_id: targetSquad.id,
          season_id: seasonId,
          source_sheet_name: READING_LOGICAL,
          source_sheet_row_id: `${READING_LOGICAL}:${item.rowNumber}`,
          source_row_number: item.rowNumber,
          player_name_original: item.originalName,
          normalized_player_name: normalize(item.originalName),
          fecha: item.fecha,
          period_start: item.period.start,
          period_end: item.period.end,
          position_label: String(item.row[0] || '').trim(),
          talla: parseNumber(item.row[3]),
          peso: parseNumber(item.row[4]),
          limite_mm: parseNumber(item.row[5]),
          triceps: parseNumber(item.row[6]),
          subescapular: parseNumber(item.row[7]),
          supraespinal: parseNumber(item.row[8]),
          abdominal: parseNumber(item.row[9]),
          muslo: parseNumber(item.row[10]),
          pantorrilla: parseNumber(item.row[11]),
          zona_media_mm: [parseNumber(item.row[8]), parseNumber(item.row[9])].filter((value) => value !== undefined).reduce((sum, value) => sum + value, 0),
          first_cut_sumatoria_6p: item.cuts[0],
          second_cut_sumatoria_6p: item.cuts[1],
          third_cut_sumatoria_6p: item.cuts[2],
          fourth_cut_sumatoria_6p: item.cuts[3],
          sumatoria_6p: current,
          cut_difference: current !== undefined && previous !== undefined ? current - previous : undefined,
          difference_from_limit: current !== undefined && parseNumber(item.row[5]) !== undefined ? current - parseNumber(item.row[5]) : undefined,
          interpretation_note: String(item.row[16] || '').trim(),
          nutrition_interpretation_key: key,
          linked: true,
          source_file_id: SOURCE_FILE_ID,
          source_file_mime_type: metadata.mimeType,
          row_hash: rowHash(item.row),
          raw_values: rawObject(item.row),
          found_in_last_sync: true,
          last_synced_at: now,
          updated_at: now,
        };
        Object.keys(payload).forEach((keyName) => payload[keyName] === undefined && delete payload[keyName]);
        const status = stageUpsert(
          payload,
          'nutrition_interpretation_key',
          interpretationByKey,
          interpretationByRow,
          seenInterpretationIds,
          interpretationsToCreate,
          interpretationsToUpdate,
        );
        counters[status === 'created' ? 'interpretations_created' : 'interpretations_updated']++;
      } catch (_error) {
        counters.errors++;
      }
    });

    await bulkWrite(
      base44.asServiceRole.entities.NutritionAssessment,
      assessmentsToCreate,
      assessmentsToUpdate,
    );
    await bulkWrite(
      base44.asServiceRole.entities.NutritionInterpretation,
      interpretationsToCreate,
      interpretationsToUpdate,
    );

    let recordsMarkedMissing = 0;
    for (const record of existingAssessments) {
      if (
        record.source_file_id === SOURCE_FILE_ID
        && [SKINFOLD_LOGICAL, WEIGHT_LOGICAL].includes(record.source_sheet_name)
        && !seenAssessmentIds.has(record.id)
        && record.found_in_last_sync !== false
      ) {
        await base44.asServiceRole.entities.NutritionAssessment.update(record.id, { found_in_last_sync: false, updated_at: now });
        recordsMarkedMissing++;
      }
    }
    for (const record of existingInterpretations) {
      if (
        record.source_file_id === SOURCE_FILE_ID
        && record.source_sheet_name === READING_LOGICAL
        && !seenInterpretationIds.has(record.id)
        && record.found_in_last_sync !== false
      ) {
        await base44.asServiceRole.entities.NutritionInterpretation.update(record.id, { found_in_last_sync: false, updated_at: now });
        recordsMarkedMissing++;
      }
    }

    const result = {
      success: true,
      unchanged: false,
      schema_version: 3,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      file_name: metadata.name,
      file_type: metadata.mimeType === EXCEL_MIME ? 'Excel (.xlsx)' : 'Google Sheets nativo',
      target_squad_id: targetSquad.id,
      target_squad_name: targetSquad.name,
      target_season_id: seasonId,
      roster_players: rosterPlayers.length,
      sheets_processed: [
        { requested: READING_LOGICAL, actual: readingExtract.sheetName, rows: readingExtract.rows.length },
        { requested: SKINFOLD_LOGICAL, actual: skinfoldExtract.sheetName, rows: skinfoldExtract.rows.length },
        { requested: WEIGHT_LOGICAL, actual: weightExtract.sheetName, rows: weightExtract.rows.length },
      ],
      rows_read: readingExtract.rows.length + skinfoldExtract.rows.length + weightExtract.rows.length,
      ...counters,
      unresolved_samples: unresolvedSamples,
      not_found_marked: recordsMarkedMissing,
    };

    await updateSyncState(base44, existingState, metadata, {
      target_squad_id: targetSquad.id,
      target_squad_name: targetSquad.name,
      target_season_id: seasonId,
      sync_interval_minutes: 60,
      sync_status: counters.errors ? 'completed_with_warnings' : 'up_to_date',
      last_error: '',
      last_synced_at: now,
      last_sync_result: result,
    });
    return Response.json(result);
  } catch (error) {
    try {
      const base44 = createClientFromRequest(req);
      const existingState = await findSyncState(base44);
      const fallbackMetadata = {
        name: existingState?.source_file_name || 'Antros grupales.xlsx',
        mimeType: existingState?.source_mime_type || EXCEL_MIME,
        modifiedTime: existingState?.source_modified_time || '',
      };
      await updateSyncState(base44, existingState, fallbackMetadata, {
        sync_status: 'error',
        last_error: error.message,
      });
    } catch (_stateError) {
      // Preserve the original error when the state update also fails.
    }
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
