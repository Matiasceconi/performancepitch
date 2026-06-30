import React, { useState, useEffect } from "react";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { base44 } from "@/api/base44Client";
import { Star, Search, ChevronDown, ChevronUp, Activity } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import LibraryExerciseGPS from "@/components/sessions/LibraryExerciseGPS";

const TYPE_COLORS = {
  "Activación": "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  "Técnico": "bg-blue-500/15 text-blue-300 border-blue-500/30",
  "Táctico": "bg-purple-500/15 text-purple-300 border-purple-500/30",
  "Reducido": "bg-orange-500/15 text-orange-300 border-orange-500/30",
  "Posesión": "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "Finalización": "bg-red-500/15 text-red-300 border-red-500/30",
  "Fuerza": "bg-pink-500/15 text-pink-300 border-pink-500/30",
  "Regenerativo": "bg-sky-500/15 text-sky-300 border-sky-500/30",
  "Otro": "bg-zinc-500/15 text-zinc-300 border-zinc-600",
};

export default function FieldLibraryPanel() {
  const { activeSquadId, activeSquad } = useWorkspace();
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterPlayers, setFilterPlayers] = useState("");
  const [sortBy, setSortBy] = useState("times_used");
  const [expanded, setExpanded] = useState({});
  const [activeTab, setActiveTab] = useState({}); // per exercise: "info" | "gps"
  const { toast } = useToast();

  useEffect(() => {
    base44.entities.FieldExerciseLibrary.list("-times_used", 500).then(data => {
      // Mostrar: globales + los del plantel activo (sin squad_id legacy = global)
      const visible = data.filter(e =>
        e.global !== false ||
        !e.squad_id ||
        e.squad_id === activeSquadId
      );
      setExercises(visible);
      setLoading(false);
    });
  }, [activeSquadId]);

  async function toggleFavorite(ex) {
    const updated = await base44.entities.FieldExerciseLibrary.update(ex.id, { favorite: !ex.favorite });
    setExercises(prev => prev.map(e => e.id === ex.id ? { ...e, ...updated } : e));
  }

  const filtered = exercises
    .filter(e => {
      const q = search.toLowerCase();
      const matchSearch = !search ||
        (e.name || "").toLowerCase().includes(q) ||
        (e.objective || "").toLowerCase().includes(q) ||
        (e.description || "").toLowerCase().includes(q);
      const matchType = !filterType || e.type === filterType;
      const matchPlayers = !filterPlayers || (
        filterPlayers === "small" ? (e.players_count || 0) <= 6 :
        filterPlayers === "medium" ? (e.players_count || 0) > 6 && (e.players_count || 0) <= 12 :
        (e.players_count || 0) > 12
      );
      return matchSearch && matchType && matchPlayers;
    })
    .sort((a, b) => {
      if (sortBy === "times_used") return (b.times_used || 0) - (a.times_used || 0);
      if (sortBy === "recent") return new Date(b.last_used_at || 0) - new Date(a.last_used_at || 0);
      if (sortBy === "favorite") return (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      return 0;
    });

  const allTypes = [...new Set(exercises.map(e => e.type).filter(Boolean))];

  if (loading) return <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total ejercicios", value: exercises.length, color: "text-blue-400" },
          { label: "Favoritos", value: exercises.filter(e => e.favorite).length, color: "text-amber-400" },
          { label: "Más usado", value: exercises[0]?.name?.split(" ")[0] || "—", color: "text-emerald-400" },
        ].map(s => (
          <div key={s.label} className="bg-zinc-800/50 rounded-xl p-3 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none">
          <option value="">Todos los tipos</option>
          {allTypes.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={filterPlayers} onChange={e => setFilterPlayers(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none">
          <option value="">Todos los jugadores</option>
          <option value="small">≤6 jugadores</option>
          <option value="medium">7–12 jugadores</option>
          <option value="large">+12 jugadores</option>
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
            ? "La biblioteca se construye automáticamente al crear ejercicios en sesiones de campo."
            : "No hay ejercicios que coincidan con los filtros."}
        </p>
      )}

      {/* Exercise cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map(ex => {
          const tc = TYPE_COLORS[ex.type] || TYPE_COLORS["Otro"];
          const isExp = expanded[ex.id];
          return (
            <div key={ex.id} className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
              {ex.image_url && <img src={ex.image_url} alt={ex.name} className="w-full max-h-40 object-cover" />}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      {ex.type && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tc}`}>{ex.type}</span>}
                      {ex.favorite && <Star size={11} className="text-amber-400 fill-amber-400" />}
                    </div>
                    <p className="text-sm font-semibold text-white truncate">{ex.name}</p>
                    {ex.objective && <p className="text-[11px] text-zinc-400 truncate">{ex.objective}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleFavorite(ex)} className="p-1 text-zinc-500 hover:text-amber-400 transition-colors">
                      <Star size={13} className={ex.favorite ? "fill-amber-400 text-amber-400" : ""} />
                    </button>
                    <button onClick={() => setExpanded(p => ({ ...p, [ex.id]: !p[ex.id] }))}
                      className="p-1 text-zinc-500 hover:text-white transition-colors">
                      {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </div>
                </div>

                {/* Quick metrics */}
                <div className="flex items-center gap-3 text-[10px] text-zinc-500 flex-wrap">
                  {ex.length_m && ex.width_m && <span>{ex.length_m}×{ex.width_m}m</span>}
                  {ex.players_count && <span>{ex.players_count} jug.</span>}
                  {ex.eii && <span className="text-amber-400 font-semibold">EII {ex.eii}</span>}
                  {ex.duration_min && <span>{ex.duration_min} min</span>}
                  <span className="ml-auto text-zinc-600">✓ {ex.times_used || 1} usos</span>
                </div>

                {isExp && (
                  <div className="mt-3 pt-3 border-t border-zinc-700">
                    {/* Sub-tabs */}
                    <div className="flex gap-1 mb-3">
                      {[
                        { key: "info", label: "Información" },
                        { key: "gps",  label: "Carga externa", icon: Activity },
                      ].map(t => (
                        <button key={t.key}
                          onClick={() => setActiveTab(p => ({ ...p, [ex.id]: t.key }))}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                            (activeTab[ex.id] || "info") === t.key
                              ? "bg-zinc-700 text-white"
                              : "text-zinc-500 hover:text-zinc-300"
                          }`}>
                          {t.icon && <t.icon size={10} />} {t.label}
                        </button>
                      ))}
                    </div>

                    {(activeTab[ex.id] || "info") === "info" && (
                      <div className="space-y-2">
                        {ex.description && <p className="text-xs text-zinc-400">{ex.description}</p>}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {ex.blocks && <div><span className="text-zinc-500">Bloques: </span><span className="text-zinc-300">{ex.blocks}</span></div>}
                          {ex.work_time && <div><span className="text-zinc-500">Trabajo: </span><span className="text-zinc-300">{ex.work_time}</span></div>}
                          {ex.rest_time && <div><span className="text-zinc-500">Pausa: </span><span className="text-zinc-300">{ex.rest_time}</span></div>}
                          {ex.total_area && <div><span className="text-zinc-500">Área: </span><span className="text-zinc-300">{ex.total_area}m²</span></div>}
                        </div>
                        {ex.last_used_at && <p className="text-[10px] text-zinc-600">Último uso: {moment(ex.last_used_at).format("DD/MM/YYYY")}</p>}
                        {ex.video_url && (
                          <a href={ex.video_url} target="_blank" rel="noreferrer"
                            className="text-[10px] text-blue-400 hover:text-blue-300">▶ Ver video</a>
                        )}
                        {ex.notes && <p className="text-[10px] text-zinc-500 italic">{ex.notes}</p>}
                      </div>
                    )}

                    {(activeTab[ex.id] || "info") === "gps" && (
                      <LibraryExerciseGPS libraryExerciseId={ex.id} />
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