import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import SquadSelectModal from "@/components/workspace/SquadSelectModal";
import AreaSelectScreen from "@/components/workspace/AreaSelectScreen";
import { AREAS, ROLE_AREAS, CUERPO_TECNICO_ROLE_PAGES, AREA_PAGES } from "@/lib/areasConfig";

const WorkspaceContext = createContext(null);

// Default modules available to all roles
const ROLE_DEFAULTS = {
  "Administrador":          { can_create: true,  can_edit: true,  can_delete: true,  can_export: true,  can_admin: true,  can_manage_users: true,  all_squads: true,  allowed_modules: ["dashboard","daily_squad","sessions","matches","performance","gps","field_library","strength_library","schedule","team","weekly_planner","tactical","admin","squad_manager","player_names"] },
  "Coordinador":            { can_create: true,  can_edit: true,  can_delete: false, can_export: true,  can_admin: true,  can_manage_users: false, all_squads: true,  allowed_modules: ["dashboard","daily_squad","sessions","matches","performance","gps","field_library","strength_library","schedule","team","weekly_planner","tactical","admin","squad_manager"] },
  "Director Deportivo":     { can_create: true,  can_edit: true,  can_delete: false, can_export: true,  can_admin: true,  can_manage_users: false, all_squads: true,  allowed_modules: ["dashboard","daily_squad","sessions","matches","performance","gps","field_library","strength_library","schedule","team","weekly_planner","tactical","admin"] },
  "Entrenador":             { can_create: true,  can_edit: true,  can_delete: false, can_export: true,  can_admin: false, can_manage_users: false, all_squads: false, allowed_modules: ["dashboard","daily_squad","sessions","matches","tactical","schedule","team","weekly_planner","field_library"] },
  "Preparador Físico":      { can_create: true,  can_edit: true,  can_delete: false, can_export: true,  can_admin: false, can_manage_users: false, all_squads: false, allowed_modules: ["dashboard","daily_squad","sessions","gps","performance","field_library","strength_library","schedule","team","weekly_planner"] },
  "Analista de Rendimiento":{ can_create: true,  can_edit: true,  can_delete: false, can_export: true,  can_admin: false, can_manage_users: false, all_squads: false, allowed_modules: ["dashboard","sessions","gps","performance","matches","tactical","field_library","strength_library"] },
  "Médico":                 { can_create: true,  can_edit: true,  can_delete: false, can_export: true,  can_admin: false, can_manage_users: false, all_squads: true,  allowed_modules: ["dashboard","daily_squad","team","performance","schedule"] },
  "Kinesiólogo":            { can_create: true,  can_edit: true,  can_delete: false, can_export: false, can_admin: false, can_manage_users: false, all_squads: false, allowed_modules: ["dashboard","daily_squad","team","performance"] },
  "Nutricionista":          { can_create: true,  can_edit: true,  can_delete: false, can_export: false, can_admin: false, can_manage_users: false, all_squads: false, allowed_modules: ["dashboard","team"] },
  "Videoanalista":          { can_create: true,  can_edit: false, can_delete: false, can_export: true,  can_admin: false, can_manage_users: false, all_squads: false, allowed_modules: ["dashboard","sessions","matches","tactical","field_library"] },
  "Utilero":                { can_create: false, can_edit: false, can_delete: false, can_export: false, can_admin: false, can_manage_users: false, all_squads: false, allowed_modules: ["dashboard","daily_squad","team","schedule"] },
  "Solo lectura":           { can_create: false, can_edit: false, can_delete: false, can_export: false, can_admin: false, can_manage_users: false, all_squads: false, allowed_modules: ["dashboard","daily_squad","sessions","matches","performance","gps","field_library","strength_library"] },
};

