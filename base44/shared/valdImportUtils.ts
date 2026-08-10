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
      obj[h] = vals[idx] || "";
    });
    rows.push(obj);
  }
  return rows;
}

/**
 * Calcula hashes raw y canonical de un archivo.
 * raw: bytes exactos recibidos
 * canonical: BOM removido, saltos LF
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
 * Calcula el hash SHA-256 de una fila (para deduplicación exacta).
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

export interface PlayerInfo {
  id: string;
  fullName: string;
  normalized: string;
  squadId: string | null;
  squadName: string | null;
  organizationId: string | null;
}

export interface AliasInfo {
  aliasNormalized: string;
  playerId: string;
  playerName: string;
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
 * Vincula un nombre del CSV contra la base de jugadores usando aliases y coincidencia exacta.
 */
export function linkPlayer(
  csvName: string,
  dbPlayers: PlayerInfo[],
  aliases: AliasInfo[]
): LinkingResult {
  const normalized = normalizeName(csvName);

  // 1. Alias confirmado
  const alias = aliases.find((a) => a.aliasNormalized === normalized);
  if (alias) {
    const player = dbPlayers.find((p) => p.id === alias.playerId);
    if (player) {
      return {
        csvName,
        normalizedName: normalized,
        proposedPlayerId: player.id,
        proposedPlayerName: player.fullName,
        method: "Alias previamente confirmado",
        status: "exact_match",
        reason: "Alias confirmado previamente para este nombre",
        candidateCount: 1,
      };
    }
  }

  // 2. Coincidencia exacta normalizada
  const exactMatches = dbPlayers.filter((p) => p.normalized === normalized);
  if (exactMatches.length === 1) {
    return {
      csvName,
      normalizedName: normalized,
      proposedPlayerId: exactMatches[0].id,
      proposedPlayerName: exactMatches[0].fullName,
      method: "Coincidencia exacta normalizada",
      status: "exact_match",
      reason: "Nombre normalizado idéntico — único candidato en la organización",
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
      reason: `${exactMatches.length} jugadores con el mismo nombre normalizado`,
      candidateCount: exactMatches.length,
      candidates: exactMatches,
    };
  }

  // 3. Posible coincidencia por apellido
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
      method: "Posible coincidencia por similitud",
      status: "possible_match",
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
    method: "Sin correspondencia",
    status: "no_match",
    reason: "No existe jugador con ese nombre ni apellido coincidente — pendiente de vinculación manual",
    candidateCount: 0,
  };
}

/**
 * Extrae métricas de una fila CSV, separando magnitud y dirección de asimetrías.
 */
export function extractMetrics(
  row: Record<string, string>,
  metricKeys: string[]
): Record<string, number> {
  const metrics: Record<string, number> = {};
  for (const key of metricKeys) {
    const raw = row[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const val = parseFloat(raw);
    if (!isNaN(val)) {
      metrics[key] = val; // conserva signo negativo
    }
  }
  return metrics;
}

/**
 * Detecta si una fila es un retest (por convención de VALD: columna "Test" o "Rep" con valor > 1).
 */
export function isRetest(row: Record<string, string>): boolean {
  const rep = row["Rep"] || row["rep"] || row["Attempt"] || row["attempt"];
  if (rep) {
    const n = parseInt(rep, 10);
    if (!isNaN(n) && n > 1) return true;
  }
  return false;
}