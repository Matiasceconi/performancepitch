import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, Check } from 'lucide-react';

const RPE_LABELS = {
  0: 'Reposo', 1: 'Muy, muy suave', 2: 'Suave', 3: 'Moderado', 4: 'Algo exigente',
  5: 'Exigente', 6: 'Bastante exigente', 7: 'Muy exigente', 8: 'Muy, muy exigente', 9: 'Casi máximo', 10: 'Máximo',
};

function rpeClasses(n) {
  if (n <= 2) return 'bg-emerald-500 text-zinc-950 border-emerald-400';
  if (n <= 4) return 'bg-emerald-400 text-zinc-950 border-emerald-300';
  if (n <= 6) return 'bg-yellow-500 text-zinc-950 border-yellow-400';
  if (n <= 8) return 'bg-orange-500 text-zinc-950 border-orange-400';
  return 'bg-red-500 text-white border-red-400';
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function formatDate(d) {
  if (!d) return '';
  const date = new Date(d + 'T12:00:00');
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]}`;
}

export default function DailyRpeForm({ token, session, onDone, onExpired, onBack }) {
  const [rpe, setRpe] = useState(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  async function submit() {
    if (rpe == null) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await base44.functions.invoke('submitDailyPlayerRpe', { token, session_id: session.session_id, rpe, comment });
      const result = res.data || res;
      if (result.error) {
        if (result.error.includes('expirada') || result.error.includes('otro día')) { onExpired(); return; }
        throw new Error(result.error);
      }
      setDone(result);
      setTimeout(() => onDone(), 1800);
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
        <h2 className="text-xl font-black text-white">¡RPE completado!</h2>
        {done.internal_load != null ? (
          <p className="text-zinc-400 text-sm">Carga interna: <span className="font-bold text-emerald-400">{done.internal_load}</span> UA</p>
        ) : (
          <p className="text-zinc-400 text-sm">Carga interna pendiente de duración de la sesión.</p>
        )}
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5 min-h-screen flex flex-col">
      <button onClick={onBack} className="flex items-center gap-1 text-zinc-400 text-sm self-start"><ChevronLeft size={18} /> Volver</button>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <h1 className="text-lg font-black text-white">{session.title || 'Sesión'}</h1>
        <p className="text-sm text-zinc-400 capitalize">{formatDate(session.date)} {session.match_day_code ? `· ${session.match_day_code}` : ''}</p>
      </div>

      <div className="space-y-3">
        <p className="text-xl font-bold text-white">¿Qué tan exigente fue la sesión?</p>
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <button key={n} onClick={() => setRpe(n)} className={`aspect-square rounded-xl font-black text-xl border-2 transition-all ${rpe === n ? `${rpeClasses(n)} scale-105` : 'bg-zinc-800 text-zinc-300 border-transparent hover:bg-zinc-700'}`}>{n}</button>
          ))}
        </div>
        {rpe != null && <p className="text-center text-sm font-semibold text-emerald-400">{RPE_LABELS[rpe]}</p>}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-zinc-300">Comentario (opcional)</p>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Escribí acá..." rows={3} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white text-sm resize-none focus:outline-none focus:border-emerald-500" />
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm">{error}</div>}

      <div className="mt-auto pt-2">
        <button onClick={submit} disabled={rpe == null || submitting} className="w-full py-4 rounded-xl bg-emerald-500 text-zinc-950 font-black disabled:opacity-40 hover:bg-emerald-400 transition-colors">{submitting ? 'Enviando...' : 'Enviar RPE'}</button>
      </div>
    </div>
  );
}