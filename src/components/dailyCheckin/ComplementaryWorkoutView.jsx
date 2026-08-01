import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Loader2, Play, CheckCircle2, Gauge, Lock, Dumbbell, Clock, Target, Video, Image as ImageIcon, AlertTriangle, RotateCcw } from 'lucide-react';

const BLOCK_LABELS = {
  activation: 'Activación',
  main: 'Bloque principal',
  accessories: 'Accesorios',
};

const STATUS_CONFIG = {
  available_today: { label: 'Disponible hoy', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  in_progress: { label: 'En curso', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  rpe_pending: { label: 'RPE pendiente', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  completed: { label: 'Realizado', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  not_completed: { label: 'No realizado', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  pending_expired: { label: 'Pendiente vencido', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  upcoming: { label: 'Próximo', color: 'text-zinc-400', bg: 'bg-zinc-800', border: 'border-zinc-700' },
};

function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d + 'T12:00:00');
  return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function ExerciseCard({ ex }) {
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-3.5 space-y-2">
      <div className="flex items-start gap-3">
        {(ex.library_exercise_image || ex.library_exercise_video) && (
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-700 shrink-0">
            {ex.library_exercise_video ? (
              <a href={ex.library_exercise_video} target="_blank" rel="noopener noreferrer" className="block w-full h-full relative">
                <img src={ex.library_exercise_image || ''} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40"><Video size={18} className="text-white" /></div>
              </a>
            ) : (
              <img src={ex.library_exercise_image || ''} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-white font-semibold text-sm">{ex.library_exercise_name || 'Ejercicio'}</h4>
            {ex.is_personalized && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">Personalizado</span>}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-zinc-400">
            {ex.sets != null && <span>{ex.sets} series</span>}
            {ex.repetitions && <span>× {ex.repetitions}</span>}
            {ex.prescribed_load_kg != null && <span className="text-zinc-300 font-medium">{ex.prescribed_load_kg} kg</span>}
            {ex.rest_seconds != null && <span>Desc: {ex.rest_seconds}s</span>}
            {ex.target_type && ex.target_type !== 'none' && <span className="text-violet-300">{ex.target_type}: {ex.target_value}</span>}
          </div>
        </div>
      </div>
      {ex.technical_instructions && <p className="text-xs text-zinc-500 pl-1">Técnica: {ex.technical_instructions}</p>}
      {ex.general_note && <p className="text-xs text-zinc-500 pl-1">Nota: {ex.general_note}</p>}
      {ex.individual_note && <p className="text-xs text-blue-300 pl-1 border-l-2 border-blue-500/40">PF: {ex.individual_note}</p>}
    </div>
  );
}

export default function ComplementaryWorkoutView({ token, workoutCard, onStarted, onFinished, onRpe, onNotDone, onBack }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');

  const workoutId = workoutCard.workout_id || workoutCard.id;

  async function loadDetail() {
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('getComplementaryWorkoutDetail', { token, workout_id: workoutId });
      const result = res.data || res;
      if (result.error) throw new Error(result.error);
      setDetail(result);
    } catch (e) {
      setError(e?.message || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDetail(); }, [workoutId]);

  async function handleStart() {
    setActing(true);
    setError('');
    try {
      const res = await base44.functions.invoke('startComplementaryWorkout', { token, workout_id: workoutId });
      const result = res.data || res;
      if (result.error) throw new Error(result.error);
      onStarted(result.execution);
    } catch (e) {
      setError(e?.message || 'Error al iniciar');
    } finally {
      setActing(false);
    }
  }

  async function handleFinish() {
    setActing(true);
    setError('');
    try {
      const res = await base44.functions.invoke('finishComplementaryWorkout', { token, execution_id: detail.execution.id });
      const result = res.data || res;
      if (result.error) throw new Error(result.error);
      onFinished(result.execution);
    } catch (e) {
      setError(e?.message || 'Error al finalizar');
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 max-w-md mx-auto p-5 space-y-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white"><ArrowLeft size={16} /> Volver</button>
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>
      </div>
    );
  }

  const w = detail.workout;
  const blocks = detail.blocks || [];
  const exec = detail.execution;
  const status = exec?.status || (detail.is_future ? 'upcoming' : detail.is_past ? 'pending_expired' : 'available_today');
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.available_today;
  const totalExercises = blocks.reduce((a, b) => a + (b.exercises?.length || 0), 0);

  return (
    <div className="min-h-screen bg-zinc-950 max-w-md mx-auto pb-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white p-4"><ArrowLeft size={16} /> Volver</button>

      <div className="px-5 space-y-4">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Dumbbell size={18} className="text-blue-400" />
            <span className="text-xs text-zinc-500 uppercase tracking-wide">{w.plan_name}</span>
          </div>
          <h1 className="text-2xl font-black text-white">{w.title}</h1>
          <p className="text-zinc-500 text-sm capitalize mt-0.5">{fmtDate(w.workout_date)}</p>
          {w.objective && <p className="text-zinc-400 text-sm mt-2 flex items-center gap-1.5"><Target size={14} /> {w.objective}</p>}
          {w.estimated_duration_minutes != null && <p className="text-zinc-500 text-xs mt-1 flex items-center gap-1"><Clock size={12} /> ~{w.estimated_duration_minutes} min</p>}
        </div>

        {/* Status badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${cfg.bg} ${cfg.border}`}>
          <span className={`w-2 h-2 rounded-full ${cfg.color.replace('text-', 'bg-')}`}></span>
          <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
        </div>

        {status === 'completed' && exec?.rpe != null && (
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span className="text-sm text-emerald-300">RPE complementario: <strong>{exec.rpe}/10</strong></span>
          </div>
        )}
        {status === 'not_completed' && (
          <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-400" />
            <span className="text-sm text-red-300">Registraste que no lo realizaste.</span>
          </div>
        )}

        {w.instructions && <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800"><p className="text-xs text-zinc-500 uppercase mb-1">Indicaciones</p><p className="text-sm text-zinc-300">{w.instructions}</p></div>}
        {w.general_instructions && <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800"><p className="text-xs text-zinc-500 uppercase mb-1">Indicaciones generales del plan</p><p className="text-sm text-zinc-300">{w.general_instructions}</p></div>}

        {/* Blocks */}
        <div className="space-y-4">
          <p className="text-sm font-bold text-zinc-400 uppercase tracking-wide">{blocks.length} bloques · {totalExercises} ejercicios</p>
          {blocks.map((block) => (
            <div key={block.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-bold text-sm">{BLOCK_LABELS[block.block_type] || block.name || 'Bloque'}</h3>
                {block.name && block.name !== BLOCK_LABELS[block.block_type] && <span className="text-xs text-zinc-500">· {block.name}</span>}
              </div>
              {block.instructions && <p className="text-xs text-zinc-500">{block.instructions}</p>}
              <div className="space-y-2">
                {block.exercises?.map((ex, i) => <ExerciseCard key={i} ex={ex} />)}
                {(!block.exercises || block.exercises.length === 0) && <p className="text-xs text-zinc-600 pl-1">Sin ejercicios en este bloque.</p>}
              </div>
            </div>
          ))}
        </div>

        {detail.snapshot_used && (
          <p className="text-xs text-zinc-600 flex items-center gap-1.5"><Lock size={11} /> Versión congelada al iniciar. Los cambios del PF no modifican esta copia.</p>
        )}
      </div>

      {/* Action bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 space-y-2">
        {error && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">{error}</div>}

        {status === 'available_today' && (
          <>
            <button onClick={handleStart} disabled={acting} className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              {acting ? <Loader2 size={18} className="animate-spin" /> : <><Play size={18} /> Iniciar entrenamiento</>}
            </button>
            <button onClick={() => onNotDone(workoutCard)} className="w-full py-2 text-sm text-zinc-500 hover:text-red-400">No pude realizarlo</button>
          </>
        )}

        {status === 'in_progress' && (
          <>
            <button onClick={handleFinish} disabled={acting} className="w-full h-12 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              {acting ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle2 size={18} /> Finalizar entrenamiento</>}
            </button>
            <button onClick={() => onNotDone(workoutCard)} className="w-full py-2 text-sm text-zinc-500 hover:text-red-400">No pude realizarlo</button>
          </>
        )}

        {status === 'rpe_pending' && (
          <button onClick={() => onRpe(exec)} className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center gap-2">
            <Gauge size={18} /> Responder RPE complementario
          </button>
        )}

        {status === 'completed' && (
          <div className="w-full h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> Entrenamiento completado
          </div>
        )}

        {status === 'not_completed' && (
          <div className="w-full h-12 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-bold flex items-center justify-center gap-2">
            <AlertTriangle size={18} /> No realizado
          </div>
        )}

        {status === 'pending_expired' && (
          <>
            <p className="text-xs text-orange-400 text-center">Este entrenamiento venció. Regularizá tu situación.</p>
            <button onClick={handleStart} disabled={acting} className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              {acting ? <Loader2 size={18} className="animate-spin" /> : <><RotateCcw size={18} /> Lo realicé (fuera de término)</>}
            </button>
            <button onClick={() => onNotDone(workoutCard)} className="w-full py-2 text-sm text-zinc-500 hover:text-red-400">No lo realicé</button>
          </>
        )}

        {status === 'upcoming' && (
          <div className="w-full h-12 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-500 font-bold flex items-center justify-center gap-2">
            <Lock size={16} /> Disponible el {fmtDate(w.workout_date)}
          </div>
        )}
      </div>
    </div>
  );
}