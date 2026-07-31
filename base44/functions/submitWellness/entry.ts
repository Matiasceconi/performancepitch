import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlayerAccess, todayISO, computeWellness, computeIsDrop } from "../../shared/playerPortalAuth.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const access = await resolvePlayerAccess(base44, user);
    if (!access) return Response.json({ error: 'Acceso de jugador no vinculado' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const playerId = access.player_id;
    const squadId = access.squad_id;
    const seasonId = access.season_id || '';
    const organizationId = access.organization_id || '';

    // response_date del cliente ignorada si no se envía; se usa hoy por defecto
    const responseDate = body.response_date || todayISO();

    // Validar rangos
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

    const { wellness_score, alert_level } = computeWellness({
      sleep_hours: sleepHours,
      sleep_quality: sleepQuality,
      energy_level: energyLevel,
      muscular_readiness: muscularReadiness,
      mood,
      calmness,
      has_pain: hasPain,
      pain_intensity: painIntensity,
    });

    // Buscar respuesta existente (idempotente: una por jugador + fecha)
    const existing = await base44.asServiceRole.entities.WellnessResponse.filter(
      { player_id: playerId, response_date: responseDate },
      "-updated_at",
      1
    );

    // Historial para detección de caída (excluyendo la de hoy)
    const history = await base44.asServiceRole.entities.WellnessResponse.filter(
      { player_id: playerId },
      "-response_date",
      30
    );
    const historyForDrop = history.filter((r) => r.response_date !== responseDate);
    const isDrop = computeIsDrop(historyForDrop, wellness_score);

    const player = await base44.asServiceRole.entities.Player.get(playerId).catch(() => null);
    const playerName = player?.full_name || access.player_name || '';

    const payload = {
      player_id: playerId,
      player_name: playerName,
      squad_id: squadId,
      season_id: seasonId,
      organization_id: organizationId,
      response_date: responseDate,
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
        updated_at: new Date().toISOString(),
      });
    } else {
      saved = await base44.asServiceRole.entities.WellnessResponse.create({
        ...payload,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return Response.json({ ok: true, wellness: saved });
  } catch (error) {
    console.error('submitWellness error:', error);
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
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