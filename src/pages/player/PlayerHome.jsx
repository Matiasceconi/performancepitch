import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { HeartPulse, Gauge, CheckCircle2, AlertTriangle, Calendar } from 'lucide-react';

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function formatDate(d) {
  const date = new Date(d + 'T12:00:00');
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]}`;
}

function scoreColor(score) {
  if (score == null) return 'text-zinc-500';
  if (score <= 40) return 'text-red-400';
  if (score <= 60) return 'text-yellow-400';
  return 'text-emerald-400';
}

export default function PlayerHome() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('getPlayerPortalData', {});
      setData(res.data || res);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'No se pudieron cargar tus datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-6 flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-4 border-zinc-700 border-t-emerald-400 rounded-full animate-spin" /></div>;
  if (error) return <div className="p-6 space-y-4"><div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">{error}</div><button onClick={load} className="w-full py-3 bg-zinc-800 rounded-xl text-sm font-semibold">Reintentar</button></div>;

  const player = data?.player;
  const todayWellness = data?.todayWellness;
  const pendingRpe = data?.pendingRpe || [];
  const lastResponse = data?.lastResponse;

  return (
    <div className="p-5 space-y-5">
      {/* Saludo */}
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center shrink-0">
          {player?.photo_url ? <img src={player.photo_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xl font-bold text-zinc-400">{(player?.first_name || '?')[0]}</span>}
        </div>
        <div>
          <h1 className="text-xl font-black text-white leading-tight">Hola, {player?.first_name || 'Jugador'}</h1>
          <p className="text-sm text-zinc-400 capitalize flex items-center gap-1.5"><Calendar size={13} />{formatDate(data?.today)}</p>
        </div>
      </div>

      {/* Wellness de hoy */}
      <div className={`rounded-2xl border p-5 ${todayWellness ? 'border-zinc-800 bg-zinc-900' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <HeartPulse size={18} className="text-emerald-400" />
            <h2 className="font-bold text-white">Wellness de hoy</h2>
          </div>
          {todayWellness && <span className={`text-2xl font-black ${scoreColor(todayWellness.wellness_score)}`}>{todayWellness.wellness_score}</span>}
        </div>
        {todayWellness ? (
          <div className="space-y-1.5 text-sm">
            <p className="text-zinc-300">Ya respondiste tu wellness de hoy.</p>
            {todayWellness.has_pain && <p className="text-amber-400 flex items-center gap-1.5"><AlertTriangle size={14} /> Reportaste dolor: {todayWellness.pain_zone || 'sin zona'} ({todayWellness.pain_intensity}/10)</p>}
            <Link to="/player/wellness" className="block mt-3 text-center py-2.5 rounded-xl bg-zinc-800 text-zinc-200 text-sm font-semibold hover:bg-zinc-700 transition-colors">Corregir respuesta</Link>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-zinc-300 text-sm">Todavía no respondiste hoy.</p>
            <Link to="/player/wellness" className="block text-center py-3.5 rounded-xl bg-emerald-500 text-zinc-950 text-sm font-black hover:bg-emerald-400 transition-colors">Responder Wellness</Link>
          </div>
        )}
      </div>

      {/* RPE pendientes */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Gauge size={18} className="text-emerald-400" />
          <h2 className="font-bold text-white">RPE pendientes</h2>
          {pendingRpe.length > 0 && <span className="ml-auto px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">{pendingRpe.length}</span>}
        </div>
        {pendingRpe.length === 0 ? (
          <p className="text-zinc-500 text-sm flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-500" /> No tenés RPE pendientes.</p>
        ) : (
          <div className="space-y-2">
            {pendingRpe.slice(0, 5).map((r) => (
              <Link key={r.session_id} to={`/player/rpe/${r.session_id}`} className="block p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white text-sm">{r.title || 'Sesión'}</p>
                    <p className="text-xs text-zinc-400 capitalize">{formatDate(r.date)} {r.match_day_code ? `· ${r.match_day_code}` : ''}</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-400">Responder →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Última respuesta */}
      {lastResponse && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-bold text-white mb-2 text-sm">Última respuesta</h2>
          <p className="text-xs text-zinc-400 capitalize">{formatDate(lastResponse.response_date)}</p>
          <p className="text-lg font-black mt-1"><span className={scoreColor(lastResponse.wellness_score)}>{lastResponse.wellness_score}</span> <span className="text-sm text-zinc-500 font-normal">/ 100</span></p>
        </div>
      )}
    </div>
  );
}