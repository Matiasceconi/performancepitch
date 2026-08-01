import React, { useState, useMemo } from 'react';
import { X, Search, UserCog, RotateCcw, Ban, Dumbbell, Check } from 'lucide-react';
import ExercisePickerModal from './ExercisePickerModal';

// Modal para editar ajustes individuales (overrides) de un ejercicio por jugador.
// Cada jugador asignado puede tener: series, reps, pausa, carga, objetivo,
// indicaciones técnicas personalizadas, exclusión, ejercicio de reemplazo y nota.
// Los campos vacíos heredan el valor base del plan.

export default function PlayerOverrideModal({ exercise, assignments, roster, onChange, onClose }) {
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(null); // player_id si está abriendo selector de reemplazo

  const overridesByPlayer = useMemo(() => {
    const map = {};
    (exercise.overrides || []).forEach((o) => { map[o.player_id] = o; });
    return map;
  }, [exercise.overrides]);

  const assignedPlayers = useMemo(() => {
    const ids = new Set((assignments || []).map((a) => a.player_id));
    const q = search.toLowerCase().trim();
    return (roster || [])
      .filter((p) => ids.has(p.id))
      .filter((p) => !q || `${p.first_name} ${p.last_name}`.toLowerCase().includes(q));
  }, [assignments, roster, search]);

  function getOverride(playerId) {
    return overridesByPlayer[playerId] || null;
  }

  function updateOverride(playerId, patch) {
    const existing = overridesByPlayer[playerId];
    const list = existing
      ? (exercise.overrides || []).map((o) => o.player_id === playerId ? { ...o, ...patch } : o)
      : [...(exercise.overrides || []), { player_id: playerId, ...patch }];
    onChange({ ...exercise, overrides: list });
  }

  function resetPlayer(playerId) {
    const list = (exercise.overrides || []).filter((o) => o.player_id !== playerId);
    onChange({ ...exercise, overrides: list });
  }

  function pickReplacement(playerId, lib) {
    updateOverride(playerId, {
      replacement_library_exercise_id: lib.id,
      replacement_library_exercise_name: lib.name,
    });
    setPickerOpen(null);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <UserCog size={18} className="text-blue-400" />
            <div>
              <h3 className="text-white font-bold text-sm">Ajustes individuales</h3>
              <p className="text-xs text-zinc-500">{exercise.library_exercise_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-3 border-b border-zinc-800">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar jugador..." className="w-full pl-8 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {assignedPlayers.length === 0 ? (
            <p className="text-center text-zinc-500 text-sm py-8">Sin jugadores asignados al plan</p>
          ) : assignedPlayers.map((p) => {
            const ov = getOverride(p.id);
            const isExcluded = !!ov?.is_excluded;
            const hasReplacement = !!ov?.replacement_library_exercise_id;
            const hasAny = !!ov;
            return (
              <div key={p.id} className={`rounded-xl border p-3 space-y-2 ${isExcluded ? 'bg-red-500/5 border-red-500/20' : 'bg-zinc-800/40 border-zinc-700/50'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-zinc-700 overflow-hidden shrink-0 flex items-center justify-center">
                      {p.photo_url ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] text-zinc-400 font-bold">{(p.first_name || '?')[0]}</span>}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium truncate">{p.first_name} {p.last_name}</p>
                      <p className="text-xs text-zinc-500">{p.position || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {hasAny && !isExcluded && <span className="text-[10px] text-blue-400 font-semibold px-1.5 py-0.5 bg-blue-500/10 rounded">Personalizado</span>}
                    {isExcluded && <span className="text-[10px] text-red-400 font-semibold px-1.5 py-0.5 bg-red-500/10 rounded">Excluido</span>}
                    {hasAny && <button onClick={() => resetPlayer(p.id)} className="text-zinc-500 hover:text-white p-1" title="Restablecer al plan base"><RotateCcw size={13} /></button>}
                  </div>
                </div>

                {!isExcluded && (
                  <>
                    <div className="grid grid-cols-4 gap-1.5">
                      <input type="number" value={ov?.sets ?? ''} onChange={(e) => updateOverride(p.id, { sets: e.target.value ? Number(e.target.value) : null })} placeholder={`Series: ${exercise.sets ?? '—'}`} className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-white" />
                      <input value={ov?.repetitions || ''} onChange={(e) => updateOverride(p.id, { repetitions: e.target.value })} placeholder={`Reps: ${exercise.repetitions || '—'}`} className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-white" />
                      <input type="number" value={ov?.rest_seconds ?? ''} onChange={(e) => updateOverride(p.id, { rest_seconds: e.target.value ? Number(e.target.value) : null })} placeholder={`Desc: ${exercise.rest_seconds ?? '—'}`} className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-white" />
                      <input type="number" value={ov?.prescribed_load_kg ?? ''} onChange={(e) => updateOverride(p.id, { prescribed_load_kg: e.target.value ? Number(e.target.value) : null })} placeholder={`Kg: ${exercise.prescribed_load_kg ?? '—'}`} className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-white" />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <select value={ov?.target_type || ''} onChange={(e) => updateOverride(p.id, { target_type: e.target.value || null })} className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-white">
                        <option value="">Objetivo: {exercise.target_type === 'none' ? 'Sin' : exercise.target_type || '—'}</option>
                        <option value="none">Sin objetivo</option>
                        <option value="RIR">RIR</option>
                        <option value="RPE">RPE</option>
                      </select>
                      <input value={ov?.target_value || ''} onChange={(e) => updateOverride(p.id, { target_value: e.target.value })} placeholder={`Valor: ${exercise.target_value || '—'}`} className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-white" />
                      <input value={ov?.technical_instructions || ''} onChange={(e) => updateOverride(p.id, { technical_instructions: e.target.value })} placeholder="Ind. técnica" className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-white" />
                    </div>
                    <input value={ov?.individual_note || ''} onChange={(e) => updateOverride(p.id, { individual_note: e.target.value })} placeholder="Nota individual para el jugador" className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white" />
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPickerOpen(p.id)} className="flex items-center gap-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300 hover:bg-zinc-700">
                        <Dumbbell size={11} /> {hasReplacement ? ov.replacement_library_exercise_name : 'Reemplazar ejercicio'}
                      </button>
                      {hasReplacement && <button onClick={() => updateOverride(p.id, { replacement_library_exercise_id: '', replacement_library_exercise_name: '' })} className="text-xs text-zinc-500 hover:text-white">Quitar reemplazo</button>}
                    </div>
                  </>
                )}

                <button onClick={() => updateOverride(p.id, { is_excluded: !isExcluded })} className={`flex items-center gap-1 text-xs ${isExcluded ? 'text-emerald-400 hover:text-emerald-300' : 'text-red-400 hover:text-red-300'}`}>
                  {isExcluded ? <><Check size={12} /> Incluir en el ejercicio</> : <><Ban size={12} /> Excluir de este ejercicio</>}
                </button>
              </div>
            );
          })}
        </div>

        <div className="p-3 border-t border-zinc-800 flex items-center justify-between">
          <p className="text-xs text-zinc-500">Los campos vacíos heredan el plan base</p>
          <button onClick={onClose} className="px-4 py-2 bg-white text-zinc-950 rounded-lg text-sm font-bold hover:bg-zinc-200">Listo</button>
        </div>
      </div>

      {pickerOpen && (
        <ExercisePickerModal squadId="" onPick={(lib) => pickReplacement(pickerOpen, lib)} onClose={() => setPickerOpen(null)} />
      )}
    </div>
  );
}