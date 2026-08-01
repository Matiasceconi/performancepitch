import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useWorkspace } from '@/lib/WorkspaceContext';
import { Dumbbell, Loader2, Plus, Calendar, Users, CheckCircle2, Clock, AlertTriangle, XCircle, Archive, Send, Copy, Pencil, Search } from 'lucide-react';
import PlanBuilder from '@/components/complementaryStrength/PlanBuilder';

const TABS = [
  { id: 'today', label: 'Hoy' },
  { id: 'create', label: 'Crear plan' },
  { id: 'templates', label: 'Plantillas' },
  { id: 'active', label: 'Planes activos' },
  { id: 'history', label: 'Historial' },
];

const STATUS_CFG = {
  available_today: { label: 'Disponible', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  in_progress: { label: 'En curso', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  rpe_pending: { label: 'RPE pend.', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  completed: { label: 'Realizado', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  not_completed: { label: 'No realizado', color: 'text-red-400', bg: 'bg-red-500/10' },
  pending_expired: { label: 'Vencido', color: 'text-orange-400', bg: 'bg-orange-500/10' },
};

const STATUS_ICON = {
  available_today: Clock, in_progress: Loader2, rpe_pending: AlertTriangle, completed: CheckCircle2, not_completed: XCircle, pending_expired: AlertTriangle,
};

function fmtTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }); } catch { return '—'; }
}

