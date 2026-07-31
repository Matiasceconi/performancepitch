import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, User, Users } from 'lucide-react';

export default function PublicHome() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-10">
        {/* Logo + nombre */}
        <div className="space-y-5">
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-zinc-800 border border-zinc-700 mx-auto">
            <Shield size={36} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight">
              Performance<span className="text-blue-400">Pitch</span>
            </h1>
            <p className="text-zinc-400 text-base mt-3 leading-relaxed">
              Plataforma integral para la gestión y el rendimiento deportivo
            </p>
          </div>
        </div>

        {/* Botones */}
        <div className="space-y-3">
          <Link
            to="/login?access=player"
            className="flex items-center justify-center gap-3 w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
          >
            <User size={20} />
            Ingresar como jugador
          </Link>
          <Link
            to="/login?access=staff"
            className="flex items-center justify-center gap-3 w-full h-14 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
          >
            <Users size={20} />
            Ingresar como staff
          </Link>
        </div>
      </div>
    </div>
  );
}