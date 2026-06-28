import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Estructura exacta de la planilla leída:
// Columnas de partidos (pares: col descripción RES, col minutos RES, col descripción JUV, col minutos JUV)
// JUV F1=col20,col21  JUV F2=col24,col25  etc.
// Filas de jugadores: rows 9-27 (índice 0)

// Partidos Juveniles (15 fechas)
const MATCHES = [
  { label: "JUV F1",  date: "2026-03-15", rival: "Atletico Tucuman" },
  { label: "JUV F2",  date: "2026-03-22", rival: "Independiente Rivadavia" },
  { label: "JUV F3",  date: "2026-03-28", rival: "Vélez" },
  { label: "JUV F4",  date: "2026-04-02", rival: "Ferro" },
  { label: "JUV F5",  date: "2026-04-08", rival: "Banfield" },
  { label: "JUV F6",  date: "2026-04-11", rival: "Lanús" },
  { label: "JUV F7",  date: "2026-04-15", rival: "Racing" },
  { label: "JUV F8",  date: "2026-04-18", rival: "Rosario Central" },
  { label: "JUV F9",  date: "2026-04-21", rival: "Newell's" },
  { label: "JUV F10", date: "2026-04-25", rival: "Godoy Cruz" },
  { label: "JUV 11",  date: "2026-04-28", rival: "Platense" },
  { label: "JUV 12",  date: "2026-05-02", rival: "Argentinos" },
  { label: "JUV 13",  date: "2026-05-13", rival: "Independiente" },
  { label: "JUV 14",  date: "2026-05-20", rival: "Tigre" },
  { label: "JUV F15", date: "2026-06-18", rival: "River" },
];

// Datos extraídos directamente de la planilla
// Formato: [playerName, [minutos por partido JUV (15 valores, null=no participó)]]
const PLAYER_DATA = [
  // col_21, col_25, col_27, col_30, col_33, col_36, col_39, col_42, col_45, col_48, col_51, col_54, col_57, col_60, col_63
  { name: "Gaston Ayala",       mins: [96, 95, 90, 92, 80, 96, 73, 20, 93, 83, 82, 46, 99, 27, null] },
  { name: "Thomas Blasquez",    mins: [null, 9, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { name: "Jonas Cabrera",      mins: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { name: "Emiliano Cantero",   mins: [89, null, 97, 99, null, null, null, null, 80, 93, 86, 91, 99, 96, null] },
  { name: "Jose Capponi",       mins: [null, null, null, 69, 91, 93, null, null, null, null, null, null, null, null, 96] },
  { name: "Alan Coria",         mins: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { name: "Joaquin Ejea",       mins: [89, null, 64, 46, null, 93, null, 13, 13, 16, null, null, null, null, 95] },
  { name: "Ramiro Gagliardi",   mins: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { name: "Thiago Martinez",    mins: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { name: "Sebastian Neris Miño", mins: [null, 80, 97, 94, 91, 93, 93, null, 93, 10, 94, 10, 95, 6, 93] },
  { name: "Franco Pastrana",    mins: [null, 10, 62, null, null, null, null, 13, 3, 10, null, null, null, null, 70] },
  { name: "Juan Puchetta",      mins: [74, 72, 73, 99, 65, 93, 62, null, null, 30, null, null, null, null, null] },
  { name: "Maximo Rodriguez",   mins: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { name: "Joan Sosa",          mins: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { name: "Dylam Almada",       mins: [96, 105, 53, null, 95, null, null, 78, null, null, 88, null, null, null, 60] },
  { name: "Brian Retamoso",     mins: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { name: "Alessandro Guennin", mins: [77, 105, 97, 99, 96, 93, null, null, null, 96, 98, null, null, 4, 90] },
  { name: "Mateo Lopez",        mins: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { name: "Pablo Lopez",        mins: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { name: "Valentin Loza",      mins: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { name: "Lautaro Quiroga",    mins: [65, 93, 64, 94, null, null, null, null, null, null, null, 11, null, 17, 46] },
  { name: "Gustavo Vazquez",    mins: [95, 10, 97, 69, 93, null, 93, null, 96, 98, null, null, null, null, null] },
  { name: "Juan Moreno",        mins: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { name: "Facundo Noguera",    mins: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { name: "Facundo Quintana",   mins: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { name: "Uriel Ramos",        mins: [95, null, 97, 96, 93, null, null, null, null, null, null, null, null, null, null] },
  { name: "Patricio Flores",    mins: [96, 93, 98, 96, 96, 93, null, 94, null, null, null, null, null, null, 93] },
  { name: "Lautaro Vazquez",    mins: [95, null, 97, 69, 93, null, null, null, 96, 98, null, null, null, null, null] },
];

function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Cargar jugadores para mapeo de IDs
    const players = await base44.asServiceRole.entities.Player.list("-created_date", 200);
    const playerMap = {};
    players.forEach(p => {
      playerMap[norm(p.full_name)] = p;
    });

    // Crear/obtener MatchReport para cada partido juvenil
    const existingMatches = await base44.asServiceRole.entities.MatchReport.filter({ competition: "Juveniles" }, "-date", 50);
    const matchByDate = {};
    existingMatches.forEach(m => { matchByDate[m.date] = m; });

    const matchIds = {};
    for (const m of MATCHES) {
      if (!matchByDate[m.date]) {
        const created = await base44.asServiceRole.entities.MatchReport.create({
          date: m.date,
          rival: m.rival,
          competition: "Juveniles",
          location: "Local",
        });
        matchIds[m.date] = created.id;
      } else {
        matchIds[m.date] = matchByDate[m.date].id;
      }
    }

    // Insertar MinutesRecord
    let created = 0;
    let skipped = 0;

    for (const pd of PLAYER_DATA) {
      // Buscar player_id
      const playerEntry = playerMap[norm(pd.name)];
      const playerId = playerEntry?.id || null;
      const playerName = playerEntry?.full_name || pd.name;

      for (let i = 0; i < MATCHES.length; i++) {
        const mins = pd.mins[i];
        if (mins === null || mins === undefined || mins === 0) { skipped++; continue; }
        const m = MATCHES[i];
        await base44.asServiceRole.entities.MinutesRecord.create({
          player_id: playerId,
          player_name: playerName,
          tournament: "Juveniles",
          match_label: `vs ${m.rival} ${m.date.slice(5).replace("-", "/")}`,
          match_date: m.date,
          rival: m.rival,
          minutes: mins,
        });
        created++;
      }
    }

    return Response.json({
      success: true,
      matches_created: Object.keys(matchIds).length,
      minutes_created: created,
      skipped,
      message: `${created} registros de minutos y ${Object.keys(matchIds).length} partidos creados`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});