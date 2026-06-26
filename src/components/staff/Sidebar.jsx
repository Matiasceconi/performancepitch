import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Video, FileSpreadsheet, Users, LayoutDashboard, Menu, X, Map, TrendingUp, UsersRound, CalendarDays, Trophy } from "lucide-react";
import { useState } from "react";

const navItems = [
{ label: "Dashboard", path: "/", icon: LayoutDashboard },
{ label: "Sesiones", path: "/sessions", icon: Video },
{ label: "Partidos", path: "/matches", icon: Trophy },
{ label: "Plantel", path: "/squad", icon: Users },
{ label: "Mapa táctico", path: "/tactical", icon: Map },
{ label: "Rendimiento", path: "/performance", icon: TrendingUp },
{ label: "Calendario", path: "/schedule", icon: CalendarDays },
{ label: "Cuerpo Técnico", path: "/team", icon: UsersRound }];


export default function Sidebar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-zinc-900 text-white p-2 rounded-lg shadow-lg">
        
        <Menu size={20} />
      </button>

      {open &&
      <div className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setOpen(false)} />
      }

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-zinc-950 border-r border-zinc-800 z-50 transition-transform duration-300 lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"}`
        }>
        
        <div className="p-5 border-b border-zinc-800 flex items-center gap-3">
          


          
          
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight leading-tight">Defensa y Justicia</h1>
            <p className="text-xs mt-0.5" style={{ color: "#F0C800" }}>Cuerpo Técnico</p>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive ?
                "text-zinc-900 font-semibold" :
                "text-zinc-400 hover:text-white hover:bg-zinc-800/60"}`
                }
                style={isActive ? { backgroundColor: "#F0C800", color: "#1a1a1a" } : {}}>
                
                <item.icon size={18} />
                {item.label}
              </Link>);

          })}
        </nav>

        <button
          onClick={() => setOpen(false)}
          className="lg:hidden absolute top-4 right-4 text-zinc-500">
          
          <X size={18} />
        </button>
      </aside>
    </>);

}