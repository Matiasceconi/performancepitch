import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Obtener todos los jugadores
    const allPlayers = await base44.entities.Player.list('', 1000);
    
    // Obtener todos los registros médicos
    const allMedicalRecords = await base44.entities.MedicalRecord.list('', 1000);

    // Normalizar nombres
    const normalize = (str) => {
      return (str || '').toLowerCase().trim().replace(/á|à|ä/g, 'a').replace(/é|è|ë/g, 'e').replace(/í|ì|ï/g, 'i').replace(/ó|ò|ö/g, 'o').replace(/ú|ù|ü/g, 'u');
    };

    // Crear un mapa de nombres normalizados para búsqueda flexible
    const playersByNormalizedName = {};
    allPlayers.forEach(player => {
      const fullName = normalize(player.full_name || '');
      const parts = fullName.split(/\s+/);
      playersByNormalizedName[fullName] = player.id;
      
      // Almacenar por combinaciones posibles
      if (parts.length >= 2) {
        const reverseOrder = parts.reverse().join(' ');
        playersByNormalizedName[reverseOrder] = player.id;
      }
    });

    let updated = 0;
    let notFound = 0;
    const notFoundNames = [];

    // Actualizar cada registro médico con el player_id correspondiente
    for (const record of allMedicalRecords) {
      if (record.player_id) continue; // Ya tiene player_id
      
      const medicalName = normalize(record.player_name || '');
      let playerId = playersByNormalizedName[medicalName];

      // Si no encuentra con busqueda exacta, intenta encontrar por partes del nombre
      if (!playerId) {
        const medicalParts = medicalName.split(/\s+/);
        // Buscar jugador que tenga todos los componentes del nombre
        playerId = Object.entries(playersByNormalizedName).find(([playerName]) => {
          const playerParts = playerName.split(/\s+/);
          return medicalParts.every(part => playerParts.some(pp => pp.includes(part) || part.includes(pp)));
        })?.[1];
      }

      if (playerId) {
        await base44.entities.MedicalRecord.update(record.id, { player_id: playerId });
        updated++;
      } else {
        notFound++;
        notFoundNames.push(record.player_name);
      }
    }

    return Response.json({
      success: true,
      updated,
      notFound,
      notFoundNames: [...new Set(notFoundNames)]
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});