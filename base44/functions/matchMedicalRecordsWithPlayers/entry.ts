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

    // Función para normalizar nombres
    const normalize = (str) => {
      return (str || '')
        .toLowerCase()
        .trim()
        .replace(/á|à|ä/g, 'a')
        .replace(/é|è|ë/g, 'e')
        .replace(/í|ì|ï/g, 'i')
        .replace(/ó|ò|ö/g, 'o')
        .replace(/ú|ù|ü/g, 'u')
        .replace(/ñ/g, 'n');
    };

    // Función para calcular similitud de Levenshtein
    const levenshteinDistance = (a, b) => {
      const matrix = [];
      for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
          }
        }
      }
      return matrix[b.length][a.length];
    };

    // Función para calcular similitud como porcentaje
    const similarity = (a, b) => {
      const dist = levenshteinDistance(a, b);
      const maxLen = Math.max(a.length, b.length);
      return maxLen === 0 ? 1 : 1 - dist / maxLen;
    };

    let matched = 0;
    const updates = [];

    // Para cada registro médico sin player_id o con info incompleta
    for (const medical of allMedical) {
      if (medical.player_id && medical.photo_url) continue; // Ya tiene todo

      const medicalNorm = normalize(medical.player_name);
      let bestMatch = null;
      let bestScore = 0.6; // Umbral mínimo de similitud

      // Buscar el mejor jugador coincidente
      for (const player of allPlayers) {
        const playerFullNorm = normalize(player.full_name || '');
        const playerLastNorm = normalize(player.last_name || '');
        const playerFirstNorm = normalize(player.first_name || '');

        // Probar diferentes combinaciones
        const scores = [
          similarity(medicalNorm, playerFullNorm),
          similarity(medicalNorm, playerLastNorm),
          similarity(medicalNorm, playerFirstNorm),
          // Búsqueda de partes: si el nombre médico contiene o es contenido por el nombre del jugador
          medicalNorm.includes(playerLastNorm) ? 0.9 : 0,
          playerFullNorm.includes(medicalNorm) ? 0.85 : 0,
        ];

        const maxScore = Math.max(...scores);
        if (maxScore > bestScore) {
          bestScore = maxScore;
          bestMatch = player;
        }
      }

      // Si encontró una coincidencia suficientemente buena, actualizar
      if (bestMatch && bestScore > 0.6) {
        updates.push({
          recordId: medical.id,
          playerId: bestMatch.id,
          playerName: bestMatch.full_name,
          photoUrl: bestMatch.photo_url,
          score: bestScore,
        });
      }
    }

    // Ejecutar actualizaciones en lote
    for (const update of updates) {
      await base44.entities.MedicalRecord.update(update.recordId, {
        player_id: update.playerId,
        player_name: update.playerName,
        photo_url: update.photoUrl,
      });
      matched++;
    }

    return Response.json({
      success: true,
      matched,
      details: updates.map(u => ({
        medicalRecord: u.recordId,
        player: u.playerName,
        similarity: (u.score * 100).toFixed(1) + '%',
      })),
      message: `${matched} registros médicos asociados a jugadores del plantel`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});