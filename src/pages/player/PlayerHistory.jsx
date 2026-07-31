import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { HeartPulse, Gauge } from 'lucide-react';

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function formatDate(d) {
  if (!d) return '';
  const date = new Date(d + 'T12:00:00');
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}/${MONTHS[date.getMonth()]}`;
}
function scoreColor(s) {
  if (s == null) return 'text-zinc-500';
  if (s <= 40) return 'text-red-400';
  if (s <= 60) return 'text-yellow-400';
  return 'text-emerald-400';
}

export default function PlayerHistory() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('wellness');

  const load = useCallback(async () => {
    setLoading(true);
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

  if (loading) return <div className="p-6 flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-4 border-zinc-700 border-t-emerald-400 rounded-full animate-spin" /></div>;
  if (error) return <div className="p-6 space-y-4"><div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">{error}</div><button onClick={load} className="w-full py-3 bg-zinc-800 rounded-xl text-sm font-semibold">Reintentar</button></div>;

  const wellness = data?.recentWellness || [];
  const rpe = data?.answeredRpe || [];

  return (
    <div className="p-5 space-y-4">
      <h1 className="text-lg font-black text-white">Mis respuestas</h1>

      <div className="flex rounded-xl border border-zinc-800 bg-zinc-900 p-1">
        <button onClick={() => setTab('wellness')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${tab === 'wellness' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400'}`}>Wellness</button>
        <button onClick={() => setTab('rpe')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${tab === 'rpe' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400'}`}>RPE</button>
      </div>

      {tab === 'wellness' && (
        <div className="space-y-2">
          {wellness.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
              <HeartPulse size={28} className="mx-auto text-zinc-600 mb-2" />
              <p className="text-zinc-500 text-sm">Todavía no tenés respuestas de wellness.</p>
            </div>
          ) : wellness.map((w) => (
            <div key={w.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white capitalize">{formatDate(w.response_date)}</p>
                <span className={`text-xl font-black ${scoreColor(w.wellness_score)}`}>{w.wellness_score}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400">
                <span>😴 {w.sleep_hours || 0}h</span>
                <span>⚡ {w.energy_level || 0}/5</span>
                <span>💪 {w.muscular_readiness || 0}/5</span>
                <span>😊 {w.mood || 0}/5</span>
                {w.has_pain && <span className="text-amber-400">⚠ Dolor {w.pain_intensity}/10</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'rpe' && (
        <div className="space-y-2">
          {rpe.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
              <Gauge size={28} className="mx-auto text-zinc-600 mb-2" />
              <p className="text-zinc-500 text-sm">Todavía no respondiste RPE de ninguna sesión.</p>
            </div>
          ) : rpe.map((r) => (
            <div key={r.session_player_id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{r.title || 'Sesión'}</p>
                  <p className="text-xs text-zinc-400 capitalize">{formatDate(r.date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-emerald-400">{r.rpe}</p>
                  {r.internal_load != null && <p className="text-xs text-zinc-500">{r.internal_load} UA</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}