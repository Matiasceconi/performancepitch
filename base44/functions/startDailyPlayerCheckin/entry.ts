import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { normalizeDni, hashToken, generateActivationToken, getNormalizedPlayerDni, getTodayInTimezone } from "../../shared/playerAccessUtils.ts";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const TOKEN_TTL_MINUTES = 15;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const dni = normalizeDni(body.dni);

    if (!dni) {
      return Response.json({ error: 'Ingresá tu DNI para continuar' }, { status: 400 });
    }

    const dniHash = await hashToken(dni);
    const now = new Date();
    const nowISO = now.toISOString();

    // 1. Control de intentos fallidos por DNI
    const attemptRows = await base44.asServiceRole.entities.DailyCheckinToken.filter(
      { record_type: 'attempt', dni_hash: dniHash },
      "-created_at",
      1
    );
    const attempt = attemptRows[0];
    if (attempt?.locked_until) {
      const lockedUntil = new Date(attempt.locked_until);
      if (lockedUntil > now) {
        return Response.json({
          error: 'Demasiados intentos fallidos. Intentá nuevamente en 15 minutos.',
        }, { status: 429 });
      }
    }

    // 2. Buscar jugador por dni, luego por document_number
    const byDni = await base44.asServiceRole.entities.Player.filter(
      { dni: dni, active: { $ne: false } },
      "last_name",
      10
    );
    const byDocNum = await base44.asServiceRole.entities.Player.filter(
      { document_number: dni, active: { $ne: false } },
      "last_name",
      10
    );

    // Combinar y deduplicar por id
    const allMatches = [...byDni, ...byDocNum];
    const seenIds = new Set<string>();
    const unique = allMatches.filter(p => {
      if (seenIds.has(p.id)) return false;
      seenIds.add(p.id);
      return true;
    });

    // 3. Validar resultado
    if (unique.length === 0 || unique.length > 1) {
      // DNI no encontrado o duplicado → incrementar intentos
      const failedAttempts = (attempt?.failed_attempts || 0) + 1;
      const updates: any = { failed_attempts: failedAttempts };
      if (failedAttempts >= MAX_ATTEMPTS) {
        updates.locked_until = new Date(now.getTime() + LOCK_MINUTES * 60 * 1000).toISOString();
      }
      if (attempt) {
        await base44.asServiceRole.entities.DailyCheckinToken.update(attempt.id, updates);
      } else {
        await base44.asServiceRole.entities.DailyCheckinToken.create({
          record_type: 'attempt',
          dni_hash: dniHash,
          failed_attempts: failedAttempts,
          locked_until: updates.locked_until || null,
          active: false,
          created_at: nowISO,
        });
      }
      return Response.json({
        error: 'No pudimos identificarte. Revisá el DNI o comunicate con el cuerpo técnico.',
      }, { status: 404 });
    }

    const player = unique[0];
    const today = getTodayInTimezone();
    const token = generateActivationToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(now.getTime() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

    // 4. Crear registro de token
    await base44.asServiceRole.entities.DailyCheckinToken.create({
      record_type: 'token',
      token_hash: tokenHash,
      dni_hash: dniHash,
      player_id: player.id,
      player_first_name: player.first_name || '',
      squad_id: player.squad_id || '',
      club_id: player.club_id || '',
      season_id: '',
      checkin_date: today,
      expires_at: expiresAt,
      scope: 'daily_checkin',
      active: true,
      created_at: nowISO,
    });

    // 5. Resetear intentos fallidos
    if (attempt) {
      await base44.asServiceRole.entities.DailyCheckinToken.update(attempt.id, {
        failed_attempts: 0,
        locked_until: null,
      });
    }

    return Response.json({
      ok: true,
      token,
      player_first_name: player.first_name || '',
    });
  } catch (error) {
    console.error('startDailyPlayerCheckin error:', error);
    return Response.json({
      error: 'No pudimos identificarte. Revisá el DNI o comunicate con el cuerpo técnico.',
    }, { status: 500 });
  }
}