import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Obtener todos los jugadores y registros médicos
    const [allPlayers, allMedical] = await Promise.all([
      base44.entities.Player.list('', 1000),
      base44.entities.MedicalRecord.list('', 1000),
    ]);

    const normalize = (str) => {
      return (str || '').toLowerCase().trim().replace(/á|à|ä/g, 'a').replace(/é|è|ë/g, 'e').replace(/í|ì|ï/g, 'i').replace(/ó|ò|ö/g, 'o').replace(/ú|ù|ü/g, 'u').replace(/ñ/g, 'n');
    };

    let updated = 0;
    const updates = [];

    // Para cada registro médico, si tiene player_id, obtener la foto del jugador
    for (const medical of allMedical) {
      if (!medical.player_id || medical.photo_url) continue; // Skip sin ID o ya tiene foto

      const player = allPlayers.find(p => p.id === medical.player_id);
      if (player && player.photo_url) {
        updates.push({
          recordId: medical.id,
          photoUrl: player.photo_url,
        });
      }
    }

    // Actualizar todos los registros con fotos en lote
    for (const update of updates) {
      await base44.entities.MedicalRecord.update(update.recordId, {
        photo_url: update.photoUrl,
      });
      updated++;
    }

    return Response.json({
      success: true,
      updated,
      message: `${updated} registros médicos actualizados con fotos del plantel`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});