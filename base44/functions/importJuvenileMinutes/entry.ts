import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Datos extraídos directamente de la planilla Excel
// Partidos JUV F1-F15 con minutos por jugador
// Solo se cargan los minutos > 0 del torneo Juveniles

const PARTIDOS_JUV = [
  { label: "JUV F1",  date: "2026-03-15", rival: "Juveniles F1",  location: "Visitante" },
  { label: "JUV F2",  date: "2026-03-22", rival: "Juveniles F2",  location: "Local"    },
  { label: "JUV F3",  date: "2026-03-28", rival: "Juveniles F3",  location: "Visitante" },
  { label: "JUV F4",  date: "2026-04-02", rival: "Juveniles F4",  location: "Local"    },
  { label: "JUV F5",  date: "2026-04-08", rival: "Juveniles F5",  location: "Local"    },
  { label: "JUV F6",  date: "2026-04-11", rival: "Juveniles F6",  location: "Visitante" },
  { label: "JUV F7",  date: "2026-04-15", rival: "Juveniles F7",  location: "Local"    },
  { label: "JUV F8",  date: "2026-04-18", rival: "Juveniles F8",  location: "Visitante" },
  { label: "JUV F9",  date: "2026-04-21", rival: "Juveniles F9",  location: "Local"    },
  { label: "JUV F10", date: "2026-04-25", rival: "Juveniles F10", location: "Visitante" },
  { label: "JUV 11",  date: "2026-04-28", rival: "Juveniles F11", location: "Local"    },
  { label: "JUV 12",  date: "2026-05-02", rival: "Juveniles F12", location: "Visitante" },
  { label: "JUV 13",  date: "2026-05-13", rival: "Juveniles F13", location: "Visitante" },
  { label: "JUV 14",  date: "2026-05-20", rival: "Juveniles F14", location: "Local"    },
  { label: "JUV F15", date: "2026-06-18", rival: "Juveniles F15", location: "Local"    },
];

