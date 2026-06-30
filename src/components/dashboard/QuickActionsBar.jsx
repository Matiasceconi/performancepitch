import React from "react";
import { Link } from "react-router-dom";
import { Users, Dumbbell, Shield, Calendar } from "lucide-react";

const ACTIONS = [
  { to: "/daily-squad", label: "Estado del plantel", icon: Users },
  { to: "/sessions", label: "Sesiones", icon: Dumbbell },
  { to: "/matches", label: "Partidos", icon: Shield },
  { to: "/schedule", label: "Cronograma", icon: Calendar },
];

export default function QuickActionsBar() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-white mb-3">Acciones rápidas</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {ACTIONS.map(a => (
          <Link key={a.to} to={a.to}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 text-zinc-300 hover:text-white text-sm font-medium transition-colors">
            <a.icon size={15} />
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}