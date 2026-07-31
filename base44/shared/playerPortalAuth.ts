// Resolución segura de la identidad del jugador autenticado para el portal móvil.
// Todas las funciones del portal deben usar resolvePlayerAccess para obtener el
// player_id real, ignorando cualquier player_id enviado desde el cliente.

export async function resolvePlayerAccess(base44, user) {
  if (!user || !user.email) return null;
  const rows = await base44.asServiceRole.entities.PlayerUserAccess.filter(
    { user_email: user.email, active: true },
    "-invited_at",
    10
  );
  return rows[0] || null;
}

export async function resolveStaffAccess(base44, user) {
  if (!user || !user.email) return null;
  if (user.role === "admin") return { admin: true };
  const rows = await base44.asServiceRole.entities.UserAccess.filter(
    { user_email: user.email, active: true },
    "-created_date",
    1
  );
  return rows[0] || null;
}

export function todayISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Cálculo del wellness_score y nivel de alerta.
export function computeWellness(values) {
  const five = [
    Number(values.sleep_quality) || 0,
    Number(values.energy_level) || 0,
    Number(values.muscular_readiness) || 0,
    Number(values.mood) || 0,
    Number(values.calmness) || 0,
  ];
  const avg = five.reduce((a, b) => a + b, 0) / 5;
  const wellness_score = Math.round(avg * 20);
  const sleepHours = Number(values.sleep_hours) || 0;
  const painIntensity = values.has_pain ? Number(values.pain_intensity) || 0 : 0;
  let alert_level = "verde";
  if (
    painIntensity >= 7 ||
    wellness_score <= 40 ||
    (sleepHours > 0 && sleepHours < 5)
  ) {
    alert_level = "rojo";
  } else if (
    (painIntensity >= 4 && painIntensity <= 6) ||
    (wellness_score >= 41 && wellness_score <= 60) ||
    (sleepHours > 0 && sleepHours < 6.5)
  ) {
    alert_level = "amarillo";
  }
  return { wellness_score, alert_level };
}

export function computeIsDrop(history, currentScore) {
  if (!history || history.length === 0 || currentScore == null) return false;
  const last7 = history.slice(0, 7).filter((r) => r.wellness_score != null);
  if (last7.length < 3) return false;
  const avgPrev = last7.reduce((a, r) => a + r.wellness_score, 0) / last7.length;
  if (avgPrev === 0) return false;
  return currentScore <= avgPrev * 0.8;
}