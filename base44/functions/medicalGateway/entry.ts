import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireMedicalAccess, medicalErrorResponse } from "../../shared/medicalAccess.ts";
import {
  todayISO, nowISO, chooseCurrentEpisode, buildCurrentStatusPayload,
  redactEpisodeForOperationalView, redactFollowUpForOperationalView,
  buildMedicalEpisodeKey, normalizeLegacyLaterality,
} from "../../shared/medicalDomain.ts";

const MAX_LIST = 2000;

function cleanText(value: any, max = 4000) {
  return String(value || "").trim().slice(0, max);
}
function asDate(value: any) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}
function asOptionalNumber(value: any) {
  if (value === "" || value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

async function getRoster(base44: any, squadId: string) {
  const memberships = await base44.asServiceRole.entities.SquadMembership.filter({ squad_id: squadId, status: "activo" }, "player_name", 500);
  const playerIds = [...new Set(memberships.map((m: any) => m.player_id).filter(Boolean))];
  const players: any[] = [];
  for (let i = 0; i < playerIds.length; i += 50) {
    const batch = playerIds.slice(i, i + 50);
    const rows = await base44.asServiceRole.entities.Player.filter({ id: { $in: batch } }, "full_name", 100);
    players.push(...rows);
  }
  return { memberships, players, playerIds };
}

async function listByPlayerIds(entity: any, playerIds: string[], sort: string, limit = MAX_LIST) {
  if (!playerIds.length) return [];
  const all: any[] = [];
  for (let i = 0; i < playerIds.length; i += 50) {
    const rows = await entity.filter({ player_id: { $in: playerIds.slice(i, i + 50) } }, sort, limit);
    all.push(...rows);
  }
  return all;
}

async function audit(base44: any, action: string, actor: any, data: any = {}) {
  await base44.asServiceRole.entities.MedicalAuditEvent.create({
    action,
    at: nowISO(),
    actor_id: actor?.id || "",
    actor_name: actor?.full_name || actor?.email || "Usuario",
    actor_email: actor?.email || "",
    player_id: data.player_id || "",
    medical_episode_id: data.medical_episode_id || "",
    medical_follow_up_id: data.medical_follow_up_id || "",
    organization_id: data.organization_id || "",
    squad_id: data.squad_id || "",
    changes: data.changes || {},
    note: data.note || "",
  });
}

async function recalcPlayer(base44: any, playerId: string, squadId: string, actor: any) {
  const episodes = await base44.asServiceRole.entities.MedicalEpisode.filter({ player_id: playerId }, "-event_date", 500);
  const current = chooseCurrentEpisode(episodes);
  const payload: any = { player_id: playerId, squad_id: squadId, ...buildCurrentStatusPayload(current, actor) };
  const existing = await base44.asServiceRole.entities.MedicalCurrentStatus.filter({ player_id: playerId }, "-updated_at", 5);
  let saved;
  if (existing[0]) saved = await base44.asServiceRole.entities.MedicalCurrentStatus.update(existing[0].id, payload);
  else saved = await base44.asServiceRole.entities.MedicalCurrentStatus.create(payload);
  return saved;
}

function episodePayload(body: any, player: any, actor: any, squadId: string) {
  const eventDate = asDate(body.event_date) || asDate(body.fecha_inicio_tto) || todayISO();
  const recordType = cleanText(body.record_type, 80) || "injury";
  const summary = cleanText(body.lesion_consulta || body.confirmed_diagnosis || body.preliminary_diagnosis || body.description, 500);
  if (!summary) throw new Error("Ingresá el motivo de consulta o diagnóstico");
  const availability = cleanText(body.availability, 80) || (recordType === "consultation" || recordType === "control" ? "full_training" : "unavailable");
  const payload: any = {
    player_id: player.id,
    player_name_original: player.full_name || `${player.first_name || ""} ${player.last_name || ""}`.trim(),
    squad_id: squadId,
    season_id: cleanText(body.season_id, 100),
    organization_id: cleanText(body.organization_id, 100),
    record_type: recordType,
    event_date: eventDate,
    event_time: cleanText(body.event_time, 10),
    professional_id: cleanText(body.professional_id || actor?.id, 200),
    professional_name: cleanText(body.professional_name || actor?.full_name || actor?.email, 300),
    context_type: cleanText(body.context_type, 80) || "other",
    training_session_id: cleanText(body.training_session_id, 200),
    match_report_id: cleanText(body.match_report_id, 200),
    lesion_consulta: summary,
    body_region: cleanText(body.body_region, 120),
    body_area: cleanText(body.body_area, 160),
    laterality: cleanText(body.laterality, 80) || "unknown",
    mechanism: cleanText(body.mechanism, 300),
    onset: cleanText(body.onset, 40) || "unknown",
    contact_type: cleanText(body.contact_type, 40) || "unknown",
    preliminary_diagnosis: cleanText(body.preliminary_diagnosis, 1000),
    confirmed_diagnosis: cleanText(body.confirmed_diagnosis, 1000),
    description: cleanText(body.description, 4000),
    treatment: cleanText(body.treatment, 4000),
    studies: cleanText(body.studies, 4000),
    private_note: cleanText(body.private_note, 8000),
    operational_note: cleanText(body.operational_note, 2000),
    fecha_inicio_tto: eventDate,
    expected_return_date: asDate(body.expected_return_date),
    actual_return_date: asDate(body.actual_return_date),
    perdida_dias: asOptionalNumber(body.perdida_dias),
    rehab_phase: cleanText(body.rehab_phase, 80) || undefined,
    availability,
    next_control_date: asDate(body.next_control_date),
    medical_status: availability === "physiotherapy" ? "kinesiologia" : availability === "unavailable" ? "lesionado" : "en_recuperacion",
    episode_state: "active",
    linked: true,
    source: "app",
    edited_by: actor?.full_name || actor?.email || "Usuario",
    edited_by_id: actor?.id || "",
    edited_at: nowISO(),
  };
  payload.medical_episode_key = buildMedicalEpisodeKey(player.id, eventDate, recordType, summary);
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
  return payload;
}

async function ensureWellnessPainSignals(base44: any, squadId: string, playerIds: string[]) {
  if (!playerIds.length) return { created: 0 };
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceDate = since.toISOString().slice(0, 10);
  const wellness = await listByPlayerIds(base44.asServiceRole.entities.WellnessResponse, playerIds, "-response_date", 1000);
  const pain = wellness.filter((w: any) => w.has_pain === true && String(w.response_date || "") >= sinceDate);
  const existing = await listByPlayerIds(base44.asServiceRole.entities.MedicalWellnessSignal, playerIds, "-response_date", 1000);
  const known = new Set(existing.map((s: any) => s.wellness_response_id));
  let created = 0;
  for (const w of pain) {
    if (!w.id || known.has(w.id)) continue;
    await base44.asServiceRole.entities.MedicalWellnessSignal.create({
      wellness_response_id: w.id,
      player_id: w.player_id,
      player_name: w.player_name || "",
      organization_id: w.organization_id || "",
      squad_id: squadId,
      response_date: w.response_date,
      reported_at: w.submitted_at || w.updated_at || w.created_date || nowISO(),
      pain_zone: w.pain_zone || "",
      pain_intensity: Number(w.pain_intensity) || 0,
      comment: w.comment || "",
      status: "pending_review",
    });
    created += 1;
  }
  return { created };
}

export default async function(req: Request) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "No autenticado" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "overview");
    const squadId = String(body.squad_id || "");
    const mutating = ["create_episode", "update_episode", "add_follow_up", "medical_clearance", "reopen_episode", "review_wellness_signal", "convert_wellness_signal"].includes(action);
    const access = await requireMedicalAccess(base44, user, squadId, mutating ? (action === "create_episode" || action === "add_follow_up" || action === "convert_wellness_signal" ? "create" : "edit") : "view");
    const { players, playerIds } = await getRoster(base44, squadId);
    const playerMap = new Map(players.map((p: any) => [p.id, p]));

    if (action === "overview") {
      await ensureWellnessPainSignals(base44, squadId, playerIds);
      const [episodesRaw, statuses, followUpsRaw, signals] = await Promise.all([
        listByPlayerIds(base44.asServiceRole.entities.MedicalEpisode, playerIds, "-event_date", MAX_LIST),
        listByPlayerIds(base44.asServiceRole.entities.MedicalCurrentStatus, playerIds, "-updated_at", MAX_LIST),
        listByPlayerIds(base44.asServiceRole.entities.MedicalFollowUp, playerIds, "-follow_up_date", MAX_LIST),
        listByPlayerIds(base44.asServiceRole.entities.MedicalWellnessSignal, playerIds, "-response_date", MAX_LIST),
      ]);
      const episodes = access.can_view_clinical ? episodesRaw : episodesRaw.map(redactEpisodeForOperationalView);
      const followUps = access.can_view_clinical ? followUpsRaw : followUpsRaw.map(redactFollowUpForOperationalView);
      return Response.json({ ok: true, players, episodes, statuses, follow_ups: followUps, wellness_signals: signals, capabilities: access.capabilities, can_view_clinical: access.can_view_clinical });
    }

    if (action === "player_history") {
      const playerId = String(body.player_id || "");
      if (!playerIds.includes(playerId)) return Response.json({ error: "Jugador fuera del plantel seleccionado" }, { status: 403 });
      const [episodesRaw, followUpsRaw, statuses] = await Promise.all([
        base44.asServiceRole.entities.MedicalEpisode.filter({ player_id: playerId }, "-event_date", 500),
        base44.asServiceRole.entities.MedicalFollowUp.filter({ player_id: playerId }, "-follow_up_date", 1000),
        base44.asServiceRole.entities.MedicalCurrentStatus.filter({ player_id: playerId }, "-updated_at", 5),
      ]);
      return Response.json({
        ok: true,
        player: playerMap.get(playerId) || null,
        current_status: statuses[0] || null,
        episodes: access.can_view_clinical ? episodesRaw : episodesRaw.map(redactEpisodeForOperationalView),
        follow_ups: access.can_view_clinical ? followUpsRaw : followUpsRaw.map(redactFollowUpForOperationalView),
        can_view_clinical: access.can_view_clinical,
      });
    }

    if (action === "create_episode") {
      const playerId = String(body.player_id || "");
      const player = playerMap.get(playerId);
      if (!player) return Response.json({ error: "Seleccioná un jugador válido del plantel" }, { status: 400 });
      const payload = episodePayload(body, player, user, squadId);
      const created = await base44.asServiceRole.entities.MedicalEpisode.create(payload);
      await audit(base44, "episode_created", user, { player_id: playerId, medical_episode_id: created.id, squad_id: squadId, changes: { record_type: created.record_type, availability: created.availability } });
      const status = await recalcPlayer(base44, playerId, squadId, user);
      return Response.json({ ok: true, episode: created, current_status: status });
    }

    if (action === "update_episode") {
      const episodeId = String(body.episode_id || "");
      const existing = await base44.asServiceRole.entities.MedicalEpisode.get(episodeId);
      if (!existing || !playerIds.includes(existing.player_id)) return Response.json({ error: "Registro no encontrado en este plantel" }, { status: 404 });
      const allowed = ["record_type","event_date","event_time","professional_id","professional_name","context_type","training_session_id","match_report_id","lesion_consulta","body_region","body_area","laterality","mechanism","onset","contact_type","preliminary_diagnosis","confirmed_diagnosis","description","treatment","studies","private_note","operational_note","expected_return_date","actual_return_date","perdida_dias","rehab_phase","availability","next_control_date"];
      const changes: any = {};
      for (const key of allowed) if (body[key] !== undefined) changes[key] = body[key];
      if (changes.event_date) changes.fecha_inicio_tto = changes.event_date;
      // Never write fecha_final_tto from expected_return_date; legacy date remains historical only.
      changes.source = "app";
      changes.edited_by = user.full_name || user.email || "Usuario";
      changes.edited_by_id = user.id || "";
      changes.edited_at = nowISO();
      changes.manual_fields = [...new Set([...(existing.manual_fields || []), ...Object.keys(changes).filter((k) => !["source","edited_by","edited_by_id","edited_at"].includes(k))])];
      if (changes.availability) changes.medical_status = changes.availability === "physiotherapy" ? "kinesiologia" : changes.availability === "unavailable" ? "lesionado" : "en_recuperacion";
      const updated = await base44.asServiceRole.entities.MedicalEpisode.update(episodeId, changes);
      await audit(base44, "episode_updated", user, { player_id: existing.player_id, medical_episode_id: episodeId, squad_id: squadId, changes });
      const status = await recalcPlayer(base44, existing.player_id, squadId, user);
      return Response.json({ ok: true, episode: updated, current_status: status });
    }

    if (action === "add_follow_up") {
      const episodeId = String(body.episode_id || "");
      const episode = await base44.asServiceRole.entities.MedicalEpisode.get(episodeId);
      if (!episode || !playerIds.includes(episode.player_id)) return Response.json({ error: "Episodio no encontrado" }, { status: 404 });
      const at = nowISO();
      const follow: any = {
        medical_episode_id: episodeId,
        player_id: episode.player_id,
        organization_id: episode.organization_id || "",
        squad_id: squadId,
        follow_up_date: asDate(body.follow_up_date) || todayISO(),
        follow_up_time: cleanText(body.follow_up_time, 10),
        professional_id: user.id || "",
        professional_name: user.full_name || user.email || "Usuario",
        note: cleanText(body.note, 8000),
        private_note: cleanText(body.private_note, 8000),
        operational_note: cleanText(body.operational_note, 2000),
        medical_status: cleanText(body.medical_status, 80) || episode.medical_status,
        availability: cleanText(body.availability, 80) || episode.availability,
        rehab_phase: cleanText(body.rehab_phase, 80) || episode.rehab_phase,
        decision: cleanText(body.decision, 80) || "continue",
        next_control_date: asDate(body.next_control_date),
        created_by_id: user.id || "",
        created_by_name: user.full_name || user.email || "Usuario",
        created_at: at,
      };
      const created = await base44.asServiceRole.entities.MedicalFollowUp.create(follow);
      const epChanges: any = { edited_at: at, edited_by: user.full_name || user.email || "Usuario", edited_by_id: user.id || "" };
      if (body.availability) epChanges.availability = body.availability;
      if (body.rehab_phase) epChanges.rehab_phase = body.rehab_phase;
      if (body.next_control_date !== undefined) epChanges.next_control_date = asDate(body.next_control_date);
      if (body.operational_note !== undefined) epChanges.operational_note = cleanText(body.operational_note, 2000);
      if (body.medical_status) epChanges.medical_status = body.medical_status;
      await base44.asServiceRole.entities.MedicalEpisode.update(episodeId, epChanges);
      await audit(base44, "follow_up_created", user, { player_id: episode.player_id, medical_episode_id: episodeId, medical_follow_up_id: created.id, squad_id: squadId, changes: { availability: follow.availability, rehab_phase: follow.rehab_phase, decision: follow.decision } });
      const status = await recalcPlayer(base44, episode.player_id, squadId, user);
      return Response.json({ ok: true, follow_up: created, current_status: status });
    }

    if (action === "medical_clearance") {
      const episodeId = String(body.episode_id || "");
      const episode = await base44.asServiceRole.entities.MedicalEpisode.get(episodeId);
      if (!episode || !playerIds.includes(episode.player_id)) return Response.json({ error: "Episodio no encontrado" }, { status: 404 });
      if (!access.can_view_clinical) return Response.json({ error: "El alta médica requiere personal clínico autorizado" }, { status: 403 });
      const clearanceDate = asDate(body.medical_clearance_date) || todayISO();
      const at = nowISO();
      const note = cleanText(body.medical_clearance_note, 4000);
      const updated = await base44.asServiceRole.entities.MedicalEpisode.update(episodeId, {
        medical_clearance_date: clearanceDate,
        medical_clearance_at: at,
        medical_clearance_by_id: user.id || "",
        medical_clearance_by_name: user.full_name || user.email || "Usuario",
        medical_clearance_note: note,
        actual_return_date: asDate(body.actual_return_date) || episode.actual_return_date || clearanceDate,
        availability: "available_to_compete",
        rehab_phase: "available",
        medical_status: "alta",
        episode_state: "closed",
        source: "app",
        edited_at: at,
        edited_by: user.full_name || user.email || "Usuario",
        edited_by_id: user.id || "",
      });
      const follow = await base44.asServiceRole.entities.MedicalFollowUp.create({
        medical_episode_id: episodeId,
        player_id: episode.player_id,
        squad_id: squadId,
        follow_up_date: clearanceDate,
        professional_id: user.id || "",
        professional_name: user.full_name || user.email || "Usuario",
        note,
        medical_status: "alta",
        availability: "available_to_compete",
        rehab_phase: "available",
        decision: "medical_clearance",
        created_by_id: user.id || "",
        created_by_name: user.full_name || user.email || "Usuario",
        created_at: at,
      });
      await audit(base44, "medical_clearance", user, { player_id: episode.player_id, medical_episode_id: episodeId, medical_follow_up_id: follow.id, squad_id: squadId, note, changes: { medical_clearance_date: clearanceDate } });
      const status = await recalcPlayer(base44, episode.player_id, squadId, user);
      return Response.json({ ok: true, episode: updated, current_status: status });
    }

    if (action === "reopen_episode") {
      const episodeId = String(body.episode_id || "");
      const episode = await base44.asServiceRole.entities.MedicalEpisode.get(episodeId);
      if (!episode || !playerIds.includes(episode.player_id)) return Response.json({ error: "Episodio no encontrado" }, { status: 404 });
      const updated = await base44.asServiceRole.entities.MedicalEpisode.update(episodeId, {
        episode_state: "active",
        medical_clearance_date: null,
        medical_clearance_at: "",
        medical_clearance_by_id: "",
        medical_clearance_by_name: "",
        medical_clearance_note: "",
        availability: cleanText(body.availability, 80) || "modified_training",
        rehab_phase: cleanText(body.rehab_phase, 80) || "rehabilitation",
        medical_status: "en_recuperacion",
        edited_at: nowISO(), edited_by: user.full_name || user.email || "Usuario", edited_by_id: user.id || "",
      });
      await audit(base44, "episode_reopened", user, { player_id: episode.player_id, medical_episode_id: episodeId, squad_id: squadId, note: cleanText(body.note, 2000) });
      const status = await recalcPlayer(base44, episode.player_id, squadId, user);
      return Response.json({ ok: true, episode: updated, current_status: status });
    }

    if (action === "review_wellness_signal" || action === "convert_wellness_signal") {
      const signalId = String(body.signal_id || "");
      const signal = await base44.asServiceRole.entities.MedicalWellnessSignal.get(signalId);
      if (!signal || !playerIds.includes(signal.player_id)) return Response.json({ error: "Señal no encontrada" }, { status: 404 });
      const at = nowISO();
      if (action === "review_wellness_signal") {
        const status = body.dismiss ? "dismissed" : "reviewed";
        const saved = await base44.asServiceRole.entities.MedicalWellnessSignal.update(signalId, { status, reviewed_at: at, reviewed_by_id: user.id || "", reviewed_by_name: user.full_name || user.email || "Usuario", review_note: cleanText(body.review_note, 2000) });
        await audit(base44, "wellness_signal_reviewed", user, { player_id: signal.player_id, squad_id: squadId, note: cleanText(body.review_note, 2000), changes: { status } });
        return Response.json({ ok: true, signal: saved });
      }
      const player = playerMap.get(signal.player_id);
      if (!player) return Response.json({ error: "Jugador no encontrado" }, { status: 404 });
      const epPayload = episodePayload({
        record_type: "consultation",
        event_date: signal.response_date || todayISO(),
        lesion_consulta: body.lesion_consulta || `Consulta por dolor reportado en Wellness: ${signal.pain_zone || "zona no especificada"}`,
        body_area: signal.pain_zone || "",
        description: signal.comment || "",
        operational_note: body.operational_note || "En revisión médica por reporte de dolor en Wellness",
        availability: body.availability || "full_training",
        next_control_date: body.next_control_date,
      }, player, user, squadId);
      const episode = await base44.asServiceRole.entities.MedicalEpisode.create(epPayload);
      const savedSignal = await base44.asServiceRole.entities.MedicalWellnessSignal.update(signalId, { status: "converted_to_consultation", reviewed_at: at, reviewed_by_id: user.id || "", reviewed_by_name: user.full_name || user.email || "Usuario", review_note: cleanText(body.review_note, 2000), medical_episode_id: episode.id });
      await audit(base44, "wellness_signal_converted", user, { player_id: signal.player_id, medical_episode_id: episode.id, squad_id: squadId, changes: { signal_id: signalId } });
      const currentStatus = await recalcPlayer(base44, signal.player_id, squadId, user);
      return Response.json({ ok: true, signal: savedSignal, episode, current_status: currentStatus });
    }

    return Response.json({ error: "Acción no soportada" }, { status: 400 });
  } catch (error) {
    console.error("medicalGateway error", error);
    return medicalErrorResponse(error);
  }
}
