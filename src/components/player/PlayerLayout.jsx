import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, HeartPulse, Gauge, History, FileText, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const NAV = [
  { to: '/player', label: 'Inicio', icon: Home, end: true },
  { to: '/player/wellness', label: 'Wellness', icon: HeartPulse, end: false },
  { to: '/player/rpe', label: 'RPE', icon: Gauge, end: false },
  { to: '/player/reports', label: 'Informes', icon: FileText, end: false },
  { to: '/player/history', label: 'Mis respuestas', icon: History, end: false },
];

export default function PlayerLayout() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  function handleLogout() {
    logout('/');
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col max-w-md mx-auto w-full">
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-900 border-t border-zinc-800 z-50">
        <div className="flex items-stretch justify-around">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2.5 px-2 flex-1 transition-colors ${
                  isActive ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
                }`
              }
            >
              <item.icon size={20} />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center gap-0.5 py-2.5 px-2 flex-1 text-zinc-500 hover:text-red-400 transition-colors"
          >
            <LogOut size={20} />
            <span className="text-[10px] font-semibold">Salir</span>
          </button>
        </div>
      </nav>
    </div>
  );
}