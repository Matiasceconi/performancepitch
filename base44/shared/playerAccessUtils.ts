// Utilidades compartidas para generación de usuarios y activación de jugadores.

export function normalizeUsername(name: string): string {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function generateUsernameBase(firstName: string, lastName: string): string {
  const first = normalizeUsername(firstName);
  const last = normalizeUsername(lastName);
  if (!first || !last) return '';
  return `${first}.${last}`;
}

export function normalizeDni(dni: string | number | undefined | null): string {
  return String(dni || '').replace(/\D/g, '');
}

export function maskDni(dni: string | number | undefined | null): string {
  const clean = normalizeDni(dni);
  if (!clean) return '';
  if (clean.length <= 3) return '•'.repeat(clean.length);
  return '•'.repeat(Math.min(clean.length - 3, 6)) + clean.slice(-3);
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateActivationToken(): string {
  return crypto.randomUUID() + crypto.randomUUID();
}

export function generateUniqueUsername(base: string, existing: Set<string>): string {
  if (!base) return '';
  if (!existing.has(base)) return base;
  let n = 2;
  while (existing.has(`${base}${n}`)) n++;
  return `${base}${n}`;
}