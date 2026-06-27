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
      return (str || '').toLowerCase().trim().replace(/á|à|ä/g, 'a').replace(/é|è|ë/g, 'e').replace(/í|ì|ï/g, 'i').replace(/ó|ò|ö/g, 'o').replace(/ú|ù|ü/g, 'u').replace(/ñ/g, 'n');
    };

    // Similitud simple entre dos strings
    const similarity = (a, b) => {
      const longer = a.length > b.length ? a : b;
      const shorter = a.length > b.length ? b : a;
      const editDistance = getEditDistance(longer, shorter);
      return ((longer.length - editDistance) / longer.length) * 100;
    };

    const getEditDistance = (a, b) => {
      const costs = [];
      for (let i = 0; i <= a.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= b.length; j++) {
          if (i === 0) {
            costs[j] = j;
          } else if (j > 0) {
            let newValue = costs[j - 1];
            if (a.charAt(i - 1) !== b.charAt(j - 1)) {
              newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
            }
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
        if (i > 0) costs[b.length] = lastValue;
      }
      return costs[b.length];
    };

    const playersList = allPlayers.map(p => ({
      id: p.id,
      fullName: normalize(p.full_name || ''),
      firstName: normalize(p.first_name || ''),
      lastName: normalize(p.last_name || ''),
      original: p.full_name
    }));

    let updated = 0;
    let notFound = 0;
    const notFoundNames = [];

    // Actualizar cada registro médico con el player_id correspondiente
    for (const record of allMedicalRecords) {
      if (record.player_id) continue;
      
      const medicalName = normalize(record.player_name || '');
      const medicalParts = medicalName.split(/\s+/).filter(p => p.length > 0);
      
      let playerId = null;
      let bestScore = 0;

      // Buscar el mejor match
      for (const player of playersList) {
        const playerParts = player.fullName.split(/\s+/).filter(p => p.length > 0);
        
        // Intenta match exacto primero
        if (player.fullName === medicalName || player.fullName === medicalParts.reverse().join(' ')) {
          playerId = player.id;
          break;
        }

        // Match por apellido + nombre (más flexible)
        const medicalLastName = medicalParts[medicalParts.length - 1];
        const medicalFirstName = medicalParts[0];
        
        const lastNameMatch = player.lastName.includes(medicalLastName) || medicalLastName.includes(player.lastName);
        const firstNameMatch = player.firstName.includes(medicalFirstName) || medicalFirstName.includes(player.firstName);

        if (lastNameMatch && firstNameMatch) {
          playerId = player.id;
          break;
        }

        // Similitud general
        const sim = similarity(medicalName, player.fullName);
        if (sim > bestScore && sim > 75) {
          bestScore = sim;
          playerId = player.id;
        }
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