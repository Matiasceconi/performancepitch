import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ensureValidToken, getValdSettings, getProfileUrl, matchPlayerByName } from "../../shared/valdApi.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const settings = await getValdSettings(base44);
    if (!settings) return Response.json({ error: 'VALD settings not configured' }, { status: 400 });

    const token = await ensureValidToken(base44, settings);
    const url = getProfileUrl(settings.region);

    const resp = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`VALD profiles fetch failed (${resp.status}): ${text}`);
    }
    const data = await resp.json();
    const profiles = data.profiles || data.items || (Array.isArray(data) ? data : []);

    const existing = await base44.asServiceRole.entities.ValdProfile.list("vald_profile_id", 500);
    const existingMap = new Map(existing.map(p => [p.vald_profile_id, p]));

    let imported = 0, updated = 0;
    for (const profile of profiles) {
      const valdId = profile.id || profile.profileId || profile.profile_id;
      if (!valdId) continue;

      const name = profile.firstName && profile.lastName
        ? `${profile.firstName} ${profile.lastName}`
        : profile.name || profile.displayName || "";

      const player = await matchPlayerByName(base44, name);

      const profileData = {
        vald_profile_id: valdId,
        player_id: player?.id || null,
        player_name: name,
        squad_id: player?.squad_id || null,
        squad_name: player?.squad_name || null,
        email: profile.email || "",
        date_of_birth: profile.dateOfBirth || profile.date_of_birth || null,
        gender: profile.gender || "",
        height: profile.height ? Number(profile.height) : null,
        weight: profile.weight ? Number(profile.weight) : null,
        active: profile.active !== false,
        last_synced_at: new Date().toISOString(),
      };

      const existingProfile = existingMap.get(valdId);
      if (existingProfile) {
        await base44.asServiceRole.entities.ValdProfile.update(existingProfile.id, profileData);
        updated++;
      } else {
        await base44.asServiceRole.entities.ValdProfile.create(profileData);
        imported++;
      }
    }

    await base44.asServiceRole.entities.ValdSettings.update(settings.id, {
      last_sync_at: new Date().toISOString(),
    });

    return Response.json({ success: true, fetched: profiles.length, imported, updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}