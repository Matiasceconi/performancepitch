import moment from "moment";

export function avg(arr) {
  const v = arr.filter((x) => x != null && !isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function sum(arr) {
  const v = arr.filter((x) => x != null && !isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) : null;
}

export function fmtInt(v) {
  return v == null || isNaN(v) ? "—" : Math.round(v).toLocaleString("es-AR");
}

export function fmtSmax(v) {
  return v == null || isNaN(v) ? "—" : Number(v).toFixed(1);
}

// Determina si un jugador debe incluirse en los promedios grupales de GPS
// según su estado en la sesión (SessionPlayer.status_at_session / attendance).
export function classifyGpsInclusion(sp) {
  const status = sp?.status_at_session || "disponible";
  const attendance = sp?.attendance || "presente";
  if (attendance === "ausente" || status === "ausente") return { include: false, group: "otro", reason: "otro" };
  if (status === "diferenciado" || attendance === "diferenciado") return { include: false, group: "diferenciado", reason: "diferenciado" };
  if (status === "reintegro") return { include: false, group: "reintegro", reason: "reintegro" };
  if (status === "lesionado" || status === "molestia") return { include: false, group: "otro", reason: "lesion" };
  if (status === "suspendido") return { include: false, group: "otro", reason: "otro" };
  if (attendance === "no_entrena") return { include: false, group: "otro", reason: "otro" };
  return { include: true, group: "principal", reason: undefined };
}

export const EXCLUSION_REASON_LABELS = {
  diferenciado: "Diferenciado",
  reintegro: "Reintegro",
  lesion: "Lesión / Molestia",
  arquero: "Arquero",
  carga_parcial: "Carga parcial",
  error_gps: "Error GPS",
  otro: "Otro / Ausente",
};

// Genera alertas automáticas de la semana a partir de los agregados por jugador
export function computeAlerts({ squadPlayers, playerAgg, sessions, gpsRows }) {
  const alerts = [];
  const values = Object.values(playerAgg);
  const withGpsIds = new Set(Object.keys(playerAgg));

  const withoutGps = squadPlayers.filter((p) => !withGpsIds.has(p.id));
  if (withoutGps.length > 0) {
    alerts.push({ type: "missing", text: `Sin GPS esta semana: ${withoutGps.map((p) => p.full_name).join(", ")}` });
  }

  const teamAvgDistance = avg(values.map((v) => v.total_distance));
  if (teamAvgDistance) {
    values.filter((v) => v.total_distance > teamAvgDistance * 1.3)
      .forEach((v) => alerts.push({ type: "high", text: `${v.player_name}: carga muy alta (${fmtInt(v.total_distance)} m vs. prom. ${fmtInt(teamAvgDistance)} m)` }));
    values.filter((v) => v.total_distance < teamAvgDistance * 0.7)
      .forEach((v) => alerts.push({ type: "low", text: `${v.player_name}: carga muy baja (${fmtInt(v.total_distance)} m vs. prom. ${fmtInt(teamAvgDistance)} m)` }));
  }

  const maxSmax = Math.max(0, ...values.map((v) => v.smax_max || 0));
  if (maxSmax > 0) {
    values.filter((v) => v.smax_max > 0 && v.smax_max >= maxSmax - 0.5)
      .forEach((v) => alerts.push({ type: "smax", text: `${v.player_name}: velocidad máxima destacada (${fmtSmax(v.smax_max)} km/h)` }));
  }

  const avgAccDec = avg(values.map((v) => (v.acc_3 || 0) + (v.dec_3 || 0)));
  if (avgAccDec) {
    values.filter((v) => ((v.acc_3 || 0) + (v.dec_3 || 0)) > avgAccDec * 1.4)
      .forEach((v) => alerts.push({ type: "accdec", text: `${v.player_name}: muchas aceleraciones/desaceleraciones (ACC ${fmtInt(v.acc_3)} / DEC ${fmtInt(v.dec_3)})` }));
  }

  sessions.filter((s) => !gpsRows.some((r) => r.session_id === s.id))
    .forEach((s) => alerts.push({ type: "pending", text: `GPS pendiente de cargar: "${s.title}" (${moment(s.date).format("DD/MM")})` }));

  return alerts;
}