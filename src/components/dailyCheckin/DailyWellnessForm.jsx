import React, { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, Check } from 'lucide-react';

const SCALE_LABELS = { 1: 'Muy mal', 2: 'Mal', 3: 'Normal', 4: 'Bien', 5: 'Muy bien' };
const PAIN_ZONES = ['Cuello', 'Hombro', 'Espalda alta', 'Espalda baja', 'Cadera', 'Isquiotibial', 'Cuádriceps', 'Gemelo', 'Tobillo', 'Rodilla', 'Pie', 'Otro'];

const STEPS = [
  { key: 'sleep_hours', type: 'hours', label: '¿Cuántas horas dormiste?', subtitle: 'Horas de sueño' },
  { key: 'sleep_quality', type: 'scale15', label: '¿Cómo fue la calidad de tu sueño?', subtitle: 'Pregunta 2 de 10' },
  { key: 'energy_level', type: 'scale15', label: '¿Con cuánta energía te sentís?', subtitle: 'Pregunta 3 de 10' },
  { key: 'muscular_readiness', type: 'scale15', label: '¿Cómo sentís muscularmente el cuerpo?', subtitle: 'Pregunta 4 de 10' },
  { key: 'mood', type: 'scale15', label: '¿Cómo está tu estado de ánimo?', subtitle: 'Pregunta 5 de 10' },
  { key: 'calmness', type: 'scale15', label: '¿Qué tan tranquilo te sentís?', subtitle: 'Pregunta 6 de 10' },
  { key: 'has_pain', type: 'yesno', label: '¿Tenés algún dolor o molestia?', subtitle: 'Pregunta 7 de 10' },
];

export default function DailyWellnessForm({ token, onDone, onExpired, onBack }) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({
    sleep_hours: 0, sleep_quality: 0, energy_level: 0, muscular_readiness: 0, mood: 0, calmness: 0,
    has_pain: false, pain_zone: '', pain_intensity: 0, comment: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const totalSteps = STEPS.length + 3;
  const set = useCallback((k, v) => setValues((p) => ({ ...p, [k]: v })), []);

  function next() { setStep((s) => Math.min(s + 1, totalSteps - 1)); }
  function back() { setStep((s) => Math.max(s - 1, 0)); }

  function canProceed() {
    const s = STEPS[step];
    if (!s) return true;
    if (s.type === 'hours') return values.sleep_hours > 0;
    if (s.type === 'scale15') return values[s.key] > 0;
    return true;
  }

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const res = await base44.functions.invoke('submitDailyWellness', { token, ...values });
      const result = res.data || res;
      if (result.error) {
        if (result.error.includes('expirada') || result.error.includes('otro día')) { onExpired(); return; }
        throw new Error(result.error);
      }
      setDone(true);
      setTimeout(() => onDone(), 1500);
    } catch (e) {
      setError(e?.message || 'No se pudo guardar');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[70vh] text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
          <Check size={32} className="text-emerald-400" />
        </div>
        <h2 className="text-xl font-black text-white">¡Respuesta enviada!</h2>
        <p className="text-zinc-400 text-sm">Gracias por registrar tu wellness.</p>
      </div>
    );
  }

  const current = STEPS[step];
  const progress = Math.round(((step + 1) / totalSteps) * 100);

  return (
    <div className="p-5 space-y-4 min-h-screen flex flex-col">
      <div className="flex items-center gap-3">
        {onBack && <button onClick={onBack} className="p-2 -ml-2 text-zinc-400 hover:text-white"><ChevronLeft size={22} /></button>}
        <h1 className="text-lg font-black text-white">Wellness</h1>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} /></div>

      <div className="flex-1 flex flex-col">
        {current?.type === 'hours' && (
          <div className="space-y-4">
            <div>
              <p className="text-xl font-bold text-white">{current.label}</p>
              <p className="text-sm text-zinc-500 mt-1">{current.subtitle}</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[3, 4, 5, 6, 7, 8, 9, 10].map((h) => (
                <button key={h} onClick={() => set('sleep_hours', h)} className={`py-4 rounded-xl text-lg font-black transition-all ${values.sleep_hours === h ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>{h}h</button>
              ))}
            </div>
          </div>
        )}

        {current?.type === 'scale15' && (
          <div className="space-y-4">
            <div>
              <p className="text-xl font-bold text-white">{current.label}</p>
              <p className="text-sm text-zinc-500 mt-1">{current.subtitle}</p>
            </div>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((n) => (
                <button key={n} onClick={() => set(current.key, n)} className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${values[current.key] === n ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'}`}>
                  <span className="w-9 h-9 rounded-full bg-zinc-950/30 flex items-center justify-center font-black text-lg shrink-0">{n}</span>
                  <span className="font-bold">{SCALE_LABELS[n]}</span>
                  {values[current.key] === n && <Check size={20} className="ml-auto" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {current?.type === 'yesno' && (
          <div className="space-y-4">
            <div>
              <p className="text-xl font-bold text-white">{current.label}</p>
              <p className="text-sm text-zinc-500 mt-1">{current.subtitle}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { set('has_pain', false); set('pain_intensity', 0); set('pain_zone', ''); next(); }} className={`py-6 rounded-xl font-black text-lg transition-all ${!values.has_pain ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300'}`}>No</button>
              <button onClick={() => { set('has_pain', true); next(); }} className={`py-6 rounded-xl font-black text-lg transition-all ${values.has_pain ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300'}`}>Sí</button>
            </div>
          </div>
        )}

        {step === STEPS.length && values.has_pain && (
          <div className="space-y-4">
            <p className="text-xl font-bold text-white">¿Dónde sentís el dolor?</p>
            <div className="grid grid-cols-2 gap-2">
              {PAIN_ZONES.map((z) => (
                <button key={z} onClick={() => set('pain_zone', z)} className={`py-3 px-3 rounded-xl text-sm font-semibold transition-all ${values.pain_zone === z ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'}`}>{z}</button>
              ))}
            </div>
          </div>
        )}

        {step === STEPS.length + 1 && values.has_pain && (
          <div className="space-y-4">
            <p className="text-xl font-bold text-white">¿Qué tan intenso es el dolor?</p>
            <p className="text-sm text-zinc-500">De 0 a 10</p>
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                <button key={n} onClick={() => set('pain_intensity', n)} className={`aspect-square rounded-xl font-black text-lg transition-all ${values.pain_intensity === n ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>{n}</button>
              ))}
            </div>
          </div>
        )}

        {step === totalSteps - 1 && (
          <div className="space-y-4">
            <p className="text-xl font-bold text-white">¿Querés agregar un comentario?</p>
            <p className="text-sm text-zinc-500">Opcional</p>
            <textarea value={values.comment} onChange={(e) => set('comment', e.target.value)} placeholder="Escribí acá..." rows={4} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white text-sm resize-none focus:outline-none focus:border-emerald-500" />
          </div>
        )}
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm">{error}</div>}

      <div className="pt-2">
        {step < totalSteps - 1 ? (
          <button onClick={next} disabled={!canProceed()} className="w-full py-4 rounded-xl bg-emerald-500 text-zinc-950 font-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-400 transition-colors">Continuar</button>
        ) : (
          <button onClick={submit} disabled={submitting} className="w-full py-4 rounded-xl bg-emerald-500 text-zinc-950 font-black disabled:opacity-50 hover:bg-emerald-400 transition-colors">{submitting ? 'Enviando...' : 'Enviar respuesta'}</button>
        )}
      </div>
    </div>
  );
}