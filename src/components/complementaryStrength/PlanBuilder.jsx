import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, GripVertical, Copy, Dumbbell, Loader2, Save, Send, X, Users, Calendar, ChevronDown, ChevronUp, UserCog, Bookmark } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import ExercisePickerModal from './ExercisePickerModal';
import PlayerOverrideModal from './PlayerOverrideModal';

const BLOCK_TYPES = [
  { value: 'activation', label: 'Activación' },
  { value: 'main', label: 'Bloque principal' },
  { value: 'accessories', label: 'Accesorios' },
];

function emptyExercise(lib) {
  return {
    library_exercise_id: lib.id,
    library_exercise_name: lib.name,
    library_exercise_image: lib.image_url || '',
    library_exercise_video: lib.video_url || '',
    sets: lib.sets ? Number(lib.sets) : null,
    repetitions: lib.reps || '',
    rest_seconds: lib.rest_time ? Number(lib.rest_time) : null,
    prescribed_load_kg: null,
    target_type: 'none',
    target_value: '',
    technical_instructions: '',
    general_note: '',
    overrides: [],
  };
}

function ExerciseRow({ ex, onChange, onRemove, onDuplicate, onOpenOverrides, assignedCount }) {
  const overrideCount = (ex.overrides || []).length;
  return (
    <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-2.5 space-y-2">
      <div className="flex items-start gap-2">
        <div className="w-9 h-9 rounded bg-zinc-800 border border-zinc-700 overflow-hidden shrink-0 flex items-center justify-center">
          {ex.library_exercise_image ? <img src={ex.library_exercise_image} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} /> : <Dumbbell size={14} className="text-zinc-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate">{ex.library_exercise_name}</p>
        </div>
        {assignedCount > 0 && (
          <button onClick={onOpenOverrides} className={`flex items-center gap-1 px-1.5 py-1 rounded text-xs ${overrideCount > 0 ? 'bg-blue-500/15 text-blue-400' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`} title="Ajustes individuales por jugador">
            <UserCog size={13} /> {overrideCount > 0 && <span className="font-bold">{overrideCount}</span>}
          </button>
        )}
        <button onClick={onDuplicate} className="text-zinc-500 hover:text-white p-1"><Copy size={13} /></button>
        <button onClick={onRemove} className="text-zinc-500 hover:text-red-400 p-1"><Trash2 size={13} /></button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <input type="number" value={ex.sets ?? ''} onChange={(e) => onChange({ ...ex, sets: e.target.value ? Number(e.target.value) : null })} placeholder="Series" className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-white" />
        <input value={ex.repetitions || ''} onChange={(e) => onChange({ ...ex, repetitions: e.target.value })} placeholder="Reps" className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-white" />
        <input type="number" value={ex.rest_seconds ?? ''} onChange={(e) => onChange({ ...ex, rest_seconds: e.target.value ? Number(e.target.value) : null })} placeholder="Desc(s)" className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-white" />
        <input type="number" value={ex.prescribed_load_kg ?? ''} onChange={(e) => onChange({ ...ex, prescribed_load_kg: e.target.value ? Number(e.target.value) : null })} placeholder="Kg" className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-white" />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <select value={ex.target_type || 'none'} onChange={(e) => onChange({ ...ex, target_type: e.target.value })} className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-white">
          <option value="none">Sin objetivo</option>
          <option value="RIR">RIR</option>
          <option value="RPE">RPE</option>
        </select>
        <input value={ex.target_value || ''} onChange={(e) => onChange({ ...ex, target_value: e.target.value })} placeholder="Valor objetivo" disabled={ex.target_type === 'none'} className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-white disabled:opacity-40" />
        <input value={ex.technical_instructions || ''} onChange={(e) => onChange({ ...ex, technical_instructions: e.target.value })} placeholder="Ind. técnica" className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-white" />
      </div>
    </div>
  );
}

