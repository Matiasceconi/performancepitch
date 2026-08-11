import { createHash } from "node:crypto";

/**
 * Normaliza un nombre: lowercase, sin acentos, espacios colapsados.
 */
export function normalizeName(name: string): string {
  return (name || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Parsea una línea CSV respetando comillas.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Doble comilla escapada
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; continue; }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  result.push(cur);
  return result.map((s) => s.trim());
}

/**
 * Parsea texto CSV a array de objetos.
 * Maneja BOM, CRLF/LF, comillas y campos vacíos al final.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/^\uFEFF/, "");
  const lines = clean.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] !== undefined ? vals[idx] : "";
    });
    rows.push(obj);
  }
  return rows;
}

/**
 * Calcula hashes raw y canonical de un archivo.
 */
export function calculateFileHashes(buf: ArrayBuffer): {
  rawFileSha256: string;
  canonicalContentSha256: string;
  sizeBytes: number;
  hasBOM: boolean;
  lineEnding: string;
  encoding: string;
} {
  const buffer = Buffer.from(buf);
  const rawHash = createHash("sha256").update(buffer).digest("hex");
  const hasBOM = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  let text = buffer.toString("utf8");
  if (hasBOM) text = text.replace(/^\uFEFF/, "");
  const hasCRLF = text.includes("\r\n");
  const canonical = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const canonicalHash = createHash("sha256").update(canonical, "utf8").digest("hex");
  return {
    rawFileSha256: rawHash,
    canonicalContentSha256: canonicalHash,
    sizeBytes: buffer.length,
    hasBOM,
    lineEnding: hasCRLF ? "CRLF" : "LF",
    encoding: "UTF-8",
  };
}

/**
 * Normaliza un valor numérico para comparación canónica.
 * - Convierte coma decimal a punto
 * - Redondea según precisión del catálogo (default 2 decimales)
 * - "10", "10.0", "10,00" → 10.00
 */
function canonicalNumber(raw: string, precision: number = 2): string {
  if (raw === undefined || raw === null || raw === "") return "";
  // Coma decimal → punto
  let s = String(raw).trim().replace(/\s/g, "");
  // Si tiene coma y no tiene punto, asumir coma decimal
  if (s.includes(",") && !s.includes(".")) {
    s = s.replace(",", ".");
  } else if (s.includes(",") && s.includes(".")) {
    // Coma como separador de miles → remover
    s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  if (isNaN(n)) return s; // no es número — conservar string normalizado
  return n.toFixed(precision);
}

/**
 * Normaliza una fecha/hora para comparación canónica.
 * "2026-08-10" y "10/08/2026" → "2026-08-10"
 */
function canonicalDate(raw: string): string {
  if (!raw) return "";
  const s = String(raw).trim();
  // ISO: YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  // DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, "0");
    const m = dmyMatch[2].padStart(2, "0");
    return `${dmyMatch[3]}-${m}-${d}`;
  }
  return s;
}

/**
 * Normaliza un nombre de columna para comparación.
 */
function canonicalKey(key: string): string {
  return (key || "").toLowerCase().trim().replace(/\s+/g, "_");
}

/**
 * Calcula el hash SHA-256 CANÓNICO de una fila completa.
 * Normaliza formato (no valores): espacios, mayúsculas/minúsculas,
 * fechas/horas equivalentes, coma/punto decimal.
 * Métricas numéricas se redondean según precisión del catálogo.
 */
