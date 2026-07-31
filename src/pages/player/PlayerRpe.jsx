import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, Check, Gauge } from 'lucide-react';

const RPE_LABELS = {
  0: 'Reposo', 1: 'Muy, muy suave', 2: 'Suave', 3: 'Moderado', 4: 'Algo exigente',
  5: 'Exigente', 6: 'Bastante exigente', 7: 'Muy exigente', 8: 'Muy, muy exigente', 9: 'Casi máximo', 10: 'Máximo',
};

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function formatDate(d) {
  if (!d) return '';
  const date = new Date(d + 'T12:00:00');
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]}`;
}

export default function PlayerRpe() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rpe, setRpe] = useState(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('getPlayerPortalData', {});
      setData(res.data || res);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pending = data?.pendingRpe || [];
  const target = sessionId ? pending.find((r) => r.session_id === sessionId) : null;

  async function submit() {
    if (rpe == null) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await base44.functions.invoke('submitPlayerRpe', { session_id: sessionId, rpe, comment });
      const result = res.data || res;
      if (result.error) throw new Error(result.error);
      setDone(result);
      setTimeout(() => navigate('/player'), 1800);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'No se pudo guardar');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-6 flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-4 border-zinc-700 border-t-emerald-400 rounded-full animate-spin" /></div>;
  if (error && !data) return <div className="p-6 space-y-4"><div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">{error}</div><button onClick={load} className="w-full py-3 bg-zinc-800 rounded-xl text-sm font-semibold">Reintentar</button></div>;

  // Success screen
  if (done) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[70vh] text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
          <Check size={32} className="text-emerald-400" />
        </div>
        <h2 className="text-xl font-black text-white">¡RPE enviado!</h2>
        {done.internal_load != null ? (
          <p className="text-zinc-400 text-sm">Carga interna: <span className="font-bold text-emerald-400">{done.internal_load}</span> UA</p>
        ) : (
          <p className="text-zinc-400 text-sm">Carga interna pendiente de duración de la sesión.</p>
        )}
      </div>
    );
  }

  // List view (no sessionId)
  if (!sessionId) {
    return (
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Gauge size={20} className="text-emerald-400" />
          <h1 className="text-lg font-black text-white">RPE pendientes</h1>
        </div>
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <Check size={32} className="mx-auto text-emerald-500 mb-2" />
            <p className="text-zinc-400 text-sm">No tenés RPE pendientes.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((r) => (
              <Link key={r.session_id} to={`/player/rpe/${r.session_id}`} className="block p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/40 transition-colors">
                <p className="font-bold text-white">{r.title || 'Sesión'}</p>
                <p className="text-xs text-zinc-400 capitalize mt-0.5">{formatDate(r.date)} {r.match_day_code ? `· ${r.match_day_code}` : ''}</p>
                {r.session_type && <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-semibold">{r.session_type}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Form view (sessionId)
  if (!target) {
    return (
      <div className="p-5 space-y-4">
        <button onClick={() => navigate('/player/rpe')} className="flex items-center gap-1 text-zinc-400 text-sm"><ChevronLeft size={18} /> Volver</button>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <p className="text-amber-300 text-sm">Esta sesión ya no está pendiente o no te corresponde.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5 min-h-screen flex flex-col">
      <button onClick={() => navigate('/player/rpe')} className="flex items-center gap-1 text-zinc-400 text-sm self-start"><ChevronLeft size={18} /> Volver</button>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <h1 className="text-lg font-black text-white">{target.title || 'Sesión'}</h1>
        <p className="text-sm text-zinc-400 capitalize">{formatDate(target.date)} {target.match_day_code ? `· ${target.match_day_code}` : ''}</p>
      </div>

      <div className="space-y-3">
        <p className="text-xl font-bold text-white">¿Qué tan exigente fue la sesión?</p>
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <button key={n} onClick={() => setRpe(n)} className={`aspect-square rounded-xl font-black text-xl transition-all ${rpe === n ? 'bg-emerald-500 text-zinc-950 scale-105' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>{n}</button>
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