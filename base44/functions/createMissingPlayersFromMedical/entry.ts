import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const allPlayers = await base44.entities.Player.list('', 1000);
    const allMedical = await base44.entities.MedicalRecord.list('', 1000);

    const normalize = (str) => {
      return (str || '').toLowerCase().trim().replace(/á|à|ä/g, 'a').replace(/é|è|ë/g, 'e').replace(/í|ì|ï/g, 'i').replace(/ó|ò|ö/g, 'o').replace(/ú|ù|ü/g, 'u').replace(/ñ/g, 'n');
    };

    const existingNames = new Set(allPlayers.map(p => normalize(p.full_name || '')));

    let created = 0;
    const createdPlayers = [];

    // Encontrar registros médicos sin player_id
    for (const medical of allMedical) {
      if (medical.player_id) continue;

      const medicalName = normalize(medical.player_name || '');
      
      // Si el nombre no existe en players, crear el jugador
      if (!existingNames.has(medicalName)) {
        const parts = (medical.player_name || '').trim().split(/\s+/);
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';

        const newPlayer = await base44.entities.Player.create({
          first_name: firstName,
          last_name: lastName,
          full_name: medical.player_name,
          position: 'Defensor',
          division: medical.category_division ? medical.category_division.split('/')[1] : 'Reserva',
          status: 'Disponible'
        });

        existingNames.add(medicalName);
        created++;
        createdPlayers.push({ name: medical.player_name, id: newPlayer.id });
      }
    }

    return Response.json({
      success: true,
      created,
      createdPlayers
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});