import React, { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Shield, ArrowLeft, Loader2 } from 'lucide-react';
import DailyWellnessForm from '@/components/dailyCheckin/DailyWellnessForm';
import DailyRpeForm from '@/components/dailyCheckin/DailyRpeForm';
import PlayerHomeView from '@/components/dailyCheckin/PlayerHomeView';
import ComplementaryWorkoutView from '@/components/dailyCheckin/ComplementaryWorkoutView';
import ComplementaryRpeForm from '@/components/dailyCheckin/ComplementaryRpeForm';
import ComplementaryNotDoneForm from '@/components/dailyCheckin/ComplementaryNotDoneForm';
import PlayerReportsView from '@/components/dailyCheckin/PlayerReportsView';

export default function IngresoJugador() {
  const [step, setStep] = useState('dni'); // dni | home | wellness | rpe | strength_view | strength_rpe | strength_not_done | reports
  const [dni, setDni] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [homeData, setHomeData] = useState(null);
  const [selectedRpe, setSelectedRpe] = useState(null);
  const [selectedStrength, setSelectedStrength] = useState(null);
  const [strengthExec, setStrengthExec] = useState(null);
  const tokenRef = useRef('');
  const [firstName, setFirstName] = useState('');

  const loadHome = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('getPlayerDailyHome', { token: tokenRef.current });
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
      setHomeData(result);
      setFirstName(result.player_first_name || '');
      setStep('home');
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
      await loadHome();
    } catch (e) {
      setError(e?.message || 'No pudimos identificarte. Revisá el DNI o comunicate con el cuerpo técnico.');
    } finally {
      setLoading(false);
    }
  }

  function handleExpired() {
    tokenRef.current = '';
    setDni('');
    setHomeData(null);
    setStep('dni');
    setError('Tu sesión expiró. Ingresá tu DNI nuevamente.');
  }

  function logout() {
    tokenRef.current = '';
    setDni('');
    setHomeData(null);
    setStep('dni');
    setError('');
  }

  // ── Step: DNI input ─────────────────────────────────────────────────────
  if (step === 'dni') {
    return (
      <div className="min-h-screen flex bg-zinc-950">
        <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 bg-zinc-900 border-r border-zinc-800 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(circle at 30% 40%, #10b981 0%, transparent 50%), radial-gradient(circle at 80% 80%, #3b82f6 0%, transparent 40%)" }} />
          <div className="relative z-10 text-center max-w-sm">
            <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-zinc-800 border border-zinc-700 mb-8 mx-auto"><Shield size={36} className="text-emerald-400" /></div>
            <h1 className="text-4xl font-black text-white tracking-tight mb-3">Performance<span className="text-emerald-400">Pitch</span></h1>
            <p className="text-zinc-400 text-base leading-relaxed">Ingreso de jugadores</p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <div className="flex items-center gap-2 mb-8 lg:hidden"><Shield size={22} className="text-emerald-400" /><span className="text-lg font-black text-white">Performance<span className="text-emerald-400">Pitch</span></span></div>
            <h2 className="text-2xl font-bold text-white mb-1">Ingreso de jugadores</h2>
            <p className="text-zinc-500 text-sm mb-8">Ingresá tu DNI para ver tu cronograma, controles diarios y entrenamientos</p>
            {error && <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>}
            <form onSubmit={handleDniSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-zinc-300 text-xs font-medium">DNI</label>
                <input type="text" inputMode="numeric" autoFocus placeholder="Solo números" value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 10))} className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-xl px-4 text-white text-lg tracking-wider placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500" required />
              </div>
              <button type="submit" disabled={loading || !dni} className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">{loading ? <><Loader2 size={18} className="animate-spin" /> Verificando...</> : 'Continuar'}</button>
            </form>
            <Link to="/" className="mt-6 flex items-center justify-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"><ArrowLeft size={14} /> Volver</Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading && step === 'dni') {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950"><div className="w-8 h-8 border-4 border-zinc-700 border-t-emerald-400 rounded-full animate-spin" /></div>;
  }

  // ── Step: Wellness ───────────────────────────────────────────────────────
  if (step === 'wellness') {
    return (
      <div className="min-h-screen bg-zinc-950 max-w-md mx-auto">
        <DailyWellnessForm token={tokenRef.current} onDone={loadHome} onExpired={handleExpired} onBack={() => setStep('home')} />
      </div>
    );
  }

  // ── Step: RPE principal ─────────────────────────────────────────────────
  if (step === 'rpe' && selectedRpe) {
    return (
      <div className="min-h-screen bg-zinc-950 max-w-md mx-auto">
        <DailyRpeForm token={tokenRef.current} session={selectedRpe} onDone={() => { setSelectedRpe(null); loadHome(); }} onExpired={handleExpired} onBack={() => { setSelectedRpe(null); setStep('home'); }} />
      </div>
    );
  }

  // ── Step: Fuerza complementaria - vista de entrenamiento ────────────────
  if (step === 'strength_view' && selectedStrength) {
    return (
      <ComplementaryWorkoutView
        token={tokenRef.current}
        workoutCard={selectedStrength}
        onStarted={(exec) => { setStrengthExec(exec); loadHome(); }}
        onFinished={(exec) => { setStrengthExec(exec); loadHome(); }}
        onRpe={(exec) => { setStrengthExec(exec); setStep('strength_rpe'); }}
        onNotDone={(card) => { setSelectedStrength(card); setStep('strength_not_done'); }}
        onBack={() => { setSelectedStrength(null); setStep('home'); }}
      />
    );
  }

  // ── Step: RPE complementario ────────────────────────────────────────────
  if (step === 'strength_rpe' && strengthExec) {
    return (
      <ComplementaryRpeForm
        token={tokenRef.current}
        execution={strengthExec}
        onDone={() => { setStrengthExec(null); setSelectedStrength(null); loadHome(); }}
        onBack={() => { setStep('strength_view'); }}
      />
    );
  }

  // ── Step: No realizado ──────────────────────────────────────────────────
  if (step === 'strength_not_done') {
    return (
      <ComplementaryNotDoneForm
        token={tokenRef.current}
        execution={strengthExec}
        workout={selectedStrength}
        onDone={() => { setStrengthExec(null); setSelectedStrength(null); loadHome(); }}
        onBack={() => { setStrengthExec(null); setStep('strength_view'); }}
      />
    );
  }

  // ── Step: Reports ───────────────────────────────────────────────────────
  if (step === 'reports') {
    return (
      <div className="min-h-screen bg-zinc-950">
        <PlayerReportsView token={tokenRef.current} onBack={() => setStep('home')} />
      </div>
    );
  }

  // ── Step: Home ──────────────────────────────────────────────────────────
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950"><div className="w-8 h-8 border-4 border-zinc-700 border-t-emerald-400 rounded-full animate-spin" /></div>;
  }

  return (
    <>
      {error && step === 'home' && <div className="max-w-md mx-auto p-4"><div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div></div>}
      <PlayerHomeView
        data={homeData}
        onOpenWellness={() => setStep('wellness')}
        onOpenRpe={(s) => { setSelectedRpe(s); setStep('rpe'); }}
        onOpenStrength={(c) => { setSelectedStrength(c); setStrengthExec(c.execution_id ? { id: c.execution_id, status: c.status, rpe: c.rpe } : null); setStep('strength_view'); }}
        onOpenReport={() => setStep('reports')}
        onLogout={logout}
      />
    </>
  );
}