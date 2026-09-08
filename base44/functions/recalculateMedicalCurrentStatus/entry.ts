import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { chooseCurrentEpisode, buildCurrentStatusPayload } from "../../shared/medicalDomain.ts";

/**
 * Compatibility recalculation endpoint.
 * Important domain rule: expected/final treatment dates NEVER imply medical clearance.
 * MedicalCurrentStatus is recalculated from explicit episode_state / medical_clearance_date
 * and the explicit availability stored in MedicalEpisode.
 * Player.status is intentionally NOT mutated here to avoid circular sources of truth.
 */
export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "No autenticado" }, { status: 401 });

    const episodes = await base44.asServiceRole.entities.MedicalEpisode.list("-event_date", 5000);
    const linked = episodes.filter((e: any) => e.player_id);
    const byPlayer = new Map<string, any[]>();
    for (const episode of linked) {
      if (!byPlayer.has(episode.player_id)) byPlayer.set(episode.player_id, []);
      byPlayer.get(episode.player_id)!.push(episode);
    }

    const existing = await base44.asServiceRole.entities.MedicalCurrentStatus.list("-updated_at", 5000);
    const existingByPlayer = new Map(existing.map((s: any) => [s.player_id, s]));
    let created = 0;
    let updated = 0;

    for (const [playerId, playerEpisodes] of byPlayer.entries()) {
      const currentEpisode = chooseCurrentEpisode(playerEpisodes);
      const payload: any = {
        player_id: playerId,
        squad_id: currentEpisode?.squad_id || existingByPlayer.get(playerId)?.squad_id || "",
        organization_id: currentEpisode?.organization_id || existingByPlayer.get(playerId)?.organization_id || "",
        ...buildCurrentStatusPayload(currentEpisode, user),
      };
      const current = existingByPlayer.get(playerId);
      if (current) {
        await base44.asServiceRole.entities.MedicalCurrentStatus.update(current.id, payload);
        updated += 1;
      } else {
        await base44.asServiceRole.entities.MedicalCurrentStatus.create(payload);
        created += 1;
      }
    }

    return Response.json({ ok: true, players: byPlayer.size, created, updated, rule: "explicit_clearance_only" });
  } catch (error: any) {
    console.error("recalculateMedicalCurrentStatus error", error);
    return Response.json({ error: error?.message || "Error al recalcular estados médicos" }, { status: 500 });
  }
}