function TodayTab({ data, filters, setFilters }) {
  const rows = data?.today_rows || [];
  const filtered = rows.filter((r) => {
    if (filters.squad && r.squad_id !== filters.squad) return false;
    if (filters.player && !r.player_name.toLowerCase().includes(filters.player.toLowerCase())) return false;
    if (filters.plan && r.plan_id !== filters.plan) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (filters.hasRpe === 'yes' && r.rpe == null) return false;
    if (filters.hasRpe === 'no' && r.rpe != null) return false;
    return true;
  });

  const plans = data?.plans || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={filters.player} onChange={(e) => setFilters({ ...filters, player: e.target.value })} placeholder="Jugador..." className="pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white w-40" />
        </div>
        <select value={filters.plan} onChange={(e) => setFilters({ ...filters, plan: e.target.value })} className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-sm text-white">
          <option value="">Todos los planes</option>
          {plans.filter((p) => p.status === 'published').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-sm text-white">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filters.hasRpe} onChange={(e) => setFilters({ ...filters, hasRpe: e.target.value })} className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-sm text-white">
          <option value="">RPE complementario</option>
          <option value="yes">Con RPE</option>
          <option value="no">Sin RPE</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
          <Dumbbell size={32} className="text-zinc-700 mx-auto mb-2" />
          <p className="text-zinc-500 text-sm">No hay entrenamientos complementarios para hoy.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="text-zinc-400 text-xs uppercase bg-zinc-900">
              <tr>
                <th className="text-left p-3 font-semibold">Jugador</th>
                <th className="text-left p-3 font-semibold">Plan</th>
                <th className="text-left p-3 font-semibold">Trabajo</th>
                <th className="text-center p-3 font-semibold">Estado</th>
                <th className="text-center p-3 font-semibold">Inicio</th>
                <th className="text-center p-3 font-semibold">Fin</th>
                <th className="text-center p-3 font-semibold">RPE</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const cfg = STATUS_CFG[r.status] || STATUS_CFG.available_today;
                const Icon = STATUS_ICON[r.status] || Clock;
                return (
                  <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-900/50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                          {r.photo_url ? <img src={r.photo_url} alt="" className="w-full h-full object-cover" /> : <Users size={13} className="text-zinc-600" />}
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">{r.player_name}</p>
                          <p className="text-xs text-zinc-500">{r.position || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-zinc-300 text-xs">{r.plan_name}</td>
                    <td className="p-3 text-zinc-300 text-xs">{r.workout_title}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                        {r.completed_late && r.status === 'completed' && <span className="text-[9px]">(tarde)</span>}
                        {cfg.label}
                      </span>
                    </td>
                    <td className="p-3 text-center text-zinc-400 text-xs">{fmtTime(r.started_at)}</td>
                    <td className="p-3 text-center text-zinc-400 text-xs">{fmtTime(r.exercises_finished_at)}</td>
                    <td className="p-3 text-center text-white font-bold">{r.rpe != null ? r.rpe : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PlanCard({ plan, onEdit, onClose, onDuplicate, onPublish, statusLabel }) {
  const workoutCount = (plan.workouts || []).length;
  const nextDate = (plan.workouts || []).filter((w) => w.status === 'published').map((w) => w.workout_date).sort()[0];
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-white font-bold">{plan.name}</h3>
          {plan.objective && <p className="text-xs text-zinc-500 mt-0.5">{plan.objective}</p>}
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 shrink-0">{statusLabel}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span className="flex items-center gap-1"><Users size={11} /> {(plan.assignments || []).length} jugadores</span>
        <span className="flex items-center gap-1"><Calendar size={11} /> {workoutCount} entrenamientos</span>
        {nextDate && <span className="flex items-center gap-1"><Clock size={11} /> Próximo: {new Date(nextDate + 'T12:00:00').toLocaleDateString('es-AR')}</span>}
      </div>
      <div className="flex gap-2 pt-1">
        {onEdit && <button onClick={() => onEdit(plan)} className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-xs hover:bg-zinc-700"><Pencil size={12} /> Editar</button>}
        {onPublish && <button onClick={() => onPublish(plan)} className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-500"><Send size={12} /> Publicar</button>}
        {onClose && <button onClick={() => onClose(plan)} className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-xs hover:bg-zinc-700"><Archive size={12} /> Cerrar</button>}
        {onDuplicate && <button onClick={() => onDuplicate(plan)} className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-xs hover:bg-zinc-700"><Copy size={12} /> Duplicar</button>}
      </div>
    </div>
  );
}

export default function ComplementaryStrengthPlans() {
  const { activeSquad, canSeePath } = useWorkspace();
  const [tab, setTab] = useState('today');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [filters, setFilters] = useState({ squad: '', player: '', plan: '', status: '', hasRpe: '' });

  const load = useCallback(async () => {
    if (!activeSquad?.id) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('getComplementaryStrengthData', { squad_id: activeSquad.id });
      const result = res.data || res;
      if (result.error) throw new Error(result.error);
      setData(result);
    } catch (e) {
      setError(e?.message || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [activeSquad?.id]);

  useEffect(() => { load(); }, [load]);

  async function publishPlan(plan) {
    if (!confirm(`¿Publicar el plan "${plan.name}"? Los jugadores asignados verán los entrenamientos.`)) return;
    try {
      const res = await base44.functions.invoke('setComplementaryStrengthPlanStatus', { plan_id: plan.id, action: 'publish' });
      const result = res.data || res;
      if (result.error) throw new Error(result.error);
      load();
    } catch (e) {
      alert(e?.message || 'Error');
    }
  }

  async function closePlan(plan) {
    if (!confirm(`¿Cerrar el plan "${plan.name}"? Se conserva todo el historial.`)) return;
    try {
      const res = await base44.functions.invoke('setComplementaryStrengthPlanStatus', { plan_id: plan.id, action: 'close' });
      const result = res.data || res;
      if (result.error) throw new Error(result.error);
      load();
    } catch (e) {
      alert(e?.message || 'Error');
    }
  }

  function duplicatePlan(plan) {
    const copy = { ...plan, id: undefined, name: `${plan.name} (copia)`, status: 'draft', assignments: (plan.assignments || []).map((a) => ({ player_id: a.player_id, player_name: a.player_name })), workouts: (plan.workouts || []).map((w) => ({ ...w, id: undefined, blocks: (w.blocks || []).map((b) => ({ ...b, id: undefined, exercises: (b.exercises || []).map((e) => ({ ...e, id: undefined, overrides: [] })) })) })) };
    setEditingPlan(copy);
    setBuilderOpen(true);
    setTab('create');
  }

  if (!activeSquad?.id) {
    return <div className="p-6 text-zinc-500 text-sm">Seleccioná un plantel para gestionar planes complementarios.</div>;
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-zinc-600" /></div>;
  }

  if (error) {
    return <div className="p-6"><div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div></div>;
  }

  const plans = data?.plans || [];
  const activePlans = plans.filter((p) => p.status === 'published' && !p.is_template);
  const draftPlans = plans.filter((p) => p.status === 'draft' && !p.is_template);
  const closedPlans = plans.filter((p) => p.status === 'closed' && !p.is_template);
  const templates = plans.filter((p) => p.is_template);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2"><Dumbbell size={20} className="text-blue-400" /> Planes complementarios</h1>
          <p className="text-xs text-zinc-500 mt-1">Fuerza complementaria individual · Plantel: {activeSquad?.name}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'today' && <TodayTab data={data} filters={filters} setFilters={setFilters} />}

      {tab === 'create' && (
        builderOpen ? (
          <PlanBuilder initialPlan={editingPlan} roster={data?.roster || []} squadInfo={activeSquad} onSaved={() => { setBuilderOpen(false); setEditingPlan(null); load(); }} onCancel={() => { setBuilderOpen(false); setEditingPlan(null); }} />
        ) : (
          <div className="space-y-4">
            <button onClick={() => { setEditingPlan(null); setBuilderOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-950 rounded-xl text-sm font-bold hover:bg-zinc-200"><Plus size={16} /> Crear nuevo plan</button>
            {draftPlans.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-zinc-400 uppercase">Borradores</h3>
                {draftPlans.map((p) => <PlanCard key={p.id} plan={p} statusLabel="Borrador" onEdit={(plan) => { setEditingPlan(plan); setBuilderOpen(true); }} onPublish={publishPlan} />)}
              </div>
            )}
          </div>
        )
      )}

      {tab === 'templates' && (
        <div className="space-y-3">
          {templates.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
              <Archive size={28} className="text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">No hay plantillas guardadas.</p>
              <p className="text-zinc-600 text-xs mt-1">Creá un plan y marcá "Guardar como plantilla" para reutilizarlo.</p>
            </div>
          ) : templates.map((p) => <PlanCard key={p.id} plan={p} statusLabel="Plantilla" onDuplicate={(plan) => duplicatePlan({ ...plan, is_template: false })} />)}
        </div>
      )}

      {tab === 'active' && (
        <div className="space-y-3">
          {activePlans.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
              <Dumbbell size={28} className="text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">No hay planes activos.</p>
            </div>
          ) : activePlans.map((p) => <PlanCard key={p.id} plan={p} statusLabel="Publicado" onEdit={(plan) => { setEditingPlan(plan); setBuilderOpen(true); setTab('create'); }} onClose={closePlan} />)}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {closedPlans.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
              <Archive size={28} className="text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">No hay planes cerrados.</p>
            </div>
          ) : closedPlans.map((p) => <PlanCard key={p.id} plan={p} statusLabel="Cerrado" onDuplicate={duplicatePlan} />)}
        </div>
      )}
    </div>
  );
}