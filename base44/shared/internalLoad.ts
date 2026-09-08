export class InternalLoadError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "InternalLoadError";
    this.status = status;
  }
}

const NO_LOAD_ATTENDANCE = new Set(["ausente", "no_entrena"]);
const EXPLICIT_MINUTES_REQUIRED_ATTENDANCE = new Set(["diferenciado", "kinesiologia"]);
const EXPLICIT_MINUTES_REQUIRED_STATUS = new Set([
  "diferenciado", "lesionado", "molestia", "reintegro", "en_recuperacion",
  "individual_field", "modified_training", "partial_integration",
]);

export function normalizeRpe(value: any) {
  const rpe = Number(value);
  if (!Number.isFinite(rpe) || rpe < 0 || rpe > 10) {
    throw new InternalLoadError("RPE inválido (0-10)", 400);
  }
  return rpe;
}

export function isAbsentForLoad(sp: any) {
  return NO_LOAD_ATTENDANCE.has(String(sp?.attendance || "").toLowerCase());
}

/**
 * Regla canónica para minutos de sRPE.
 * - Ausente/no entrena: 0, nunca genera carga.
 * - Si hay minutos individuales > 0: siempre prevalecen.
 * - Diferenciado/kinesiología/reintegro/restricción: exige minutos explícitos.
 * - Sólo un presente sin restricción puede heredar la duración de la sesión.
 */
export function resolvePlayerSessionMinutes(sp: any, session: any) {
  if (!sp) return { minutes: null, source: "missing_session_player", pending: true, no_load: false };
  if (isAbsentForLoad(sp)) return { minutes: 0, source: "absence", pending: false, no_load: true };

  const individualMinutes = Number(sp.minutes);
  if (Number.isFinite(individualMinutes) && individualMinutes > 0) {
    return { minutes: individualMinutes, source: "session_player", pending: false, no_load: false };
  }

  const attendance = String(sp.attendance || "").toLowerCase();
  const status = String(sp.status_at_session || "").toLowerCase();
  const requiresExplicit = EXPLICIT_MINUTES_REQUIRED_ATTENDANCE.has(attendance) || EXPLICIT_MINUTES_REQUIRED_STATUS.has(status);
  if (requiresExplicit) return { minutes: null, source: "explicit_required", pending: true, no_load: false };

  if (attendance === "presente" || attendance === "") {
    const sessionMinutes = Number(session?.duration_minutes);
    if (Number.isFinite(sessionMinutes) && sessionMinutes > 0) {
      return { minutes: sessionMinutes, source: "session_duration", pending: false, no_load: false };
    }
  }

  return { minutes: null, source: "missing_minutes", pending: true, no_load: false };
}

export function calculateSessionRpeLoad(rpe: number, minutesResolution: any) {
  if (minutesResolution?.no_load) return null;
  const minutes = Number(minutesResolution?.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return Math.round(rpe * minutes * 10) / 10;
}

export function validateRpeSessionWindow(session: any, now = new Date()) {
  if (!session) throw new InternalLoadError("Sesión no encontrada", 404);
  if (session.status === "cancelled") throw new InternalLoadError("La sesión está cancelada", 403);
  if (!session.rpe_enabled) throw new InternalLoadError("El RPE no está habilitado para esta sesión", 403);
  if (session.rpe_available_at) {
    const availableAt = new Date(session.rpe_available_at);
    if (!Number.isNaN(availableAt.getTime()) && now < availableAt) {
      throw new InternalLoadError("El RPE todavía no está disponible", 403);
    }
  }
}

export async function saveSessionPlayerRpe(base44: any, args: {
  sp: any;
  session: any;
  rpe: any;
  comment?: any;
  source?: string;
  now?: Date;
}) {
  const now = args.now || new Date();
  const rpe = normalizeRpe(args.rpe);
  validateRpeSessionWindow(args.session, now);
  if (isAbsentForLoad(args.sp)) throw new InternalLoadError("No estás registrado como presente en esta sesión", 403);

  const minutesResolution = resolvePlayerSessionMinutes(args.sp, args.session);
  const internalLoad = calculateSessionRpeLoad(rpe, minutesResolution);
  const nowISO = now.toISOString();
  const wasFirstSubmission = args.sp.rpe == null;
  const updated = await base44.asServiceRole.entities.SessionPlayer.update(args.sp.id, {
    rpe,
    rpe_comment: String(args.comment || "").slice(0, 1000),
    rpe_source: args.source || "player",
    internal_load: internalLoad,
    internal_load_pending: minutesResolution.pending,
    internal_load_minutes: minutesResolution.minutes,
    internal_load_minutes_source: minutesResolution.source,
    rpe_submitted_at: wasFirstSubmission ? nowISO : (args.sp.rpe_submitted_at || nowISO),
    rpe_updated_at: nowISO,
  });

  return {
    updated,
    rpe,
    internalLoad,
    internalLoadPending: minutesResolution.pending,
    minutesUsed: minutesResolution.minutes,
    minutesSource: minutesResolution.source,
  };
}

export function internalLoadErrorResponse(error: any) {
  const status = error instanceof InternalLoadError ? error.status : 500;
  return Response.json({ error: error?.message || "Error interno" }, { status });
}
