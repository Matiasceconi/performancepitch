import { createClientFromRequest } from "npm:@base44/sdk";

const MODULE_ID = "minutos_jugados";
const MODULE_PATH = "/performance/minutes";
const SOURCE = "manual_performance_minutes";
const TIME_ZONE = "America/Argentina/Buenos_Aires";

function normalizedEmail(value: unknown) {
  return String(value || "").toLowerCase().trim();
}

function isValidDate(value: unknown) {
  const date = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function todayInArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function hasRolePermission(roles: any[], keys: string[]) {
  return roles.some((role) => {
    if (role?.active === false) return false;
    if (role?.can_admin || role?.module_permissions?.[MODULE_ID]?.can_admin) return true;
    if (keys.some((key) => role?.module_permissions?.[MODULE_ID]?.[key])) return true;
    if (keys.some((key) => role?.[key])) {
      const allowedPages = role?.allowed_pages || [];
      return allowedPages.includes(MODULE_PATH) || !!role?.module_permissions?.[MODULE_ID];
    }
    return false;
  });
}

async function resolveAccess(base44: any, user: any, action: "view" | "upsert" | "delete", squadId = "") {
  if (user?.role === "admin") return { all_squads: true, squad_ids: [], is_admin: true };

  const email = normalizedEmail(user?.email);
  const accessRows = await base44.asServiceRole.entities.UserAccess.filter(
    { user_email: email, active: true },
    "-created_date",
    5,
  );
  const access = accessRows[0] || null;
  if (!access) throw Object.assign(new Error("No tenés acceso de staff a Minutos Jugados."), { status: 403 });

  const roleText = String(access.role || "").toLowerCase();
  const legacyAdmin = roleText.includes("admin") || roleText.includes("administrador") || !!access.can_admin;
  const roleIds = access.role_ids || [];
  const allRoles = roleIds.length
    ? await base44.asServiceRole.entities.AppRole.list("name", 200)
    : [];
  const roles = allRoles.filter((role: any) => roleIds.includes(role.id) && role.active !== false);

  let permitted = legacyAdmin;
  if (!permitted && action === "view") {
    permitted = hasRolePermission(roles, ["can_view"])
      || (access.allowed_pages || []).includes(MODULE_PATH)
      || (access.allowed_modules || []).includes(MODULE_ID)
      || (access.allowed_modules || []).includes("performance");
  }
  if (!permitted && action === "upsert") {
    permitted = hasRolePermission(roles, ["can_create", "can_edit"]);
  }
  if (!permitted && action === "delete") {
    permitted = hasRolePermission(roles, ["can_delete"]);
  }
  if (!permitted) {
    const label = action === "delete" ? "eliminar" : action === "upsert" ? "cargar o editar" : "ver";
    throw Object.assign(new Error(`No tenés permiso para ${label} minutos en Juveniles.`), { status: 403 });
  }

  const allowedSquads = access.squad_ids || [];
  if (squadId && !access.all_squads && !allowedSquads.includes(squadId)) {
    throw Object.assign(new Error("El plantel seleccionado no está dentro de tus permisos."), { status: 403 });
  }
  return {
    all_squads: !!access.all_squads,
    squad_ids: allowedSquads,
    is_admin: legacyAdmin,
  };
}

async function assertReservaPlayer(base44: any, playerId: string, squadId: string) {
  const [player, squad] = await Promise.all([
    base44.asServiceRole.entities.Player.get(playerId),
    base44.asServiceRole.entities.Squad.get(squadId),
  ]);
  if (!player) throw Object.assign(new Error("No se encontró el jugador."), { status: 404 });
  if (!squad) throw Object.assign(new Error("No se encontró el plantel."), { status: 404 });
  if (!String(squad.name || "").toLowerCase().includes("reserva")) {
    throw Object.assign(new Error("La carga manual de Juveniles está habilitada solamente para el plantel Reserva."), { status: 400 });
  }

  const memberships = await base44.asServiceRole.entities.SquadMembership.filter(
    { squad_id: squadId, player_id: playerId, status: "activo" },
    "-created_date",
    5,
  );
  if (!memberships.length && player.squad_id !== squadId) {
    throw Object.assign(new Error("El jugador no pertenece actualmente al plantel Reserva seleccionado."), { status: 400 });
  }
  return { player, squad };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "list");

    if (action === "list") {
      const squadId = String(body?.squadId || "");
      const access = await resolveAccess(base44, user, "view", squadId);
      let records = squadId
        ? await base44.asServiceRole.entities.YouthPlayerMinutes.filter({ squad_id: squadId }, "-match_date", 5000)
        : await base44.asServiceRole.entities.YouthPlayerMinutes.list("-match_date", 5000);
      if (!access.all_squads) {
        const allowed = new Set(access.squad_ids || []);
        records = records.filter((record: any) => allowed.has(record.squad_id));
      }
      return Response.json({ records });
    }

    if (action === "upsert") {
      const playerId = String(body?.playerId || "");
      const squadId = String(body?.squadId || "");
      const matchDate = String(body?.matchDate || "");
      const recordId = String(body?.recordId || "");
      const minutes = Number(body?.minutes);

      if (!playerId || !squadId) {
        throw Object.assign(new Error("Jugador y plantel son obligatorios."), { status: 400 });
      }
      if (!isValidDate(matchDate)) {
        throw Object.assign(new Error("Ingresá una fecha de partido válida."), { status: 400 });
      }
      if (matchDate > todayInArgentina()) {
        throw Object.assign(new Error("La fecha del partido no puede ser futura."), { status: 400 });
      }
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 150) {
        throw Object.assign(new Error("Los minutos deben ser un número entero entre 1 y 150."), { status: 400 });
      }

      await resolveAccess(base44, user, "upsert", squadId);
      const { player, squad } = await assertReservaPlayer(base44, playerId, squadId);
      const seasonId = String(body?.seasonId || squad.season || matchDate.slice(0, 4));
      const recordKey = `${squadId}:${seasonId}:${matchDate}:${playerId}`;
      const duplicates = await base44.asServiceRole.entities.YouthPlayerMinutes.filter(
        { record_key: recordKey },
        "-updated_at",
        10,
      );
      const duplicate = duplicates[0] || null;
      if (recordId && duplicate && duplicate.id !== recordId) {
        throw Object.assign(new Error("Ya existe una carga para este jugador en esa fecha. Editá el registro existente."), { status: 409 });
      }

      let current = null;
      if (recordId) {
        current = await base44.asServiceRole.entities.YouthPlayerMinutes.get(recordId);
        if (!current) throw Object.assign(new Error("No se encontró el registro a editar."), { status: 404 });
        if (current.squad_id !== squadId || current.player_id !== playerId) {
          throw Object.assign(new Error("El registro no coincide con el jugador y plantel seleccionados."), { status: 400 });
        }
      } else {
        current = duplicate;
      }

      const now = new Date().toISOString();
      const playerName = player.full_name || `${player.first_name || ""} ${player.last_name || ""}`.trim();
      const payload = {
        record_key: recordKey,
        player_id: playerId,
        player_name: playerName,
        squad_id: squadId,
        squad_name: squad.name || "Reserva",
        season_id: seasonId,
        match_date: matchDate,
        minutes,
        source: SOURCE,
        updated_by_user_id: user.id || "",
        updated_by_email: normalizedEmail(user.email),
        updated_at: now,
      };

      if (current?.id) {
        const record = await base44.asServiceRole.entities.YouthPlayerMinutes.update(current.id, payload);
        return Response.json({ record, created: false, updated: true });
      }

      const record = await base44.asServiceRole.entities.YouthPlayerMinutes.create({
        ...payload,
        created_by_user_id: user.id || "",
        created_by_email: normalizedEmail(user.email),
        created_at: now,
      });
      return Response.json({ record, created: true, updated: false });
    }

    if (action === "delete") {
      const recordId = String(body?.recordId || "");
      if (!recordId) throw Object.assign(new Error("Falta el registro a eliminar."), { status: 400 });
      const current = await base44.asServiceRole.entities.YouthPlayerMinutes.get(recordId);
      if (!current) throw Object.assign(new Error("No se encontró el registro."), { status: 404 });
      await resolveAccess(base44, user, "delete", current.squad_id || "");
      await base44.asServiceRole.entities.YouthPlayerMinutes.delete(recordId);
      return Response.json({ success: true, deleted_id: recordId });
    }

    return Response.json({ error: "Acción no válida." }, { status: 400 });
  } catch (error) {
    const status = Number((error as any)?.status || 500);
    console.error("manageYouthMinutes", error);
    return Response.json({ error: (error as Error)?.message || "Error interno" }, { status });
  }
});
