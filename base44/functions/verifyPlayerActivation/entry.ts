import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { normalizeDni, normalizeUsername, generateActivationToken, hashToken } from "../../shared/playerAccessUtils.ts";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const TOKEN_TTL_MINUTES = 30;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const rawUsername = String(body.username || '').toLowerCase().trim();
    const rawDni = normalizeDni(body.dni);

    if (!rawUsername || !rawDni) {
      return Response.json({ error: 'Los datos ingresados no son correctos' }, { status: 400 });
    }

    const username = normalizeUsername(rawUsername).replace(/\./g, '.');
    // Buscar acceso por username (normalizado)
    const access = await base44.asServiceRole.entities.PlayerUserAccess.filter(
      { username: rawUsername },
      "-created_date",
      5
    ).catch(() => []);

    const record = access[0];
    if (!record) {
      // Mensaje genérico: no revelar si el usuario existe
      return Response.json({ error: 'Los datos ingresados no son correctos' }, { status: 400 });
    }

    // Verificar bloqueo temporal
    if (record.locked_until) {
      const lockedUntil = new Date(record.locked_until);
      if (lockedUntil > new Date()) {
        return Response.json({
          error: 'Demasiados intentos fallidos. Intentá nuevamente en 15 minutos.',
          locked: true,
        }, { status: 429 });
      }
    }

    // Verificar que no esté ya activo
    if (record.status === 'access_active' && record.active) {
      return Response.json({
        error: 'Tu cuenta ya está activada. Ingresá desde la portada con tu email y contraseña.',
        already_active: true,
      }, { status: 409 });
    }

    // Verificar que tenga DNI cargado
    if (record.status === 'missing_document') {
      return Response.json({ error: 'Los datos ingresados no son correctos' }, { status: 400 });
    }

    // Obtener el jugador para comparar DNI
    const player = await base44.asServiceRole.entities.Player.get(record.player_id).catch(() => null);
    if (!player) {
      return Response.json({ error: 'Los datos ingresados no son correctos' }, { status: 400 });
    }

    const playerDni = normalizeDni(player.dni);
    if (!playerDni || playerDni !== rawDni) {
      // Incrementar intentos fallidos
      const attempts = (record.failed_attempts || 0) + 1;
      const updates: any = { failed_attempts: attempts, updated_at: new Date().toISOString() };
      if (attempts >= MAX_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
        updates.locked_until = lockUntil;
        updates.status = 'access_blocked';
      }
      await base44.asServiceRole.entities.PlayerUserAccess.update(record.id, updates);
      return Response.json({ error: 'Los datos ingresados no son correctos' }, { status: 400 });
    }

    // DNI correcto: generar token de activación
    const token = generateActivationToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

    await base44.asServiceRole.entities.PlayerUserAccess.update(record.id, {
      activation_token_hash: tokenHash,
      activation_token_expires_at: expiresAt,
      failed_attempts: 0,
      locked_until: null,
      status: 'activation_pending',
      updated_at: new Date().toISOString(),
    });

    return Response.json({ ok: true, activation_token: token });
  } catch (error) {
    console.error('verifyPlayerActivation error:', error);
    return Response.json({ error: 'No pudimos verificar tu acceso. Intentá nuevamente.' }, { status: 500 });
  }
}