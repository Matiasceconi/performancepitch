import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlayerAccess } from "../../shared/playerPortalAuth.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const access = await resolvePlayerAccess(base44, user);
    if (!access) return Response.json({ error: 'Acceso de jugador no vinculado' }, { status: 403 });

    const playerId = access.player_id;

    // Reportes publicados del jugador (RLS admin-only, usamos service role)
    // Filtrar deleted_at == null (soft delete)
    const allReports = await base44.asServiceRole.entities.PlayerMatchReport.filter(
      { player_id: playerId, status: 'published' },
      '-published_at',
      100
    );
    const reports = allReports.filter(r => !r.deleted_at);

    // Datos del jugador
    const player = await base44.asServiceRole.entities.Player.get(playerId).catch(() => null);

    // Para cada reporte, cargar datos GPS necesarios para renderizar la vista previa
    const enriched = [];
    for (const report of reports) {
      const matchIds = report.match_ids || [];
      const matches = [];
      for (const matchId of (report.report_snapshot?.selected?.length ? [] : matchIds)) {
        const match = await base44.asServiceRole.entities.MatchReport.get(matchId).catch(() => null);
        if (!match) continue;
        const gpsRows = await base44.asServiceRole.entities.CatapultReport.filter(
          { session_id: matchId, player_id: playerId },
          '-date',
          10
        ).catch(() => []);
        const minutesRows = await base44.asServiceRole.entities.MatchPlayerMinutes.filter(
          { match_id: matchId, player_id: playerId },
          '-match_date',
          1
        ).catch(() => []);
        matches.push({
          match,
          gpsRow: gpsRows[0] || null,
          minutesPlayed: minutesRows[0]?.minutes_played ?? null,
          hasGps: gpsRows.length > 0,
        });
      }
      enriched.push({
        id: report.id,
        title: report.title,
        report_type: report.report_type,
        status: report.status,
        staff_comment: report.staff_comment || '',
        match_labels: report.match_labels || [],
        match_dates: report.match_dates || [],
        published_at: report.published_at,
        published_by: report.published_by || '',
        report_snapshot: report.report_snapshot || null,
        report_version: report.report_version || 1,
        match_ids: report.match_ids || [],
        matches,
      });
    }

    return Response.json({
      player: player ? {
        id: player.id,
        full_name: player.full_name,
        photo_url: player.photo_url,
        position: player.position,
        squad_name: player.squad_name,
        division: player.division,
        jersey_number: player.jersey_number,
      } : null,
      reports: enriched,
    });
  } catch (error) {
    console.error('getPlayerMatchReports error:', error);
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}