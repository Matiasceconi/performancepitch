import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Video, Users, LayoutDashboard, Menu, X, Map, TrendingUp, UsersRound,
  CalendarDays, Trophy, ClipboardList, Settings2, ShieldCheck, BookOpen,
  Dumbbell, ChevronDown, ChevronRight, LogOut, User, Gauge, HeartPulse, Heart, Apple, Clock, Repeat
} from "lucide-react";
import SquadSelector from "@/components/workspace/SquadSelector";
import UserProfileModal from "@/components/workspace/UserProfileModal";
import { useAuth } from "@/lib/AuthContext";
import { useWorkspace } from "@/lib/WorkspaceContext";

// Ítems de navegación — visibilidad determinada por canSeePath(path), según roles/áreas dinámicos
const NAV_ITEMS = [
  { label: "Dashboard",         path: "/",                icon: LayoutDashboard },
  // "sessions" group — shown if any child page is allowed
  { label: "Sesiones",          path: "/sessions",        icon: Video,    group: "sesiones" },
  { label: "Biblioteca Campo",  path: "/field-library",   icon: BookOpen, group: "sesiones" },
  { label: "Biblioteca Fuerza", path: "/strength-library",icon: Dumbbell, group: "sesiones" },
  { label: "Partidos",          path: "/matches",         icon: Trophy },
  { label: "Mapa táctico",      path: "/tactical",        icon: Map },
  // "performance" group — shown if any child page is allowed
  { label: "Carga Externa",     path: "/performance/external-load", icon: Gauge,     group: "rendimiento" },
  { label: "Carga Interna",     path: "/performance/internal-load", icon: HeartPulse,group: "rendimiento" },
  { label: "Área Médica",       path: "/performance/medical",       icon: Heart,     group: "rendimiento" },
  { label: "Nutrición",         path: "/performance/nutrition",     icon: Apple,     group: "rendimiento" },
  { label: "Minutos Jugados",   path: "/performance/minutes",       icon: Clock,     group: "rendimiento" },
  { label: "Calendario",        path: "/schedule",        icon: CalendarDays },
  { label: "Cuerpo Técnico",    path: "/team",            icon: UsersRound },
  { label: "Plan Semanal",      path: "/weekly-planner",  icon: ClipboardList },
  { label: "Estado del Plantel",path: "/daily-squad",     icon: ShieldCheck },
  { label: "Planteles",         path: "/squad-manager",   icon: Users },
];

const SESSION_PATHS = ["/sessions", "/field-library", "/strength-library"];
const PERFORMANCE_PATHS = ["/performance/external-load", "/performance/internal-load", "/performance/medical", "/performance/nutrition", "/performance/minutes"];
const BEFORE_PERFORMANCE_PATHS = ["/matches", "/tactical"];

export default function Sidebar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(SESSION_PATHS.includes(location.pathname));
  const [performanceOpen, setPerformanceOpen] = useState(PERFORMANCE_PATHS.includes(location.pathname));
  const [showProfile, setShowProfile] = useState(false);
  const { user } = useAuth();
  const { isAdmin, activeAreaName, canSeePath, requestAreaChange, myAreas } = useWorkspace();

  // canSeePath ya contempla el bypass sticky de administrador (isAdmin) y el área activa.
  function canSee(item) {
    return canSeePath(item.path);
  }
  // Dashboard ("Inicio") y Administración son módulos de PLATAFORMA: no dependen del área activa.
  // Administración depende únicamente del permiso de administrador del usuario, nunca del área.
  const dashboardItem = NAV_ITEMS.find(i => i.path === "/");
  const sessionItems = NAV_ITEMS.filter(i => i.group === "sesiones" && canSee(i));
  const performanceItems = NAV_ITEMS.filter(i => i.group === "rendimiento" && canSee(i));
  const topItems = NAV_ITEMS.filter(i => !i.group && i.path !== "/" && canSee(i));
  const beforePerformanceItems = topItems.filter(i => BEFORE_PERFORMANCE_PATHS.includes(i.path));
  const afterPerformanceItems = topItems.filter(i => !BEFORE_PERFORMANCE_PATHS.includes(i.path));

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
          {activeAreaName && (
            <div className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-xs text-zinc-300 truncate block">{activeAreaName}</span>
            </div>
          )}
          <SquadSelector />
        </div>

        {/* Nav */}
        <nav className="p-3 space-y-0.5 overflow-y-auto" style={{ maxHeight: "calc(100vh - 148px)" }}>

          {/* ── PLATAFORMA — global, no depende del área activa ────────────── */}
          <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Plataforma</p>
          {dashboardItem && <NavLink item={dashboardItem} />}
          {myAreas.length > 1 && (
            <button
              onClick={requestAreaChange}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-all">
              <Repeat size={18} />
              Cambiar Área
            </button>
          )}
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                location.pathname === "/admin" ? "text-zinc-900 font-semibold" : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
              }`}
              style={location.pathname === "/admin" ? { backgroundColor: "#F0C800", color: "#1a1a1a" } : {}}>
              <Settings2 size={18} />
              Administración
            </Link>
          )}

          {/* ── ÁREA DE TRABAJO — cambia según el área seleccionada ────────── */}
          <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Área de Trabajo</p>

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
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-zinc-800 bg-zinc-950">
          <button
            onClick={() => setShowProfile(true)}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-left group"
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
        </div>

        <button onClick={() => setOpen(false)} className="lg:hidden absolute top-4 right-4 text-zinc-500">
          <X size={18} />
        </button>
      </aside>

      {showProfile && <UserProfileModal onClose={() => setShowProfile(false)} />}
    </>
  );
}