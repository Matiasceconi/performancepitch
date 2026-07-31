import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Gauge, Users, Clock, TrendingUp } from 'lucide-react';

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
function fmt(d) {
  if (!d) return '';
  const date = new Date(d + 'T12:00:00');
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}`;
}

export default function RpeBySessionTab({ sessions, sessionPlayers, players }) {
  const [selectedSessionId, setSelectedSessionId] = useState('');

  const sortedSessions = useMemo(() => [...sessions].sort((a, b) => (b.date || '').localeCompare(a.date || '')), [sessions]);

  useEffect(() => {
    if (!selectedSessionId && sortedSessions.length) setSelectedSessionId(sortedSessions[0].id);
  }, [sortedSessions, selectedSessionId]);

  const session = sortedSessions.find((s) => s.id === selectedSessionId);

  const spForSession = useMemo(() => sessionPlayers.filter((sp) => sp.session_id === selectedSessionId), [sessionPlayers, selectedSessionId]);

  const playerMap = useMemo(() => { const m = {}; players.forEach((p) => { m[p.id] = p; }); return m; }, [players]);

  const enriched = useMemo(() => spForSession.map((sp) => {
    const p = playerMap[sp.player_id];
    return {
      ...sp,
      player_name: p ? `${p.first_name} ${p.last_name}` : sp.player_name || '',
      position: p?.position || sp.position || '',
      minutes: Number(sp.minutes) || 0,
      rpe: sp.rpe != null ? Number(sp.rpe) : null,
      internal_load: sp.internal_load != null ? Number(sp.internal_load) : null,
    };
  }), [spForSession, playerMap]);

  const summary = useMemo(() => {
    const participants = enriched.length;
    const responded = enriched.filter((r) => r.rpe != null).length;
    const rpes = enriched.map((r) => r.rpe).filter((r) => r != null);
    const loads = enriched.map((r) => r.internal_load).filter((r) => r != null);
    const avgRpe = rpes.length ? (rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1) : null;
    const avgLoad = loads.length ? Math.round(loads.reduce((a, b) => a + b, 0) / loads.length) : null;
    return {
      participants, responded,
      avgRpe, avgLoad,
      min: rpes.length ? Math.min(...rpes) : null,
      max: rpes.length ? Math.max(...rpes) : null,
      pending: participants - responded,
    };
  }, [enriched]);

  const ranking = useMemo(() => [...enriched].filter((r) => r.rpe != null).sort((a, b) => b.rpe - a.rpe), [enriched]);
  const loadRanking = useMemo(() => [...enriched].filter((r) => r.internal_load != null).sort((a, b) => b.internal_load - a.internal_load), [enriched]);

  const distribution = useMemo(() => {
    const dist = {};
    for (let i = 0; i <= 10; i++) dist[i] = 0;
    enriched.forEach((r) => { if (r.rpe != null) dist[r.rpe] = (dist[r.rpe] || 0) + 1; });
    return Object.entries(dist).map(([k, v]) => ({ rpe: k, count: v }));
  }, [enriched]);

  if (!sessions.length) return <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">No hay sesiones disponibles.</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={selectedSessionId} onChange={(e) => setSelectedSessionId(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white min-w-[280px]">
          {sortedSessions.map((s) => <option key={s.id} value={s.id}>{fmt(s.date)} · {s.title || 'Sesión'} {s.match_day_code ? `(${s.match_day_code})` : ''}</option>)}
        </select>
        {session?.rpe_enabled && <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">RPE habilitado</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3"><p className="text-xs text-zinc-500">Participantes</p><p className="text-2xl font-black text-white mt-1">{summary.participants}</p></div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3"><p className="text-xs text-zinc-500">Respondieron</p><p className="text-2xl font-black text-emerald-400 mt-1">{summary.responded}</p></div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3"><p className="text-xs text-zinc-500">RPE promedio</p><p className="text-2xl font-black text-emerald-400 mt-1">{summary.avgRpe ?? '-'}</p></div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3"><p className="text-xs text-zinc-500">Carga int. prom.</p><p className="text-2xl font-black text-emerald-400 mt-1">{summary.avgLoad ?? '-'}</p></div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3"><p className="text-xs text-zinc-500">Mín / Máx</p><p className="text-2xl font-black text-white mt-1">{summary.min ?? '-'} / {summary.max ?? '-'}</p></div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3"><p className="text-xs text-zinc-500">Pendientes</p><p className="text-2xl font-black text-amber-400 mt-1">{summary.pending}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-3">Distribución del RPE</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="rpe" stroke="#71717a" fontSize={11} />
              <YAxis stroke="#71717a" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-3">Pendientes de RPE</h3>
          {summary.pending === 0 ? <p className="text-zinc-500 text-sm">Todos respondieron.</p> : (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {enriched.filter((r) => r.rpe == null).map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-300">{r.player_name}</span>
                  <span className="text-xs text-amber-400">Pendiente</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase">
            <tr>
              <th className="text-left p-3 font-semibold">Jugador</th>
              <th className="text-left p-3 font-semibold">Pos.</th>
              <th className="text-center p-3 font-semibold">Minutos</th>
              <th className="text-center p-3 font-semibold">RPE</th>
              <th className="text-center p-3 font-semibold">Carga interna</th>
              <th className="text-left p-3 font-semibold">Comentario</th>
              <th className="text-center p-3 font-semibold">Hora</th>
              <th className="text-center p-3 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {enriched.map((r) => (
              <tr key={r.id} className="hover:bg-zinc-900/50">
                <td className="p-3 font-medium text-white">{r.player_name}</td>
                <td className="p-3 text-zinc-400 text-xs">{r.position || '-'}</td>
                <td className="p-3 text-center text-zinc-300">{r.minutes || '-'}</td>
                <td className="p-3 text-center font-bold text-emerald-400">{r.rpe ?? '-'}</td>
                <td className="p-3 text-center text-zinc-300">{r.internal_load != null ? r.internal_load : (r.rpe != null ? <span className="text-amber-400 text-xs">Pend. duración</span> : '-')}</td>
                <td className="p-3 text-zinc-400 text-xs max-w-[200px] truncate">{r.rpe_comment || '-'}</td>
                <td className="p-3 text-center text-zinc-500 text-xs">{r.rpe_updated_at ? new Date(r.rpe_updated_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td className="p-3 text-center">{r.rpe != null ? <span className="text-xs text-emerald-400">Respondido</span> : <span className="text-xs text-amber-400">Pendiente</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}