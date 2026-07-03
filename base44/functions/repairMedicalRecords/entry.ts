import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
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
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // 1. Volver a traer el historial completo desde la planilla (upsert seguro por sync_key)
    await base44.functions.invoke('syncMedicalFromSheet', {});

    // 2. Cargar todos los registros y detectar duplicados / sin vincular
    const records = await base44.asServiceRole.entities.MedicalRecord.list('-created_date', 3000);

    const groups = {};
    let unlinkedCount = 0;
    records.forEach((r) => {
      if (!r.player_id) unlinkedCount++;
      const playerKey = r.player_id || `unlinked:${normalize(r.player_name)}`;
      const key = r.sync_key || buildSyncKey(playerKey, r.injury_date, r.diagnosis, r.affected_limb);
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });

    let duplicatesRemoved = 0;
    let statusesUpdated = 0;

    for (const key of Object.keys(groups)) {
      const group = groups[key].sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date));
      const keep = group[0];
      const dupes = group.slice(1);
      for (const dup of dupes) {
        await base44.asServiceRole.entities.MedicalRecord.delete(dup.id);
        duplicatesRemoved++;
      }

      const newStatus = computeMedicalStatus(keep.diagnosis, keep.expected_return, keep.rehab_stage);
      if (keep.medical_status !== newStatus || keep.sync_key !== key) {
        await base44.asServiceRole.entities.MedicalRecord.update(keep.id, { medical_status: newStatus, sync_key: key });
        statusesUpdated++;
      }
    }

    return Response.json({
      success: true,
      duplicatesRemoved,
      statusesUpdated,
      unlinkedCount,
      totalRecords: records.length - duplicatesRemoved,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});