import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Shield, ArrowLeft, Loader2, CheckCircle2, ClipboardList, Gauge, AlertTriangle, Lock } from 'lucide-react';
import DailyWellnessForm from '@/components/dailyCheckin/DailyWellnessForm';
import DailyRpeForm from '@/components/dailyCheckin/DailyRpeForm';

export default function IngresoJugador() {
  const [step, setStep] = useState('dni'); // 'dni' | 'dashboard' | 'wellness' | 'rpe'
  const [dni, setDni] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [selectedRpe, setSelectedRpe] = useState(null);
  const tokenRef = useRef('');
  const [firstName, setFirstName] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('getDailyCheckinData', { token: tokenRef.current });
      const result = res.data || res;
      if (result.error) {
        if (result.error.includes('expirada') || result.error.includes('otro día')) {
          tokenRef.current = '';
          setStep('dni');
          setError(result.error);
        } else {
          throw new Error(result.error);
        }
        return;
      }
      setData(result);
      setFirstName(result.player_first_name || '');
      setStep('dashboard');
    } catch (e) {
      setError(e?.message || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleDniSubmit(e) {
    e.preventDefault();
    setError('');
    if (dni.length < 4) { setError('Ingresá tu DNI completo'); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('startDailyPlayerCheckin', { dni });
      const result = res.data || res;
      if (result.error) throw new Error(result.error);
      tokenRef.current = result.token;
      setFirstName(result.player_first_name || '');
      await loadDashboard();
    } catch (e) {
      setError(e?.message || 'No pudimos identificarte. Revisá el DNI o comunicate con el cuerpo técnico.');
    } finally {
      setLoading(false);
    }
  }

  function handleWellnessDone() {
    loadDashboard();
  }

  function handleRpeDone() {
    setSelectedRpe(null);
    loadDashboard();
  }

  function handleExpired() {
    tokenRef.current = '';
    setDni('');
    setData(null);
    setStep('dni');
    setError('Tu sesión expiró. Ingresá tu DNI nuevamente.');
  }

  // ── Step: DNI input ─────────────────────────────────────────────────────
  if (step === 'dni') {
    return (
      <div className="min-h-screen flex bg-zinc-950">
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
            <p className="text-zinc-400 text-base leading-relaxed">Ingreso de jugadores</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <div className="flex items-center gap-2 mb-8 lg:hidden">
              <Shield size={22} className="text-emerald-400" />
              <span className="text-lg font-black text-white">Performance<span className="text-emerald-400">Pitch</span></span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-1">Ingreso de jugadores</h2>
            <p className="text-zinc-500 text-sm mb-8">Ingresá tu DNI para responder el Wellness y el RPE del día</p>

            {error && (
              <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>
            )}

            <form onSubmit={handleDniSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-zinc-300 text-xs font-medium">DNI</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  placeholder="Solo números"
                  value={dni}
                  onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-xl px-4 text-white text-lg tracking-wider placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading || !dni}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? <><Loader2 size={18} className="animate-spin" /> Verificando...</> : 'Continuar'}
              </button>
            </form>

            <Link to="/" className="mt-6 flex items-center justify-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft size={14} /> Volver
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading dashboard ───────────────────────────────────────────────────
  if (loading && step === 'dni') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-8 h-8 border-4 border-zinc-700 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  // ── Step: Wellness form ─────────────────────────────────────────────────
  if (step === 'wellness') {
    return (
      <div className="min-h-screen bg-zinc-950 max-w-md mx-auto">
        <DailyWellnessForm
          token={tokenRef.current}
          onDone={handleWellnessDone}
          onExpired={handleExpired}
          onBack={() => setStep('dashboard')}
        />
      </div>
    );
  }

  // ── Step: RPE form ──────────────────────────────────────────────────────
  if (step === 'rpe' && selectedRpe) {
    return (
      <div className="min-h-screen bg-zinc-950 max-w-md mx-auto">
        <DailyRpeForm
          token={tokenRef.current}
          session={selectedRpe}
          onDone={handleRpeDone}
          onExpired={handleExpired}
          onBack={() => { setSelectedRpe(null); setStep('dashboard'); }}
        />
      </div>
    );
  }

  // Auto-navegar al formulario de RPE si el Wellness está completo y hay una sola sesión
  useEffect(() => {
    const wellnessDone = data?.wellness?.status === 'completed';
    const rpeSessions = data?.rpe_sessions || [];
    if (step === 'dashboard' && wellnessDone && rpeSessions.length === 1 && !selectedRpe) {
      setSelectedRpe(rpeSessions[0]);
      setStep('rpe');
    }
  }, [step, data, selectedRpe]);

  // ── Step: Dashboard ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-8 h-8 border-4 border-zinc-700 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  const wellnessDone = data?.wellness?.status === 'completed';
  const rpeSessions = data?.rpe_sessions || [];
  const rpePending = rpeSessions.length > 0;

  return (
    <div className="min-h-screen bg-zinc-950 max-w-md mx-auto p-5 space-y-6">
      {/* Greeting */}
      <div className="pt-4">
        <h1 className="text-2xl font-black text-white">Hola, {firstName}</h1>
        <p className="text-zinc-500 text-sm mt-1">Estas son tus tareas de hoy</p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>
      )}

      {/* Wellness card */}
      <button
        onClick={() => !wellnessDone && setStep('wellness')}
        disabled={wellnessDone}
        className={`w-full text-left p-5 rounded-2xl border transition-all ${
          wellnessDone
            ? 'bg-emerald-500/5 border-emerald-500/20 cursor-default'
            : 'bg-zinc-900 border-zinc-800 hover:border-emerald-500/40 active:scale-[0.98]'
        }`}
      >
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            wellnessDone ? 'bg-emerald-500/15' : 'bg-emerald-500/10'
          }`}>
            {wellnessDone ? <CheckCircle2 size={24} className="text-emerald-400" /> : <ClipboardList size={24} className="text-emerald-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white">Wellness de hoy</h3>
            <p className="text-sm text-zinc-500 mt-0.5">
              {wellnessDone ? 'Completado ✓' : 'Pendiente · Tocá para responder'}
            </p>
          </div>
        </div>
      </button>

      {/* RPE cards */}
      {rpePending ? (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wide">RPE de hoy</h2>
          {rpeSessions.map((s) => {
            const blocked = !wellnessDone;
            return (
              <div
                key={s.session_id}
                className={`w-full p-5 rounded-2xl border transition-all ${
                  blocked
                    ? 'bg-zinc-900 border-zinc-800 opacity-80'
                    : 'bg-zinc-900 border-zinc-800 hover:border-emerald-500/40 active:scale-[0.98] cursor-pointer'
                }`}
                onClick={() => { if (!blocked) { setSelectedRpe(s); setStep('rpe'); } }}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    blocked ? 'bg-zinc-800' : 'bg-blue-500/10'
                  }`}>
                    {blocked ? <Lock size={22} className="text-zinc-500" /> : <Gauge size={24} className="text-blue-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white">{s.title || 'Sesión'}</h3>
                    {blocked ? (
                      <>
                        <p className="text-sm text-amber-400 mt-0.5">Primero completá tu Wellness de hoy para poder responder el RPE.</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); setStep('wellness'); }}
                          className="mt-2 px-4 py-2 rounded-lg bg-emerald-500 text-zinc-950 text-sm font-bold hover:bg-emerald-400 transition-colors"
                        >
                          Completar Wellness
                        </button>
                      </>
                    ) : (
                      <p className="text-sm text-zinc-500 mt-0.5">
                        {s.match_day_code ? `${s.match_day_code} · ` : ''}Tocá para responder
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
              <Gauge size={24} className="text-zinc-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white">RPE de hoy</h3>
              <p className="text-sm text-zinc-500 mt-0.5">No tenés una sesión con RPE para responder hoy.</p>
            </div>
          </div>
        </div>
      )}

      {/* All done badge */}
      {wellnessDone && !rpePending && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-3">
            <CheckCircle2 size={32} className="text-emerald-400" />
          </div>
          <h2 className="text-lg font-bold text-white">¡Todo al día!</h2>
          <p className="text-zinc-500 text-sm mt-1">Completaste tus respuestas de hoy.</p>
        </div>
      )}

      {/* Logout */}
      <button
        onClick={() => { tokenRef.current = ''; setDni(''); setData(null); setStep('dni'); }}
        className="w-full py-3 rounded-xl bg-zinc-800 text-zinc-400 text-sm font-semibold hover:bg-zinc-700 transition-colors"
      >
        Cerrar sesión
      </button>
    </div>
  );
}