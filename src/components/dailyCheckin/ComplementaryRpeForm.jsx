import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Loader2, CheckCircle2, Dumbbell } from 'lucide-react';

const RPE_LABELS = {
  0: 'Reposo', 1: 'Muy suave', 2: 'Suave', 3: 'Moderado', 4: 'Algo exigente',
  5: 'Exigente', 6: 'Bastante exigente', 7: 'Muy exigente', 8: 'Muy, muy exigente', 9: 'Casi máximo', 10: 'Máximo',
};

function rpeClasses(n) {
  if (n <= 2) return 'bg-emerald-500 text-zinc-950 border-emerald-400';
  if (n <= 4) return 'bg-emerald-400 text-zinc-950 border-emerald-300';
  if (n <= 6) return 'bg-yellow-500 text-zinc-950 border-yellow-400';
  if (n <= 8) return 'bg-orange-500 text-zinc-950 border-orange-400';
  return 'bg-red-500 text-white border-red-400';
}

export default function ComplementaryRpeForm({ token, execution, onDone, onBack }) {
  const [rpe, setRpe] = useState(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e?.preventDefault();
    if (rpe == null) { setError('Seleccioná un valor de 0 a 10'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('submitComplementaryRpe', { token, execution_id: execution.id, rpe, comment });
      const result = res.data || res;
      if (result.error) throw new Error(result.error);
      setDone(true);
      setTimeout(() => onDone(result.execution), 900);
    } catch (err) {
      setError(err?.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle2 size={40} className="text-emerald-400" />
          </div>
          <h2 className="text-xl font-black text-white">¡Entrenamiento completado!</h2>
          <p className="text-zinc-500 text-sm">Tu RPE complementario fue guardado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 max-w-md mx-auto p-5 space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
        <ArrowLeft size={16} /> Volver al entrenamiento
      </button>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <Dumbbell size={18} className="text-blue-400" />
          <h1 className="text-xl font-black text-white">RPE del entrenamiento complementario</h1>
        </div>
        <p className="text-zinc-500 text-sm">Esfuerzo percibido del trabajo complementario (0 a 10). Este RPE es independiente del de la sesión principal.</p>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>}

      <div>
        <p className="text-zinc-300 text-sm font-medium mb-3">¿Cómo percibiste el esfuerzo?</p>
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <button key={n} onClick={() => setRpe(n)} className={`aspect-square rounded-xl font-black text-lg border-2 transition-all ${rpe === n ? `${rpeClasses(n)} scale-105` : 'bg-zinc-800 text-zinc-300 border-transparent hover:bg-zinc-700'}`}>{n}</button>
          ))}
        </div>
        {rpe != null && (
          <p className="text-center text-sm text-zinc-400 mt-3">{RPE_LABELS[rpe]}</p>
        )}
      </div>

      <div>
        <label className="text-zinc-300 text-sm font-medium block mb-2">Comentario (opcional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 1000))}
          rows={3}
          placeholder="Algo que quieras comentarle al PF..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-blue-500"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || rpe == null}
        className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? <><Loader2 size={18} className="animate-spin" /> Guardando...</> : 'Enviar RPE'}
      </button>
    </div>
  );
}