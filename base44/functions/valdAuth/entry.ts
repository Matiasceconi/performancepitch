import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ensureValidToken, getValdSettings, authenticateWithVald } from "../../shared/valdApi.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const settings = await getValdSettings(base44);

    if (!settings && body.client_id) {
      const auth = await authenticateWithVald(body.region || "use", body.client_id, body.client_secret, body.tenant_id);
      const created = await base44.asServiceRole.entities.ValdSettings.create({
        client_id: body.client_id,
        client_secret: body.client_secret,
        tenant_id: body.tenant_id,
        region: body.region || "use",
        access_token: auth.access_token,
        token_expires_at: auth.expires_at,
        active: true,
      });
      return Response.json({ success: true, settings_id: created.id, token_expires_at: auth.expires_at });
    }

    if (!settings) return Response.json({ error: 'VALD settings not configured' }, { status: 400 });

    const token = await ensureValidToken(base44, settings);
    return Response.json({ success: true, has_token: true, region: settings.region, last_sync_at: settings.last_sync_at });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}