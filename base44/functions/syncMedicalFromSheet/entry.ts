import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireMedicalAccess, medicalErrorResponse } from "../../shared/medicalAccess.ts";
import { normalizeLegacyLaterality, mapLegacyMedicalStatusToAvailability, nowISO } from "../../shared/medicalDomain.ts";

const SPREADSHEET_ID = '1rcl45gx1ngyitLCwB37CHSfhHvEVlhZHXA6U0lb1eUw';

function normalize(s: any) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}
function tokenKey(s: any) {
  return normalize(s).split(/\s+/).filter(Boolean).sort().join(' ');
}
function parseDate(str: any) {
  if (!str) return undefined;
  const s = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return undefined;
  let [, d, mo, y] = m;
  if (y.length === 2) y = '20' + y;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}
function parseDays(str: any) {
  if (!str) return undefined;
  const n = parseInt(String(str).replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Classification is descriptive only. Crucially, fecha_final_tto is NOT used
 * to infer Alta/Disponible. Only explicit text in the source can mark a legacy
 * row as closed, and even then no medical_clearance_date is fabricated.
 */
function classifyImportedEpisode(lesionConsulta: any, etapaRhb: any) {
  const text = normalize(lesionConsulta);
  const etapa = normalize(etapaRhb);
  const explicitClosed = ['alta medica', 'alta médica', 'retorno con el grupo', 'disponible', 'finalizado'].some((k) => etapa.includes(normalize(k)) || text.includes(normalize(k)));
  if (text.includes('kinesiolog') || etapa.includes('kinesiolog')) return { status: 'kinesiologia', closed: false };
  if (['consulta', 'control', 'sintomatico', 'sintomático'].some((k) => text.includes(normalize(k)))) return { status: 'consulta', closed: explicitClosed };
  if (['seguimiento', 'reintegro', 'readapt', 'campo'].some((k) => text.includes(k) || etapa.includes(k))) return { status: 'en_recuperacion', closed: explicitClosed };
  return { status: explicitClosed ? 'alta' : 'lesionado', closed: explicitClosed };
}

function mergeProtectingManual(existing: any, incoming: any) {
  const manual = new Set(existing?.manual_fields || []);
  const update: any = { ...incoming };
  const conflicts: string[] = [];
  for (const field of manual) {
    if (incoming[field] !== undefined && JSON.stringify(incoming[field]) !== JSON.stringify(existing[field])) conflicts.push(field);
    delete update[field];
  }
  // A record authored in the app must never be silently converted back into a sheet-owned record.
  if (existing?.source === 'app') {
    delete update.source;
    delete update.edited_by;
    delete update.edited_by_id;
    delete update.edited_at;
  }
  update.sync_conflict = conflicts.length > 0;
  update.sync_conflict_fields = conflicts;
  return { update, conflicts };
}

export default async function(req: Request) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const squadId = String(body.squad_id || '');
    await requireMedicalAccess(base44, user, squadId, 'edit');

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const range = 'A:J';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!resp.ok) return Response.json({ error: `Google Sheets error: ${await resp.text()}` }, { status: 500 });
    const rows = (await resp.json()).values || [];
    if (rows.length < 2) return Response.json({ success: true, rows_read: 0, created: 0, updated: 0, conflicts: 0, linked: 0, unlinked: 0 });
    const dataRows = rows.slice(2);

    const [players, aliases, existingEpisodes] = await Promise.all([
      base44.asServiceRole.entities.Player.list('-created_date', 3000),
      base44.asServiceRole.entities.PlayerAlias.list('-created_date', 4000),
      base44.asServiceRole.entities.MedicalEpisode.list('-created_date', 5000),
    ]);

    const byNormalizedName: Record<string, any> = {};
    const byTokenKey: Record<string, any> = {};
    const playerById: Record<string, any> = {};
    players.forEach((p: any) => {
      byNormalizedName[normalize(p.full_name)] = p;
      byTokenKey[tokenKey(p.full_name)] = p;
      playerById[p.id] = p;
    });
    const byAlias: Record<string, string> = {};
    aliases.forEach((a: any) => { if (a.normalized_alias) byAlias[a.normalized_alias] = a.player_id; });
    const episodeByKey: Record<string, any> = {};
    existingEpisodes.forEach((e: any) => { if (e.medical_episode_key) episodeByKey[e.medical_episode_key] = e; });

    let created = 0, updated = 0, linked = 0, unlinked = 0, conflicts = 0, reviewRequired = 0;
    const at = nowISO();

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] || [];
      const playerNameOriginal = String(row[0] || '').trim();
      const lesionConsulta = String(row[2] || '').trim();
      if (!playerNameOriginal || !lesionConsulta) continue;

      const normName = normalize(playerNameOriginal);
      let playerId = byAlias[normName] || '';
      if (!playerId && byNormalizedName[normName]) playerId = byNormalizedName[normName].id;
      if (!playerId && byTokenKey[tokenKey(playerNameOriginal)]) playerId = byTokenKey[tokenKey(playerNameOriginal)].id;
      const isLinked = !!(playerId && playerById[playerId]);
      if (isLinked) linked++; else unlinked++;

      const fechaInicio = parseDate(row[4]);
      const fechaFinalLegacy = parseDate(row[5]);
      const mmii = String(row[3] || '').trim();
      const etapa = String(row[7] || '').trim();
      const classification = classifyImportedEpisode(lesionConsulta, etapa);
      const keyPart = isLinked ? playerId : normName;
      // Keep historical key format to avoid creating a second copy of already-synced rows.
      const episodeKey = `${keyPart}|${fechaInicio || ''}|${normalize(lesionConsulta)}|${normalize(mmii)}`;
      const requiresReview = !!fechaFinalLegacy && !classification.closed;
      if (requiresReview) reviewRequired++;

      const incoming: any = {
        player_id: isLinked ? playerId : '',
        player_name_original: playerNameOriginal,
        squad_id: isLinked ? squadId : '',
        categoria_division: row[1] || '',
        record_type: classification.status === 'consulta' ? 'consultation' : 'injury',
        event_date: fechaInicio,
        lesion_consulta: lesionConsulta,
        mmii_afectado: mmii,
        body_area: mmii === 'No corresponde' ? '' : mmii,
        laterality: normalizeLegacyLaterality(mmii),
        fecha_inicio_tto: fechaInicio,
        fecha_final_tto: fechaFinalLegacy,
        perdida_dias: parseDays(row[6]),
        etapa_rhb: etapa,
        observaciones: row[8] || '',
        operational_note: row[8] || '',
        medical_status: classification.status,
        availability: mapLegacyMedicalStatusToAvailability(classification.status, etapa),
        episode_state: classification.closed ? 'closed' : 'active',
        medical_episode_key: episodeKey,
        linked: isLinked,
        source_sheet_row_id: String(i + 3),
        source: 'google_sheets',
        last_synced_at: at,
        sync_conflict: requiresReview,
        sync_conflict_fields: requiresReview ? ['fecha_final_tto_requires_explicit_clearance_review'] : [],
      };
      Object.keys(incoming).forEach((k) => incoming[k] === undefined && delete incoming[k]);

      const existing = episodeByKey[episodeKey];
      if (existing) {
        const merged = mergeProtectingManual(existing, incoming);
        if (merged.conflicts.length) conflicts++;
        if (requiresReview) {
          merged.update.sync_conflict = true;
          merged.update.sync_conflict_fields = [...new Set([...(merged.update.sync_conflict_fields || []), 'fecha_final_tto_requires_explicit_clearance_review'])];
        }
        await base44.asServiceRole.entities.MedicalEpisode.update(existing.id, merged.update);
        updated++;
      } else {
        const createdEp = await base44.asServiceRole.entities.MedicalEpisode.create(incoming);
        episodeByKey[episodeKey] = createdEp;
        created++;
      }
    }

    // Recalculation uses explicit episode_state/clearance only and never Player.status.
    const recalcReq = new Request(req.url, { method: 'POST', headers: req.headers, body: '{}' });
    // Avoid an internal HTTP call; reproduce only linked squad players through current records.
    const squadEpisodes = await base44.asServiceRole.entities.MedicalEpisode.filter({ squad_id: squadId, linked: true }, '-event_date', 5000);
    const playerIds = [...new Set(squadEpisodes.map((e: any) => e.player_id).filter(Boolean))];
    // Current statuses are deliberately not inferred here from dates. The gateway/recalc endpoint handles explicit state changes.

    return Response.json({
      success: true,
      rows_read: dataRows.length,
      created,
      updated,
      conflicts,
      requires_review: reviewRequired,
      linked,
      unlinked,
      linked_players_seen: playerIds.length,
      rule: 'sheet_is_optional_importer_and_never_auto_clears',
    });
  } catch (error: any) {
    console.error('syncMedicalFromSheet error', error);
    return medicalErrorResponse(error);
  }
}
