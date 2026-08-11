import { createHash } from "node:crypto";

export function normalizeName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ");
}

export function normalizeHeader(value: string): string {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function detectDelimiter(line: string): string {
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestCount = -1;
  for (const delimiter of candidates) {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') quoted = !quoted;
      else if (!quoted && line[i] === delimiter) count++;
    }
    if (count > bestCount) { best = delimiter; bestCount = count; }
  }
  return best;
}

function parseCsvRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const clean = String(text || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '"') {
      if (quoted && clean[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      row.push(field);
      field = "";
    } else if (ch === "\n" && !quoted) {
      row.push(field);
      if (row.some((value) => String(value).trim() !== "")) records.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((value) => String(value).trim() !== "")) records.push(row);
  return records;
}

export function parseCsv(text: string): Record<string, string>[] {
  const clean = String(text || "").replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] || "";
  const records = parseCsvRecords(clean, detectDelimiter(firstLine));
  if (records.length < 2) return [];
  const headers = records[0].map((header, index) => String(header || `column_${index + 1}`).trim());
  return records.slice(1).map((values) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => { row[header] = String(values[index] ?? "").trim(); });
    return row;
  });
}

export function getField(row: Record<string, string>, aliases: string[]): string {
  const wanted = new Set(aliases.map(normalizeHeader));
  const key = Object.keys(row).find((header) => wanted.has(normalizeHeader(header)));
  return key ? String(row[key] || "").trim() : "";
}

