import React, { useState, useEffect } from "react";
import { Loader2, Inbox, Search, Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useWorkspace } from "@/lib/WorkspaceContext";

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" }); }
  catch { return iso; }
}

export default function EvaluationsPlayers() {
  const { activeSquad } = useWorkspace();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const filter = activeSquad?.id ? { squad_id: activeSquad.id } : {};
    base44.entities.EvaluationResult.filter(filter, "-assessment_date", 500)
      .then((data) => setResults(data || []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [activeSquad?.id]);

  if (loading) return <div className="py-10 flex justify-center"><Loader2 size={20} className="text-zinc-500 animate-spin" /></div>;

  // Group by player
  const byPlayer = new Map();
  for (const r of results) {
    const key = r.player_id || r.player_name_csv;
    if (!byPlayer.has(key)) {
      byPlayer.set(key, {
        player_id: r.player_id,
        player_name: r.player_name_csv,
        squad_name: r.squad_name,
        linking_status: r.linking_status,
        last_date: r.assessment_date,
        test_count: 0,
        result_count: 0,
        tests: new Set(),
      });
    }
    const p = byPlayer.get(key);
    p.result_count++;
    p.tests.add(r.test_key);
    if (r.assessment_date > p.last_date) p.last_date = r.assessment_date;
  }

  const players = [...byPlayer.values()].map((p) => ({ ...p, test_count: p.tests.size, tests: [...p.tests] }));
  const filtered = search ? players.filter((p) => p.player_name.toLowerCase().includes(search.toLowerCase())) : players;

  if (!filtered.length) {
    return (
      <div className="py-12 text-center">
        <Users size={28} className="text-zinc-600 mx-auto mb-2" />
        <p className="text-zinc-500 text-sm">No hay jugadores con evaluaciones</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar jugador..." className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((p) => (
          <div key={p.player_id || p.player_name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-zinc-400">{(p.player_name || "?").charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{p.player_name}</p>
                <p className="text-xs text-zinc-500 truncate">{p.squad_name || "Sin plantel"}</p>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                p.linking_status === "linked" ? "bg-emerald-500/15 text-emerald-300" :
                p.linking_status === "collision" ? "bg-orange-500/15 text-orange-300" :
                "bg-red-500/15 text-red-300"
              }`}>{p.linking_status}</span>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800 text-xs">
              <div><p className="text-zinc-500">Resultados</p><p className="text-white font-bold">{p.result_count}</p></div>
              <div><p className="text-zinc-500">Pruebas</p><p className="text-white font-bold">{p.test_count}</p></div>
              <div><p className="text-zinc-500">Última</p><p className="text-zinc-300">{fmtDate(p.last_date)}</p></div>
            </div>
            <div className="flex gap-1 mt-2">
              {p.tests.map((tk) => (
                <span key={tk} className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 text-[10px] font-bold uppercase">{tk}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}