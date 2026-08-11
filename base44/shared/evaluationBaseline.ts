import {
  calculateStats,
  zScore,
  pctChange,
} from "./evaluationImportUtils.ts";

/**
 * Calcula la línea de base de un jugador para una métrica específica.
 * Usa los N resultados primarios más recientes (excluyendo la sesión actual).
 * Configuración inicial: media de las últimas 3 sesiones válidas, mínimo 3.
 */
export function calculateBaseline(
  historicalValues: number[],
  minSessions: number = 3
): {
  value: number | null;
  std: number | null;
  sufficient: boolean;
  count: number;
  config_version: string;
} {
  if (historicalValues.length < minSessions) {
    return { value: null, std: null, sufficient: false, count: historicalValues.length, config_version: "mean_last_3_v1" };
  }
  const recentValues = historicalValues.slice(-3);
  const stats = calculateStats(recentValues);
  return {
    value: stats.mean,
    std: stats.std,
    sufficient: true,
    count: stats.count,
    config_version: "mean_last_3_v1",
  };
}

export interface ThresholdConfig {
  moderate: number;
  important: number;
  type: string;
  improvement_threshold?: number | null;
  decline_threshold?: number | null;
  direction?: "higher_is_better" | "lower_is_better" | "range" | "contextual" | "none";
}

export interface ReferenceChange {
  available: boolean;
  reference_value: number | null;
  change_abs: number | null;
  change_pct: number | null;
  outcome: "improvement" | "decline" | "neutral" | "unavailable";
  relevant: boolean;
  threshold_value: number | null;
  threshold_type: "percentage" | "absolute" | "sd" | null;
}

export function evaluateReferenceChange(
  currentValue: number,
  referenceValue: number | null,
  threshold: ThresholdConfig | null,
  direction: "higher_is_better" | "lower_is_better" | "range" | "contextual" | "none" = "higher_is_better",
  referenceStd: number | null = null,
): ReferenceChange {
  if (referenceValue === null || !Number.isFinite(referenceValue)) {
    return {
      available: false,
      reference_value: null,
      change_abs: null,
      change_pct: null,
      outcome: "unavailable",
      relevant: false,
      threshold_value: null,
      threshold_type: threshold?.type as any || null,
    };
  }
  const changeAbs = currentValue - referenceValue;
  const changePct = pctChange(currentValue, referenceValue);
  const directional = direction === "higher_is_better" || direction === "lower_is_better";
  const improvement = directional && (direction === "lower_is_better" ? changeAbs < 0 : changeAbs > 0);
  const decline = directional && (direction === "lower_is_better" ? changeAbs > 0 : changeAbs < 0);
  const outcome = improvement ? "improvement" : decline ? "decline" : "neutral";
  if (!threshold || outcome === "neutral") {
    return {
      available: true,
      reference_value: referenceValue,
      change_abs: changeAbs,
      change_pct: changePct,
      outcome,
      relevant: false,
      threshold_value: null,
      threshold_type: threshold?.type as any || null,
    };
  }

  const configured = improvement
    ? threshold.improvement_threshold ?? threshold.moderate
    : threshold.decline_threshold ?? threshold.moderate;
  let magnitude = Math.abs(changeAbs);
  if (threshold.type === "percentage") magnitude = Math.abs(changePct || 0);
  else if (threshold.type === "sd") {
    magnitude = referenceStd && Number.isFinite(referenceStd)
      ? Math.abs(changeAbs / referenceStd)
      : 0;
  }
  return {
    available: true,
    reference_value: referenceValue,
    change_abs: changeAbs,
    change_pct: changePct,
    outcome,
    relevant: Number.isFinite(configured) && magnitude >= Math.abs(configured),
    threshold_value: configured,
    threshold_type: threshold.type as any,
  };
}

export interface SignalResult {
  signal: "expected" | "moderate" | "important" | "insufficient";
  changeAbs: number | null;
  changePct: number | null;
  zScoreIndividual: number | null;
  reason: string;
  config_version: string;
}

/**
 * Determina la señal (severidad) de un resultado respecto a su línea de base.
 * Usa umbrales independientes de mejora y caída si están configurados.
 */
