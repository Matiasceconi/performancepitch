import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Video, Users, LayoutDashboard, Menu, X, Map, TrendingUp, UsersRound,
  CalendarDays, Trophy, ClipboardList, Settings2, ShieldCheck, BookOpen,
  Dumbbell, ChevronDown, ChevronRight, LogOut, User, Gauge, HeartPulse, Heart, Apple, Clock, Bug
} from "lucide-react";
import SquadSelector from "@/components/workspace/SquadSelector";
import UserProfileModal from "@/components/workspace/UserProfileModal";
import AdminAccessDebugPanel from "@/components/workspace/AdminAccessDebugPanel";
import { useAuth } from "@/lib/AuthContext";
import { useWorkspace } from "@/lib/WorkspaceContext";

// module key → path and label mapping
const NAV_ITEMS = [
  { module: "dashboard",         label: "Dashboard",         path: "/",                icon: LayoutDashboard },
  // "sessions" group — shown if any child module is allowed
  { module: "sessions",          label: "Sesiones",          path: "/sessions",        icon: Video,    group: "sesiones" },
  { module: "field_library",     label: "Biblioteca Campo",  path: "/field-library",   icon: BookOpen, group: "sesiones" },
  { module: "strength_library",  label: "Biblioteca Fuerza", path: "/strength-library",icon: Dumbbell, group: "sesiones" },
  { module: "matches",           label: "Partidos",          path: "/matches",         icon: Trophy },
  { module: "tactical",          label: "Mapa táctico",      path: "/tactical",        icon: Map },
  // "performance" group — shown if any child module is allowed
  { module: "performance",       label: "Carga Externa",     path: "/performance/external-load", icon: Gauge,     group: "rendimiento" },
  { module: "performance",       label: "Carga Interna",     path: "/performance/internal-load", icon: HeartPulse,group: "rendimiento" },
  { module: "performance",       label: "Área Médica",       path: "/performance/medical",       icon: Heart,     group: "rendimiento" },
  { module: "performance",       label: "Nutrición",         path: "/performance/nutrition",     icon: Apple,     group: "rendimiento" },
  { module: "performance",       label: "Minutos Jugados",   path: "/performance/minutes",       icon: Clock,     group: "rendimiento" },
  { module: "schedule",          label: "Calendario",        path: "/schedule",        icon: CalendarDays },
  { module: "team",              label: "Cuerpo Técnico",    path: "/team",            icon: UsersRound },
  { module: "weekly_planner",    label: "Plan Semanal",      path: "/weekly-planner",  icon: ClipboardList },
  { module: "daily_squad",       label: "Estado del Plantel",path: "/daily-squad",     icon: ShieldCheck },
  { module: "squad_manager",     label: "Planteles",         path: "/squad-manager",   icon: Users },
  { module: "admin",             label: "Administración",    path: "/admin",           icon: Settings2 },
];

const SESSION_PATHS = ["/sessions", "/field-library", "/strength-library"];
const PERFORMANCE_PATHS = ["/performance/external-load", "/performance/internal-load", "/performance/medical", "/performance/nutrition", "/performance/minutes"];
const BEFORE_PERFORMANCE_MODULES = ["matches", "tactical"];

