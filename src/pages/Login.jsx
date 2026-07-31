import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, Shield, ArrowLeft } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const access = urlParams.get('access') || 'staff';
  const isPlayer = access === 'player';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      // Recargar para que AuthProvider se reinicialice con el nuevo token.
      // PostLoginRedirect se encarga de redirigir según los permisos reales.
      window.location.href = `/login?access=${access}`;
    } catch (err) {
      setError("Email o contraseña incorrectos. Verificá tus datos e intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-zinc-950">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 bg-zinc-900 border-r border-zinc-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: "radial-gradient(circle at 30% 40%, #3b82f6 0%, transparent 50%), radial-gradient(circle at 80% 80%, #10b981 0%, transparent 40%)"
        }} />
        <div className="relative z-10 text-center max-w-sm">
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-zinc-800 border border-zinc-700 mb-8 mx-auto">
            <Shield size={36} className="text-blue-400" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-3">
            Performance<span className="text-blue-400">Pitch</span>
          </h1>
          <p className="text-zinc-400 text-base leading-relaxed">
            Plataforma integral para la gestión y el rendimiento deportivo
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <Shield size={22} className="text-blue-400" />
            <span className="text-lg font-black text-white">Performance<span className="text-blue-400">Pitch</span></span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">
            {isPlayer ? "Ingreso de jugadores" : "Ingreso del staff"}
          </h2>
          <p className="text-zinc-500 text-sm mb-8">
            {isPlayer ? "Ingresá con tu cuenta de jugador" : "Ingresá con tu cuenta del cuerpo técnico"}
          </p>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs font-medium">Email</Label>
              <Input
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-blue-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-zinc-300 text-xs font-medium">Contraseña</Label>
                <Link to="/forgot-password" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  Olvidé mi contraseña
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Ingresando...</>
              ) : (
                "Ingresar"
              )}
            </Button>
          </form>

          <Link
            to="/"
            className="mt-6 flex items-center justify-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> Volver
          </Link>
        </div>
      </div>
    </div>
  );
}