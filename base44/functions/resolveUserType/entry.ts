import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ authenticated: false }, { status: 200 });

    const [playerAccessRows, userAccessRows] = await Promise.all([
      base44.asServiceRole.entities.PlayerUserAccess.filter(
        { user_email: user.email, active: true },
        "-invited_at",
        5
      ).catch(() => []),
      base44.asServiceRole.entities.UserAccess.filter(
        { user_email: user.email },
        "-created_date",
        1
      ).catch(() => []),
    ]);

    const playerAccess = playerAccessRows[0] || null;
    const isPlatformAdmin = user.role === 'admin';
    const hasStaffAccess = isPlatformAdmin || userAccessRows.length > 0;

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
    });
  } catch (error) {
    console.error('resolveUserType error:', error);
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}