// Minutos por jugador por partido (índice = partido JUV 0..14)
// Extraídos de la planilla: columnas pares con minutos (>0) para cada partido JUV
// Formato: { playerName, partidoIdx, minutes }
const MINUTOS_JUV = [
  // Ayala Gaston - total 70 min JUV
  { playerName: "Ayala Gaston",        partidoIdx: 0,  minutes: 96  },
  { playerName: "Ayala Gaston",        partidoIdx: 3,  minutes: 73  },
  { playerName: "Ayala Gaston",        partidoIdx: 9,  minutes: 27  },

  // Blasquez Thomas - total 160 min JUV
  { playerName: "Blasquez Thomas",     partidoIdx: 0,  minutes: 45  },
  { playerName: "Blasquez Thomas",     partidoIdx: 1,  minutes: 45  },

  // Cabrera Jonas
  { playerName: "Cabrera Jonas",       partidoIdx: 0,  minutes: 45  },

  // Cantero Emiliano - total 285 min JUV
  { playerName: "Cantero Emiliano",    partidoIdx: 0,  minutes: 89  },
  { playerName: "Cantero Emiliano",    partidoIdx: 2,  minutes: 97  },
  { playerName: "Cantero Emiliano",    partidoIdx: 4,  minutes: 99  },

  // Capponi Jose - total 541 min JUV
  { playerName: "Capponi Jose",        partidoIdx: 0,  minutes: 95  },
  { playerName: "Capponi Jose",        partidoIdx: 1,  minutes: 95  },
  { playerName: "Capponi Jose",        partidoIdx: 2,  minutes: 97  },
  { playerName: "Capponi Jose",        partidoIdx: 4,  minutes: 91  },
  { playerName: "Capponi Jose",        partidoIdx: 12, minutes: 96  },

  // Ejea Joaquin - total 525 min JUV
  { playerName: "Ejea Joaquin",        partidoIdx: 0,  minutes: 89  },
  { playerName: "Ejea Joaquin",        partidoIdx: 1,  minutes: 64  },
  { playerName: "Ejea Joaquin",        partidoIdx: 2,  minutes: 46  },
  { playerName: "Ejea Joaquin",        partidoIdx: 5,  minutes: 93  },
  { playerName: "Ejea Joaquin",        partidoIdx: 7,  minutes: 45  },
  { playerName: "Ejea Joaquin",        partidoIdx: 8,  minutes: 95  },
  { playerName: "Ejea Joaquin",        partidoIdx: 9,  minutes: 93  },

  // Gagliardi Ramiro
  { playerName: "Gagliardi Ramiro",    partidoIdx: 0,  minutes: 45  },

  // Neris Mino Sebastian - total 923 min JUV
  { playerName: "Neris Mino Sebastian", partidoIdx: 1,  minutes: 80  },
  { playerName: "Neris Mino Sebastian", partidoIdx: 2,  minutes: 97  },
  { playerName: "Neris Mino Sebastian", partidoIdx: 3,  minutes: 94  },
  { playerName: "Neris Mino Sebastian", partidoIdx: 4,  minutes: 91  },
  { playerName: "Neris Mino Sebastian", partidoIdx: 5,  minutes: 93  },
  { playerName: "Neris Mino Sebastian", partidoIdx: 7,  minutes: 93  },
  { playerName: "Neris Mino Sebastian", partidoIdx: 9,  minutes: 45  },
  { playerName: "Neris Mino Sebastian", partidoIdx: 10, minutes: 94  },
  { playerName: "Neris Mino Sebastian", partidoIdx: 12, minutes: 95  },
  { playerName: "Neris Mino Sebastian", partidoIdx: 13, minutes: 93  },

  // Pastrana Franco - total 257 min JUV
  { playerName: "Pastrana Franco",     partidoIdx: 0,  minutes: 62  },
  { playerName: "Pastrana Franco",     partidoIdx: 2,  minutes: 45  },
  { playerName: "Pastrana Franco",     partidoIdx: 9,  minutes: 80  },
  { playerName: "Pastrana Franco",     partidoIdx: 14, minutes: 70  },

  // Puchetta Juan - total 583 min JUV
  { playerName: "Puchetta Juan",       partidoIdx: 0,  minutes: 74  },
  { playerName: "Puchetta Juan",       partidoIdx: 1,  minutes: 72  },
  { playerName: "Puchetta Juan",       partidoIdx: 2,  minutes: 73  },
  { playerName: "Puchetta Juan",       partidoIdx: 3,  minutes: 99  },
  { playerName: "Puchetta Juan",       partidoIdx: 4,  minutes: 65  },
  { playerName: "Puchetta Juan",       partidoIdx: 5,  minutes: 93  },
  { playerName: "Puchetta Juan",       partidoIdx: 6,  minutes: 62  },
  { playerName: "Puchetta Juan",       partidoIdx: 8,  minutes: 45  },
  { playerName: "Puchetta Juan",       partidoIdx: 10, minutes: 45  },

  // Almada Dylan - total 669 min JUV
  { playerName: "Almada Dylan",        partidoIdx: 0,  minutes: 96  },
  { playerName: "Almada Dylan",        partidoIdx: 1,  minutes: 105 },
  { playerName: "Almada Dylan",        partidoIdx: 2,  minutes: 53  },
  { playerName: "Almada Dylan",        partidoIdx: 4,  minutes: 95  },
  { playerName: "Almada Dylan",        partidoIdx: 7,  minutes: 78  },
  { playerName: "Almada Dylan",        partidoIdx: 8,  minutes: 96  },
  { playerName: "Almada Dylan",        partidoIdx: 9,  minutes: 94  },
  { playerName: "Almada Dylan",        partidoIdx: 11, minutes: 88  },
  { playerName: "Almada Dylan",        partidoIdx: 14, minutes: 60  },

  // Brian Retamoso - total 0 min JUV (solo reserva)

  // Guennin Alessandro - total 752 min JUV
  { playerName: "Guennin Alessandro",  partidoIdx: 0,  minutes: 77  },
  { playerName: "Guennin Alessandro",  partidoIdx: 1,  minutes: 105 },
  { playerName: "Guennin Alessandro",  partidoIdx: 3,  minutes: 99  },
  { playerName: "Guennin Alessandro",  partidoIdx: 4,  minutes: 96  },
  { playerName: "Guennin Alessandro",  partidoIdx: 5,  minutes: 93  },
  { playerName: "Guennin Alessandro",  partidoIdx: 8,  minutes: 95  },
  { playerName: "Guennin Alessandro",  partidoIdx: 9,  minutes: 95  },
  { playerName: "Guennin Alessandro",  partidoIdx: 11, minutes: 95  },
  { playerName: "Guennin Alessandro",  partidoIdx: 14, minutes: 90  },

  // Quiroga Lautaro - total 362 min JUV
  { playerName: "Quiroga Lautaro",     partidoIdx: 0,  minutes: 65  },
  { playerName: "Quiroga Lautaro",     partidoIdx: 1,  minutes: 93  },
  { playerName: "Quiroga Lautaro",     partidoIdx: 2,  minutes: 64  },
  { playerName: "Quiroga Lautaro",     partidoIdx: 3,  minutes: 94  },
  { playerName: "Quiroga Lautaro",     partidoIdx: 14, minutes: 46  },

  // Vazquez Lautaro - total 354 min JUV
  { playerName: "Vazquez Lautaro",     partidoIdx: 0,  minutes: 95  },
  { playerName: "Vazquez Lautaro",     partidoIdx: 1,  minutes: 10  },
  { playerName: "Vazquez Lautaro",     partidoIdx: 2,  minutes: 97  },
  { playerName: "Vazquez Lautaro",     partidoIdx: 3,  minutes: 33  },
  { playerName: "Vazquez Lautaro",     partidoIdx: 4,  minutes: 69  },
  { playerName: "Vazquez Lautaro",     partidoIdx: 5,  minutes: 93  },
  { playerName: "Vazquez Lautaro",     partidoIdx: 6,  minutes: 93  },
  { playerName: "Vazquez Lautaro",     partidoIdx: 8,  minutes: 96  },
  { playerName: "Vazquez Lautaro",     partidoIdx: 9,  minutes: 98  },

  // Uriel Ramos - total 381 min JUV
  { playerName: "Uriel Ramos",         partidoIdx: 1,  minutes: 95  },
  { playerName: "Uriel Ramos",         partidoIdx: 2,  minutes: 97  },
  { playerName: "Uriel Ramos",         partidoIdx: 3,  minutes: 96  },
  { playerName: "Uriel Ramos",         partidoIdx: 4,  minutes: 93  },
  { playerName: "Uriel Ramos",         partidoIdx: 12, minutes: 0   },

  // Patricio Flores - total 663 min JUV
  { playerName: "Patricio Flores",     partidoIdx: 0,  minutes: 96  },
  { playerName: "Patricio Flores",     partidoIdx: 2,  minutes: 93  },
  { playerName: "Patricio Flores",     partidoIdx: 3,  minutes: 98  },
  { playerName: "Patricio Flores",     partidoIdx: 4,  minutes: 96  },
  { playerName: "Patricio Flores",     partidoIdx: 5,  minutes: 96  },
  { playerName: "Patricio Flores",     partidoIdx: 6,  minutes: 93  },
  { playerName: "Patricio Flores",     partidoIdx: 7,  minutes: 93  },
  { playerName: "Patricio Flores",     partidoIdx: 9,  minutes: 0   },
  { playerName: "Patricio Flores",     partidoIdx: 10, minutes: 0   },
  { playerName: "Patricio Flores",     partidoIdx: 13, minutes: 93  },
];

