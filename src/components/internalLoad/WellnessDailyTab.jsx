import React, { useState, useMemo } from 'react';
import { Search, AlertTriangle, Heart } from 'lucide-react';

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d + 'T12:00:00');
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}`;
}
function scoreColor(s) {
  if (s == null) return 'text-zinc-500';
  if (s <= 40) return 'text-red-400';
  if (s <= 60) return 'text-yellow-400';
  return 'text-emerald-400';
}
function alertBadge(level) {
  if (level === 'rojo') return 'bg-red-500/20 text-red-300 border-red-500/30';
  if (level === 'amarillo') return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
  return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
}

export default function WellnessDailyTab({ wellness, players, date, onDateChange }) {
  const [search, setSearch] = useState('');
  const [filterAlert, setFilterAlert] = useState('Todos');

  const playerMap = useMemo(() => {
    const m = {};
    players.forEach((p) => { m[p.id] = p; });
    return m;
  }, [players]);

  const byPlayerToday = useMemo(() => {
    const m = {};
    wellness.filter((w) => w.response_date === date).forEach((w) => { m[w.player_id] = w; });
    return m;
  }, [wellness, date]);

  const rows = useMemo(() => {
    return players
      .map((p) => ({ player: p, w: byPlayerToday[p.id] }))
      .filter(({ player }) => `${player.first_name} ${player.last_name}`.toLowerCase().includes(search.toLowerCase()))
      .filter(({ w }) => filterAlert === 'Todos' || (w && w.alert_level === filterAlert));
  }, [players, byPlayerToday, search, filterAlert]);

  const summary = useMemo(() => {
    const active = players.length;
    const responded = players.filter((p) => byPlayerToday[p.id]).length;
    const scores = players.map((p) => byPlayerToday[p.id]?.wellness_score).filter((s) => s != null);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const red = players.filter((p) => byPlayerToday[p.id]?.alert_level === 'rojo').length;
    const yellow = players.filter((p) => byPlayerToday[p.id]?.alert_level === 'amarillo').length;
    const pain = players.filter((p) => byPlayerToday[p.id]?.has_pain).length;
    return { active, responded, pct: active ? Math.round((responded / active) * 100) : 0, avg, red, yellow, pain };
  }, [players, byPlayerToday]);

  const cards = [
    { label: 'Activos', value: summary.active, color: 'text-white' },
    { label: 'Respondieron', value: summary.responded, color: 'text-emerald-400' },
    { label: 'Respuesta', value: `${summary.pct}%`, color: 'text-emerald-400' },
    { label: 'Wellness prom.', value: summary.avg ?? '-', color: scoreColor(summary.avg) },
    { label: 'Alertas rojas', value: summary.red, color: 'text-red-400' },
    { label: 'Alertas amar.', value: summary.yellow, color: 'text-yellow-400' },
    { label: 'Con dolor', value: summary.pain, color: 'text-amber-400' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <p className="text-xs text-zinc-500">{c.label}</p>
            <p className={`text-2xl font-black mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white" />
        <select value={filterAlert} onChange={(e) => setFilterAlert(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white">
          <option value="Todos">Todas las alertas</option>
          <option value="rojo">Roja</option>
          <option value="amarillo">Amarilla</option>
          <option value="verde">Verde</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar jugador..." className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase">
            <tr>
              <th className="text-left p-3 font-semibold">Jugador</th>
              <th className="text-left p-3 font-semibold">Pos.</th>
              <th className="text-center p-3 font-semibold">Sueño (h)</th>
              <th className="text-center p-3 font-semibold">Cal. sueño</th>
              <th className="text-center p-3 font-semibold">Energía</th>
              <th className="text-center p-3 font-semibold">Muscular</th>
              <th className="text-center p-3 font-semibold">Ánimo</th>
              <th className="text-center p-3 font-semibold">Tranq.</th>
              <th className="text-center p-3 font-semibold">Dolor</th>
              <th className="text-center p-3 font-semibold">Wellness</th>
              <th className="text-center p-3 font-semibold">Hora</th>
              <th className="text-center p-3 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {rows.map(({ player, w }) => (
              <tr key={player.id} className="hover:bg-zinc-900/50">
                <td className="p-3 font-medium text-white">{player.first_name} {player.last_name}</td>
                <td className="p-3 text-zinc-400 text-xs">{player.position || '-'}</td>
                <td className="p-3 text-center text-zinc-300">{w?.sleep_hours ?? '-'}</td>
                <td className="p-3 text-center text-zinc-300">{w?.sleep_quality ?? '-'}</td>
                <td className="p-3 text-center text-zinc-300">{w?.energy_level ?? '-'}</td>
                <td className="p-3 text-center text-zinc-300">{w?.muscular_readiness ?? '-'}</td>
                <td className="p-3 text-center text-zinc-300">{w?.mood ?? '-'}</td>
                <td className="p-3 text-center text-zinc-300">{w?.calmness ?? '-'}</td>
                <td className="p-3 text-center">{w?.has_pain ? <span className="text-amber-400 font-semibold">{w.pain_intensity}/10</span> : <span className="text-zinc-600">-</span>}</td>
                <td className={`p-3 text-center font-black ${scoreColor(w?.wellness_score)}`}>{w?.wellness_score ?? '-'}</td>
                <td className="p-3 text-center text-zinc-500 text-xs">{w?.updated_at ? new Date(w.updated_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td className="p-3 text-center">
                  {w ? <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${alertBadge(w.alert_level)}`}>{w.alert_level === 'rojo' ? 'Roja' : w.alert_level === 'amarillo' ? 'Amar.' : 'Verde'}</span>
                    : <span className="text-xs text-zinc-600">Pendiente</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}