export function computeCanonicalRowHash(
  row: Record<string, string>,
  metricPrecision: Record<string, number> = {}
): string {
  const normalized: Record<string, string> = {};
  for (const key of Object.keys(row)) {
    const ck = canonicalKey(key);
    const raw = row[key];
    if (raw === undefined || raw === null || raw === "") {
      normalized[ck] = "";
      continue;
    }
    // Si es una columna de fecha/hora, normalizar
    const lowerKey = ck;
    if (lowerKey === "date" || lowerKey === "fecha") {
      normalized[ck] = canonicalDate(raw);
    } else if (lowerKey === "time" || lowerKey === "hora") {
      normalized[ck] = String(raw).trim();
    } else {
      // Intentar tratar como número
      const precision = metricPrecision[key] ?? metricPrecision[ck] ?? 2;
      normalized[ck] = canonicalNumber(raw, precision);
    }
  }
  const stable = JSON.stringify(
    Object.keys(normalized).sort().reduce((acc, k) => {
      acc[k] = normalized[k];
      return acc;
    }, {} as Record<string, string>)
  );
  return createHash("sha256").update(stable, "utf8").digest("hex");
}

/**
 * Calcula el hash SHA-256 literal de una fila (deduplicación exacta legacy).
 * @deprecated Usar computeCanonicalRowHash para idempotencia real.
 */
export function computeRowHash(row: Record<string, string>): string {
  const stable = JSON.stringify(
    Object.keys(row).sort().reduce((acc, k) => {
      acc[k] = row[k];
      return acc;
    }, {} as Record<string, string>)
  );
  return createHash("sha256").update(stable, "utf8").digest("hex");
}

/**
 * Calcula idempotency key: organización + archivo + fila canónica.
 */
export function computeIdempotencyKey(
  organizationId: string | null,
  fileName: string,
  row: Record<string, string>,
  metricPrecision: Record<string, number> = {}
): string {
  const rowHash = computeCanonicalRowHash(row, metricPrecision);
  const stable = JSON.stringify({
    org: organizationId || "default",
    file: fileName,
    row_hash: rowHash,
  });
  return createHash("sha256").update(stable, "utf8").digest("hex");
}

export interface PlayerInfo {
  id: string;
  fullName: string;
  normalized: string;
  squadId: string | null;
  squadName: string | null;
  organizationId: string | null;
  position: string | null;
}

export interface AliasInfo {
  aliasNormalized: string;
  playerId: string;
  playerName: string;
  externalPlayerId: string | null;
  sourceKey: string | null;
  organizationId: string | null;
}

export interface LinkingResult {
  csvName: string;
  normalizedName: string;
  proposedPlayerId: string | null;
  proposedPlayerName: string | null;
  method: string;
  status: "exact_match" | "possible_match" | "collision" | "no_match";
  reason: string;
  candidateCount: number;
  candidates?: PlayerInfo[];
}

/**
 * Vincula un nombre del CSV contra la base de jugadores.
 * Orden: alias confirmado → coincidencia exacta normalizada única → posible por apellido (sugerencia) → sin match.
 * NO usa similitud aproximada para vincular automáticamente.
 * La búsqueda es a nivel club (organization), no limitada al plantel.
 */
