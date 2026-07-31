import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, ArrowLeft, Loader2, User, Lock, Mail, CheckCircle2, AlertTriangle } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";

export default function ActivatePlayer() {
  const [step, setStep] = useState(1); // 1=verify, 2=register, 3=otp, 4=success
  const [username, setUsername] = useState("");
  const [dni, setDni] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activationToken, setActivationToken] = useState("");
  const activationTokenRef = useRef("");

  // Manejar retorno de Google: si hay token en la URL, completar activación
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    const google = urlParams.get("google");
    if (token && google) {
      activationTokenRef.current = token;
      setActivationToken(token);
      // Esperar a que el AuthProvider reconozca la sesión
      const tryComplete = async () => {
        try {
          const res = await base44.functions.invoke("completePlayerActivation", { activation_token: token });
          const result = res.data || res;
          if (result.ok) {
            setStep(4);
            setTimeout(() => { window.location.href = "/login?access=player"; }, 2000);
          } else if (result.error) {
            setError(result.error);
            setStep(1);
          }
        } catch (e) {
          setError("No pudimos completar la activación con Google. Intentá nuevamente.");
          setStep(1);
        }
      };
      // Dar tiempo a que el token se establezca
      setTimeout(tryComplete, 1500);
    }
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await base44.functions.invoke("verifyPlayerActivation", { username, dni });
      const result = res.data || res;
      if (result.error) throw new Error(result.error);
      if (result.already_active) {
        setError(result.error);
      } else {
        activationTokenRef.current = result.activation_token;
        setActivationToken(result.activation_token);
        setStep(2);
      }
    } catch (err) {
      setError(err?.message || "Los datos ingresados no son correctos");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (email !== confirmEmail) { setError("Los emails no coinciden"); return; }
    if (password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres"); return; }
    if (password !== confirmPassword) { setError("Las contraseñas no coinciden"); return; }
    setLoading(true);
    try {
      await base44.auth.register({ email, password });
      setStep(3);
    } catch (err) {
      const msg = String(err?.message || "");
      if (/already|exist|registered|409|conflict/i.test(msg)) {
        setError("Ya existe una cuenta con ese email. Ingresá desde la portada con tus datos.");
      } else {
        setError("No pudimos registrar la cuenta. Intentá nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await base44.auth.verifyOtp({ email, otpCode: otp });
      const accessToken = res.access_token || res.accessToken;
      if (accessToken) base44.auth.setToken(accessToken);
      // Vincular la cuenta con el token de activación
      const linkRes = await base44.functions.invoke("completePlayerActivation", {
        activation_token: activationTokenRef.current,
      });
      const result = linkRes.data || linkRes;
      if (result.error) throw new Error(result.error);
      setStep(4);
      setTimeout(() => { window.location.href = "/player"; }, 2000);
    } catch (err) {
      setError("El código ingresado no es correcto. Verificá e intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleActivate = () => {
    setError("");
    const returnUrl = `${window.location.origin}/activar-jugador?token=${encodeURIComponent(activationTokenRef.current)}&google=true`;
    try {
      base44.auth.loginWithProvider("google", returnUrl);
    } catch (err) {
      setError("No pudimos ingresar con Google. Intentá nuevamente o utilizá email y contraseña.");
    }
  };

  const handleResendOtp = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
    } catch (e) { /* ignore */ }
  };

  return (
    <div className="min-h-screen flex bg-zinc-950">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 bg-zinc-900 border-r border-zinc-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: "radial-gradient(circle at 30% 40%, #10b981 0%, transparent 50%), radial-gradient(circle at 80% 80%, #3b82f6 0%, transparent 40%)"
        }} />
        <div className="relative z-10 text-center max-w-sm">
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-zinc-800 border border-zinc-700 mb-8 mx-auto">
            <Shield size={36} className="text-emerald-400" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-3">
            Performance<span className="text-emerald-400">Pitch</span>
          </h1>
          <p className="text-zinc-400 text-base leading-relaxed">
            Activá tu cuenta de jugador
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <Shield size={22} className="text-emerald-400" />
            <span className="text-lg font-black text-white">Performance<span className="text-emerald-400">Pitch</span></span>
          </div>

          {/* Step 1: Verify identity */}
          {step === 1 && (
            <>
              <h2 className="text-2xl font-bold text-white mb-1">Activar cuenta</h2>
              <p className="text-zinc-500 text-sm mb-8">Verificá tu identidad con tu usuario y DNI</p>

              {error && (
                <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>
              )}

              <form onSubmit={handleVerify} className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-zinc-300 text-xs font-medium">Nombre de usuario</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input
                      type="text"
                      autoFocus
                      placeholder="juan.perez"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-10 h-11 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-emerald-500"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300 text-xs font-medium">DNI</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="Solo números"
                    value={dni}
                    onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
                    className="h-11 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-emerald-500"
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-11 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white" disabled={loading}>
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verificando...</> : "Verificar identidad"}
                </Button>
              </form>

              <div className="mt-6 space-y-3">
                <Link to="/login?access=player" className="block text-center text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                  Ya activé mi cuenta
                </Link>
                <Link to="/" className="flex items-center justify-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors">
                  <ArrowLeft size={14} /> Volver
                </Link>
              </div>
            </>
          )}

          {/* Step 2: Register account */}
          {step === 2 && (
            <>
              <h2 className="text-2xl font-bold text-white mb-1">Crear cuenta</h2>
              <p className="text-zinc-500 text-sm mb-8">Registrá tu email y contraseña</p>

              {error && (
                <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleActivate}
                className="w-full h-11 bg-white hover:bg-zinc-100 text-zinc-900 border-zinc-300 font-semibold flex items-center justify-center gap-2.5 mb-4"
              >
                <GoogleIcon className="w-5 h-5" />
                Continuar con Google
              </Button>

              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-xs text-zinc-500 whitespace-nowrap">o con email y contraseña</span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-zinc-300 text-xs font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-11 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-emerald-500" required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300 text-xs font-medium">Confirmar email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input type="email" placeholder="tu@email.com" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} className="pl-10 h-11 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-emerald-500" required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300 text-xs font-medium">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input type="password" placeholder="Mínimo 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-11 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-emerald-500" required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300 text-xs font-medium">Confirmar contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-11 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-emerald-500" required />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white" disabled={loading}>
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando...</> : "Crear cuenta"}
                </Button>
              </form>

              <button onClick={() => setStep(1)} className="mt-6 flex items-center justify-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors w-full">
                <ArrowLeft size={14} /> Volver
              </button>
            </>
          )}

          {/* Step 3: OTP verification */}
          {step === 3 && (
            <>
              <h2 className="text-2xl font-bold text-white mb-1">Verificar email</h2>
              <p className="text-zinc-500 text-sm mb-8">Te enviamos un código a {email}</p>

              {error && (
                <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>
              )}

              <form onSubmit={handleOtp} className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-zinc-300 text-xs font-medium">Código de verificación</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="h-12 text-center text-lg tracking-widest bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-emerald-500"
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-11 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white" disabled={loading}>
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verificando...</> : "Confirmar código"}
                </Button>
              </form>

              <button onClick={handleResendOtp} className="mt-6 block text-center text-sm text-emerald-400 hover:text-emerald-300 transition-colors w-full">
                Reenviar código
              </button>
            </>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">¡Cuenta activada!</h2>
              <p className="text-zinc-400 text-sm">Tu cuenta fue vinculada correctamente. Te redirigimos al portal del jugador...</p>
              <div className="flex justify-center">
                <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}