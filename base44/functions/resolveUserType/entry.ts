import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ authenticated: false }, { status: 200 });

    const normalizedEmail = (user.email || '').toLowerCase().trim();

    const [playerAccessRows, userAccessRows] = await Promise.all([
      base44.asServiceRole.entities.PlayerUserAccess.filter(
        { user_email: normalizedEmail, active: true },
        "-invited_at",
        5
      ).catch(() => []),
      base44.asServiceRole.entities.UserAccess.filter(
        { user_email: normalizedEmail, active: true },
        "-created_date",
        1
      ).catch(() => []),
    ]);

    const playerAccess = playerAccessRows[0] || null;
    const staffAccess = userAccessRows[0] || null;
    const isPlatformAdmin = user.role === 'admin';
    const hasStaffAccess = isPlatformAdmin || !!staffAccess;

    return Response.json({
      authenticated: true,
      is_staff: hasStaffAccess,
      is_player: !!playerAccess,
      player_access: playerAccess ? {
        player_id: playerAccess.player_id,
        player_name: playerAccess.player_name,
        squad_id: playerAccess.squad_id,
        squad_name: playerAccess.squad_name,
        season_id: playerAccess.season_id,
      } : null,
      // UserAccess resuelto una sola vez; WorkspaceProvider lo reutiliza.
      staff_access: staffAccess ? {
        id: staffAccess.id,
        user_email: staffAccess.user_email,
        role: staffAccess.role,
        role_ids: staffAccess.role_ids || [],
        all_squads: !!staffAccess.all_squads,
        squad_ids: staffAccess.squad_ids || [],
        squad_names: staffAccess.squad_names || [],
        active: staffAccess.active !== false,
        allowed_pages: staffAccess.allowed_pages || [],
        allowed_modules: staffAccess.allowed_modules || [],
        can_admin: !!staffAccess.can_admin,
      } : null,
      is_platform_admin: isPlatformAdmin,
    });
  } catch (error) {
    console.error('resolveUserType error:', error);
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}