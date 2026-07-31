import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlayerAccessAdmin } from "../../shared/playerPortalAuth.ts";
import { generateUsernameBase, generateUniqueUsername, normalizeDni, getNormalizedPlayerDni } from "../../shared/playerAccessUtils.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const admin = await resolvePlayerAccessAdmin(base44, user);
    if (!admin) return Response.json({ error: 'No tenés permisos de administrador' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    // Listar jugadores + accesos del plantel (o todos los planteles)
    if (action === 'list') {
      const squadId = String(body.squad_id || '');
      const playerQuery: any = {};
      if (squadId && squadId !== 'all') playerQuery.squad_id = squadId;
      const players = await base44.asServiceRole.entities.Player.filter(playerQuery, "last_name", 2000);
      const accessQuery: any = {};
      if (squadId && squadId !== 'all') accessQuery.squad_id = squadId;
      const accesses = await base44.asServiceRole.entities.PlayerUserAccess.filter(accessQuery, "-created_date", 5000);
      const accessByPlayer: Record<string, any> = {};
      accesses.forEach(a => { accessByPlayer[a.player_id] = a; });
      const rows = players.map(p => {
        const acc = accessByPlayer[p.id];
        const hasDni = !!getNormalizedPlayerDni(p);
        return {
          player: p,
          access: acc,
          has_dni: hasDni,
          username: acc?.username || '',
          status: acc?.status || (hasDni ? 'ready_to_activate' : 'missing_document'),
          email: acc?.user_email || '',
          last_login: acc?.last_login_at || acc?.last_access_at || '',
        };
      });
      return Response.json({ ok: true, rows });
    }

    const playerId = String(body.player_id || '');
    if (!playerId) return Response.json({ error: 'Jugador requerido' }, { status: 400 });

    const player = await base44.asServiceRole.entities.Player.get(playerId).catch(() => null);
    if (!player) return Response.json({ error: 'Jugador no encontrado' }, { status: 404 });

    // Buscar acceso existente
    const existing = await base44.asServiceRole.entities.PlayerUserAccess.filter(
      { player_id: playerId },
      "-created_date",
      5
    );
    const access = existing[0];

    // Regenerar nombre de usuario
    if (action === 'regenerate_username') {
      if (!access) return Response.json({ error: 'No hay acceso para este jugador' }, { status: 404 });
      // Obtener todos los usernames existentes excepto el actual
      const allAccess = await base44.asServiceRole.entities.PlayerUserAccess.filter({}, "-created_date", 5000);
      const existingUsernames = new Set(allAccess.filter(a => a.id !== access.id && a.username).map(a => a.username));
      const base = generateUsernameBase(player.first_name, player.last_name) || `jugador.${player.id.slice(-6)}`;
      const username = generateUniqueUsername(base, existingUsernames);
      const updated = await base44.asServiceRole.entities.PlayerUserAccess.update(access.id, {
        username,
        status: getNormalizedPlayerDni(player) ? 'ready_to_activate' : 'missing_document',
        updated_at: new Date().toISOString(),
      });
      return Response.json({ ok: true, access: updated });
    }

    // Desbloquear intentos
    if (action === 'unlock') {
      if (!access) return Response.json({ error: 'No hay acceso para este jugador' }, { status: 404 });
      const updated = await base44.asServiceRole.entities.PlayerUserAccess.update(access.id, {
        failed_attempts: 0,
        locked_until: null,
        status: access.status === 'access_blocked' ? 'ready_to_activate' : access.status,
        updated_at: new Date().toISOString(),
      });
      return Response.json({ ok: true, access: updated });
    }

    // Actualizar DNI del jugador
    if (action === 'update_dni') {
      const dni = normalizeDni(body.dni);
      await base44.asServiceRole.entities.Player.update(playerId, { dni });
      if (access) {
        const updated = await base44.asServiceRole.entities.PlayerUserAccess.update(access.id, {
          status: dni ? (access.status === 'access_active' ? 'access_active' : 'ready_to_activate') : 'missing_document',
          updated_at: new Date().toISOString(),
        });
        return Response.json({ ok: true, access: updated });
      }
      return Response.json({ ok: true });
    }

    // Cambiar email vinculado
    if (action === 'update_email') {
      if (!access) return Response.json({ error: 'No hay acceso para este jugador' }, { status: 404 });
      const email = String(body.email || '').toLowerCase().trim();
      const updated = await base44.asServiceRole.entities.PlayerUserAccess.update(access.id, {
        user_email: email,
        updated_at: new Date().toISOString(),
      });
      return Response.json({ ok: true, access: updated });
    }

    // Reiniciar activación
    if (action === 'reset_activation') {
      if (!access) return Response.json({ error: 'No hay acceso para este jugador' }, { status: 404 });
      const updated = await base44.asServiceRole.entities.PlayerUserAccess.update(access.id, {
        status: getNormalizedPlayerDni(player) ? 'ready_to_activate' : 'missing_document',
        active: false,
        user_email: '',
        user_id: '',
        auth_user_id: '',
        activated_at: '',
        activation_token_hash: '',
        activation_token_expires_at: '',
        failed_attempts: 0,
        locked_until: '',
        invitation_status: 'pending',
        updated_at: new Date().toISOString(),
      });
      return Response.json({ ok: true, access: updated });
    }

    // Activar/desactivar (toggle)
    if (action === 'toggle') {
      if (!access) return Response.json({ error: 'No hay acceso para este jugador' }, { status: 404 });
      const newActive = !access.active;
      const updated = await base44.asServiceRole.entities.PlayerUserAccess.update(access.id, {
        active: newActive,
        status: newActive ? 'access_active' : 'access_disabled',
        invitation_status: newActive ? 'active' : 'disabled',
        updated_at: new Date().toISOString(),
      });
      return Response.json({ ok: true, access: updated });
    }

    // Crear/invitar (legado - mantener compatibilidad)
    if (action === 'create' || action === 'invite') {
      const email = String(body.email || '').toLowerCase().trim();
      if (access) return Response.json({ error: 'Ya existe un acceso para este jugador' }, { status: 409 });
      const nowISO = new Date().toISOString();
      const allAccess = await base44.asServiceRole.entities.PlayerUserAccess.filter({}, "-created_date", 5000);
      const existingUsernames = new Set(allAccess.filter(a => a.username).map(a => a.username));
      const base = generateUsernameBase(player.first_name, player.last_name) || `jugador.${player.id.slice(-6)}`;
      const username = generateUniqueUsername(base, existingUsernames);
      const hasDni = !!getNormalizedPlayerDni(player);
      const accessRecord = await base44.asServiceRole.entities.PlayerUserAccess.create({
        user_email: email,
        player_id: playerId,
        player_name: player.full_name || `${player.first_name} ${player.last_name}`,
        squad_id: player.squad_id || '',
        squad_name: player.squad_name || '',
        username,
        status: hasDni ? 'ready_to_activate' : 'missing_document',
        active: false,
        invitation_status: 'pending',
        failed_attempts: 0,
        created_at: nowISO,
        updated_at: nowISO,
        created_by: user.id,
      });
      if (email) {
        try {
          await base44.asServiceRole.users.inviteUser(email, 'user');
        } catch (e) {
          const msg = String(e?.message || '');
          if (!/already|exist|invited|registered|409|conflict/i.test(msg)) {
            console.warn('inviteUser:', msg);
          }
        }
      }
      return Response.json({ ok: true, access: accessRecord });
    }

    return Response.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    console.error('managePlayerAccess error:', error);
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}