export function normalizeDate(value: string): string | null {
  const input = String(value || "").trim();
  if (!input) return null;
  const iso = input.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const latam = input.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (latam) {
    const year = latam[3].length === 2 ? `20${latam[3]}` : latam[3];
    return `${year}-${latam[2].padStart(2, "0")}-${latam[1].padStart(2, "0")}`;
  }
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export function normalizeTime(value: string): string | null {
  const input = String(value || "").trim().toUpperCase();
  if (!input) return null;
  const match = input.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return input.toLowerCase();
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  if (match[4] === "PM" && hour < 12) hour += 12;
  if (match[4] === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

export function assessmentDateFromRow(row: Record<string, string>): string | null {
  return normalizeDate(getField(row, ["Date", "Assessment Date", "Test Date", "Fecha", "Fecha de prueba"]));
}

export function assessmentTimeFromRow(row: Record<string, string>): string | null {
  return normalizeTime(getField(row, ["Time", "Assessment Time", "Test Time", "Hora", "Hora de prueba"]));
}

export function athleteNameFromRow(row: Record<string, string>): string {
  return getField(row, ["Name", "Athlete", "Athlete Name", "Player", "Player Name", "Nombre", "Jugador"]);
}

export function calculateFileHashes(buf: ArrayBuffer): {
  rawFileSha256: string; canonicalContentSha256: string; sizeBytes: number;
  hasBOM: boolean; lineEnding: string; encoding: string;
} {
  const buffer = Buffer.from(buf);
  const rawFileSha256 = createHash("sha256").update(buffer).digest("hex");
  const hasBOM = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  const raw = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const canonical = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return {
    rawFileSha256,
    canonicalContentSha256: createHash("sha256").update(canonical, "utf8").digest("hex"),
    sizeBytes: buffer.length,
    hasBOM,
    lineEnding: raw.includes("\r\n") ? "CRLF" : "LF",
    encoding: "UTF-8",
  };
}

export function parseNumeric(rawValue: unknown): number | null {
  const input = String(rawValue ?? "").trim();
  if (!input) return null;
  const compact = input.replace(/\s+(L|R)$/i, "").replace(/%/g, "").replace(/\s/g, "");
  let normalized = compact;
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(compact)) normalized = compact.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+,\d+$/.test(compact)) normalized = compact.replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function decimalPlaces(rawValue: unknown): number {
  const input = String(rawValue ?? "").trim().replace(/\s+(L|R)$/i, "").replace(/%/g, "");
  const match = input.match(/[.,](\d+)$/);
  return match ? match[1].length : 0;
}

function canonicalScalar(
  header: string,
  rawValue: unknown,
  precisionByHeader: Record<string, number>,
): string | number | null {
  const raw = String(rawValue ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return "";
  const normalizedHeader = normalizeHeader(header);
  if (["date", "assessment date", "test date", "fecha", "fecha de prueba"].includes(normalizedHeader)) {
    return normalizeDate(raw) || raw.toLowerCase();
  }
  if (["time", "assessment time", "test time", "hora", "hora de prueba"].includes(normalizedHeader)) {
    return normalizeTime(raw) || raw.toLowerCase();
  }
  const numeric = parseNumeric(raw);
  if (numeric !== null) {
    const configured = precisionByHeader[header] ?? precisionByHeader[normalizedHeader];
    const precision = Number.isInteger(configured) ? configured : decimalPlaces(raw);
    const rounded = Number(numeric.toFixed(Math.max(0, Math.min(8, precision))));
    const direction = raw.match(/\s+(L|R)$/i)?.[1]?.toUpperCase();
    return direction ? `${rounded}|${direction}` : rounded;
  }
  return raw.toLocaleLowerCase("es");
}

export function canonicalizeRow(
  row: Record<string, string>,
  precisionByHeader: Record<string, number> = {},
): Record<string, string | number | null> {
  return Object.keys(row)
    .sort((a, b) => normalizeHeader(a).localeCompare(normalizeHeader(b)))
    .reduce((acc, header) => {
      acc[normalizeHeader(header)] = canonicalScalar(header, row[header], precisionByHeader);
      return acc;
    }, {} as Record<string, string | number | null>);
}

export function computeRowHash(
  row: Record<string, string>,
  precisionByHeader: Record<string, number> = {},
): string {
  return createHash("sha256").update(JSON.stringify(canonicalizeRow(row, precisionByHeader)), "utf8").digest("hex");
}

export function computeIdempotencyKey(
  organizationId: string | null,
  sourceKey: string,
  row: Record<string, string>,
  precisionByHeader: Record<string, number> = {},
): string {
  return createHash("sha256").update(JSON.stringify({
    organization_id: organizationId || "default",
    source_key: sourceKey,
    row: canonicalizeRow(row, precisionByHeader),
  }), "utf8").digest("hex");
}

export function detectSourceKey(headers: string[]): string {
  const normalized = headers.map(normalizeHeader);
  if (normalized.includes("test type") && normalized.some((h) => h.includes("imp-mom"))) return "forcedecks";
  if (normalized.some((h) => h.includes("nordbord") || h.includes("nordic force"))) return "nordbord";
  return "unknown";
}

export function detectTestKey(_fileName: string, testTypeHint?: string): string {
  const hint = normalizeHeader(testTypeHint || "");
  if (hint === "cmrj" || hint.includes("rebound")) return "cmrj";
  if (hint === "cmj" || hint.includes("countermovement jump")) return "cmj";
  if (hint === "sj" || hint.includes("squat jump")) return "sj";
  return hint.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "unknown";
}

export function testKeyFromRow(row: Record<string, string>): string {
  return detectTestKey("", getField(row, ["Test Type", "Test", "Assessment", "Prueba", "Tipo de prueba"]));
}

export function metricHeaders(row: Record<string, string>): string[] {
  const metadata = new Set([...METADATA_COLS].map(normalizeHeader));
  return Object.keys(row).filter((header) => !metadata.has(normalizeHeader(header)) && String(row[header] || "").trim() !== "");
}

export function extractMetrics(row: Record<string, string>, keys = metricHeaders(row)): Record<string, number> {
  const metrics: Record<string, number> = {};
  for (const key of keys) {
    const value = parseNumeric(row[key]);
    if (value !== null) metrics[key] = value;
  }
  return metrics;
}

export function extractAsymmetries(
  row: Record<string, string>,
  keys = metricHeaders(row),
): Record<string, { magnitude: number; direction: string | null }> {
  const asymmetries: Record<string, { magnitude: number; direction: string | null }> = {};
  for (const key of keys) {
    const lower = normalizeHeader(key);
    if (!lower.includes("asym") && !lower.includes("imbalance")) continue;
    const value = parseNumeric(row[key]);
    if (value === null) continue;
    const suffix = String(row[key] || "").match(/\s+(L|R)$/i)?.[1]?.toUpperCase() || null;
    asymmetries[key] = { magnitude: Math.abs(value), direction: suffix };
  }
  return asymmetries;
}

export function getRepetitions(row: Record<string, string>): number | null {
  const value = parseNumeric(getField(row, ["Reps", "Repetitions", "Repeticiones"]));
  return value !== null ? Math.max(0, Math.round(value)) : null;
}

export function getAttemptNumber(row: Record<string, string>): number {
  const value = parseNumeric(getField(row, ["Attempt", "Attempt Number", "Trial", "Intento"]));
  return value !== null && value > 0 ? Math.round(value) : 1;
}

export function isRetest(row: Record<string, string>): boolean {
  const value = getField(row, ["Retest", "Is Retest", "Re-test"]);
  return /^(1|true|yes|si|sí)$/i.test(value);
}

export interface PlayerInfo {
  id: string; fullName: string; normalized: string; squadId: string | null;
  squadName: string | null; organizationId: string | null; position: string | null;
}

export interface AliasInfo {
  aliasNormalized: string; playerId: string; playerName: string;
  externalPlayerId: string | null; sourceKey: string | null;
}

export interface LinkingResult {
  csvName: string; normalizedName: string; proposedPlayerId: string | null;
  proposedPlayerName: string | null; method: string;
  status: "exact_match" | "possible_match" | "collision" | "no_match";
  reason: string; candidateCount: number; candidates?: PlayerInfo[];
}

export function linkPlayer(csvName: string, dbPlayers: PlayerInfo[], aliases: AliasInfo[], sourceKey = "forcedecks"): LinkingResult {
  const normalized = normalizeName(csvName);
  const aliasMatches = aliases.filter((alias) =>
    alias.aliasNormalized === normalized && (!alias.sourceKey || alias.sourceKey === sourceKey)
  );
  if (aliasMatches.length === 1) {
    const player = dbPlayers.find((item) => item.id === aliasMatches[0].playerId);
    if (player) return {
      csvName, normalizedName: normalized, proposedPlayerId: player.id,
      proposedPlayerName: player.fullName, method: "confirmed_alias", status: "exact_match",
      reason: "Alias confirmado para esta fuente", candidateCount: 1,
    };
  }
  if (aliasMatches.length > 1) return {
    csvName, normalizedName: normalized, proposedPlayerId: null, proposedPlayerName: null,
    method: "alias_collision", status: "collision", reason: "El alias activo apunta a más de una identidad",
    candidateCount: aliasMatches.length,
  };

  const exact = dbPlayers.filter((player) => player.normalized === normalized);
  if (exact.length === 1) return {
    csvName, normalizedName: normalized, proposedPlayerId: exact[0].id,
    proposedPlayerName: exact[0].fullName, method: "exact_name_match", status: "exact_match",
    reason: "Coincidencia exacta única dentro del club", candidateCount: 1,
  };
  if (exact.length > 1) return {
    csvName, normalizedName: normalized, proposedPlayerId: null, proposedPlayerName: null,
    method: "exact_name_collision", status: "collision", reason: "Hay varias identidades con el mismo nombre normalizado",
    candidateCount: exact.length, candidates: exact,
  };

  const lastName = normalized.split(" ").filter(Boolean).at(-1) || "";
  const possible = lastName.length >= 3
    ? dbPlayers.filter((player) => player.normalized.split(" ").at(-1) === lastName)
    : [];
  if (possible.length) return {
    csvName, normalizedName: normalized, proposedPlayerId: null, proposedPlayerName: null,
    method: "surname_suggestion", status: "possible_match",
    reason: "Sugerencia por apellido; requiere confirmación manual",
    candidateCount: possible.length, candidates: possible,
  };
  return {
    csvName, normalizedName: normalized, proposedPlayerId: null, proposedPlayerName: null,
    method: "no_match", status: "no_match", reason: "Sin coincidencia exacta dentro del club",
    candidateCount: 0, candidates: [],
  };
}

export function formatSessionName(date: string, testKeys: string[]): string {
  const [year, month, day] = date.split("-");
  const label = [day, month, year].filter(Boolean).join("/");
  return `${label} · ${[...new Set(testKeys)].map((key) => key.toUpperCase()).sort().join(" + ")}`;
}

export const METADATA_COLS = new Set([
  "Name", "Athlete", "Athlete Name", "Player", "Player Name", "Nombre", "Jugador",
  "ExternalId", "External ID", "Test Type", "Test", "Assessment", "Date", "Time",
  "Assessment Date", "Assessment Time", "Rep", "Reps", "Repetitions", "Attempt",
  "Attempt Number", "Trial", "Side", "Tags", "Retest", "Is Retest",
]);

export function calculateStats(values: number[]): { mean: number; median: number; std: number; cv: number; count: number } {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return { mean: 0, median: 0, std: 0, cv: 0, count: 0 };
  const sorted = [...finite].sort((a, b) => a - b);
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  const variance = finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / finite.length;
  const std = Math.sqrt(variance);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return { mean, median, std, cv: mean ? (std / Math.abs(mean)) * 100 : 0, count: finite.length };
}

export function zScore(value: number, mean: number, std: number): number | null {
  return std && Number.isFinite(std) ? (value - mean) / std : null;
}

export function pctChange(current: number, baseline: number): number | null {
  return baseline && Number.isFinite(baseline) ? ((current - baseline) / Math.abs(baseline)) * 100 : null;
}