function BlockEditor({ block, onChange, onRemove, squadId, assignedCount, onOpenOverrides }) {
  const [open, setOpen] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [overrideEx, setOverrideEx] = useState(null);

  function addExercise(lib) {
    onChange({ ...block, exercises: [...(block.exercises || []), emptyExercise(lib)] });
  }
  function updateEx(i, ex) {
    const list = [...(block.exercises || [])];
    list[i] = ex;
    onChange({ ...block, exercises: list });
  }
  function removeEx(i) {
    onChange({ ...block, exercises: (block.exercises || []).filter((_, idx) => idx !== i) });
  }
  function dupEx(i) {
    const list = [...(block.exercises || [])];
    const copy = { ...list[i], id: undefined, overrides: [] };
    list.splice(i + 1, 0, copy);
    onChange({ ...block, exercises: list });
  }
  function onDragEnd(result) {
    if (!result.destination) return;
    const list = [...(block.exercises || [])];
    const [moved] = list.splice(result.source.index, 1);
    list.splice(result.destination.index, 0, moved);
    onChange({ ...block, exercises: list });
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 p-2.5">
        <GripVertical size={14} className="text-zinc-600" />
        <select value={block.block_type} onChange={(e) => onChange({ ...block, block_type: e.target.value })} className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white">
          {BLOCK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input value={block.name || ''} onChange={(e) => onChange({ ...block, name: e.target.value })} placeholder="Nombre del bloque" className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white" />
        <button onClick={onRemove} className="text-zinc-500 hover:text-red-400 p-1"><Trash2 size={14} /></button>
        <button onClick={() => setOpen(!open)} className="text-zinc-500 hover:text-white p-1">{open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</button>
      </div>
      {open && (
        <div className="px-2.5 pb-2.5 space-y-2">
          <input value={block.instructions || ''} onChange={(e) => onChange({ ...block, instructions: e.target.value })} placeholder="Indicaciones del bloque" className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white" />
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId={`ex-${block._key || block.name || 'block'}`}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                  {(block.exercises || []).map((ex, i) => (
                    <Draggable key={i} draggableId={`ex-${i}`} index={i}>
                      {(p, s) => (
                        <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className={s.isDragging ? 'opacity-70' : ''}>
                          <ExerciseRow ex={ex} onChange={(e) => updateEx(i, e)} onRemove={() => removeEx(i)} onDuplicate={() => dupEx(i)} onOpenOverrides={() => setOverrideEx(ex)} assignedCount={assignedCount} />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          <button onClick={() => setPickerOpen(true)} className="w-full py-1.5 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-400 hover:border-zinc-500 hover:text-white flex items-center justify-center gap-1"><Plus size={12} /> Agregar ejercicio</button>
        </div>
      )}
      {pickerOpen && <ExercisePickerModal squadId={squadId} onPick={addExercise} onClose={() => setPickerOpen(false)} />}
      {overrideEx && (
        <PlayerOverrideModal
          exercise={overrideEx}
          assignments={onOpenOverrides.assignments}
          roster={onOpenOverrides.roster}
          onChange={(newEx) => {
            updateEx((block.exercises || []).findIndex((e) => e === overrideEx), newEx);
            setOverrideEx(newEx);
          }}
          onClose={() => setOverrideEx(null)}
        />
      )}
    </div>
  );
}

function WorkoutEditor({ workout, onChange, onRemove, squadId, assignedCount, assignments, roster }) {
  const [open, setOpen] = useState(true);
  function addBlock(type) {
    const newBlock = { block_type: type, name: '', instructions: '', exercises: [] };
    onChange({ ...workout, blocks: [...(workout.blocks || []), newBlock] });
  }
  function updateBlock(i, b) {
    const list = [...(workout.blocks || [])];
    list[i] = b;
    onChange({ ...workout, blocks: list });
  }
  function removeBlock(i) {
    onChange({ ...workout, blocks: (workout.blocks || []).filter((_, idx) => idx !== i) });
  }
  function onDragEnd(result) {
    if (!result.destination) return;
    const list = [...(workout.blocks || [])];
    const [moved] = list.splice(result.source.index, 1);
    list.splice(result.destination.index, 0, moved);
    onChange({ ...workout, blocks: list });
  }

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 p-3 bg-zinc-900/50">
        <Calendar size={15} className="text-blue-400" />
        <input type="date" value={workout.workout_date || ''} onChange={(e) => onChange({ ...workout, workout_date: e.target.value })} className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white" />
        <input value={workout.title || ''} onChange={(e) => onChange({ ...workout, title: e.target.value })} placeholder="Título (opcional)" className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white" />
        <button onClick={() => setOpen(!open)} className="text-zinc-500 hover:text-white p-1">{open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</button>
        <button onClick={onRemove} className="text-zinc-500 hover:text-red-400 p-1"><Trash2 size={14} /></button>
      </div>
      {open && (
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input value={workout.objective || ''} onChange={(e) => onChange({ ...workout, objective: e.target.value })} placeholder="Objetivo" className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white" />
            <input type="number" value={workout.estimated_duration_minutes ?? ''} onChange={(e) => onChange({ ...workout, estimated_duration_minutes: e.target.value ? Number(e.target.value) : null })} placeholder="Duración (min)" className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white" />
          </div>
          <input value={workout.instructions || ''} onChange={(e) => onChange({ ...workout, instructions: e.target.value })} placeholder="Indicaciones del entrenamiento" className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white" />
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId={`blocks-${workout._key || workout.workout_date || 'w'}`}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                  {(workout.blocks || []).map((b, i) => (
                    <Draggable key={i} draggableId={`blk-${i}`} index={i}>
                      {(p, s) => (
                        <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className={s.isDragging ? 'opacity-70' : ''}>
                          <BlockEditor block={b} onChange={(nb) => updateBlock(i, nb)} onRemove={() => removeBlock(i)} squadId={squadId} assignedCount={assignedCount} onOpenOverrides={{ assignments, roster }} />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          <div className="flex gap-1.5">
            {BLOCK_TYPES.map((t) => <button key={t.value} onClick={() => addBlock(t.value)} className="flex-1 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 text-[11px] hover:border-zinc-500 flex items-center justify-center gap-1"><Plus size={11} /> {t.label}</button>)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlanBuilder({ initialPlan, roster, squadInfo, onSaved, onCancel }) {
  const [plan, setPlan] = useState(() => initialPlan || {
    name: '', objective: '', description: '', general_instructions: '',
    squad_id: squadInfo?.id || '', squad_name: squadInfo?.name || '', season_id: squadInfo?.season || '',
    organization_id: squadInfo?.club_id || '', status: 'draft', is_template: false,
    assignments: [], workouts: [],
  });
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [showAssign, setShowAssign] = useState(false);

  function addWorkout() {
    const today = new Date().toISOString().slice(0, 10);
    setPlan((p) => ({ ...p, workouts: [...(p.workouts || []), { workout_date: today, title: '', objective: '', estimated_duration_minutes: null, instructions: '', status: 'draft', blocks: [] }] }));
  }
  function updateWorkout(i, w) {
    const list = [...(plan.workouts || [])];
    list[i] = w;
    setPlan((p) => ({ ...p, workouts: list }));
  }
  function removeWorkout(i) {
    setPlan((p) => ({ ...p, workouts: (p.workouts || []).filter((_, idx) => idx !== i) }));
  }

  function togglePlayer(playerId, playerName) {
    setPlan((p) => {
      const exists = (p.assignments || []).some((a) => a.player_id === playerId);
      return { ...p, assignments: exists ? p.assignments.filter((a) => a.player_id !== playerId) : [...(p.assignments || []), { player_id: playerId, player_name: playerName }] };
    });
  }

  async function save(asPublish = false) {
    if (!plan.name) { setError('Nombre del plan requerido'); return; }
    if (!plan.workouts?.length) { setError('Agregá al menos un entrenamiento'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await base44.functions.invoke('saveComplementaryStrengthPlan', { plan, assignments: plan.assignments, workouts: plan.workouts });
      const result = res.data || res;
      if (result.error) throw new Error(result.error);
      if (asPublish) {
        setPublishing(true);
        const pub = await base44.functions.invoke('setComplementaryStrengthPlanStatus', { plan_id: result.plan_id, action: 'publish' });
        const pubResult = pub.data || pub;
        if (pubResult.error) throw new Error(pubResult.error);
      }
      onSaved();
    } catch (e) {
      setError(e?.message || 'Error al guardar');
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  }

  const assignedIds = new Set((plan.assignments || []).map((a) => a.player_id));
  const assignedCount = (plan.assignments || []).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-white">{plan.id ? 'Editar plan' : 'Crear plan complementario'}</h2>
        <button onClick={onCancel} className="text-zinc-400 hover:text-white p-1"><X size={18} /></button>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
        <input value={plan.name} onChange={(e) => setPlan({ ...plan, name: e.target.value })} placeholder="Nombre del plan" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white font-medium" />
        <input value={plan.objective} onChange={(e) => setPlan({ ...plan, objective: e.target.value })} placeholder="Objetivo general" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
        <textarea value={plan.description} onChange={(e) => setPlan({ ...plan, description: e.target.value })} placeholder="Descripción" rows={2} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white resize-none" />
        <textarea value={plan.general_instructions} onChange={(e) => setPlan({ ...plan, general_instructions: e.target.value })} placeholder="Indicaciones generales para el jugador" rows={2} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white resize-none" />
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!plan.is_template} onChange={(e) => setPlan({ ...plan, is_template: e.target.checked })} className="rounded" />
          <span className="flex items-center gap-1.5 text-sm text-zinc-300"><Bookmark size={13} className="text-amber-400" /> Guardar como plantilla reutilizable</span>
        </label>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
        <button onClick={() => setShowAssign(!showAssign)} className="w-full flex items-center justify-between p-3">
          <span className="flex items-center gap-2 text-sm text-white font-medium"><Users size={15} /> Jugadores asignados ({assignedCount})</span>
          {showAssign ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
        </button>
        {showAssign && (
          <div className="border-t border-zinc-800 p-3 max-h-64 overflow-y-auto space-y-1">
            {roster.length === 0 ? <p className="text-xs text-zinc-500 text-center py-4">Sin jugadores en el plantel</p> : roster.map((p) => (
              <label key={p.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-zinc-800 cursor-pointer">
                <input type="checkbox" checked={assignedIds.has(p.id)} onChange={() => togglePlayer(p.id, `${p.first_name} ${p.last_name}`.trim())} className="rounded" />
                <span className="text-sm text-zinc-300">{p.first_name} {p.last_name}</span>
                <span className="text-xs text-zinc-600">{p.position}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-400 uppercase">Entrenamientos ({(plan.workouts || []).length})</h3>
          <button onClick={addWorkout} className="flex items-center gap-1 px-3 py-1.5 bg-white text-zinc-950 rounded-lg text-xs font-bold hover:bg-zinc-200"><Plus size={13} /> Agregar fecha</button>
        </div>
        {(plan.workouts || []).map((w, i) => <WorkoutEditor key={i} workout={w} onChange={(nw) => updateWorkout(i, nw)} onRemove={() => removeWorkout(i)} squadId={plan.squad_id} assignedCount={assignedCount} assignments={plan.assignments} roster={roster} />)}
      </div>

      <div className="flex gap-2 sticky bottom-0 bg-zinc-950 py-3 border-t border-zinc-800">
        <button onClick={() => save(false)} disabled={saving || publishing} className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <><Save size={15} /> Guardar borrador</>}
        </button>
        <button onClick={() => save(true)} disabled={saving || publishing} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 flex items-center justify-center gap-2 disabled:opacity-50">
          {publishing ? <Loader2 size={16} className="animate-spin" /> : <><Send size={15} /> Publicar</>}
        </button>
      </div>
    </div>
  );
}