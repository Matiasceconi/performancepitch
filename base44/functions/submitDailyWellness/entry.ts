import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hashToken, getTodayInTimezone } from "../../shared/playerAccessUtils.ts";
import { computeWellness as cw, computeIsDrop as cid } from "../../shared/playerPortalAuth.ts";
import { resolvePlayerContextForDate } from "../../shared/squadRosterResolver.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || '');
    if (!token) return Response.json({ error: 'Token requerido' }, { status: 400 });

    const tokenHash = await hashToken(token);
    const tokenRows = await base44.asServiceRole.entities.DailyCheckinToken.filter(
      { record_type: 'token', token_hash: tokenHash, active: true },
      "-created_at",
      1
    );
    const tokenRecord = tokenRows[0];
    if (!tokenRecord) {
      return Response.json({ error: 'Sesión expirada. Ingresá tu DNI nuevamente.' }, { status: 401 });
    }

    const now = new Date();
    if (new Date(tokenRecord.expires_at) < now) {
      await base44.asServiceRole.entities.DailyCheckinToken.update(tokenRecord.id, { active: false });
      return Response.json({ error: 'Sesión expirada. Ingresá tu DNI nuevamente.' }, { status: 401 });
    }

    const today = getTodayInTimezone();
    if (tokenRecord.checkin_date !== today) {
      return Response.json({ error: 'La sesión corresponde a otro día.' }, { status: 401 });
    }

    const playerId = tokenRecord.player_id;

    // Resolver el plantel operativo real del jugador para la fecha
    const context = await resolvePlayerContextForDate(base44, playerId, today);
    const squadId = context?.squad_id || tokenRecord.squad_id || '';
    const seasonId = context?.season_id || tokenRecord.season_id || '';
    const organizationId = context?.organization_id || '';

    // Validar valores
    const sleepHours = Number(body.sleep_hours) || 0;
    const sleepQuality = clamp15(body.sleep_quality);
    const energyLevel = clamp15(body.energy_level);
    const muscularReadiness = clamp15(body.muscular_readiness);
    const mood = clamp15(body.mood);
    const calmness = clamp15(body.calmness);
    const hasPain = !!body.has_pain;
    const painIntensity = hasPain ? clamp010(body.pain_intensity) : 0;
    const painZone = hasPain ? String(body.pain_zone || '').slice(0, 100) : '';
    const comment = String(body.comment || '').slice(0, 1000);

    const { wellness_score, alert_level } = cw({
      sleep_hours: sleepHours,
      sleep_quality: sleepQuality,
      energy_level: energyLevel,
      muscular_readiness: muscularReadiness,
      mood,
      calmness,
      has_pain: hasPain,
      pain_intensity: painIntensity,
    });

    // Buscar respuesta existente (idempotente)
    const existing = await base44.asServiceRole.entities.WellnessResponse.filter(
      { player_id: playerId, response_date: today },
      "-updated_at",
      1
    );

    // Historial para detección de caída
    const history = await base44.asServiceRole.entities.WellnessResponse.filter(
      { player_id: playerId },
      "-response_date",
      30
    );
    const historyForDrop = history.filter((r) => r.response_date !== today);
    const isDrop = cid(historyForDrop, wellness_score);

    const player = await base44.asServiceRole.entities.Player.get(playerId).catch(() => null);
    const playerName = player?.full_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim();

    const payload = {
      player_id: playerId,
      player_name: playerName,
      squad_id: squadId,
      season_id: seasonId,
      organization_id: organizationId,
      response_date: today,
      sleep_hours: sleepHours,
      sleep_quality: sleepQuality,
      energy_level: energyLevel,
      muscular_readiness: muscularReadiness,
      mood,
      calmness,
      has_pain: hasPain,
      pain_zone: painZone,
      pain_intensity: painIntensity,
      comment,
      wellness_score,
      alert_level,
      is_drop: isDrop,
      source: 'player',
    };

    let saved;
    if (existing[0]) {
      saved = await base44.asServiceRole.entities.WellnessResponse.update(existing[0].id, {
        ...payload,
        updated_at: now.toISOString(),
      });
    } else {
      saved = await base44.asServiceRole.entities.WellnessResponse.create({
        ...payload,
        submitted_at: now.toISOString(),
        updated_at: now.toISOString(),
      });
    }

    return Response.json({ ok: true, wellness: saved });
  } catch (error) {
    console.error('submitDailyWellness error:', error);
    return Response.json({ error: error.message || 'Error al guardar el wellness' }, { status: 500 });
  }
}

function clamp15(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(5, Math.round(n)));
}
function clamp010(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, Math.round(n)));
}