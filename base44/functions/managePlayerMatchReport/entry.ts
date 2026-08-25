import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

type Action = "view" | "create" | "edit" | "delete";
const permissionKey: Record<Action, string> = {
  view: "can_view",
  create: "can_create",
  edit: "can_edit",
  delete: "can_delete",
};

async function requireAccess(base44: any, user: any, squadId: string, action: Action) {
  if (!user) throw Object.assign(new Error("No autenticado"), { status: 401 });
  if (!squadId) throw Object.assign(new Error("Seleccioná un plantel"), { status: 400 });
  if (user.role === "admin") return;

  const email = String(user.email || "").trim().toLowerCase();
  const accessRows = await base44.asServiceRole.entities.UserAccess.list("-created_date", 500);
  const access = accessRows.find((row: any) =>
    row.active !== false && String(row.user_email || "").trim().toLowerCase() === email
  );
  if (!access) throw Object.assign(new Error("No tenés acceso autorizado a Carga externa"), { status: 403 });
  if (!access.all_squads && !(access.squad_ids || []).includes(squadId)) {
    throw Object.assign(new Error("No tenés acceso a este plantel"), { status: 403 });
  }

  const roleIds = Array.isArray(access.role_ids) ? access.role_ids : [];
  const roles = (await base44.asServiceRole.entities.AppRole.list("name", 300))
    .filter((role: any) => roleIds.includes(role.id) && role.active !== false);
  const key = permissionKey[action];
  const allowed = roles.some((role: any) => {
    const module = role.module_permissions?.carga_externa || {};
    return role.can_admin === true || module.can_admin === true || module[key] === true;
  });
  if (!allowed) throw Object.assign(new Error("No tenés permiso para esta acción en Carga externa"), { status: 403 });
}

function cleanPayload(payload: any) {
  const selected = payload?.report_snapshot?.selected;
  if (!Array.isArray(selected) || selected.length === 0) {
    throw Object.assign(new Error("El informe necesita al menos un partido con GPS"), { status: 400 });
  }
  return {
    title: String(payload.title || "Informe individual de rendimiento"),
    report_type: selected.length > 1 ? "multi_match" : "single_match",
    player_id: String(payload.player_id || ""),
    player_name: String(payload.player_name || ""),
    squad_id: String(payload.squad_id || ""),
    squad_name: String(payload.squad_name || ""),
    season_id: String(payload.season_id || ""),
    match_ids: selected.map((item: any) => String(item?.match?.id || "")).filter(Boolean),
    match_labels: selected.map((item: any) => `vs ${item?.match?.rival || "Rival"} (${item?.match?.date || ""})`),
    match_dates: selected.map((item: any) => String(item?.match?.date || "")).filter(Boolean),
    staff_comment: String(payload.staff_comment || ""),
    metrics_snapshot: payload.metrics_snapshot || {},
    report_snapshot: payload.report_snapshot,
    report_version: 3,
  };
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const body = await req.json().catch(() => ({}));
    const operation = String(body.operation || "");
    const now = new Date().toISOString();
    const actor = String(user?.email || user?.id || "");

    if (operation === "list") {
      await requireAccess(base44, user, body.squad_id, "view");
      const rows = await base44.asServiceRole.entities.PlayerMatchReport.filter(
        { player_id: body.player_id, squad_id: body.squad_id },
        "-updated_at",
        100
      );
      return Response.json({ reports: rows.filter((row: any) => !row.deleted_at) });
    }

    if (operation === "save") {
      const payload = cleanPayload(body.payload);
      await requireAccess(base44, user, payload.squad_id, body.id ? "edit" : "create");
      if (!payload.player_id) return Response.json({ error: "Jugador inválido" }, { status: 400 });
      if (body.id) {
        const current = await base44.asServiceRole.entities.PlayerMatchReport.get(body.id);
        if (!current || current.squad_id !== payload.squad_id || current.deleted_at) {
          return Response.json({ error: "Informe no encontrado" }, { status: 404 });
        }
        const updated = await base44.asServiceRole.entities.PlayerMatchReport.update(body.id, {
          ...payload,
          status: current.status === "published" ? "draft" : (current.status || "draft"),
          published_at: current.status === "published" ? null : current.published_at,
          updated_at: now,
          updated_by: actor,
        });
        return Response.json({ report: updated });
      }
      const created = await base44.asServiceRole.entities.PlayerMatchReport.create({
        ...payload,
        status: "draft",
        created_at: now,
        created_by: actor,
        updated_at: now,
        updated_by: actor,
      });
      return Response.json({ report: created });
    }

    if (["publish", "unpublish", "delete"].includes(operation)) {
      const report = await base44.asServiceRole.entities.PlayerMatchReport.get(body.id).catch(() => null);
      if (!report || report.deleted_at) return Response.json({ error: "Informe no encontrado" }, { status: 404 });
      await requireAccess(base44, user, report.squad_id, operation === "delete" ? "delete" : "edit");

      if (operation === "publish") {
        if (!report.report_snapshot?.selected?.length) {
          return Response.json({ error: "Guardá nuevamente el informe antes de publicarlo" }, { status: 400 });
        }
        const updated = await base44.asServiceRole.entities.PlayerMatchReport.update(report.id, {
          status: "published",
          published_at: now,
          published_by: actor,
          updated_at: now,
          updated_by: actor,
        });
        return Response.json({ report: updated });
      }
      if (operation === "unpublish") {
        const updated = await base44.asServiceRole.entities.PlayerMatchReport.update(report.id, {
          status: "draft",
          published_at: null,
          updated_at: now,
          updated_by: actor,
        });
        return Response.json({ report: updated });
      }
      const updated = await base44.asServiceRole.entities.PlayerMatchReport.update(report.id, {
        status: "archived",
        deleted_at: now,
        deleted_by: actor,
        updated_at: now,
        updated_by: actor,
      });
      return Response.json({ report: updated });
    }

    return Response.json({ error: "Operación inválida" }, { status: 400 });
  } catch (error: any) {
    console.error("managePlayerMatchReport error:", error);
    return Response.json({ error: error?.message || "Error interno" }, { status: error?.status || 500 });
  }
}
