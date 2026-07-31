import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Search, AlertTriangle } from 'lucide-react';

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
function fmt(d) {
  if (!d) return '';
  const date = new Date(d + 'T12:00:00');
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}`;
}
function movingAvg(arr, key, window = 7) {
  return arr.map((_, i) => {
    const slice = arr.slice(Math.max(0, i - window + 1), i + 1).map((r) => r[key]).filter((v) => v != null);
    return slice.length ? Math.round(slice.reduce((a, b) => a + b, 0) / slice.length * 10) / 10 : null;
  });
}

export default function EvolutionTab({ wellness, sessionPlayers, sessions, players }) {
  const [search, setSearch] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');

  const sortedPlayers = useMemo(() => [...players].sort((a, b) => `${a.last_name}`.localeCompare(b.last_name)), [players]);

  useEffect(() => {
    if (!selectedPlayerId && sortedPlayers.length) setSelectedPlayerId(sortedPlayers[0].id);
  }, [sortedPlayers, selectedPlayerId]);

  const playerWellness = useMemo(() =>
    wellness.filter((w) => w.player_id === selectedPlayerId).sort((a, b) => (a.response_date || '').localeCompare(b.response_date || '')),
    [wellness, selectedPlayerId]);

  const wellnessChart = useMemo(() => {
    const ma = movingAvg(playerWellness, 'wellness_score');
    return playerWellness.map((w, i) => ({ date: fmt(w.response_date), wellness: w.wellness_score, media: ma[i] }));
  }, [playerWellness]);

  const sleepChart = useMemo(() => playerWellness.map((w) => ({ date: fmt(w.response_date), horas: w.sleep_hours })), [playerWellness]);

  const painChart = useMemo(() => playerWellness.map((w) => ({ date: fmt(w.response_date), intensidad: w.has_pain ? w.pain_intensity : 0 })), [playerWellness]);

  const playerRpe = useMemo(() => {
    const sessionMap = {};
    sessions.forEach((s) => { sessionMap[s.id] = s; });
    return sessionPlayers
      .filter((sp) => sp.player_id === selectedPlayerId && sp.rpe != null)
      .map((sp) => {
        const s = sessionMap[sp.session_id];
        return { date: fmt(s?.date), rpe: sp.rpe, internal_load: sp.internal_load, title: s?.title || '' };
      })
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [sessionPlayers, sessions, selectedPlayerId]);

  const rpeChart = useMemo(() => playerRpe.map((r) => ({ date: r.date, rpe: r.rpe, carga: r.internal_load })), [playerRpe]);

  const recentAlerts = useMemo(() => playerWellness.filter((w) => w.alert_level === 'rojo' || w.alert_level === 'amarillo' || w.is_drop).slice(-5).reverse(), [playerWellness]);

  const filteredPlayers = sortedPlayers.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar jugador..." className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
        </div>
        <select value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white min-w-[220px]">
          {filteredPlayers.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
        </select>
      </div>

      {!selectedPlayerId ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">Seleccioná un jugador.</div>
      ) : playerWellness.length === 0 && playerRpe.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">Sin registros para este jugador.</div>
      ) : (
        <>
          {recentAlerts.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 mb-2"><AlertTriangle size={16} className="text-amber-400" /><h3 className="text-sm font-bold text-white">Alertas recientes</h3></div>
              <div className="space-y-1">
                {recentAlerts.map((w) => (
                  <div key={w.id} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300 capitalize">{fmt(w.response_date)}</span>
                    <span className={`text-xs font-semibold ${w.alert_level === 'rojo' ? 'text-red-400' : 'text-yellow-400'}`}>
                      {w.alert_level === 'rojo' ? 'Alerta roja' : 'Alerta amarilla'}{w.is_drop ? ' · Caída' : ''}{w.has_pain ? ` · Dolor ${w.pain_intensity}/10` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-bold text-white mb-3">Evolución del wellness (media móvil 7)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={wellnessChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                  <YAxis domain={[0, 100]} stroke="#71717a" fontSize={10} />
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="wellness" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Wellness" />
                  <Line type="monotone" dataKey="media" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Media 7" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-bold text-white mb-3">Horas de sueño</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={sleepChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                  <YAxis stroke="#71717a" fontSize={10} />
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
                  <ReferenceLine y={7} stroke="#10b981" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="horas" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-bold text-white mb-3">Intensidad de dolor</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={painChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                  <YAxis domain={[0, 10]} stroke="#71717a" fontSize={10} />
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="intensidad" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-bold text-white mb-3">RPE y carga interna por sesión</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={rpeChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                  <YAxis yAxisId="left" domain={[0, 10]} stroke="#71717a" fontSize={10} />
                  <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={10} />
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
                  <Line yAxisId="left" type="monotone" dataKey="rpe" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="RPE" />
                  <Line yAxisId="right" type="monotone" dataKey="carga" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Carga interna" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}