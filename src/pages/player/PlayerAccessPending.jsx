import React from 'react';
import { base44 } from '@/api/base44Client';

export default function PlayerAccessPending() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center mx-auto">
          <span className="text-yellow-400 text-2xl">⏳</span>
        </div>
        <h2 className="text-white font-bold text-lg">Acceso pendiente</h2>
        <p className="text-zinc-400 text-sm">
          Tu cuenta todavía no está vinculada a un jugador. Pedile al cuerpo técnico que genere tu acceso desde la sección "Accesos de jugadores".
        </p>
        <button
          onClick={() => base44.auth.logout(window.location.origin)}
          className="w-full px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-xl transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}