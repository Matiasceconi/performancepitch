import React from 'react';
import { ShieldX, UserX, Clock, AlertTriangle, RefreshCw, LogOut } from 'lucide-react';

const VARIANTS = {
  'no-staff': {
    icon: ShieldX,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    title: 'No tenés acceso habilitado como staff',
    message: 'Tu cuenta no tiene permisos de cuerpo técnico configurados. Contactá al administrador para que te asigne acceso.',
  },
  'no-player': {
    icon: UserX,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    title: 'No tenés acceso habilitado como jugador',
    message: 'Tu cuenta no está vinculada a un jugador. Pedile al cuerpo técnico que genere tu acceso desde la sección "Accesos de jugadores".',
  },
  'none': {
    icon: Clock,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    title: 'Acceso pendiente de autorización',
    message: 'Tu cuenta todavía no tiene accesos configurados. Contactá al administrador de la plataforma.',
  },
  'error': {
    icon: AlertTriangle,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    title: 'No pudimos verificar tu acceso',
    message: 'Ocurrió un error al consultar tus permisos. Intentá nuevamente.',
  },
  'not-registered': {
    icon: ShieldX,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    title: 'Cuenta no registrada',
    message: 'Tu cuenta no está registrada en esta aplicación. Contactá al administrador para solicitar acceso.',
  },
};

export default function AccessScreen({ variant = 'none', onRetry, onLogout }) {
  const config = VARIANTS[variant] || VARIANTS['none'];
  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-5">
        <div className={`w-14 h-14 rounded-full ${config.bg} border ${config.border} flex items-center justify-center mx-auto`}>
          <Icon size={28} className={config.color} />
        </div>
        <h2 className="text-white font-bold text-lg">{config.title}</h2>
        <p className="text-zinc-400 text-sm leading-relaxed">{config.message}</p>
        <div className="flex flex-col gap-2 pt-3">
          {variant === 'error' && onRetry && (
            <button
              onClick={onRetry}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} /> Reintentar
            </button>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <LogOut size={16} /> Cerrar sesión
            </button>
          )}
        </div>
      </div>
    </div>
  );
}