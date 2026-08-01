import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, X, Loader2, Dumbbell, Video } from 'lucide-react';

export default function ExercisePickerModal({ squadId, onPick, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const rows = await base44.entities.StrengthExerciseLibrary.list('name', 500);
        setItems(rows);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = items.filter((e) => !e.squad_id || e.global || e.squad_id === squadId);
    if (!q) return list;
    return list.filter((e) => (e.name || '').toLowerCase().includes(q) || (e.aliases || []).some((a) => a.toLowerCase().includes(q)));
  }, [items, search, squadId]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 className="text-white font-bold">Biblioteca de ejercicios</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-4 border-b border-zinc-800">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar ejercicio..." className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-zinc-600" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-zinc-500 text-sm py-8">Sin resultados</p>
          ) : filtered.map((ex) => (
            <button key={ex.id} onClick={() => { onPick(ex); onClose(); }} className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-800 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 overflow-hidden shrink-0 flex items-center justify-center">
                {ex.image_url ? <img src={ex.image_url} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} /> : <Dumbbell size={16} className="text-zinc-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{ex.name}</p>
                <p className="text-xs text-zinc-500">{[ex.method, ex.exercise_type].filter(Boolean).join(' · ') || 'Sin clasificar'}</p>
              </div>
              {ex.video_url && <Video size={14} className="text-zinc-600 shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}