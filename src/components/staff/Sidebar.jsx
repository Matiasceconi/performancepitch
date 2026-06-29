import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Video, Users, LayoutDashboard, Menu, X, Map, TrendingUp, UsersRound, CalendarDays, Trophy, ClipboardList, Settings2, ShieldCheck, BookOpen, Dumbbell, ChevronDown, ChevronRight } from "lucide-react";

const navItems = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  {
    label: "Sesiones", icon: Video,
    children: [
      { label: "Sesiones creadas", path: "/sessions", icon: Video },
      { label: "Biblioteca de Campo", path: "/field-library", icon: BookOpen },
      { label: "Biblioteca de Fuerza", path: "/strength-library", icon: Dumbbell },
    ]
  },
  { label: "Partidos", path: "/matches", icon: Trophy },
  { label: "Mapa táctico", path: "/tactical", icon: Map },
  { label: "Rendimiento", path: "/performance", icon: TrendingUp },
  { label: "Calendario", path: "/schedule", icon: CalendarDays },
  { label: "Cuerpo Técnico", path: "/team", icon: UsersRound },
  { label: "Plan Semanal", path: "/weekly-planner", icon: ClipboardList },
  { label: "Estado del Plantel", path: "/daily-squad", icon: ShieldCheck },
  { label: "Planteles", path: "/squad-manager", icon: Users },
  { label: "Administración", path: "/admin", icon: Settings2 },
];

export default function Sidebar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Auto-expand Sesiones group if any child is active
  const sessionPaths = ["/sessions", "/field-library", "/strength-library"];
  const [sessionsOpen, setSessionsOpen] = useState(sessionPaths.includes(location.pathname));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-zinc-900 text-white p-2 rounded-lg shadow-lg">
        <Menu size={20} />
      </button>

      {open && <div className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setOpen(false)} />}

      <aside className={`fixed top-0 left-0 h-full w-64 bg-zinc-950 border-r border-zinc-800 z-50 transition-transform duration-300 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>

        <div className="p-5 border-b border-zinc-800 flex items-center gap-3">
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight leading-tight">Defensa y Justicia</h1>
            <p className="text-xs mt-0.5" style={{ color: "#F0C800" }}>Cuerpo Técnico</p>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            if (item.children) {
              const isGroupActive = item.children.some(c => location.pathname === c.path);
              return (
                <div key={item.label}>
                  <button
                    onClick={() => setSessionsOpen(p => !p)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isGroupActive ? "text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                    }`}>
                    <item.icon size={18} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {sessionsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {sessionsOpen && (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-zinc-800 pl-3">
                      {item.children.map(child => {
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
              );
            }

            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
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
          })}
        </nav>

        <button onClick={() => setOpen(false)} className="lg:hidden absolute top-4 right-4 text-zinc-500">
          <X size={18} />
        </button>
      </aside>
    </>
  );
}