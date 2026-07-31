import React from 'react';
import { UserRound } from 'lucide-react';
import PlayerAccessManager from '@/components/internalLoad/PlayerAccessManager';

export default function PlayerAccess() {
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