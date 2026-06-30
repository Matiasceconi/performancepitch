import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import SquadSelectModal from "@/components/workspace/SquadSelectModal";

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
  const [needSquadSelection, setNeedSquadSelection] = useState(false);

  const loadWorkspace = useCallback(async () => {
    if (!isAuthenticated || !user) { setLoadingWorkspace(false); return; }
    setLoadingWorkspace(true);

    // 1. Fetch all active squads
    const allSquads = await base44.entities.Squad.filter({ active: true }, "name", 100);
    setSquads(allSquads);

    // 2. Find user access record by email
    const accessRecords = await base44.entities.UserAccess.filter({ user_email: user.email }, "-created_date", 1);
    let access = accessRecords[0] || null;

    // 3. If user is platform admin (role === 'admin') and has no access record, treat as Administrador
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

    // 4. Merge role defaults with access record overrides
    if (access) {
      const defaults = ROLE_DEFAULTS[access.role] || ROLE_DEFAULTS["Solo lectura"];
      access = { ...defaults, ...access };
    }

    setUserAccess(access);

    // 5. Determine which squads this user can access
    const mySquads = access?.all_squads
      ? allSquads
      : allSquads.filter(s => (access?.squad_ids || []).includes(s.id));

    // 6. Restore last active squad from localStorage or ask user to pick
    const savedId = localStorage.getItem("activeSquadId");
    const restoredSquad = mySquads.find(s => s.id === savedId) || null;

    if (restoredSquad) {
      setActiveSquadState(restoredSquad);
    } else if (mySquads.length === 1) {
      setActiveSquadState(mySquads[0]);
      localStorage.setItem("activeSquadId", mySquads[0].id);
    } else if (mySquads.length > 1) {
      // Multiple squads, no saved preference → show selector
      setNeedSquadSelection(true);
    } else {
      setActiveSquadState(null);
    }

    // 7. Update last_seen on access record (fire and forget)
    if (accessRecords[0]) {
      base44.entities.UserAccess.update(accessRecords[0].id, {
        last_seen: new Date().toISOString(),
      }).catch(() => {});
    }

    setLoadingWorkspace(false);
  }, [isAuthenticated, user]);

  useEffect(() => { loadWorkspace(); }, [loadWorkspace]);

  function setActiveSquad(squad) {
    setActiveSquadState(squad);
    setNeedSquadSelection(false);
    if (squad) localStorage.setItem("activeSquadId", squad.id);
  }

  // Accessible squads for this user
  const mySquads = userAccess?.all_squads
    ? squads
    : squads.filter(s => (userAccess?.squad_ids || []).includes(s.id));

  // Permission helpers
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

  // Show squad picker before rendering app
  if (needSquadSelection && isAuthenticated) {
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
      // Squads
      squads,
      mySquads,
      activeSquad,
      setActiveSquad,
      // User access
      userAccess,
      loadingWorkspace,
      reloadWorkspace: loadWorkspace,
      // Permission helpers
      can,
      canModule,
      canAccessSquad,
      // Shorthand
      activeSquadId: activeSquad?.id || null,
      activeSquadName: activeSquad?.name || "",
      isAdmin: userAccess?.can_admin || false,
      canManageUsers: userAccess?.can_manage_users || false,
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