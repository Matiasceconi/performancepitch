import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveStaffAccess } from "../../shared/playerPortalAuth.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const staff = await resolveStaffAccess(base44, user);
    if (!staff) return Response.json({ error: 'Sin permisos de staff' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const playerId = String(body.player_id || '');
    const email = String(body.email || '').toLowerCase().trim();

    if (!playerId) return Response.json({ error: 'Jugador requerido' }, { status: 400 });

    const player = await base44.asServiceRole.entities.Player.get(playerId).catch(() => null);
    if (!player) return Response.json({ error: 'Jugador no encontrado' }, { status: 404 });

    if (action === 'create' || action === 'invite') {
      if (!email) return Response.json({ error: 'Email requerido' }, { status: 400 });
      // Verificar que no existan dos accesos activos para el mismo jugador
      const existing = await base44.asServiceRole.entities.PlayerUserAccess.filter(
        { player_id: playerId, active: true },
        "-invited_at",
        10
      );
      if (existing.length > 0) {
        return Response.json({ error: 'Ya existe un acceso activo para este jugador' }, { status: 409 });
      }
      // Verificar email único
      const byEmail = await base44.asServiceRole.entities.PlayerUserAccess.filter(
        { user_email: email, active: true },
        "-invited_at",
        5
      );
      if (byEmail.length > 0) {
        return Response.json({ error: 'Ya existe un acceso activo con ese email' }, { status: 409 });
      }
      const nowISO = new Date().toISOString();
      const access = await base44.asServiceRole.entities.PlayerUserAccess.create({
        user_email: email,
        player_id: playerId,
        player_name: player.full_name || `${player.first_name} ${player.last_name}`,
        squad_id: player.squad_id || '',
        squad_name: player.squad_name || '',
        season_id: '',
        active: true,
        invited_at: nowISO,
        invitation_status: 'sent',
        created_at: nowISO,
        updated_at: nowISO,
      });
      // Invitar al usuario a la app con rol user
      try {
        await base44.asServiceRole.users.inviteUser(email, 'user');
      } catch (e) {
        // Si ya existe el usuario, continuamos igualmente
        console.warn('inviteUser (no bloqueante):', e?.message);
      }
      return Response.json({ ok: true, access });
    }

    if (action === 'resend') {
      const existing = await base44.asServiceRole.entities.PlayerUserAccess.filter(
        { player_id: playerId, active: true },
        "-invited_at",
        1
      );
      if (!existing[0]) return Response.json({ error: 'No hay acceso activo para reenviar' }, { status: 404 });
      const nowISO = new Date().toISOString();
      const updated = await base44.asServiceRole.entities.PlayerUserAccess.update(existing[0].id, {
        invited_at: nowISO,
        invitation_status: 'sent',
        updated_at: nowISO,
      });
      try {
        await base44.asServiceRole.users.inviteUser(existing[0].user_email, 'user');
      } catch (e) {
        console.warn('inviteUser (no bloqueante):', e?.message);
      }
      return Response.json({ ok: true, access: updated });
    }

    if (action === 'toggle') {
      const existing = await base44.asServiceRole.entities.PlayerUserAccess.filter(
        { player_id: playerId },
        "-invited_at",
        1
      );
      if (!existing[0]) return Response.json({ error: 'No hay acceso para este jugador' }, { status: 404 });
      const newActive = !existing[0].active;
      const updated = await base44.asServiceRole.entities.PlayerUserAccess.update(existing[0].id, {
        active: newActive,
        invitation_status: newActive ? 'active' : 'disabled',
        updated_at: new Date().toISOString(),
      });
      return Response.json({ ok: true, access: updated });
    }

    if (action === 'list') {
      const squadId = String(body.squad_id || '');
      let query = {};
      if (squadId) query = { squad_id: squadId };
      const accesses = await base44.asServiceRole.entities.PlayerUserAccess.filter(query, "-invited_at", 500);
      return Response.json({ ok: true, accesses });
    }

    return Response.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    console.error('managePlayerAccess error:', error);
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}