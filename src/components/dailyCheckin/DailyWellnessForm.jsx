import React, { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, Check } from 'lucide-react';

const PAIN_ZONES = ['Cuello', 'Hombro', 'Espalda alta', 'Espalda baja', 'Cadera', 'Isquiotibial', 'Cuádriceps', 'Gemelo', 'Tobillo', 'Rodilla', 'Pie', 'Otro'];

const SLEEP_OPTIONS = [3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
function formatHours(h) {
  const int = Math.floor(h);
  const dec = h - int;
  return dec === 0 ? `${int} h` : `${int} h 30 min`;
}

function scaleClasses(n) {
  if (n <= 3) return 'bg-emerald-500 text-zinc-950 border-emerald-400';
  if (n <= 6) return 'bg-yellow-500 text-zinc-950 border-yellow-400';
  if (n <= 8) return 'bg-orange-500 text-zinc-950 border-orange-400';
  return 'bg-red-500 text-white border-red-400';
}

const SUBJECTIVE_STEPS = [
  { key: 'fatigue', label: '¿Qué nivel de fatiga sentís hoy?', low: 'Totalmente descansado', high: 'Extremadamente fatigado' },
  { key: 'muscular_soreness', label: '¿Qué nivel de cansancio o pesadez muscular tenés?', low: 'Músculos completamente recuperados', high: 'Muchísima pesadez o cansancio muscular' },
  { key: 'sleep_lack', label: '¿Qué nivel de falta de descanso sentís hoy?', low: 'Dormí y descansé muy bien', high: 'Dormí muy mal y no me recuperé' },
  { key: 'stress', label: '¿Qué nivel de estrés sentís hoy?', low: 'Muy tranquilo', high: 'Extremadamente estresado' },
  { key: 'mood_low', label: '¿Qué nivel de malestar o ánimo bajo sentís hoy?', low: 'Muy buen ánimo', high: 'Muy mal ánimo' },
];

export default function DailyWellnessForm({ token, onDone, onExpired, onBack }) {
  const [values, setValues] = useState({
    sleep_hours: 0, fatigue: 0, muscular_soreness: 0, sleep_lack: 0, stress: 0, mood_low: 0,
    has_pain: false, pain_zone: '', pain_intensity: 0, comment: '',
  });
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const set = useCallback((k, v) => setValues((p) => ({ ...p, [k]: v })), []);

  // Lista plana de pasos según si hay dolor o no
  const steps = [
    { type: 'sleep' },
    ...SUBJECTIVE_STEPS.map((s) => ({ type: 'scale', ...s })),
    { type: 'pain_yesno' },
    ...(values.has_pain ? [{ type: 'pain_zone' }, { type: 'pain_intensity' }] : []),
    { type: 'comment' },
  ];
  const total = steps.length;
  const current = steps[step];

  function next() { setStep((s) => Math.min(s + 1, total - 1)); }
  function back() { setStep((s) => Math.max(s - 1, 0)); }

  function canProceed() {
    if (!current) return true;
    if (current.type === 'sleep') return values.sleep_hours > 0;
    if (current.type === 'scale') return values[current.key] > 0;
    if (current.type === 'pain_zone') return !!values.pain_zone;
    if (current.type === 'pain_intensity') return values.pain_intensity > 0;
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
      setTimeout(() => onDone(), 1600);
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
        <h2 className="text-xl font-black text-white">¡Wellness completado!</h2>
        <p className="text-zinc-400 text-sm">Tu respuesta fue registrada correctamente.</p>
      </div>
    );
  }

  const progress = Math.round(((step + 1) / total) * 100);
  const isLast = step === total - 1;

  return (
    <div className="p-5 space-y-4 min-h-screen flex flex-col">
      <div className="flex items-center gap-3">
        {onBack && <button onClick={onBack} className="p-2 -ml-2 text-zinc-400 hover:text-white"><ChevronLeft size={22} /></button>}
        <h1 className="text-lg font-black text-white">Wellness</h1>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} /></div>

      <div className="flex-1 flex flex-col">
        {/* Horas de sueño */}
        {current?.type === 'sleep' && (
          <div className="space-y-4">
            <div>
              <p className="text-xl font-bold text-white">{current.label || '¿Cuántas horas dormiste?'}</p>
              <p className="text-sm text-zinc-500 mt-1">Pregunta {step + 1} de {total}</p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {SLEEP_OPTIONS.map((h) => (
                <button key={h} onClick={() => set('sleep_hours', h)} className={`py-4 rounded-xl text-base font-black transition-all ${values.sleep_hours === h ? 'bg-emerald-500 text-zinc-950 border-2 border-emerald-400' : 'bg-zinc-800 text-zinc-300 border-2 border-transparent hover:bg-zinc-700'}`}>{formatHours(h)}</button>
              ))}
            </div>
          </div>
        )}

        {/* Escala 1-10 subjetiva */}
        {current?.type === 'scale' && (
          <div className="space-y-4">
            <div>
              <p className="text-xl font-bold text-white">{current.label}</p>
              <p className="text-sm text-zinc-500 mt-1">Pregunta {step + 1} de {total} · 1 = mejor estado, 10 = peor estado</p>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const selected = values[current.key] === n;
                return (
                  <button key={n} onClick={() => set(current.key, n)} className={`aspect-square rounded-xl font-black text-lg border-2 transition-all ${selected ? `${scaleClasses(n)} scale-105` : 'bg-zinc-800 text-zinc-300 border-transparent hover:bg-zinc-700'}`}>{n}</button>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-zinc-500 pt-1">
              <span className="text-emerald-400/80">1 · {current.low}</span>
              <span className="text-red-400/80">{current.high} · 10</span>
            </div>
          </div>
        )}

        {/* Dolor Sí/No */}
        {current?.type === 'pain_yesno' && (
          <div className="space-y-4">
            <div>
              <p className="text-xl font-bold text-white">¿Tenés algún dolor o molestia?</p>
              <p className="text-sm text-zinc-500 mt-1">Pregunta {step + 1} de {total}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { set('has_pain', false); set('pain_intensity', 0); set('pain_zone', ''); next(); }} className={`py-6 rounded-xl font-black text-lg border-2 transition-all ${!values.has_pain ? 'bg-emerald-500 text-zinc-950 border-emerald-400' : 'bg-zinc-800 text-zinc-300 border-transparent'}`}>No</button>
              <button onClick={() => { set('has_pain', true); next(); }} className={`py-6 rounded-xl font-black text-lg border-2 transition-all ${values.has_pain ? 'bg-amber-500 text-zinc-950 border-amber-400' : 'bg-zinc-800 text-zinc-300 border-transparent'}`}>Sí</button>
            </div>
          </div>
        )}

        {/* Zona del dolor */}
        {current?.type === 'pain_zone' && (
          <div className="space-y-4">
            <div>
              <p className="text-xl font-bold text-white">¿Dónde sentís el dolor?</p>
              <p className="text-sm text-zinc-500 mt-1">Pregunta {step + 1} de {total}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PAIN_ZONES.map((z) => (
                <button key={z} onClick={() => set('pain_zone', z)} className={`py-3 px-3 rounded-xl text-sm font-semibold border-2 transition-all ${values.pain_zone === z ? 'bg-amber-500 text-zinc-950 border-amber-400' : 'bg-zinc-800 text-zinc-200 border-transparent hover:bg-zinc-700'}`}>{z}</button>
              ))}
            </div>
          </div>
        )}

        {/* Intensidad del dolor */}
        {current?.type === 'pain_intensity' && (
          <div className="space-y-4">
            <div>
              <p className="text-xl font-bold text-white">¿Qué tan intenso es el dolor?</p>
              <p className="text-sm text-zinc-500 mt-1">Pregunta {step + 1} de {total} · 1 = molestia mínima, 10 = dolor máximo</p>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const selected = values.pain_intensity === n;
                return (
                  <button key={n} onClick={() => set('pain_intensity', n)} className={`aspect-square rounded-xl font-black text-lg border-2 transition-all ${selected ? `${scaleClasses(n)} scale-105` : 'bg-zinc-800 text-zinc-300 border-transparent hover:bg-zinc-700'}`}>{n}</button>
                );
              })}
            </div>
          </div>
        )}

        {/* Comentario */}
        {current?.type === 'comment' && (
          <div className="space-y-4">
            <p className="text-xl font-bold text-white">¿Querés agregar un comentario?</p>
            <p className="text-sm text-zinc-500">Opcional · Pregunta {step + 1} de {total}</p>
            <textarea value={values.comment} onChange={(e) => set('comment', e.target.value)} placeholder="Escribí acá..." rows={4} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white text-sm resize-none focus:outline-none focus:border-emerald-500" />
          </div>
        )}
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm">{error}</div>}

      <div className="pt-2 flex gap-2">
        {step > 0 && (
          <button onClick={back} className="px-4 py-4 rounded-xl bg-zinc-800 text-zinc-300 font-bold hover:bg-zinc-700 transition-colors"><ChevronLeft size={20} /></button>
        )}
        {!isLast ? (
          <button onClick={next} disabled={!canProceed()} className="flex-1 py-4 rounded-xl bg-emerald-500 text-zinc-950 font-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-400 transition-colors">Continuar</button>
        ) : (
          <button onClick={submit} disabled={submitting} className="flex-1 py-4 rounded-xl bg-emerald-500 text-zinc-950 font-black disabled:opacity-50 hover:bg-emerald-400 transition-colors">{submitting ? 'Enviando...' : 'Enviar respuesta'}</button>
        )}
      </div>
    </div>
  );
}