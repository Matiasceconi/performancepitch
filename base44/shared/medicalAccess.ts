export type MedicalAction = "view" | "create" | "edit" | "delete" | "export" | "admin";

export class MedicalAccessError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "MedicalAccessError";
    this.status = status;
  }
}

const ACTION_KEY: Record<MedicalAction, string> = {
  view: "can_view",
  create: "can_create",
  edit: "can_edit",
  delete: "can_delete",
  export: "can_export",
  admin: "can_admin",
};

const CLINICAL_ROLE = /(m[eé]dic|doctor|kinesi|fisioter|traumatolog|enfermer)/i;
const PERFORMANCE_ROLE = /(preparador|\bpf\b|rendimiento|fisico|físico|entrenador|director t[eé]cnico|\bdt\b)/i;

export async function requireMedicalAccess(base44: any, user: any, squadId: string | null | undefined, action: MedicalAction = "view") {
  if (!user) throw new MedicalAccessError("No autenticado", 401);
  if (!squadId) throw new MedicalAccessError("Seleccioná un plantel", 400);
  if (user.role === "admin") {
    return {
      user,
      access: null,
      roles: [],
      capabilities: { can_view: true, can_create: true, can_edit: true, can_delete: true, can_export: true, can_admin: true },
      can_view_clinical: true,
      is_clinical: true,
      is_platform_admin: true,
    };
  }

  const originalEmail = String(user.email || "").trim();
  const normalizedEmail = originalEmail.toLowerCase();
  let accessRows = await base44.asServiceRole.entities.UserAccess.filter({ user_email: originalEmail, active: true }, "-created_date", 5);
  if (!accessRows.length && normalizedEmail !== originalEmail) {
    accessRows = await base44.asServiceRole.entities.UserAccess.filter({ user_email: normalizedEmail, active: true }, "-created_date", 5);
  }
  const access = accessRows[0] || null;
  if (!access) throw new MedicalAccessError("Área Médica disponible sólo para personal autorizado", 403);

  const allowedSquads = Array.isArray(access.squad_ids) ? access.squad_ids : [];
  if (!access.all_squads && !allowedSquads.includes(squadId)) throw new MedicalAccessError("No tenés acceso a este plantel", 403);

  const roleIds = Array.isArray(access.role_ids) ? access.role_ids : [];
  const allRoles = roleIds.length ? await base44.asServiceRole.entities.AppRole.list("name", 300) : [];
  const roles = allRoles.filter((role: any) => roleIds.includes(role.id) && role.active !== false);
  const merged: Record<string, boolean> = { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, can_admin: false };

  for (const role of roles) {
    const module = role.module_permissions?.area_medica || {};
    const coversMedical = Object.keys(module).length > 0 || (role.allowed_pages || []).includes("/performance/medical") || role.can_admin === true;
    if (!coversMedical) continue;
    for (const key of Object.keys(merged)) merged[key] = merged[key] || module[key] === true || role.can_admin === true || role[key] === true;
  }

  const roleText = [access.role, ...roles.map((role: any) => role.name)].filter(Boolean).join(" ");
  const areas = new Set(roles.flatMap((role: any) => role.areas || []));
  const isClinical = CLINICAL_ROLE.test(roleText) || areas.has("area_medica") || areas.has("kinesiologia");
  const isPerformance = PERFORMANCE_ROLE.test(roleText) || areas.has("rendimiento_fisico") || areas.has("cuerpo_tecnico");
  const pageAllowed = (access.allowed_pages || []).includes("/performance/medical") || roles.some((role: any) => (role.allowed_pages || []).includes("/performance/medical"));

  if (isClinical || pageAllowed) merged.can_view = true;
  if (isClinical) {
    merged.can_create = merged.can_create || true;
    merged.can_edit = merged.can_edit || true;
  }

  if (!merged[ACTION_KEY[action]]) throw new MedicalAccessError(`No tenés permiso para ${action} en Área Médica`, 403);
  return {
    user,
    access,
    roles,
    capabilities: merged,
    is_clinical: isClinical,
    is_performance: isPerformance,
    can_view_clinical: isClinical || merged.can_admin,
    is_platform_admin: false,
  };
}

export function medicalErrorResponse(error: any): Response {
  const status = error instanceof MedicalAccessError ? error.status : 500;
  return Response.json({ error: error?.message || "Error interno" }, { status });
}