export function WorkspaceProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [squads, setSquads] = useState([]);
  const [activeSquad, setActiveSquadState] = useState(null);
  const [userAccess, setUserAccess] = useState(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [workspaceError, setWorkspaceError] = useState(null);
  const [needSquadSelection, setNeedSquadSelection] = useState(false);
  const [adminAccess, setAdminAccess] = useState(false);
  const [myAreas, setMyAreas] = useState([]);
  const [activeAreaId, setActiveAreaIdState] = useState(null);
  const [needAreaSelection, setNeedAreaSelection] = useState(false);

  // Solo la primera carga bloquea toda la pantalla. Recargas posteriores (reloadWorkspace)
  // no deben desmontar el Sidebar ni ocultar módulos globales como Administración.
  const hasLoadedOnceRef = useRef(false);
  // Una vez confirmado el permiso de admin en la sesión, queda "trabado" en true:
  // así una falla transitoria al recargar el workspace (red, rate limit, etc.)
  // nunca hace que Administración desaparezca del menú a mitad de sesión.
  const adminLockRef = useRef(false);

  const loadWorkspace = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setLoadingWorkspace(false);
      return;
    }
    setLoadingWorkspace(true);
    setWorkspaceError(null);

    try {
      // 1. Fetch all active squads
      const allSquads = await base44.entities.Squad.filter({ active: true }, "name", 100);
      setSquads(allSquads);

      // 2. Find user access record by email
      const accessRecords = await base44.entities.UserAccess.filter({ user_email: user.email }, "-created_date", 1);
      let access = accessRecords[0] || null;

      // 3. If platform admin with no access record → treat as Administrador
      if (!access && user.role === "admin") {
        access = {
          user_email: user.email,
          role: "Administrador",
          all_squads: true,
          squad_ids: [],
          squad_names: [],
          ...ROLE_DEFAULTS["Administrador"],
          active: true,
        };
      }

      // 4. Merge role defaults with access record
      if (access) {
        const defaults = ROLE_DEFAULTS[access.role] || ROLE_DEFAULTS["Solo lectura"];
        access = { ...defaults, ...access };
        if (user.role === "admin") {
          access.can_admin = true;
          access.can_manage_users = true;
          access.all_squads = true;
        }
      }

      setUserAccess(access);

      // Permiso de Administración: depende únicamente del rol/permisos del usuario,
      // NUNCA del plantel activo. Es "sticky" durante la sesión: una vez true, no vuelve a false.
      const resolvedAdmin = !!access?.can_admin;
      if (resolvedAdmin) adminLockRef.current = true;
      setAdminAccess(adminLockRef.current);

      console.info("[Workspace] Diagnóstico de acceso", {
        user_email: user.email,
        platform_role: user.role,
        business_role: access?.role || null,
        can_admin_this_load: resolvedAdmin,
        admin_locked_for_session: adminLockRef.current,
        allowed_modules: access?.allowed_modules || [],
      });

      // 4.5 Determine which areas this user can access
      const areasForRole = ROLE_AREAS[access?.role] || [];
      const resolvedAreaIds = Array.from(new Set([...areasForRole, ...(resolvedAdmin ? ["administracion"] : [])]));
      const resolvedAreas = AREAS.filter(a => resolvedAreaIds.includes(a.id));
      setMyAreas(resolvedAreas);

      const savedAreaId = localStorage.getItem("activeAreaId");
      const savedAreaUser = localStorage.getItem("activeAreaUserId");
      if (savedAreaUser && savedAreaUser !== user.id) {
        localStorage.removeItem("activeAreaId");
        localStorage.removeItem("activeAreaUserId");
      }
      const validSavedAreaId = savedAreaUser === user.id && resolvedAreaIds.includes(savedAreaId) ? savedAreaId : null;

      if (validSavedAreaId) {
        setActiveAreaIdState(validSavedAreaId);
        setNeedAreaSelection(false);
      } else if (resolvedAreaIds.length === 1) {
        setActiveAreaIdState(resolvedAreaIds[0]);
        localStorage.setItem("activeAreaId", resolvedAreaIds[0]);
        localStorage.setItem("activeAreaUserId", user.id);
        setNeedAreaSelection(false);
      } else if (resolvedAreaIds.length > 1) {
        setNeedAreaSelection(true);
      } else {
        setActiveAreaIdState(null);
        setNeedAreaSelection(false);
      }

      // 5. Determine which squads this user can access
      const mySquads = access?.all_squads
        ? allSquads
        : allSquads.filter(s => (access?.squad_ids || []).includes(s.id));

      // 6. Restore last active squad or prompt selection
      const savedId = localStorage.getItem("activeSquadId");
      // Clear cached squad if it belongs to a different user
      const savedUser = localStorage.getItem("activeSquadUserId");
      if (savedUser && savedUser !== user.id) {
        localStorage.removeItem("activeSquadId");
        localStorage.removeItem("activeSquadUserId");
      }

      const validSavedId = savedUser === user.id ? savedId : null;
      const restoredSquad = mySquads.find(s => s.id === validSavedId) || null;

      if (restoredSquad) {
        setActiveSquadState(restoredSquad);
        setNeedSquadSelection(false);
      } else if (mySquads.length === 1) {
        setActiveSquadState(mySquads[0]);
        localStorage.setItem("activeSquadId", mySquads[0].id);
        localStorage.setItem("activeSquadUserId", user.id);
        setNeedSquadSelection(false);
      } else if (mySquads.length > 1) {
        setNeedSquadSelection(true);
      } else {
        // No squads assigned — still allow access, just no active squad
        setActiveSquadState(null);
        setNeedSquadSelection(false);
      }

      // 7. Update last_seen (fire and forget)
      if (accessRecords[0]) {
        base44.entities.UserAccess.update(accessRecords[0].id, {
          last_seen: new Date().toISOString(),
        }).catch(() => {});
      }
    } catch (err) {
      console.error("WorkspaceContext error:", err);
      console.warn("[Workspace] Falla al cargar el workspace — Administración se mantiene según el último estado confirmado (admin_locked_for_session):", adminLockRef.current);
      // Solo mostramos la pantalla de error bloqueante en la carga inicial.
      // En recargas posteriores, un error transitorio no debe tirar abajo toda la app ni el menú.
      if (!hasLoadedOnceRef.current) {
        setWorkspaceError(err?.message || "Error al cargar el espacio de trabajo.");
      }
    } finally {
      hasLoadedOnceRef.current = true;
      setLoadingWorkspace(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => { loadWorkspace(); }, [loadWorkspace]);

  function setActiveSquad(squad) {
    setActiveSquadState(squad);
    setNeedSquadSelection(false);
    if (squad) {
      localStorage.setItem("activeSquadId", squad.id);
      localStorage.setItem("activeSquadUserId", user?.id || "");
    }
  }

  const mySquads = userAccess?.all_squads
    ? squads
    : squads.filter(s => (userAccess?.squad_ids || []).includes(s.id));

  function can(action) {
    if (!userAccess) return false;
    return !!userAccess[`can_${action}`];
  }

  function canModule(moduleKey) {
    if (!userAccess) return false;
    return (userAccess.allowed_modules || []).includes(moduleKey);
  }

  function canAccessSquad(squadId) {
    if (!userAccess) return false;
    if (userAccess.all_squads) return true;
    return (userAccess.squad_ids || []).includes(squadId);
  }

  function setActiveArea(areaId) {
    setActiveAreaIdState(areaId);
    setNeedAreaSelection(false);
    if (areaId) {
      localStorage.setItem("activeAreaId", areaId);
      localStorage.setItem("activeAreaUserId", user?.id || "");
    }
  }

  function requestAreaChange() {
    setNeedAreaSelection(true);
  }

  // Seguridad: valida si la página (path) puede verse desde el área activa y el rol del usuario.
  function canSeePath(path) {
    if (!activeAreaId) return false;
    if (activeAreaId === "cuerpo_tecnico") {
      const pages = CUERPO_TECNICO_ROLE_PAGES[userAccess?.role];
      if (pages === undefined) return false;
      if (pages === null) return true;
      return pages.includes(path);
    }
    const pages = AREA_PAGES[activeAreaId];
    if (pages === undefined) return false;
    if (pages === null) return true;
    return pages.includes(path);
  }

  // ── Loading state (solo bloquea en la carga inicial de la sesión) ───────
  if (loadingWorkspace && !hasLoadedOnceRef.current) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-blue-400 rounded-full animate-spin mx-auto" />
          <p className="text-zinc-500 text-sm">Cargando espacio de trabajo…</p>
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────
  if (workspaceError) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto">
            <span className="text-red-400 text-xl">!</span>
          </div>
          <h2 className="text-white font-bold text-lg">Error al cargar</h2>
          <p className="text-zinc-400 text-sm">{workspaceError}</p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={loadWorkspace}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors">
              Reintentar
            </button>
            <button
              onClick={() => base44.auth.logout(window.location.origin)}
              className="w-full px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-xl transition-colors">
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── No access record (non-admin user with no UserAccess) ────────────────
  if (!userAccess) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center mx-auto">
            <span className="text-yellow-400 text-xl">⚠</span>
          </div>
          <h2 className="text-white font-bold text-lg">Sin permisos configurados</h2>
          <p className="text-zinc-400 text-sm">
            Tu usuario no tiene permisos configurados en la plataforma. Contactá al administrador.
          </p>
          <button
            onClick={() => base44.auth.logout(window.location.origin)}
            className="w-full px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-xl transition-colors">
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  // ── No squads assigned ──────────────────────────────────────────────────
  if (!userAccess.can_admin && mySquads.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto">
            <span className="text-blue-400 text-xl">🏟</span>
          </div>
          <h2 className="text-white font-bold text-lg">Sin planteles asignados</h2>
          <p className="text-zinc-400 text-sm">
            Tu usuario no tiene planteles asignados. Contactá al administrador para que te asigne acceso.
          </p>
          <button
            onClick={() => base44.auth.logout(window.location.origin)}
            className="w-full px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-xl transition-colors">
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  // ── Area selection required (antes de entrar al sistema general) ───────
  if (needAreaSelection) {
    return (
      <AreaSelectScreen
        areas={myAreas}
        userName={user?.full_name || ""}
        currentAreaId={activeAreaId}
        onSelect={setActiveArea}
      />
    );
  }

  // ── Squad selection required ────────────────────────────────────────────
  if (needSquadSelection) {
    return (
      <SquadSelectModal
        squads={mySquads}
        userName={user?.full_name || ""}
        onSelect={setActiveSquad}
      />
    );
  }

  return (
    <WorkspaceContext.Provider value={{
      squads,
      mySquads,
      activeSquad,
      setActiveSquad,
      userAccess,
      loadingWorkspace,
      reloadWorkspace: loadWorkspace,
      can,
      canModule,
      canAccessSquad,
      myAreas,
      activeAreaId,
      activeAreaName: myAreas.find(a => a.id === activeAreaId)?.name || "",
      setActiveArea,
      requestAreaChange,
      canSeePath,
      activeSquadId: activeSquad?.id || null,
      activeSquadName: activeSquad?.name || "",
      activeSeasonId: activeSquad?.season || null,
      // Global, sticky para la sesión — nunca depende del plantel activo.
      isAdmin: adminAccess,
      canManageUsers: userAccess?.can_manage_users || false,
      debugInfo: {
        user_email: user?.email || null,
        platform_role: user?.role || null,
        business_role: userAccess?.role || null,
        can_admin: userAccess?.can_admin || false,
        admin_locked_for_session: adminLockRef.current,
        allowed_modules: userAccess?.allowed_modules || [],
        active_squad_id: activeSquad?.id || null,
        active_season_id: activeSquad?.season || null,
        loading_workspace: loadingWorkspace,
      },
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

export { ROLE_DEFAULTS };