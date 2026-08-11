export type EvaluationAction = "view" | "create" | "edit" | "delete" | "export" | "admin";

export class EvaluationAccessError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "EvaluationAccessError";
    this.status = status;
  }
}

const ACTION_KEY: Record<EvaluationAction, string> = {
  view: "can_view",
  create: "can_create",
  edit: "can_edit",
  delete: "can_delete",
  export: "can_export",
  admin: "can_admin",
};

const PROFESSIONAL_ROLE = /(preparador|\bpf\b|rendimiento|kinesi|fisico|físico)/i;

export async function requireEvaluationAccess(base44: any, user: any, squadId: string | null | undefined, action: EvaluationAction = "view") {
  if (!user) throw new EvaluationAccessError("No autenticado", 401);
  if (!squadId) throw new EvaluationAccessError("Seleccioná un plantel", 400);
  if (user.role === "admin") {
    return {
      user,
      access: null,
      roles: [],
      capabilities: { can_view: true, can_create: true, can_edit: true, can_delete: true, can_export: true, can_admin: true },
      is_platform_admin: true,
      is_professional: true,
    };
  }

  const originalEmail = String(user.email || "").trim();
  const email = originalEmail.toLowerCase();
  let accessRows = await base44.asServiceRole.entities.UserAccess.filter({ user_email: originalEmail, active: true }, "-created_date", 5);
  if (!accessRows.length && originalEmail !== email) {
    accessRows = await base44.asServiceRole.entities.UserAccess.filter({ user_email: email, active: true }, "-created_date", 5);
  }
  const access = accessRows[0] || null;
  if (!access) throw new EvaluationAccessError("Evaluaciones está disponible sólo para personal autorizado", 403);

  const allowedSquads = Array.isArray(access.squad_ids) ? access.squad_ids : [];
  if (!access.all_squads && !allowedSquads.includes(squadId)) throw new EvaluationAccessError("No tenés acceso a este plantel", 403);

  const roleIds = Array.isArray(access.role_ids) ? access.role_ids : [];
  const allRoles = roleIds.length ? await base44.asServiceRole.entities.AppRole.list("name", 300) : [];
  const roles = allRoles.filter((role: any) => roleIds.includes(role.id) && role.active !== false);
  const merged: Record<string, boolean> = { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, can_admin: false };
  for (const role of roles) {
    const module = role.module_permissions?.evaluaciones || {};
    const coversEvaluations = Object.keys(module).length > 0 || (role.allowed_pages || []).includes("/evaluations") || role.can_admin === true;
    if (!coversEvaluations) continue;
    for (const key of Object.keys(merged)) merged[key] = merged[key] || module[key] === true || role.can_admin === true || role[key] === true;
  }

  const roleText = [access.role, ...roles.map((role: any) => role.name)].filter(Boolean).join(" ");
  const roleAreas = new Set(roles.flatMap((role: any) => role.areas || []));
  const isProfessional = PROFESSIONAL_ROLE.test(roleText) || roleAreas.has("rendimiento_fisico") || roleAreas.has("kinesiologia");
  const pageAllowed = (access.allowed_pages || []).includes("/evaluations") || roles.some((role: any) => (role.allowed_pages || []).includes("/evaluations"));
  if (isProfessional || pageAllowed) {
    merged.can_view = true;
    merged.can_create = merged.can_create || isProfessional;
    merged.can_edit = merged.can_edit || isProfessional;
    merged.can_export = merged.can_export || isProfessional;
  }
  if (!merged[ACTION_KEY[action]]) throw new EvaluationAccessError(`No tenés permiso para ${action} en Evaluaciones`, 403);
  return { user, access, roles, capabilities: merged, is_platform_admin: false, is_professional: isProfessional };
}

export function evaluationErrorResponse(error: any): Response {
  const status = error instanceof EvaluationAccessError ? error.status : 500;
  return Response.json({ error: error?.message || "Error interno" }, { status });
}
