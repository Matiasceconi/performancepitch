import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hashToken } from "../../shared/playerAccessUtils.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const token = String(body.activation_token || '');
    if (!token) return Response.json({ error: 'Token de activación requerido' }, { status: 400 });

    const tokenHash = await hashToken(token);
    const now = new Date();

    // Buscar el acceso por token hash
    const access = await base44.asServiceRole.entities.PlayerUserAccess.filter(
      { activation_token_hash: tokenHash },
      "-created_date",
      5
    ).catch(() => []);

    const record = access[0];
    if (!record) {
      return Response.json({ error: 'Token de activación inválido o expirado' }, { status: 400 });
    }

    // Verificar vencimiento
    if (record.activation_token_expires_at) {
      const expires = new Date(record.activation_token_expires_at);
      if (expires < now) {
        return Response.json({ error: 'El token de activación expiró. Verificá tu identidad nuevamente.' }, { status: 410 });
      }
    }

    // Verificar que no esté ya activo
    if (record.status === 'access_active' && record.active) {
      return Response.json({ error: 'Esta cuenta ya está activada' }, { status: 409 });
    }

    const normalizedEmail = String(user.email || '').toLowerCase().trim();

    // Verificar que no haya otro acceso con el mismo email
    const byEmail = await base44.asServiceRole.entities.PlayerUserAccess.filter(
      { user_email: normalizedEmail, active: true },
      "-created_date",
      5
    ).catch(() => []);

    const conflict = byEmail.find(a => a.player_id !== record.player_id);
    if (conflict) {
      return Response.json({ error: 'Ya existe una cuenta activa con este email vinculada a otro jugador' }, { status: 409 });
    }

    const nowISO = now.toISOString();

    // Vincular el usuario autenticado con el acceso
    await base44.asServiceRole.entities.PlayerUserAccess.update(record.id, {
      user_id: user.id,
      user_email: normalizedEmail,
      auth_user_id: user.id,
      status: 'access_active',
      active: true,
      invitation_status: 'active',
      activated_at: nowISO,
      last_login_at: nowISO,
      activation_token_hash: null,
      activation_token_expires_at: null,
      failed_attempts: 0,
      locked_until: null,
      updated_at: nowISO,
    });

    return Response.json({ ok: true, player_id: record.player_id });
  } catch (error) {
    console.error('completePlayerActivation error:', error);
    return Response.json({ error: error.message || 'Error al completar la activación' }, { status: 500 });
  }
}