export default function Sidebar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(SESSION_PATHS.includes(location.pathname));
  const [performanceOpen, setPerformanceOpen] = useState(PERFORMANCE_PATHS.includes(location.pathname));
  const [showProfile, setShowProfile] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const { user } = useAuth();
  const { canModule, isAdmin } = useWorkspace();

  // Administración es un módulo GLOBAL: depende únicamente de isAdmin (rol/permiso de admin),
  // nunca del plantel activo ni de si el workspace está recargando en segundo plano.
  // isAdmin es "sticky" durante la sesión (ver WorkspaceContext), por eso nunca parpadea.
  function canSee(item) {
    if (item.module === "admin") {
      console.info(`[Sidebar] Administración ${isAdmin ? "visible" : "oculta"} — motivo: isAdmin=${isAdmin} (independiente del plantel activo)`);
      return isAdmin;
    }
    return canModule(item.module);
  }
  const sessionItems = NAV_ITEMS.filter(i => i.group === "sesiones" && canSee(i));
  const performanceItems = NAV_ITEMS.filter(i => i.group === "rendimiento" && canSee(i));
  const topItems = NAV_ITEMS.filter(i => !i.group && canSee(i));
  const beforePerformanceItems = topItems.filter(i => BEFORE_PERFORMANCE_MODULES.includes(i.module));
  const afterPerformanceItems = topItems.filter(i => i.module !== "dashboard" && !BEFORE_PERFORMANCE_MODULES.includes(i.module));

  function NavLink({ item }) {
    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        onClick={() => setOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
          isActive ? "text-zinc-900 font-semibold" : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
        }`}
        style={isActive ? { backgroundColor: "#F0C800", color: "#1a1a1a" } : {}}>
        <item.icon size={18} />
        {item.label}
      </Link>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-zinc-900 text-white p-2 rounded-lg shadow-lg">
        <Menu size={20} />
      </button>

      {open && <div className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setOpen(false)} />}

      <aside className={`fixed top-0 left-0 h-full w-64 bg-zinc-950 border-r border-zinc-800 z-50 transition-transform duration-300 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>

        {/* Brand + squad selector */}
        <div className="p-4 border-b border-zinc-800 space-y-3">
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight leading-tight">Defensa y Justicia</h1>
            <p className="text-xs mt-0.5" style={{ color: "#F0C800" }}>PerformancePitch</p>
          </div>
          <SquadSelector />
        </div>

        {/* Nav */}
        <nav className="p-3 space-y-0.5 overflow-y-auto" style={{ maxHeight: "calc(100vh - 148px)" }}>

          {/* Top-level items before session group */}
          {topItems.filter(i => i.module === "dashboard").map(i => <NavLink key={i.path} item={i} />)}

          {/* Sessions group */}
          {sessionItems.length > 0 && (
            <div>
              <button
                onClick={() => setSessionsOpen(p => !p)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  SESSION_PATHS.includes(location.pathname) ? "text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                }`}>
                <Video size={18} />
                <span className="flex-1 text-left">Sesiones</span>
                {sessionsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {sessionsOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-zinc-800 pl-3">
                  {sessionItems.map(child => {
                    const isActive = location.pathname === child.path;
                    return (
                      <Link
                        key={child.path}
                        to={child.path}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          isActive ? "text-zinc-900 font-semibold" : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                        }`}
                        style={isActive ? { backgroundColor: "#F0C800", color: "#1a1a1a" } : {}}>
                        <child.icon size={15} />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Items before Rendimiento group */}
          {beforePerformanceItems.map(i => <NavLink key={i.path} item={i} />)}

          {/* Rendimiento group */}
          {performanceItems.length > 0 && (
            <div>
              <button
                onClick={() => setPerformanceOpen(p => !p)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  PERFORMANCE_PATHS.includes(location.pathname) ? "text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                }`}>
                <TrendingUp size={18} />
                <span className="flex-1 text-left">Rendimiento</span>
                {performanceOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {performanceOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-zinc-800 pl-3">
                  {performanceItems.map(child => {
                    const isActive = location.pathname === child.path;
                    return (
                      <Link
                        key={child.path}
                        to={child.path}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          isActive ? "text-zinc-900 font-semibold" : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                        }`}
                        style={isActive ? { backgroundColor: "#F0C800", color: "#1a1a1a" } : {}}>
                        <child.icon size={15} />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Rest of top-level items */}
          {afterPerformanceItems.map(i => <NavLink key={i.path} item={i} />)}
        </nav>

        {/* User footer */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-zinc-800 bg-zinc-950 flex items-center gap-1.5">
          <button
            onClick={() => setShowProfile(true)}
            className="flex-1 flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-left group min-w-0"
          >
            <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
              {user?.photo_url
                ? <img src={user.photo_url} className="w-7 h-7 rounded-full object-cover" alt="" />
                : <User size={13} className="text-zinc-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-300 truncate group-hover:text-white transition-colors">
                {user?.full_name || user?.email || "Usuario"}
              </p>
            </div>
            <LogOut size={13} className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowDebug(true)}
              title="Diagnóstico de acceso a Administración"
              className="p-2 rounded-lg text-zinc-600 hover:text-yellow-400 hover:bg-zinc-800 transition-colors shrink-0">
              <Bug size={14} />
            </button>
          )}
        </div>

        <button onClick={() => setOpen(false)} className="lg:hidden absolute top-4 right-4 text-zinc-500">
          <X size={18} />
        </button>
      </aside>

      {showProfile && <UserProfileModal onClose={() => setShowProfile(false)} />}
      {showDebug && <AdminAccessDebugPanel onClose={() => setShowDebug(false)} />}
    </>
  );
}