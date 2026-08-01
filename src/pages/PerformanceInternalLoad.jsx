import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useWorkspace } from '@/lib/WorkspaceContext';
import { HeartPulse } from 'lucide-react';
import WellnessDailyTab from '@/components/internalLoad/WellnessDailyTab';
import RpeBySessionTab from '@/components/internalLoad/RpeBySessionTab';
import EvolutionTab from '@/components/internalLoad/EvolutionTab';
import PlayerAccessManager from '@/components/internalLoad/PlayerAccessManager';

const TABS = [
  { id: 'wellness', label: 'Wellness diario' },
  { id: 'rpe', label: 'RPE por sesión' },
  { id: 'evolution', label: 'Evolución' },
  { id: 'access', label: 'Accesos de jugadores' },
];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function PerformanceInternalLoad() {
  const { activeSquadId, activeSquadName, activeSeasonId } = useWorkspace();
  const [tab, setTab] = useState('wellness');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [date, setDate] = useState(todayISO());

  const load = useCallback(async () => {
    if (!activeSquadId) { setData(null); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('getInternalLoadData', {
        squad_id: activeSquadId,
        season_id: activeSeasonId || '',
        target_date: date,
      });
      setData(res.data || res);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [activeSquadId, activeSeasonId, date]);

  useEffect(() => { load(); }, [load]);

  // Suscripción para actualización en tiempo real cuando un jugador responde
  useEffect(() => {
    const unsubW = base44.entities.WellnessResponse.subscribe(() => { load(); });
    const unsubSP = base44.entities.SessionPlayer.subscribe(() => { load(); });
    return () => { unsubW(); unsubSP(); };
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <HeartPulse size={22} className="text-emerald-400" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Carga Interna</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Wellness y RPE del plantel · {activeSquadName || 'Sin plantel'}</p>
        </div>
      </div>

      <div className="flex overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/70 p-1.5">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === t.id ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400 hover:text-white'}`}>{t.label}</button>
        ))}
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-zinc-700 border-t-emerald-400 rounded-full animate-spin" /></div>
      ) : !activeSquadId ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">Seleccioná un plantel para ver la carga interna.</div>
      ) : (
        <>
          {tab === 'wellness' && <WellnessDailyTab wellness={data?.wellness || []} players={data?.roster?.length ? data.roster : (data?.players || [])} date={date} onDateChange={setDate} />}
          {tab === 'rpe' && <RpeBySessionTab sessions={data?.sessions || []} sessionPlayers={data?.sessionPlayers || []} players={data?.players || []} />}
          {tab === 'evolution' && <EvolutionTab wellness={data?.wellness || []} sessionPlayers={data?.sessionPlayers || []} sessions={data?.sessions || []} players={data?.players || []} />}
          {tab === 'access' && <PlayerAccessManager />}
        </>
      )}
    </div>
  );
}