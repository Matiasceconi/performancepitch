import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hashToken, getTodayInTimezone } from "../../shared/playerAccessUtils.ts";
import { computeWellnessV2, computeIsDropV2 } from "../../shared/playerPortalAuth.ts";
import { resolvePlayerContextForDate } from "../../shared/squadRosterResolver.ts";

const SCALE_VERSION = "negative_1_10_v2";

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

    // Validar valores escala v2 (1-10, mayor es peor)
    const fatigue = clamp110(body.fatigue);
    const muscularSoreness = clamp110(body.muscular_soreness);
    const sleepLack = clamp110(body.sleep_lack);
    const stress = clamp110(body.stress);
    const moodLow = clamp110(body.mood_low);
    const sleepHours = Math.round(Number(body.sleep_hours) * 2) / 2; // admite .5
    const hasPain = !!body.has_pain;
    const painIntensity = hasPain ? clampPain(body.pain_intensity) : 0;
    const painZone = hasPain ? String(body.pain_zone || '').slice(0, 100) : '';
    const comment = String(body.comment || '').slice(0, 1000);

    if (sleepHours <= 0) {
      return Response.json({ error: 'Indicá cuántas horas dormiste.' }, { status: 400 });
    }
    if (fatigue <= 0 || muscularSoreness <= 0 || sleepLack <= 0 || stress <= 0 || moodLow <= 0) {
      return Response.json({ error: 'Respondé todas las preguntas del wellness.' }, { status: 400 });
    }
    if (hasPain && (!painZone || painIntensity <= 0)) {
      return Response.json({ error: 'Indicá la zona y la intensidad del dolor.' }, { status: 400 });
    }

    const { wellness_score, alert_level, alert_reasons } = computeWellnessV2({
      fatigue, muscular_soreness: muscularSoreness, sleep_lack: sleepLack, stress, mood_low: moodLow,
      has_pain: hasPain, pain_intensity: painIntensity, sleep_hours: sleepHours,
    });

    // Buscar respuesta existente (idempotente)
    const existing = await base44.asServiceRole.entities.WellnessResponse.filter(
      { player_id: playerId, response_date: today },
      "-updated_at",
      1
    );

    // Historial v2 para detección de caída (no mezclar con escala legado)
    const history = await base44.asServiceRole.entities.WellnessResponse.filter(
      { player_id: playerId },
      "-response_date",
      30
    );
    const historyForDrop = history.filter((r) => r.response_date !== today);
    const isDrop = computeIsDropV2(historyForDrop, wellness_score);

    const player = await base44.asServiceRole.entities.Player.get(playerId).catch(() => null);
    const playerName = player?.full_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim();

    const payload = {
      player_id: playerId,
      player_name: playerName,
      squad_id: squadId,
      season_id: seasonId,
      organization_id: organizationId,
      response_date: today,
      wellness_scale_version: SCALE_VERSION,
      fatigue,
      muscular_soreness: muscularSoreness,
      sleep_lack: sleepLack,
      stress,
      mood_low: moodLow,
      sleep_hours: sleepHours,
      has_pain: hasPain,
      pain_zone: painZone,
      pain_intensity: painIntensity,
      comment,
      wellness_score,
      alert_level,
      alert_reasons,
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

function clamp110(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(10, Math.round(n)));
}
function clampPain(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(10, Math.round(n)));
}