export function determineSignal(
  currentValue: number,
  baselineValue: number | null,
  baselineStd: number | null,
  thresholds: ThresholdConfig | null
): SignalResult {
  if (baselineValue === null || baselineStd === null) {
    return {
      signal: "insufficient",
      changeAbs: null,
      changePct: null,
      zScoreIndividual: null,
      reason: "Sin línea de base suficiente",
      config_version: "mean_last_3_v1",
    };
  }

  const changeAbs = currentValue - baselineValue;
  const changePct = pctChange(currentValue, baselineValue);
  const z = zScore(currentValue, baselineValue, baselineStd);

  if (!thresholds) {
    return {
      signal: "expected",
      changeAbs,
      changePct,
      zScoreIndividual: z,
      reason: "Sin umbrales configurados",
      config_version: "mean_last_3_v1",
    };
  }

  const absZ = z !== null ? Math.abs(z) : 0;
  const absPct = changePct !== null ? Math.abs(changePct) : 0;

  // Determinar dirección del cambio respecto a si mayor o menor es mejor
  const direction = thresholds.direction || "higher_is_better";
  const isImprovement = direction === "higher_is_better" ? changeAbs > 0 : changeAbs < 0;
  const isDecline = direction === "higher_is_better" ? changeAbs < 0 : changeAbs > 0;

  // Usar umbral de mejora o caída si están definidos; sino usar moderate/important simétricos
  let severity: "expected" | "moderate" | "important";
  let thresholdUsed: number;

  if (thresholds.type === "sd") {
    thresholdUsed = absZ;
    severity = absZ >= thresholds.important ? "important" : absZ >= thresholds.moderate ? "moderate" : "expected";
  } else if (thresholds.type === "percentage") {
    thresholdUsed = absPct;
    // Usar umbrales direccionales si existen
    if (isImprovement && thresholds.improvement_threshold != null) {
      severity = absPct >= thresholds.improvement_threshold ? "important" : "expected";
    } else if (isDecline && thresholds.decline_threshold != null) {
      severity = absPct >= thresholds.decline_threshold ? "important" : "expected";
    } else {
      severity = absPct >= thresholds.important ? "important" : absPct >= thresholds.moderate ? "moderate" : "expected";
    }
  } else {
    thresholdUsed = Math.abs(changeAbs);
    severity = Math.abs(changeAbs) >= thresholds.important ? "important" : Math.abs(changeAbs) >= thresholds.moderate ? "moderate" : "expected";
  }

  const directionLabel = isImprovement ? "Mejora" : isDecline ? "Caída" : "Sin cambio";
  const reason =
    severity === "important"
      ? `${directionLabel} importante (z=${z !== null ? z.toFixed(2) : "—"}, ${changePct !== null ? changePct.toFixed(1) + "%" : "—"})`
      : severity === "moderate"
      ? `${directionLabel} moderada (z=${z !== null ? z.toFixed(2) : "—"}, ${changePct !== null ? changePct.toFixed(1) + "%" : "—"})`
      : "Dentro del rango esperado";

  return { signal: severity, changeAbs, changePct, zScoreIndividual: z, reason, config_version: "mean_last_3_v1" };
}

/**
 * Calcula el cambio reciente: resultado actual contra la sesión anterior válida
 * de la misma prueba, métrica y lado.
 */
export function calculateRecentChange(
  currentValue: number,
  previousValue: number | null
): {
  changeAbs: number | null;
  changePct: number | null;
  hasPrevious: boolean;
} {
  if (previousValue === null || previousValue === undefined) {
    return { changeAbs: null, changePct: null, hasPrevious: false };
  }
  return {
    changeAbs: currentValue - previousValue,
    changePct: pctChange(currentValue, previousValue),
    hasPrevious: true,
  };
}

/**
 * Determina si un resultado es mejora, caída, neutral o señal mixta.
 * Compara contra sesión anterior Y línea de base.
 */
export interface ChangeClassification {
  vs_previous: "improvement" | "decline" | "neutral" | "no_previous";
  vs_baseline: "improvement" | "decline" | "neutral" | "no_baseline" | "insufficient";
  is_mixed: boolean; // mejora en una dirección pero caída en la otra
  is_improvement: boolean; // mejora pura (mejora en ambas o mejora sin base previa)
  is_decline: boolean; // caída pura
}

export function classifyChange(
  currentVsPrevious: { changeAbs: number | null; hasPrevious: boolean },
  currentVsBaseline: { changeAbs: number | null; baselineSufficient: boolean },
  direction: "higher_is_better" | "lower_is_better" | "range" | "contextual" | "none" = "higher_is_better"
): ChangeClassification {
  const isBetter = (abs: number) => direction === "lower_is_better" ? abs < 0 : abs > 0;
  const isWorse = (abs: number) => direction === "lower_is_better" ? abs > 0 : abs < 0;

  let vsPrevious: "improvement" | "decline" | "neutral" | "no_previous";
  if (!currentVsPrevious.hasPrevious || currentVsPrevious.changeAbs === null) {
    vsPrevious = "no_previous";
  } else if (currentVsPrevious.changeAbs === 0) {
    vsPrevious = "neutral";
  } else if (isBetter(currentVsPrevious.changeAbs)) {
    vsPrevious = "improvement";
  } else if (isWorse(currentVsPrevious.changeAbs)) {
    vsPrevious = "decline";
  } else {
    vsPrevious = "neutral";
  }

  let vsBaseline: "improvement" | "decline" | "neutral" | "no_baseline" | "insufficient";
  if (!currentVsBaseline.baselineSufficient || currentVsBaseline.changeAbs === null) {
    vsBaseline = currentVsBaseline.baselineSufficient ? "no_baseline" : "insufficient";
  } else if (currentVsBaseline.changeAbs === 0) {
    vsBaseline = "neutral";
  } else if (isBetter(currentVsBaseline.changeAbs)) {
    vsBaseline = "improvement";
  } else if (isWorse(currentVsBaseline.changeAbs)) {
    vsBaseline = "decline";
  } else {
    vsBaseline = "neutral";
  }

  // Señal mixta: mejora en una dirección pero caída en la otra
  const isMixed =
    (vsPrevious === "improvement" && vsBaseline === "decline") ||
    (vsPrevious === "decline" && vsBaseline === "improvement");

  // Mejora pura: mejora en ambas (o mejora sin base previa suficiente)
  const isImprovement =
    (vsPrevious === "improvement" && (vsBaseline === "improvement" || vsBaseline === "no_baseline" || vsBaseline === "insufficient")) ||
    (vsPrevious === "no_previous" && vsBaseline === "improvement");

  // Caída pura: caída en ambas (o caída sin base previa suficiente)
  const isDecline =
    (vsPrevious === "decline" && (vsBaseline === "decline" || vsBaseline === "no_baseline" || vsBaseline === "insufficient")) ||
    (vsPrevious === "no_previous" && vsBaseline === "decline");

  return {
    vs_previous: vsPrevious,
    vs_baseline: vsBaseline,
    is_mixed: isMixed,
    is_improvement: isImprovement,
    is_decline: isDecline,
  };
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