export function linkPlayer(
  csvName: string,
  dbPlayers: PlayerInfo[],
  aliases: AliasInfo[],
  sourceKey?: string | null
): LinkingResult {
  const normalized = normalizeName(csvName);

  // 1. Alias confirmado (organization + source_key + alias_normalized)
  const alias = aliases.find((a) => {
    if (a.aliasNormalized !== normalized) return false;
    if (sourceKey && a.sourceKey && a.sourceKey !== sourceKey) return false;
    return true;
  });
  if (alias) {
    const player = dbPlayers.find((p) => p.id === alias.playerId);
    if (player) {
      return {
        csvName,
        normalizedName: normalized,
        proposedPlayerId: player.id,
        proposedPlayerName: player.fullName,
        method: alias.externalPlayerId ? "Identidad externa confirmada" : "Alias confirmado",
        status: "exact_match",
        reason: alias.externalPlayerId
          ? "Vinculado por external_player_id confirmado"
          : "Alias confirmado previamente para esta fuente",
        candidateCount: 1,
      };
    }
  }

  // 2. Coincidencia exacta normalizada y única dentro del club
  const exactMatches = dbPlayers.filter((p) => p.normalized === normalized);
  if (exactMatches.length === 1) {
    return {
      csvName,
      normalizedName: normalized,
      proposedPlayerId: exactMatches[0].id,
      proposedPlayerName: exactMatches[0].fullName,
      method: "exact_name_match",
      status: "exact_match",
      reason: "Nombre normalizado idéntico — único candidato en el club",
      candidateCount: 1,
    };
  }
  if (exactMatches.length > 1) {
    return {
      csvName,
      normalizedName: normalized,
      proposedPlayerId: null,
      proposedPlayerName: null,
      method: "Colisión entre varios candidatos",
      status: "collision",
      reason: `${exactMatches.length} jugadores con el mismo nombre normalizado en el club`,
      candidateCount: exactMatches.length,
      candidates: exactMatches,
    };
  }

  // 3. Posible coincidencia por apellido (SÓLO sugerencia — requiere confirmación manual)
  const csvParts = normalized.split(" ");
  const csvLast = csvParts[csvParts.length - 1];
  const possible = dbPlayers.filter((p) => {
    const pParts = p.normalized.split(" ");
    return pParts[pParts.length - 1] === csvLast && csvLast.length >= 3;
  });

  if (possible.length >= 1) {
    return {
      csvName,
      normalizedName: normalized,
      proposedPlayerId: null,
      proposedPlayerName: null,
      method: "possible_surname_match",
      status: possible.length === 1 ? "possible_match" : "collision",
      reason: `Sin coincidencia exacta. ${possible.length} jugador(es) con apellido "${csvLast}" — requiere confirmación manual`,
      candidateCount: possible.length,
      candidates: possible,
    };
  }

  // 4. Sin correspondencia
  return {
    csvName,
    normalizedName: normalized,
    proposedPlayerId: null,
    proposedPlayerName: null,
    method: "no_match",
    status: "no_match",
    reason: "No existe jugador con ese nombre ni apellido coincidente — pendiente de vinculación manual",
    candidateCount: 0,
  };
}

/**
 * Detecta si una fila es un retest (columna Rep/Attempt > 1).
 */
export function isRetest(row: Record<string, string>): boolean {
  const rep = row["Rep"] || row["rep"] || row["Attempt"] || row["attempt"] || row["Trial"] || row["trial"];
  if (rep) {
    const n = parseInt(rep, 10);
    if (!isNaN(n) && n > 1) return true;
  }
  return false;
}

/**
 * Extrae el número de intento de una fila.
 */
