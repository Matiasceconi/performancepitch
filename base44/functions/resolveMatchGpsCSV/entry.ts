import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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
    const mapped = cols.filter((c) => matchColumn(c) !== null).length;
    const firstLow = cols[0]?.replace(/^\uFEFF/, "").toLowerCase().trim();
    if (firstLow === "name" || firstLow === "jugador" || firstLow === "athlete" || mapped >= 3) {
      headerIdx = i;
      headers = cols.map((c) => c.replace(/^\uFEFF/, ""));
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

function normalizeName(name) {
  return (name || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/\s+/g, " ");
}

function fuzzyMatch(gpsName, players) {
  const gpsWords = normalizeName(gpsName).split(" ").filter(w => w.length > 2);
  if (gpsWords.length === 0) return null;
  let best = null, bestScore = 0;
  for (const p of players) {
    const pName = p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim();
    const pWords = normalizeName(pName).split(" ").filter(w => w.length > 2);
    if (pWords.length === 0) continue;
    const matches = gpsWords.filter(w => pWords.includes(w)).length;
    const score = matches / Math.max(gpsWords.length, pWords.length);
    if (score > bestScore) { bestScore = score; best = score >= 0.5 ? p : null; }
  }
  return best;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();

    // Modo: "resolve" (leer CSV y resolver) o "save_mapping" (guardar alias manual)
    if (body.mode === "save_mapping") {
      const { csv_name, player_id } = body;
      if (!csv_name || !player_id) return Response.json({ error: "csv_name y player_id requeridos" }, { status: 400 });

      const players = await base44.asServiceRole.entities.Player.list('', 500);
      const player = players.find(p => p.id === player_id);
      if (!player) return Response.json({ error: "Jugador no encontrado" }, { status: 404 });

      const mappings = await base44.asServiceRole.entities.PlayerNameMapping.filter({ player_id }, '', 10);
      const officialName = player.full_name || `${player.first_name || ""} ${player.last_name || ""}`.trim();

      if (mappings.length > 0) {
        const existing = mappings[0];
        const aliases = new Set([...(existing.aliases || []), csv_name]);
        await base44.asServiceRole.entities.PlayerNameMapping.update(existing.id, {
          aliases: Array.from(aliases),
        });
      } else {
        await base44.asServiceRole.entities.PlayerNameMapping.create({
          player_id,
          player_name: officialName,
          aliases: [csv_name],
          sources: ['Partidos GPS'],
        });
      }
      return Response.json({ success: true, message: `Alias "${csv_name}" vinculado a ${officialName}` });
    }

    // Modo "resolve" (por defecto)
    const { csv_url } = body;
    if (!csv_url) return Response.json({ error: "csv_url requerido" }, { status: 400 });

    // Descargar y parsear CSV
    const csvText = await fetch(csv_url).then(r => r.text());
    const parseResult = parseCatapultCSV(csvText);
    if (parseResult.error) return Response.json({ error: parseResult.error }, { status: 400 });

    // Cargar jugadores y mappings
    const [players, mappings] = await Promise.all([
      base44.asServiceRole.entities.Player.list('', 500),
      base44.asServiceRole.entities.PlayerNameMapping.list('', 500),
    ]);

    // Construir mapa de alias normalizados -> player_id
    const aliasMap = {};
    mappings.forEach(m => {
      const allNames = [m.player_name, ...(m.aliases || [])];
      allNames.forEach(name => {
        aliasMap[normalizeName(name)] = m.player_id;
      });
    });

    // Mapa player_id -> player object
    const playerById = Object.fromEntries(players.map(p => [p.id, p]));

    const resolvedRows = [];
    const unresolvedNames = new Set();

    for (const row of parseResult.rows) {
      const csvName = (row.player_name || "").trim();
      let playerId = null;
      let officialName = null;

      // 1. Buscar en alias map
      const aliasHit = aliasMap[normalizeName(csvName)];
      if (aliasHit && playerById[aliasHit]) {
        playerId = aliasHit;
        const p = playerById[aliasHit];
        officialName = p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim();
      }

      // 2. Buscar por nombre exacto normalizado
      if (!playerId) {
        for (const p of players) {
          const pName = p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim();
          if (normalizeName(pName) === normalizeName(csvName)) {
            playerId = p.id;
            officialName = pName;
            break;
          }
        }
      }

      // 3. Fuzzy match
      if (!playerId) {
        const match = fuzzyMatch(csvName, players);
        if (match) {
          playerId = match.id;
          officialName = match.full_name || `${match.first_name || ""} ${match.last_name || ""}`.trim();
        }
      }

      if (playerId) {
        const p = playerById[playerId];
        resolvedRows.push({
          ...row,
          player_id: playerId,
          player_name: officialName || csvName,
          csv_name: csvName,
          photo_url: p?.photo_url || null,
          jersey_number: p?.jersey_number || null,
          position: p?.position || null,
        });
      } else {
        unresolvedNames.add(csvName);
        resolvedRows.push({
          ...row,
          player_id: null,
          player_name: csvName,
          csv_name: csvName,
          unresolved: true,
        });
      }
    }

    // Candidatos del plantel para selección manual de los no resueltos
    const playerOptions = players.map(p => ({
      id: p.id,
      full_name: p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim(),
      jersey_number: p.jersey_number,
      position: p.position,
      photo_url: p.photo_url,
      division: p.division,
    })).sort((a, b) => (a.jersey_number || 99) - (b.jersey_number || 99));

    return Response.json({
      success: true,
      rows: resolvedRows,
      total: resolvedRows.length,
      resolved: resolvedRows.filter(r => !r.unresolved).length,
      unresolved: resolvedRows.filter(r => r.unresolved).length,
      unresolved_names: Array.from(unresolvedNames),
      player_options: playerOptions,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});