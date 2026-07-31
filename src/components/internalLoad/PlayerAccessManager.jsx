import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useWorkspace } from '@/lib/WorkspaceContext';
import { UserPlus, Send, Power, Mail, CheckCircle2, XCircle, Search } from 'lucide-react';

export default function PlayerAccessManager() {
  const { activeSquadId, activeSquadName } = useWorkspace();
  const [players, setPlayers] = useState([]);
  const [accesses, setAccesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalPlayer, setModalPlayer] = useState(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!activeSquadId) { setPlayers([]); setAccesses([]); setLoading(false); return; }
    setLoading(true);
    try {
      const [playerRows, accessRes] = await Promise.all([
        base44.entities.Player.filter({ squad_id: activeSquadId, active: { $ne: false } }, "last_name", 500),
        base44.functions.invoke('managePlayerAccess', { action: 'list', squad_id: activeSquadId }),
      ]);
      setPlayers(playerRows);
      setAccesses((accessRes.data || accessRes).accesses || []);
    } catch (e) {
      setError(e?.message || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [activeSquadId]);

  useEffect(() => { load(); }, [load]);

  const accessByPlayer = {};
  accesses.forEach((a) => { accessByPlayer[a.player_id] = a; });

  const filtered = players.filter((p) => {
    const name = `${p.first_name} ${p.last_name}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  async function handleInvite() {
    if (!modalPlayer || !email) return;
    setBusy(true);
    setError('');
    try {
      const res = await base44.functions.invoke('managePlayerAccess', { action: 'invite', player_id: modalPlayer.id, email });
      const result = res.data || res;
      if (result.error) throw new Error(result.error);
      setModalPlayer(null);
      setEmail('');
      load();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function handleAction(playerId, action) {
    setBusy(true);
    setError('');
    try {
      const res = await base44.functions.invoke('managePlayerAccess', { action, player_id: playerId });
      const result = res.data || res;
      if (result.error) throw new Error(result.error);
      load();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-zinc-700 border-t-emerald-400 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Accesos de jugadores</h2>
          <p className="text-sm text-zinc-500">Vinculá cada jugador con su cuenta para el portal móvil</p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar jugador..." className="pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white w-56 focus:outline-none focus:border-emerald-500" />
        </div>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm">{error}</div>}

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase">
            <tr>
              <th className="text-left p-3 font-semibold">Jugador</th>
              <th className="text-left p-3 font-semibold">Posición</th>
              <th className="text-left p-3 font-semibold">Email vinculado</th>
              <th className="text-left p-3 font-semibold">Estado</th>
              <th className="text-left p-3 font-semibold">Último ingreso</th>
              <th className="text-right p-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filtered.map((p) => {
              const acc = accessByPlayer[p.id];
              return (
                <tr key={p.id} className="hover:bg-zinc-900/50">
                  <td className="p-3 font-medium text-white">{p.first_name} {p.last_name}</td>
                  <td className="p-3 text-zinc-400">{p.position || '-'}</td>
                  <td className="p-3 text-zinc-300">{acc?.user_email || '-'}</td>
                  <td className="p-3">
                    {acc ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${acc.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-700/40 text-zinc-400'}`}>
                        {acc.active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {acc.active ? 'Activo' : 'Inactivo'}
                      </span>
                    ) : <span className="text-xs text-zinc-600">Sin acceso</span>}
                  </td>
                  <td className="p-3 text-zinc-400 text-xs">{acc?.last_access_at ? new Date(acc.last_access_at).toLocaleDateString('es-AR') : '-'}</td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {!acc && <button onClick={() => { setModalPlayer(p); setEmail(''); }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20"><UserPlus size={13} /> Invitar</button>}
                      {acc && acc.active && <button onClick={() => handleAction(p.id, 'resend')} disabled={busy} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700"><Send size={13} /> Reenviar</button>}
                      {acc && <button onClick={() => handleAction(p.id, 'toggle')} disabled={busy} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${acc.active ? 'bg-red-500/10 text-red-300 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'}`}><Power size={13} /> {acc.active ? 'Desactivar' : 'Activar'}</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal invitar */}
      {modalPlayer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setModalPlayer(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Mail size={18} className="text-emerald-400" />
              <h3 className="font-bold text-white">Invitar a {modalPlayer.first_name} {modalPlayer.last_name}</h3>
            </div>
            <p className="text-sm text-zinc-400">Ingresá el email del jugador. Se le enviará una invitación para acceder al portal desde su celular.</p>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@ejemplo.com" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-emerald-500" />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setModalPlayer(null)} className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-semibold">Cancelar</button>
              <button onClick={handleInvite} disabled={busy || !email} className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 text-sm font-bold disabled:opacity-50">Enviar invitación</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}