function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Cargar todos los jugadores para intentar vincular por player_id
    const players = await base44.asServiceRole.entities.Player.list("-created_date", 200);
    const playerMap = {};
    players.forEach(p => {
      if (p.full_name) playerMap[norm(p.full_name)] = p;
    });

    // Verificar que no existan ya registros de juveniles importados (evitar duplicados)
    const existing = await base44.asServiceRole.entities.MinutesRecord.filter(
      { tournament: "Juveniles" }, "-created_date", 500
    );
    const existingKeys = new Set(existing.map(r => `${r.player_name}__${r.match_date}`));

    let created = 0;
    let skipped = 0;
    const errors = [];

    for (const entry of MINUTOS_JUV) {
      if (!entry.minutes || entry.minutes <= 0) continue;
      const partido = PARTIDOS_JUV[entry.partidoIdx];
      if (!partido) continue;

      const key = `${entry.playerName}__${partido.date}`;
      if (existingKeys.has(key)) { skipped++; continue; }

      // Buscar player_id por nombre normalizado
      const normName = norm(entry.playerName);
      let matchedPlayer = playerMap[normName];
      // Fallback: buscar por apellido
      if (!matchedPlayer) {
        const parts = normName.split(" ");
        for (const p of Object.values(playerMap)) {
          const pNorm = norm(p.full_name || "");
          if (parts.length > 0 && pNorm.includes(parts[0])) {
            matchedPlayer = p;
            break;
          }
        }
      }

      const record = {
        player_name: entry.playerName,
        tournament: "Juveniles",
        match_label: `vs ${partido.rival} ${partido.date.slice(5,10)} (Juv)`,
        match_date: partido.date,
        rival: partido.rival,
        minutes: entry.minutes,
      };
      if (matchedPlayer) {
        record.player_id = matchedPlayer.id;
        record.player_name = matchedPlayer.full_name;
        record.player_number = matchedPlayer.jersey_number;
      }

      try {
        await base44.asServiceRole.entities.MinutesRecord.create(record);
        created++;
      } catch (e) {
        errors.push(`${entry.playerName} @ ${partido.date}: ${e.message}`);
      }
    }

    return Response.json({
      success: true,
      created,
      skipped,
      errors,
      message: `Importación completa: ${created} registros creados, ${skipped} omitidos (ya existían)`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});