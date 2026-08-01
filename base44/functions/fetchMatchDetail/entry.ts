import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Proxy al endpoint externo de fútbol para obtener el detalle de un partido.
// El endpoint externo cachea el resultado: la primera llamada tarda 3-4s, las siguientes son instantáneas.
const EXTERNAL_ENDPOINT = "https://base44.app/api/apps/6a6d734e0e73182fe462b682/functions/syncFootballData";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const fixtureId = body.fixtureId;
    if (!fixtureId) return Response.json({ error: 'fixtureId requerido' }, { status: 400 });

    const res = await fetch(EXTERNAL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getMatchDetail", fixtureId: Number(fixtureId) }),
    });
    if (!res.ok) throw new Error(`Error ${res.status} al obtener detalle del partido`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);

    return Response.json(json);
  } catch (error) {
    console.error('fetchMatchDetail error:', error);
    return Response.json({ error: error.message || 'Error al cargar el detalle del partido' }, { status: 500 });
  }
}