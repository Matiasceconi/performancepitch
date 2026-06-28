import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// CSV parsing helpers (mismo que SessionCsvPanel)
function matchColumn(raw) {
  const h = raw.toLowerCase().replace(/^\uFEFF/, "").trim();
  if (h === "name" || h === "jugador" || h === "player" || h === "nombre" || h === "athlete") return "player_name";
  if (h === "total duration" || h === "tot dur") return "total_duration";
  if (h.includes("total distance") || h === "tot dist (m)" || h === "tot dist") return "total_distance";
  if (h.startsWith("d") && h.includes("19")) return "distance_hsr";
  if ((h.startsWith("d+") || h.startsWith("d +")) && h.includes("25")) return "sprint_distance";
  if (h === "sprint efforts" || h === "sprint effs") return "sprint_efforts";
  if (h.includes("acc") && (h.includes("3mt") || h.includes("3 m"))) return "accelerations";
  if (h.includes("dec") && (h.includes("3mt") || h.includes("3 m"))) return "decelerations";
  if (h === "total player load" || h === "tot pl" || h === "player load") return "player_load";
  if (h.includes("maximum velocity") || h === "max vel (km/h)" || h === "max velocity (km/h)") return "max_velocity";
  if (h.includes("max vel") && h.includes("%")) return "max_velocity_percentage";
  if (h === "metros x min" || h === "m/min" || h === "meters per minute") return "meters_per_minute";
  return null;
}

function parseNum(val) {
  if (val == null || val === "" || val === "-") return null;
  const str = String(val).trim();
  const hasCommaDecimal = /^\d+,\d+$/.test(str) || /^\d{1,3}(\.\d{3})*,\d+$/.test(str);
  const cleaned = hasCommaDecimal ? str.replace(/\./g, "").replace(",", ".") : str.replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseDuration(val) {
  if (!val) return null;
  const parts = String(val).trim().split(":").map(Number);
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  return parseNum(val);
}

function splitCSVLine(line, sep) {
  const result = [];
  let cur = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === sep && !inQuotes) { result.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  result.push(cur.trim());
  return result;
}

function parseCatapultCSV(text) {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);
  const firstSemi = lines[0].split(";").length;
  const firstComma = lines[0].split(",").length;
  const sep = firstSemi > firstComma ? ";" : ",";

  let headerIdx = -1, headers = [];
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cols = splitCSVLine(lines[i], sep);
    const firstLow = cols[0]?.replace(/^\uFEFF/, "").toLowerCase().trim();
    const mapped = cols.filter((c) => matchColumn(c) !== null).length;
    if (firstLow === "name" || firstLow === "jugador" || firstLow === "athlete" || mapped >= 3) {
      headerIdx = i;
      headers = cols.map((c, idx) => idx === 0 ? c.replace(/^\uFEFF/, "") : c);
      break;
    }
  }
  if (headerIdx === -1) return { error: "No se encontró fila de encabezados válida." };

  const fieldMap = {};
  headers.forEach((h, idx) => {
    const field = matchColumn(h);
    if (field) fieldMap[idx] = field;
    else if (idx === 0) fieldMap[idx] = "player_name";
  });

  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i], sep);
    const obj = {};
    Object.entries(fieldMap).forEach(([colIdx, field]) => {
      const raw = cols[parseInt(colIdx)];
      if (field === "player_name") obj[field] = raw || "";
      else if (field === "total_duration") obj[field] = parseDuration(raw);
      else obj[field] = parseNum(raw);
    });
    const name = (obj.player_name || "").trim();
    if (!name) continue;
    if (["total", "promedio", "average", "team", "totals"].includes(name.toLowerCase())) continue;
    rows.push(obj);
  }
  return { rows };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { csv_url, session_id, session_date, file_name } = await req.json();

    // 1. Descargar CSV
    const csvText = await fetch(csv_url).then(r => r.text());

    // 2. Parsear CSV
    const parseResult = parseCatapultCSV(csvText);
    if (parseResult.error) {
      return Response.json({ error: parseResult.error }, { status: 400 });
    }

    const rows = parseResult.rows;

    // 3. Obtener lista de jugadores y mapeos de nombres
    const [players, mappings] = await Promise.all([
      base44.asServiceRole.entities.Player.list('', 500),
      base44.asServiceRole.entities.PlayerNameMapping.list('', 500),
    ]);

    const normalizeName = (name) => (name || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

    // Mapa player_id -> player
    const playerById = Object.fromEntries(players.map(p => [p.id, p]));

    // Mapa de alias normalizados -> player_id (de PlayerNameMapping)
    const aliasMap = {};
    mappings.forEach(m => {
      const allNames = [m.player_name, ...(m.aliases || [])];
      allNames.forEach(name => {
        aliasMap[normalizeName(name)] = m.player_id;
      });
    });

    // 4. Procesar cada fila del CSV
    const imported = [];
    const matched = [];
    const unmatched = [];

    for (const row of rows) {
      const gpsName = (row.player_name || "").trim();
      let player = null;

      // Intento 1: alias/mapping exacto
      const aliasPlayerId = aliasMap[normalizeName(gpsName)];
      if (aliasPlayerId && playerById[aliasPlayerId]) {
        player = playerById[aliasPlayerId];
      }

      // Intento 2: búsqueda exacta normalizada por full_name
      if (!player) {
        for (const p of players) {
          const pName = p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim();
          if (normalizeName(pName) === normalizeName(gpsName)) { player = p; break; }
        }
      }

      // Intento 3: fuzzy matching por palabras
      if (!player) {
        const gpsWords = normalizeName(gpsName).split(" ").filter(w => w.length > 2);
        let bestScore = 0;
        for (const p of players) {
          const pName = p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim();
          const playerWords = normalizeName(pName).split(" ").filter(w => w.length > 2);
          const matches = gpsWords.filter(w => playerWords.includes(w)).length;
          const score = matches / Math.max(gpsWords.length, playerWords.length);
          if (score > bestScore) { bestScore = score; player = score >= 0.5 ? p : null; }
        }
      }

      // Crear registro CatapultReport
      const reportData = {
        player_name: gpsName,
        date: session_date,
        session_id: session_id,
        session_label: file_name,
        file_url: csv_url,
        total_duration: row.total_duration,
        total_distance: row.total_distance,
        distance_hsr: row.distance_hsr,
        sprint_distance: row.sprint_distance,
        sprint_efforts: row.sprint_efforts,
        accelerations: row.accelerations,
        decelerations: row.decelerations,
        player_load: row.player_load,
        max_velocity: row.max_velocity,
        max_velocity_percentage: row.max_velocity_percentage,
        meters_per_minute: row.meters_per_minute,
      };

      // Crear el documento con player_id en la raíz
      const finalData = { ...reportData };
      if (player) {
        finalData.player_id = player.id;
        await base44.asServiceRole.entities.CatapultReport.create(finalData);
        matched.push({ name: gpsName, playerId: player.id, playerName: player.data?.name || player.name });
      } else {
        // Sin player_id si no se encontró
        await base44.asServiceRole.entities.CatapultReport.create(finalData);
        unmatched.push(gpsName);
      }
      imported.push(gpsName);
    }

    return Response.json({
      success: true,
      total_imported: imported.length,
      total_matched: matched.length,
      total_unmatched: unmatched.length,
      details: {
        imported,
        matched,
        unmatched,
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});