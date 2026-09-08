import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function matchColumn(raw) {
  const h = raw.toLowerCase().replace(/^\uFEFF/, "").trim();
  if (h === "name" || h === "jugador" || h === "player" || h === "nombre" || h === "athlete") return "player_name";
  if (["period name", "period", "periodo", "período", "half", "segment", "activity name", "activity"].includes(h)) return "period_name";
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
      if (field === "player_name" || field === "period_name") obj[field] = raw || "";
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

function normalizePeriodLabel(value, fallbackIndex = 0) {
  const raw = String(value || "").trim();
  const n = normalizeName(raw);
  if (/^(1t|1er tiempo|primer tiempo|primera parte|first half|1st half|h1)$/.test(n) || n.includes("first half")) return { name: "1T", order: 1, kind: "period" };
  if (/^(2t|2do tiempo|segundo tiempo|segunda parte|second half|2nd half|h2)$/.test(n) || n.includes("second half")) return { name: "2T", order: 2, kind: "period" };
  if (/(partido|match|game|full|total|all periods|sesion completa|session total)/.test(n)) return { name: raw || "Partido completo", order: 0, kind: "full" };
  if (raw) return { name: raw, order: fallbackIndex + 1, kind: "period" };
  return { name: `Período ${fallbackIndex + 1}`, order: fallbackIndex + 1, kind: "period" };
}

const ADDITIVE_KEYS = ["total_duration", "total_distance", "distance_hsr", "sprint_distance", "sprint_efforts", "accelerations", "decelerations", "player_load"];
const MAX_KEYS = ["max_velocity", "max_velocity_percentage"];

function aggregatePlayerRows(rows) {
  if (!rows.length) return null;
  const enriched = rows.map((row, index) => ({ ...row, _period: normalizePeriodLabel(row.period_name, index) }));
  const fullRows = enriched.filter((row) => row._period.kind === "full");
  const periodRows = enriched.filter((row) => row._period.kind !== "full");
  const canonical = fullRows.length
    ? [...fullRows].sort((a, b) => Number(b.total_duration || 0) - Number(a.total_duration || 0))[0]
    : null;
  const sourceRows = canonical ? [canonical] : enriched;
  const summary = {
    player_id: rows[0].player_id || null,
    player_name: rows[0].player_name,
    csv_name: rows[0].csv_name,
    photo_url: rows[0].photo_url || null,
    jersey_number: rows[0].jersey_number || null,
    position: rows[0].position || null,
    unresolved: !!rows[0].unresolved,
  };
  ADDITIVE_KEYS.forEach((key) => {
    const values = sourceRows.map((row) => Number(row[key])).filter(Number.isFinite);
    summary[key] = values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  });
  MAX_KEYS.forEach((key) => {
    const values = sourceRows.map((row) => Number(row[key])).filter(Number.isFinite);
    summary[key] = values.length ? Math.max(...values) : null;
  });
  if (summary.total_distance != null && Number(summary.total_duration) > 0) summary.meters_per_minute = summary.total_distance / summary.total_duration;
  else {
    const intensities = sourceRows.map((row) => Number(row.meters_per_minute)).filter(Number.isFinite);
    summary.meters_per_minute = intensities.length ? intensities.reduce((sum, value) => sum + value, 0) / intensities.length : null;
  }
  const breakdownRows = periodRows.length ? periodRows : (canonical ? [] : enriched);
  summary.period_breakdown = breakdownRows
    .map((row) => ({
      period_name: row._period.name,
      period_order: row._period.order,
      total_duration: row.total_duration ?? null,
      total_distance: row.total_distance ?? null,
      distance_hsr: row.distance_hsr ?? null,
      sprint_distance: row.sprint_distance ?? null,
      sprint_efforts: row.sprint_efforts ?? null,
      accelerations: row.accelerations ?? null,
      decelerations: row.decelerations ?? null,
      player_load: row.player_load ?? null,
      max_velocity: row.max_velocity ?? null,
      max_velocity_percentage: row.max_velocity_percentage ?? null,
      meters_per_minute: row.meters_per_minute ?? ((Number(row.total_duration) > 0 && Number(row.total_distance) >= 0) ? Number(row.total_distance) / Number(row.total_duration) : null),
    }))
    .sort((a, b) => (a.period_order || 99) - (b.period_order || 99));
  return summary;
}

function buildPlayerSummaries(rows) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = row.player_id || `csv:${normalizeName(row.csv_name || row.player_name)}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  });
  return Array.from(grouped.values()).map(aggregatePlayerRows).filter(Boolean);
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

    // ── Modo: save_mapping (guardar alias manual) ──────────────────────────────
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

      // Si se pasa match_id + match_date + csv_url, también actualizar el CatapultReport de ese jugador
      if (body.match_id && body.match_date && body.csv_url) {
        try {
          const existing = await base44.asServiceRole.entities.CatapultReport.filter({
            session_id: body.match_id,
            player_id: player_id,
          });
          if (existing.length === 0) {
            // Re-parsear CSV para obtener los datos de este jugador
            const csvText = await fetch(body.csv_url).then(r => r.text());
            const parsed = parseCatapultCSV(csvText);
            if (!parsed.error) {
              const playerRows = parsed.rows
                .filter(r => normalizeName(r.player_name) === normalizeName(csv_name))
                .map(r => ({ ...r, player_id, player_name: officialName, csv_name }));
              const playerSummary = aggregatePlayerRows(playerRows);
              if (playerSummary) {
                await base44.asServiceRole.entities.CatapultReport.create({
                  player_id: player_id,
                  player_name: officialName,
                  date: body.match_date,
                  session_id: body.match_id,
                  session_label: body.csv_label || "Partido GPS",
                  file_url: body.csv_url,
                  total_duration: playerSummary.total_duration,
                  total_distance: playerSummary.total_distance,
                  distance_hsr: playerSummary.distance_hsr,
                  sprint_distance: playerSummary.sprint_distance,
                  sprint_efforts: playerSummary.sprint_efforts,
                  accelerations: playerSummary.accelerations,
                  decelerations: playerSummary.decelerations,
                  player_load: playerSummary.player_load,
                  max_velocity: playerSummary.max_velocity,
                  max_velocity_percentage: playerSummary.max_velocity_percentage,
                  meters_per_minute: playerSummary.meters_per_minute,
                  period_breakdown: playerSummary.period_breakdown || [],
                });
              }
            }
          }
        } catch (e) {
          // Continuar aunque falle el upsert
        }
      }

      return Response.json({ success: true, message: `Alias "${csv_name}" vinculado a ${officialName}` });
    }

    // ── Modo: resolve + persist (por defecto) ────────────────────────────────
    // Parámetros: csv_url (requerido), match_id (opcional), match_date (opcional), csv_label (opcional)
    const { csv_url, match_id, match_date, csv_label } = body;
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

    const playerById = Object.fromEntries(players.map(p => [p.id, p]));

    const resolvedRows = [];
    const unresolvedNames = new Set();

    for (const row of parseResult.rows) {
      const csvName = (row.player_name || "").trim();
      let playerId = null;
      let officialName = null;

      // 1. Alias map
      const aliasHit = aliasMap[normalizeName(csvName)];
      if (aliasHit && playerById[aliasHit]) {
        playerId = aliasHit;
        const p = playerById[aliasHit];
        officialName = p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim();
      }

      // 2. Nombre exacto normalizado
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

    const playerSummaries = buildPlayerSummaries(resolvedRows);
    const resolvedSummaries = playerSummaries.filter((row) => row.player_id && !row.unresolved);

    // ── Persistir una fila canónica por jugador + desglose por períodos ──────
    if (match_id && match_date && resolvedSummaries.length > 0) {
      const existingReports = await base44.asServiceRole.entities.CatapultReport.filter({ session_id: match_id });
      const existingByPlayerId = Object.fromEntries(existingReports.map(r => [r.player_id, r]));

      const incomingPlayerIds = new Set(resolvedSummaries.map((item) => item.player_id));
      for (const existing of existingReports) {
        if (existing.player_id && !incomingPlayerIds.has(existing.player_id)) {
          await base44.asServiceRole.entities.CatapultReport.delete(existing.id);
        }
      }

      for (const summary of resolvedSummaries) {
        const reportData = {
          player_id: summary.player_id,
          player_name: summary.player_name,
          date: match_date,
          session_id: match_id,
          session_label: csv_label || "Partido GPS",
          file_url: csv_url,
          total_duration: summary.total_duration,
          total_distance: summary.total_distance,
          distance_hsr: summary.distance_hsr,
          sprint_distance: summary.sprint_distance,
          sprint_efforts: summary.sprint_efforts,
          accelerations: summary.accelerations,
          decelerations: summary.decelerations,
          player_load: summary.player_load,
          max_velocity: summary.max_velocity,
          max_velocity_percentage: summary.max_velocity_percentage,
          meters_per_minute: summary.meters_per_minute,
          period_breakdown: summary.period_breakdown || [],
        };

        if (existingByPlayerId[summary.player_id]) {
          await base44.asServiceRole.entities.CatapultReport.update(existingByPlayerId[summary.player_id].id, reportData);
        } else {
          await base44.asServiceRole.entities.CatapultReport.create(reportData);
        }
      }
    }

    // Candidatos para selección manual
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
      player_summaries: playerSummaries,
      persisted: resolvedSummaries.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});