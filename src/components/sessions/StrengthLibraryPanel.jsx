import React, { useState, useEffect } from "react";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { base44 } from "@/api/base44Client";
import { Star, Search, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

const METHOD_COLORS = {
  "Dinámicos": "bg-blue-500/15 text-blue-300 border-blue-500/30",
  "Balísticos": "bg-orange-500/15 text-orange-300 border-orange-500/30",
  "Biseries": "bg-purple-500/15 text-purple-300 border-purple-500/30",
  "Triseries": "bg-pink-500/15 text-pink-300 border-pink-500/30",
  "Contrastes": "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "Complejos": "bg-red-500/15 text-red-300 border-red-500/30",
  "Isométricos": "bg-amber-500/15 text-amber-300 border-amber-500/30",
  "Excéntricos": "bg-sky-500/15 text-sky-300 border-sky-500/30",
  "Preventivos": "bg-teal-500/15 text-teal-300 border-teal-500/30",
  "Otro": "bg-zinc-500/15 text-zinc-300 border-zinc-600",
};

export default function StrengthLibraryPanel() {
  const { activeSquadId } = useWorkspace();
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [sortBy, setSortBy] = useState("times_used");
  const [expanded, setExpanded] = useState({});
  const { toast } = useToast();

  useEffect(() => {
    base44.entities.StrengthExerciseLibrary.list("-times_used", 500).then(data => {
      const visible = data.filter(e => e.global === true || e.squad_id === activeSquadId);
      setExercises(visible);
      setLoading(false);
    });
  }, [activeSquadId]);

  async function toggleFavorite(ex) {
    const updated = await base44.entities.StrengthExerciseLibrary.update(ex.id, { favorite: !ex.favorite });
    setExercises(prev => prev.map(e => e.id === ex.id ? { ...e, ...updated } : e));
  }

  async function handleDelete(ex) {
    if (!window.confirm(`¿Eliminar "${ex.name}" de la biblioteca?`)) return;
    await base44.entities.StrengthExerciseLibrary.delete(ex.id);
    setExercises(prev => prev.filter(e => e.id !== ex.id));
    toast({ title: "✓ Ejercicio eliminado de la biblioteca" });
  }

  const filtered = exercises
    .filter(e => {
      const q = search.toLowerCase();
      const matchSearch = !search ||
        (e.name || "").toLowerCase().includes(q) ||
        (e.exercise_type || "").toLowerCase().includes(q);
      const matchMethod = !filterMethod || e.method === filterMethod;
      return matchSearch && matchMethod;
    })
    .sort((a, b) => {
      if (sortBy === "times_used") return (b.times_used || 0) - (a.times_used || 0);
      if (sortBy === "recent") return new Date(b.last_used_at || 0) - new Date(a.last_used_at || 0);
      if (sortBy === "favorite") return (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
      return (a.name || "").localeCompare(b.name || "");
    });

  const allMethods = [...new Set(exercises.map(e => e.method).filter(Boolean))];

  if (loading) return <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total ejercicios", value: exercises.length, color: "text-orange-400" },
          { label: "Favoritos", value: exercises.filter(e => e.favorite).length, color: "text-amber-400" },
          { label: "Más usado", value: exercises[0]?.name?.split(" ")[0] || "—", color: "text-blue-400" },
        ].map(s => (
          <div key={s.label} className="bg-zinc-800/50 rounded-xl p-3 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none" />
        </div>
        <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none">
          <option value="">Todos los métodos</option>
          {allMethods.map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none">
          <option value="times_used">Más usados</option>
          <option value="recent">Más recientes</option>
          <option value="favorite">Favoritos primero</option>
          <option value="name">Nombre A-Z</option>
        </select>
      </div>

      {filtered.length === 0 && (
        <p className="text-zinc-600 text-sm text-center py-8">
          {exercises.length === 0
            ? "La biblioteca se construye automáticamente al crear estaciones de fuerza."
            : "No hay ejercicios que coincidan."}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map(ex => {
          const mc = METHOD_COLORS[ex.method] || METHOD_COLORS["Otro"];
          const isExp = expanded[ex.id];
          return (
            <div key={ex.id} className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
              {ex.image_url && <img src={ex.image_url} alt={ex.name} className="w-full max-h-36 object-cover" />}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      {ex.method && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${mc}`}>{ex.method}</span>}
                      {ex.exercise_type && <span className="text-[10px] text-zinc-500">{ex.exercise_type}</span>}
                      {ex.favorite && <Star size={11} className="text-amber-400 fill-amber-400" />}
                    </div>
                    <p className="text-sm font-semibold text-white truncate">{ex.name}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => toggleFavorite(ex)} className="p-1 text-zinc-500 hover:text-amber-400 transition-colors">
                      <Star size={13} className={ex.favorite ? "fill-amber-400 text-amber-400" : ""} />
                    </button>
                    <button onClick={() => setExpanded(p => ({ ...p, [ex.id]: !p[ex.id] }))}
                      className="p-1 text-zinc-500 hover:text-white transition-colors">
                      {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    <button onClick={() => handleDelete(ex)} className="p-1 text-zinc-500 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-zinc-500 flex-wrap">
                  {ex.volume && <span className="text-amber-300 font-semibold">{ex.volume}</span>}
                  <span className="ml-auto text-zinc-600">✓ {ex.times_used || 1} usos</span>
                </div>
                {isExp && (
                  <div className="mt-3 pt-3 border-t border-zinc-700 space-y-2">
                    {ex.description && <p className="text-xs text-zinc-400">{ex.description}</p>}
                    {ex.notes && <p className="text-xs text-zinc-500">{ex.notes}</p>}
                    {ex.last_used_at && <p className="text-[10px] text-zinc-600">Último uso: {moment(ex.last_used_at).format("DD/MM/YYYY")}</p>}
                    {ex.video_url && (
                      <a href={ex.video_url} target="_blank" rel="noreferrer"
                        className="text-[10px] text-blue-400 hover:text-blue-300">▶ Ver video</a>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}