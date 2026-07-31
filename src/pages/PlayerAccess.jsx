import React from 'react';
import { UserRound, ShieldAlert } from 'lucide-react';
import { useWorkspace } from '@/lib/WorkspaceContext';
import PlayerAccessManager from '@/components/internalLoad/PlayerAccessManager';

export default function PlayerAccess() {
  const { isAdmin } = useWorkspace();

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <ShieldAlert size={28} className="text-red-400" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-white">No tenés permisos de administrador</h2>
          <p className="text-zinc-500 text-sm max-w-sm">
            Esta página está reservada para administradores. Contactá a un administrador si creés que es un error.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <UserRound size={22} className="text-emerald-400" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Accesos de jugadores</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Gestioná el acceso al portal móvil de cada jugador</p>
        </div>
      </div>
      <PlayerAccessManager />
    </div>
  );
}