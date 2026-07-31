import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useWorkspace } from '@/lib/WorkspaceContext';
import {
  UserPlus, Search, RefreshCw, Copy, CheckCircle2, XCircle, AlertTriangle,
  Lock, Unlock, RotateCcw, Mail, Edit3, Loader2, Shield, User, KeyRound, Power
} from 'lucide-react';

const STATUS_LABELS = {
  missing_document: { label: 'Falta DNI', color: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  ready_to_activate: { label: 'Listo para activar', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  activation_pending: { label: 'Activación pendiente', color: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' },
  access_active: { label: 'Acceso activo', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  access_blocked: { label: 'Bloqueado', color: 'bg-red-500/15 text-red-300 border-red-500/30' },
  access_disabled: { label: 'Desactivado', color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
  link_error: { label: 'Error de vinculación', color: 'bg-red-500/15 text-red-300 border-red-500/30' },
};

function maskDni(dni) {
  const clean = String(dni || '').replace(/\D/g, '');
  if (!clean) return '';
  if (clean.length <= 3) return '•'.repeat(clean.length);
  return '•'.repeat(Math.min(clean.length - 3, 6)) + clean.slice(-3);
}

export default function PlayerAccessManager() {
  const { activeSquadId } = useWorkspace();
  const [players, setPlayers] = useState([]);
  const [accesses, setAccesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showMissingDniOnly, setShowMissingDniOnly] = useState(false);
  const [reviewResult, setReviewResult] = useState(null);
  const [modal, setModal] = useState(null); // { type: 'dni' | 'email', player, access }
  const [modalValue, setModalValue] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const load = useCallback(async () => {
    if (!activeSquadId) { setPlayers([]); setAccesses([]); setLoading(false); return; }
    setLoading(true);
    setError('');
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

  const playerById = {};
  players.forEach(p => { playerById[p.id] = p; });

  const accessByPlayer = {};
  accesses.forEach(a => { accessByPlayer[a.player_id] = a; });

  // Combinar jugadores + accesos
  const rows = players.map(p => {
    const acc = accessByPlayer[p.id];
    return {
      player: p,
      access: acc,
      hasDni: !!String(p.dni || '').replace(/\D/g, ''),
      username: acc?.username || '',
      status: acc?.status || (String(p.dni || '').replace(/\D/g, '') ? 'ready_to_activate' : 'missing_document'),
      email: acc?.user_email || '',
      lastLogin: acc?.last_login_at || acc?.last_access_at || '',
    };
  });

  const stats = {
    total: rows.length,
    active: rows.filter(r => r.status === 'access_active').length,
    pending: rows.filter(r => r.status === 'activation_pending' || r.status === 'ready_to_activate').length,
    missingDni: rows.filter(r => !r.hasDni).length,
    blocked: rows.filter(r => r.status === 'access_blocked').length,
  };

  const filtered = rows.filter(r => {
    const name = `${r.player.first_name} ${r.player.last_name}`.toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || r.username.includes(search.toLowerCase());
    const matchFilter = !showMissingDniOnly || !r.hasDni;
    return matchSearch && matchFilter;
  });

  async function handleReview(dryRun) {
    setBusy(true);
    setError('');
    try {
      const res = await base44.functions.invoke('reviewPlayerAccess', { action: dryRun ? 'dry_run' : 'execute', squad_id: activeSquadId });
      setReviewResult(res.data || res);
      if (!dryRun) load();
    } catch (e) {
      setError(e?.message || 'Error al revisar');
    } finally {
      setBusy(false);
    }
  }

  async function handleAction(playerId, action, extra = {}) {
    setBusy(true);
    setError('');
    try {
      const res = await base44.functions.invoke('managePlayerAccess', { action, player_id: playerId, ...extra });
      const result = res.data || res;
      if (result.error) throw new Error(result.error);
      load();
    } catch (e) {
      setError(e?.message || 'Error');
    } finally {
      setBusy(false);
    }
  }

  function handleCopyInstructions(row) {
    const text = `PerformancePitch - Activación de cuenta\n\nUsuario: ${row.username}\nEnlace: ${window.location.origin}/activar-jugador\n\nIngresá tu usuario y DNI para verificar tu identidad y crear tu cuenta.`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(row.player.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function openModal(type, row) {
    setModal({ type, player: row.player, access: row.access });
    setModalValue(type === 'dni' ? String(row.player.dni || '').replace(/\D/g, '') : (row.email || ''));
  }

  async function handleModalSave() {
    if (!modal) return;
    if (modal.type === 'dni') {
      await handleAction(modal.player.id, 'update_dni', { dni: modalValue });
    } else {
      await handleAction(modal.player.id, 'update_email', { email: modalValue });
    }
    setModal(null);
    setModalValue('');
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-zinc-700 border-t-emerald-400 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white">Accesos de jugadores</h2>
          <p className="text-sm text-zinc-500">Gestión de usuarios y activación mediante DNI</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleReview(true)} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 disabled:opacity-50">
            <Search size={14} /> Revisar jugadores
          </button>
          <button onClick={() => handleReview(false)} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30 disabled:opacity-50">
            <RefreshCw size={14} /> Generar usuarios
          </button>
        </div>
      </div>

      {/* Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: User, color: 'text-zinc-300' },
          { label: 'Activos', value: stats.active, icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Pendientes', value: stats.pending, icon: AlertTriangle, color: 'text-yellow-400' },
          { label: 'Sin DNI', value: stats.missingDni, icon: XCircle, color: 'text-orange-400' },
          { label: 'Bloqueados', value: stats.blocked, icon: Lock, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <s.icon size={14} className={s.color} />
              <span className="text-xs text-zinc-500">{s.label}</span>
            </div>
            <p className="text-xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Missing DNI alert */}
      {stats.missingDni > 0 && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-orange-400 flex-shrink-0" />
            <p className="text-sm text-orange-200">
              Hay <strong>{stats.missingDni}</strong> jugador{stats.missingDni !== 1 ? 'es' : ''} sin número de documento. Completá sus datos para habilitar el acceso.
            </p>
          </div>
          <button onClick={() => setShowMissingDniOnly(!showMissingDniOnly)} className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500/20 text-orange-200 hover:bg-orange-500/30 transition-colors">
            {showMissingDniOnly ? 'Ver todos' : 'Ver jugadores sin DNI'}
          </button>
        </div>
      )}

      {/* Review result */}
      {reviewResult && (
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">
              {reviewResult.dry_run ? 'Revisión (dry run)' : 'Generación completada'}
            </h3>
            <button onClick={() => setReviewResult(null)} className="text-zinc-500 hover:text-white"><XCircle size={16} /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-zinc-500">Total:</span> <span className="text-white font-semibold">{reviewResult.stats?.total}</span></div>
            <div><span className="text-zinc-500">Con DNI:</span> <span className="text-white font-semibold">{reviewResult.stats?.with_dni}</span></div>
            <div><span className="text-zinc-500">Sin DNI:</span> <span className="text-white font-semibold">{reviewResult.stats?.without_dni}</span></div>
            <div><span className="text-zinc-500">A crear:</span> <span className="text-white font-semibold">{reviewResult.stats?.users_to_create}</span></div>
            <div><span className="text-zinc-500">Existentes:</span> <span className="text-white font-semibold">{reviewResult.stats?.existing_access}</span></div>
            <div><span className="text-zinc-500">Conflictos:</span> <span className="text-white font-semibold">{reviewResult.stats?.username_conflicts}</span></div>
            {!reviewResult.dry_run && <div><span className="text-zinc-500">Creados:</span> <span className="text-emerald-400 font-semibold">{reviewResult.created}</span></div>}
            {!reviewResult.dry_run && <div><span className="text-zinc-500">Actualizados:</span> <span className="text-blue-400 font-semibold">{reviewResult.updated}</span></div>}
          </div>
          {reviewResult.dry_run && reviewResult.sample?.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-zinc-500 uppercase font-semibold">Muestra de usuarios</p>
              {reviewResult.sample.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300">{s.player}</span>
                  <span className="text-emerald-400 font-mono">{s.username || '(sin DNI)'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm">{error}</div>}

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o usuario..."
          className="pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white w-full focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-800 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase">
            <tr>
              <th className="text-left p-3 font-semibold">Jugador</th>
              <th className="text-left p-3 font-semibold">Usuario</th>
              <th className="text-left p-3 font-semibold">DNI</th>
              <th className="text-left p-3 font-semibold">Estado</th>
              <th className="text-left p-3 font-semibold">Email</th>
              <th className="text-left p-3 font-semibold">Último ingreso</th>
              <th className="text-right p-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filtered.map((row) => {
              const statusCfg = STATUS_LABELS[row.status] || STATUS_LABELS.access_disabled;
              return (
                <tr key={row.player.id} className="hover:bg-zinc-900/50">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {row.player.photo_url ? (
                        <img src={row.player.photo_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                          <User size={14} className="text-zinc-500" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-white">{row.player.first_name} {row.player.last_name}</p>
                        <p className="text-xs text-zinc-500">{row.player.squad_name || row.player.position || ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    {row.username ? (
                      <span className="font-mono text-emerald-400 text-xs">{row.username}</span>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {row.hasDni ? (
                      <span className="font-mono text-zinc-400 text-xs">{maskDni(row.player.dni)}</span>
                    ) : (
                      <button onClick={() => openModal('dni', row)} className="text-xs text-orange-400 hover:text-orange-300 font-semibold">Cargar DNI</button>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                  </td>
                  <td className="p-3 text-zinc-300 text-xs">{row.email || '—'}</td>
                  <td className="p-3 text-zinc-400 text-xs">{row.lastLogin ? new Date(row.lastLogin).toLocaleDateString('es-AR') : '—'}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      {row.username && (
                        <button
                          onClick={() => handleCopyInstructions(row)}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700"
                          title="Copiar instrucciones de activación"
                        >
                          {copiedId === row.player.id ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      )}
                      {row.hasDni && (
                        <button
                          onClick={() => handleAction(row.player.id, 'regenerate_username')}
                          disabled={busy}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700"
                          title="Regenerar usuario"
                        >
                          <RotateCcw size={12} />
                        </button>
                      )}
                      {!row.hasDni && (
                        <button
                          onClick={() => openModal('dni', row)}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-orange-500/10 text-orange-300 text-xs hover:bg-orange-500/20"
                          title="Cargar DNI"
                        >
                          <Edit3 size={12} />
                        </button>
                      )}
                      {row.email && (
                        <button
                          onClick={() => openModal('email', row)}
                          disabled={busy}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700"
                          title="Cambiar email"
                        >
                          <Mail size={12} />
                        </button>
                      )}
                      {row.status === 'access_blocked' && (
                        <button
                          onClick={() => handleAction(row.player.id, 'unlock')}
                          disabled={busy}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-300 text-xs hover:bg-emerald-500/20"
                          title="Desbloquear"
                        >
                          <Unlock size={12} />
                        </button>
                      )}
                      {row.access && row.status === 'access_active' && (
                        <button
                          onClick={() => handleAction(row.player.id, 'reset_activation')}
                          disabled={busy}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700"
                          title="Reiniciar activación"
                        >
                          <KeyRound size={12} />
                        </button>
                      )}
                      {row.access && (
                        <button
                          onClick={() => handleAction(row.player.id, 'toggle')}
                          disabled={busy}
                          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs ${row.access.active ? 'bg-red-500/10 text-red-300 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'}`}
                          title={row.access.active ? 'Desactivar' : 'Reactivar'}
                        >
                          <Power size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-zinc-500 text-sm">No hay jugadores que coincidan con la búsqueda</div>
        )}
      </div>

      {/* Modal DNI / Email */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-white">
              {modal.type === 'dni' ? 'Cargar DNI' : 'Cambiar email'}
            </h3>
            <p className="text-sm text-zinc-400">
              {modal.type === 'dni'
                ? `Ingresá el DNI de ${modal.player.first_name} ${modal.player.last_name}`
                : `Ingresá el nuevo email vinculado a ${modal.player.first_name} ${modal.player.last_name}`}
            </p>
            <input
              type={modal.type === 'dni' ? 'text' : 'email'}
              inputMode={modal.type === 'dni' ? 'numeric' : 'email'}
              value={modalValue}
              onChange={(e) => setModalValue(modal.type === 'dni' ? e.target.value.replace(/\D/g, '') : e.target.value)}
              placeholder={modal.type === 'dni' ? 'Solo números' : 'email@ejemplo.com'}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              autoFocus
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-semibold">Cancelar</button>
              <button
                onClick={handleModalSave}
                disabled={busy || !modalValue}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 text-sm font-bold disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}