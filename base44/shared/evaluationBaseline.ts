import {
  calculateStats,
  zScore,
  pctChange,
} from "./evaluationImportUtils.ts";

/**
 * Calcula la línea de base de un jugador para una métrica específica.
 * Usa los N resultados primarios más recientes (excluyendo la sesión actual).
 */
export function calculateBaseline(
  historicalValues: number[],
  minSessions: number = 3
): {
  value: number | null;
  std: number | null;
  sufficient: boolean;
  count: number;
} {
  if (historicalValues.length < minSessions) {
    return { value: null, std: null, sufficient: false, count: historicalValues.length };
  }
  const stats = calculateStats(historicalValues);
  return {
    value: stats.mean,
    std: stats.std,
    sufficient: true,
    count: stats.count,
  };
}

/**
 * Determina la señal (severidad) de un resultado respecto a su línea de base.
 * No usa colores universales — devuelve una etiqueta textual.
 */
export function determineSignal(
  currentValue: number,
  baselineValue: number | null,
  baselineStd: number | null,
  thresholds: { moderate: number; important: number; type: string } | null
): {
  signal: "expected" | "moderate" | "important" | "insufficient";
  changeAbs: number | null;
  changePct: number | null;
  zScoreIndividual: number | null;
  reason: string;
} {
  if (baselineValue === null || baselineStd === null) {
    return {
      signal: "insufficient",
      changeAbs: null,
      changePct: null,
      zScoreIndividual: null,
      reason: "Sin línea de base suficiente",
    };
  }

  const changeAbs = currentValue - baselineValue;
  const changePct = pctChange(currentValue, baselineValue);
  const z = zScore(currentValue, baselineValue, baselineStd);

  if (!thresholds) {
    // Sin umbrales configurados — solo reportar cambio sin clasificar
    return {
      signal: "expected",
      changeAbs,
      changePct,
      zScoreIndividual: z,
      reason: "Sin umbrales configurados",
    };
  }

  const absZ = z !== null ? Math.abs(z) : 0;
  const absPct = changePct !== null ? Math.abs(changePct) : 0;

  let severity: "expected" | "moderate" | "important";
  if (thresholds.type === "sd") {
    severity = absZ >= thresholds.important ? "important" : absZ >= thresholds.moderate ? "moderate" : "expected";
  } else if (thresholds.type === "percentage") {
    severity = absPct >= thresholds.important ? "important" : absPct >= thresholds.moderate ? "moderate" : "expected";
  } else {
    severity = Math.abs(changeAbs) >= thresholds.important ? "important" : Math.abs(changeAbs) >= thresholds.moderate ? "moderate" : "expected";
  }

  const reason =
    severity === "important"
      ? `Desviación importante (z=${z !== null ? z.toFixed(2) : "—"}, ${changePct !== null ? changePct.toFixed(1) + "%" : "—"})`
      : severity === "moderate"
      ? `Desviación moderada (z=${z !== null ? z.toFixed(2) : "—"}, ${changePct !== null ? changePct.toFixed(1) + "%" : "—"})`
      : "Dentro del rango esperado";

  return { signal: severity, changeAbs, changePct, zScoreIndividual: z, reason };
}

/**
 * Detecta señales de asimetría fuera de rango.
 */
export function detectAsymmetrySignal(
  asymmetryMagnitude: number,
  threshold: number | null
): { flagged: boolean; reason: string } {
  if (threshold === null || !isFinite(threshold)) {
    return { flagged: false, reason: "Sin umbral de asimetría configurado" };
  }
  if (asymmetryMagnitude > threshold) {
    return {
      flagged: true,
      reason: `Asimetría ${asymmetryMagnitude.toFixed(1)}% supera el umbral ${threshold}%`,
    };
  }
  return { flagged: false, reason: "Asimetría dentro de rango" };
}

/**
 * Detecta valores anómalos (outliers) dentro del historial de un jugador.
 */
export function detectAnomaly(
  currentValue: number,
  baselineValue: number,
  baselineStd: number
): { anomaly: boolean; reason: string } {
  if (baselineStd === 0 || !isFinite(baselineStd)) {
    return { anomaly: false, reason: "" };
  }
  const z = Math.abs((currentValue - baselineValue) / baselineStd);
  if (z >= 3) {
    return { anomaly: true, reason: `Valor anómalo (z=${z.toFixed(2)})` };
  }
  return { anomaly: false, reason: "" };
}

/**
 * Calcula Z-score del plantel (todos los jugadores) y por posición.
 */
export function calculateSquadZScores(
  currentValue: number,
  squadValues: number[],
  positionValues: number[]
): { squad: number | null; position: number | null } {
  const squadStats = calculateStats(squadValues);
  const positionStats = calculateStats(positionValues);
  return {
    squad: zScore(currentValue, squadStats.mean, squadStats.std),
    position: zScore(currentValue, positionStats.mean, positionStats.std),
  };
}