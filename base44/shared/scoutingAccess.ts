export type ScoutingAction = "view" | "create" | "edit" | "delete" | "export" | "admin";

export class ScoutingAccessError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "ScoutingAccessError";
    this.status = status;
  }
}

const ACTION_KEY: Record<ScoutingAction, string> = {
  view: "can_view",
  create: "can_create",
  edit: "can_edit",
  delete: "can_delete",
  export: "can_export",
  admin: "can_admin",
};

const SCOUTING_ROLE = /(scout|scouting|recruitment|director.?deportivo|direcci[oó]n.?deportiva|secretar[ií]a.?t[eé]cnica|manager deportivo)/i;

export async function requireScoutingAccess(base44: any, user: any, action: ScoutingAction = "view", squadId?: string | null) {
  if (!user) throw new ScoutingAccessError("No autenticado", 401);
  if (user.role === "admin") {
    return {
      user,
      access: null,
      roles: [],
      capabilities: { can_view: true, can_create: true, can_edit: true, can_delete: true, can_export: true, can_admin: true },
      is_platform_admin: true,
      is_scouting_professional: true,
    };
  }

  const originalEmail = String(user.email || "").trim();
  const email = originalEmail.toLowerCase();
  let rows = await base44.asServiceRole.entities.UserAccess.filter({ user_email: originalEmail, active: true }, "-created_date", 5);
  if (!rows.length && originalEmail !== email) rows = await base44.asServiceRole.entities.UserAccess.filter({ user_email: email, active: true }, "-created_date", 5);
  const access = rows[0] || null;
  if (!access) throw new ScoutingAccessError("Scouting está disponible sólo para personal autorizado", 403);

  if (squadId) {
    const allowedSquads = Array.isArray(access.squad_ids) ? access.squad_ids : [];
    if (!access.all_squads && !allowedSquads.includes(squadId)) throw new ScoutingAccessError("No tenés acceso a ese plantel", 403);
  }

  const roleIds = Array.isArray(access.role_ids) ? access.role_ids : [];
  const allRoles = roleIds.length ? await base44.asServiceRole.entities.AppRole.list("name", 300) : [];
  const roles = allRoles.filter((role: any) => roleIds.includes(role.id) && role.active !== false);
  const merged: Record<string, boolean> = { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, can_admin: false };

  for (const role of roles) {
    const module = role.module_permissions?.scouting || {};
    const coversScouting = Object.keys(module).length > 0 || (role.allowed_pages || []).includes("/scouting") || role.can_admin === true;
    if (!coversScouting) continue;
    for (const key of Object.keys(merged)) merged[key] = merged[key] || module[key] === true || role.can_admin === true;
  }

  const roleText = [access.role, ...roles.map((role: any) => role.name)].filter(Boolean).join(" ");
  const roleAreas = new Set(roles.flatMap((role: any) => role.areas || []));
  const isScoutingProfessional = SCOUTING_ROLE.test(roleText) || roleAreas.has("scouting");
  const pageAllowed = (access.allowed_pages || []).includes("/scouting") || roles.some((role: any) => (role.allowed_pages || []).includes("/scouting"));

  // Migración suave: un rol claramente de Scouting puede operar el módulo aunque
  // todavía no se hayan guardado permisos granulares. Eliminar y administrar
  // siempre requieren permiso explícito.
  if (isScoutingProfessional || pageAllowed) {
    merged.can_view = true;
    if (isScoutingProfessional) {
      merged.can_create = true;
      merged.can_edit = true;
      merged.can_export = true;
    }
  }

  if (!merged[ACTION_KEY[action]]) throw new ScoutingAccessError(`No tenés permiso para ${action} en Scouting`, 403);
  return { user, access, roles, capabilities: merged, is_platform_admin: false, is_scouting_professional: isScoutingProfessional };
}

export function scoutingErrorResponse(error: any): Response {
  const status = error instanceof ScoutingAccessError ? error.status : 500;
  return Response.json({ error: error?.message || "Error interno en Scouting" }, { status });
}
