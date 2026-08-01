import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';

const REASONS = [
  { value: 'dolor_molestia', label: 'Dolor o molestia' },
  { value: 'indicacion_medica', label: 'Indicación médica o de kinesiología' },
  { value: 'decision_cuerpo_tecnico', label: 'Decisión del cuerpo técnico' },
  { value: 'falta_tiempo', label: 'Falta de tiempo' },
  { value: 'no_asistio', label: 'No asistí' },
  { value: 'sin_equipamiento', label: 'No tenía equipamiento' },
  { value: 'otro', label: 'Otro' },
];

export default function ComplementaryNotDoneForm({ token, execution, workout, onDone, onBack }) {
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  const isOtro = reason === 'otro';
  const canSubmit = reason && (!isOtro || comment.trim());

  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('reportComplementaryNotDone', {
        token,
        execution_id: execution?.id || '',
        workout_id: workout?.workout_id || workout?.id || '',
        reason,
        comment,
      });
      const result = res.data || res;
      if (result.error) throw new Error(result.error);
      onDone(result.execution);
    } catch (err) {
      setError(err?.message || 'Error al registrar');
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 max-w-md mx-auto p-5 space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
        <ArrowLeft size={16} /> Volver
      </button>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={18} className="text-amber-400" />
          <h1 className="text-xl font-black text-white">No pude realizarlo</h1>
        </div>
        <p className="text-zinc-500 text-sm">Contanos por qué no pudiste hacer este entrenamiento complementario.</p>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>}

      <div className="space-y-2">
        {REASONS.map((r) => (
          <button
            key={r.value}
            onClick={() => setReason(r.value)}
            className={`w-full text-left p-3.5 rounded-xl border transition-all ${reason === r.value ? 'bg-amber-500/10 border-amber-500/40 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {isOtro && (
        <div>
          <label className="text-zinc-300 text-sm font-medium block mb-2">Comentario (obligatorio)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 1000))}
            rows={3}
            placeholder="Explicá brevemente..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-amber-500"
          />
        </div>
      )}

      <button
        onClick={() => setConfirming(true)}
        disabled={!canSubmit}
        className="w-full h-12 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold disabled:opacity-50"
      >
        Confirmar
      </button>

      {confirming && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50" onClick={() => setConfirming(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg">¿Confirmar que no lo realizaste?</h3>
            <p className="text-zinc-400 text-sm">No se te pedirá RPE. Quedará registrado como "No realizado".</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirming(false)} className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 font-semibold">Cancelar</button>
              <button onClick={handleSubmit} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white font-bold flex items-center justify-center gap-2">
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Sí, confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}