export function getAttemptNumber(row: Record<string, string>): number {
  const rep = row["Rep"] || row["rep"] || row["Attempt"] || row["attempt"] || row["Trial"] || row["trial"];
  if (rep) {
    const n = parseInt(rep, 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return 1;
}

/**
 * Columnas de metadatos (no son métricas).
 */
export const METADATA_COLS = new Set([
  "Name", "name", "Date", "date", "Test", "test", "Rep", "rep",
  "Attempt", "attempt", "Side", "side", "Time", "time", "Athlete", "athlete",
  "Trial", "trial", "Player", "player", "ID", "id",
]);

/**
 * Extrae métricas de una fila, conservando signo negativo.
 */
export function extractMetrics(
  row: Record<string, string>,
  metricKeys: string[]
): Record<string, number> {
  const metrics: Record<string, number> = {};
  for (const key of metricKeys) {
    const raw = row[key];
    if (raw === undefined || raw === null || raw === "") continue;
    // Coma decimal → punto
    let s = String(raw).trim().replace(/\s/g, "");
    if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
    else if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");
    const val = parseFloat(s);
    if (!isNaN(val)) metrics[key] = val;
  }
  return metrics;
}

/**
 * Separa asimetrías en magnitud y dirección.
 */
export function extractAsymmetries(
  row: Record<string, string>,
  metricKeys: string[]
): Record<string, { magnitude: number; direction: string | null }> {
  const asymmetries: Record<string, { magnitude: number; direction: string | null }> = {};
  for (const key of metricKeys) {
    if (!key.toLowerCase().includes("asym") && !key.toLowerCase().includes("imbalance")) continue;
    const raw = row[key];
    if (raw === undefined || raw === null || raw === "") continue;
    let s = String(raw).trim().replace(/\s/g, "");
    if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
    const val = parseFloat(s);
    if (isNaN(val)) continue;
    const direction = val > 0 ? "R" : val < 0 ? "L" : null;
    asymmetries[key] = { magnitude: Math.abs(val), direction };
  }
  return asymmetries;
}

/**
 * Detecta el test_key desde el contenido del CSV (columnas/métricas), no del nombre del archivo.
 * ForceDecks CSV tiene columnas características por test.
 */
export function detectTestKeyFromContent(
  headers: string[],
  metrics: string[],
  fileName?: string,
  testTypeHint?: string
): string {
  const allCols = [...headers, ...metrics].map((c) => c.toLowerCase());

  // CMRJ tiene métricas de reactive strength index modificado y tiempo de contacto
  if (allCols.some((c) => c.includes("rsi_mod") || c.includes("ground_contact_time") || c.includes("contact_time"))) {
    if (allCols.some((c) => c.includes("rebound") || c.includes("cmrj"))) return "cmrj";
  }

  // SJ no tiene countermovement depth
  if (allCols.some((c) => c.includes("squat_jump") || c.includes("_sj_"))) return "sj";
  if (allCols.some((c) => c.includes("countermovement") || c.includes("_cmj_"))) return "cmj";

  // Fallback: hint o nombre
  return detectTestKey(fileName || "", testTypeHint);
}

/**
 * Detecta el test_key desde el nombre del archivo o hint.
 */
export function detectTestKey(fileName: string, testTypeHint?: string): string {
  const lower = (fileName || "").toLowerCase();
  if (testTypeHint) {
    const h = testTypeHint.toLowerCase();
    if (h.includes("cmrj") || h.includes("rebound")) return "cmrj";
    if (h.includes("cmj") || h.includes("countermovement")) return "cmj";
    if (h.includes("sj") || h.includes("squat")) return "sj";
  }
  if (lower.includes("cmrj") || lower.includes("rebound")) return "cmrj";
  if (lower.includes("cmj") || lower.includes("countermovement")) return "cmj";
  if (lower.includes("sj") || lower.includes("squat")) return "sj";
  return "unknown";
}

/**
 * Detecta la fecha desde el contenido del CSV.
 * Busca columna Date/date con valor YYYY-MM-DD o DD/MM/YYYY.
 */
export function detectDateFromContent(rows: Record<string, string>[]): string | null {
  if (!rows.length) return null;
  const firstRow = rows[0];
  const dateCol = Object.keys(firstRow).find((k) => {
    const lk = k.toLowerCase();
    return lk === "date" || lk === "fecha" || lk === "test_date" || lk === "assessment_date";
  });
  if (dateCol && firstRow[dateCol]) {
    const d = canonicalDate(firstRow[dateCol]);
    if (d) return d;
  }
  return null;
}

/**
 * Detecta la hora desde el contenido del CSV.
 */
export function detectTimeFromContent(rows: Record<string, string>[]): string | null {
  if (!rows.length) return null;
  const firstRow = rows[0];
  const timeCol = Object.keys(firstRow).find((k) => {
    const lk = k.toLowerCase();
    return lk === "time" || lk === "hora" || lk === "test_time";
  });
  if (timeCol && firstRow[timeCol]) return firstRow[timeCol].trim();
  return null;
}

/**
 * Genera nombre automático de sesión: DD/MM/AAAA · PRUEBA + PRUEBA
 */
export function autoSessionName(assessmentDate: string, testKeys: string[]): string {
  if (!assessmentDate) return "Batería sin fecha";
  const parts = assessmentDate.split("-");
  if (parts.length !== 3) return `Batería ${assessmentDate}`;
  const dd = parts[2];
  const mm = parts[1];
  const yyyy = parts[0];
  const testPart = (testKeys || []).map((t) => t.toUpperCase()).join(" + ");
  return testPart ? `${dd}/${mm}/${yyyy} · ${testPart}` : `${dd}/${mm}/${yyyy}`;
}

/**
 * Calcula estadísticas básicas de un array de números.
 */
export function calculateStats(values: number[]): {
  mean: number;
  median: number;
  std: number;
  cv: number;
  count: number;
} {
  if (!values.length) return { mean: 0, median: 0, std: 0, cv: 0, count: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
  const cv = mean !== 0 ? (std / Math.abs(mean)) * 100 : 0;
  return { mean, median, std, cv, count: values.length };
}

/**
 * Calcula Z-score.
 */
export function zScore(value: number, mean: number, std: number): number | null {
  if (std === 0 || !isFinite(std)) return null;
  return (value - mean) / std;
}

/**
 * Calcula cambio porcentual evitando división por cero.
 */
export function pctChange(current: number, baseline: number): number | null {
  if (baseline === 0 || !isFinite(baseline)) return null;
  return ((current - baseline) / Math.abs(baseline)) * 100;
}

// ── Primary attempt selection ─────────────────────────────────────────────

export interface PrimaryMetricConfig {
  primaryMetric: string;
  primaryDirection: "higher" | "lower";
  secondaryMetric: string | null;
  secondaryDirection: "higher" | "lower";
}

/**
 * Selecciona el intento principal de forma determinística:
 * 1. Mejor valor en métrica principal
 * 2. Desempate por métrica secundaria
 * 3. Desempate por primer intento (horario o orden CSV)
 */
export function selectPrimaryAttempt(
  attempts: Array<{
    result_id: string;
    attempt_number: number;
    assessment_datetime?: string;
    metrics: Record<string, number>;
    retest: boolean;
  }>,
  config: PrimaryMetricConfig
): { primaryId: string; reason: string } | null {
  if (!attempts.length) return null;
  // Filtrar retests para selección automática (los retests no son primarios automáticos)
  const candidates = attempts.filter((a) => !a.retest);
  if (!candidates.length) {
    // Si todos son retests, usar el primero
    const first = attempts[0];
    return { primaryId: first.result_id, reason: "Único intento disponible (retest)" };
  }

  const isBetter = (a: number, b: number, direction: "higher" | "lower") =>
    direction === "higher" ? a > b : a < b;

  // Ordenar por: métrica principal → métrica secundaria → primer intento
  const sorted = [...candidates].sort((a, b) => {
    const aPrimary = a.metrics[config.primaryMetric];
    const bPrimary = b.metrics[config.primaryMetric];
    if (aPrimary != null && bPrimary != null && aPrimary !== bPrimary) {
      return isBetter(bPrimary, aPrimary, config.primaryDirection) ? 1 : -1;
    }
    // Métrica secundaria
    if (config.secondaryMetric) {
      const aSec = a.metrics[config.secondaryMetric];
      const bSec = b.metrics[config.secondaryMetric];
      if (aSec != null && bSec != null && aSec !== bSec) {
        return isBetter(bSec, aSec, config.secondaryDirection) ? 1 : -1;
      }
    }
    // Primer intento por horario o orden
    if (a.assessment_datetime && b.assessment_datetime) {
      return a.assessment_datetime.localeCompare(b.assessment_datetime);
    }
    return a.attempt_number - b.attempt_number;
  });

  const winner = sorted[0];
  const reason = config.secondaryMetric
    ? `Mejor ${config.primaryMetric}${config.primaryDirection === "higher" ? " (mayor)" : " (menor)"} · desempate ${config.secondaryMetric}`
    : `Mejor ${config.primaryMetric}${config.primaryDirection === "higher" ? " (mayor)" : " (menor)"}`;

  return { primaryId: winner.result_id, reason };
}