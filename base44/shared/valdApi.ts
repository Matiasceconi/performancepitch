const AUTH_BASE = "prd-{region}-api-externalauth.valdperformance.com";
const PROFILE_BASE = "prd-{region}-api-externaltenant.valdperformance.com";
const PRODUCT_BASES = {
  ForceDecks: "prd-{region}-api-externalforcedecks.valdperformance.com",
  NordBord: "prd-{region}-api-externalnordbord.valdperformance.com",
  ForceFrame: "prd-{region}-api-externalforceframe.valdperformance.com",
  SmartSpeed: "prd-{region}-api-externalsmartspeed.valdperformance.com",
  DynaMo: "prd-{region}-api-externaldynamo.valdperformance.com",
  HumanTrak: "prd-{region}-api-externalhumantrak.valdperformance.com",
};

export function getAuthUrl(region) {
  return `https://${AUTH_BASE.replace("{region}", region)}/connect/token`;
}

export function getProfileUrl(region) {
  return `https://${PROFILE_BASE.replace("{region}", region)}/api/v1/profiles`;
}

export function getTestUrl(region, product) {
  const base = PRODUCT_BASES[product];
  if (!base) throw new Error(`Unknown VALD product: ${product}`);
  return `https://${base.replace("{region}", region)}/api/v1/tests`;
}

export async function authenticateWithVald(region, clientId, clientSecret, tenantId) {
  const url = getAuthUrl(region);
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    tenant_id: tenantId,
  });
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`VALD auth failed (${resp.status}): ${text}`);
  }
  const data = await resp.json();
  return {
    access_token: data.access_token,
    expires_at: new Date(Date.now() + (data.expires_in - 60) * 1000).toISOString(),
  };
}

export async function getValdSettings(base44) {
  const settings = await base44.asServiceRole.entities.ValdSettings.filter({ active: true }, "-created_date", 1);
  return settings[0] || null;
}

export async function ensureValidToken(base44, settings) {
  if (!settings) throw new Error("VALD settings not configured");
  const now = new Date();
  const expires = settings.token_expires_at ? new Date(settings.token_expires_at) : null;
  if (settings.access_token && expires && expires > now) {
    return settings.access_token;
  }
  const auth = await authenticateWithVald(settings.region, settings.client_id, settings.client_secret, settings.tenant_id);
  await base44.asServiceRole.entities.ValdSettings.update(settings.id, {
    access_token: auth.access_token,
    token_expires_at: auth.expires_at,
  });
  return auth.access_token;
}

export function normalizeName(name) {
  return (name || "").toLowerCase().trim().replace(/\s+/g, " ");
}

export async function matchPlayerByName(base44, name) {
  if (!name) return null;
  const normalized = normalizeName(name);
  const players = await base44.asServiceRole.entities.Player.list("full_name", 500);
  let match = players.find(p => normalizeName(p.full_name || p.name) === normalized);
  if (!match) {
    const parts = normalized.split(" ");
    const lastName = parts[parts.length - 1];
    if (lastName.length >= 3) {
      match = players.find(p => normalizeName(p.full_name || p.name).endsWith(" " + lastName));
    }
  }
  return match || null;
}

export function extractMetrics(product, test) {
  const metrics = {};
  const raw = test.metrics || test.results || test;
  if (product === "ForceDecks") {
    const keys = ["jumpHeight", "jump_height", "rsi", "peakForce", "peak_force", "peakPower", "peak_power", "meanForce", "mean_force", "concentricImpulse", "eccentricUtilization", "asymmetry", "modifiedRsi", "modified_rsi", "flightTime", "flight_time", "contactTime", "contact_time"];
    for (const k of keys) {
      if (raw[k] != null) metrics[k] = raw[k];
    }
  } else if (product === "NordBord") {
    const keys = ["leftForce", "left_force", "rightForce", "right_force", "peakForce", "peak_force", "asymmetry", "leftMaxForce", "rightMaxForce", "maxForce"];
    for (const k of keys) {
      if (raw[k] != null) metrics[k] = raw[k];
    }
  } else if (product === "ForceFrame") {
    const keys = ["peakForce", "peak_force", "asymmetry", "leftForce", "rightForce", "maxForce"];
    for (const k of keys) {
      if (raw[k] != null) metrics[k] = raw[k];
    }
  } else if (product === "SmartSpeed") {
    const keys = ["time", "speed", "distance", "splitTime", "split_time", "averageSpeed", "maxSpeed"];
    for (const k of keys) {
      if (raw[k] != null) metrics[k] = raw[k];
    }
  } else if (product === "DynaMo") {
    const keys = ["force", "power", "velocity", "asymmetry", "peakForce", "peak_power"];
    for (const k of keys) {
      if (raw[k] != null) metrics[k] = raw[k];
    }
  }
  if (test.metrics && typeof test.metrics === "object") {
    for (const [k, v] of Object.entries(test.metrics)) {
      if (!metrics[k] && v != null) metrics[k] = v;
    }
  }
  return metrics;
}