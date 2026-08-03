import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Users, Loader2, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useWorkspace } from "@/lib/WorkspaceContext";
import ValdProductBadge, { PRODUCTS } from "@/components/vald/ValdProductBadge";

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}

export default function ValdPlayers() {
  const { activeSquad } = useWorkspace();
  const [profiles, setProfiles] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [profs, allTests] = await Promise.all([
          base44.entities.ValdProfile.filter(activeSquad?.id ? { squad_id: activeSquad.id } : {}, "player_name", 500),
          base44.entities.ValdTest.filter(activeSquad?.id ? { squad_id: activeSquad.id } : {}, "-test_date", 500),
        ]);
        setProfiles(profs || []);
        setTests(allTests || []);
      } catch (e) { console.error("vald players", e); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [activeSquad?.id]);

  const playerStats = useMemo(() => {
    const stats = {};
    for (const t of tests) {
      const key = t.vald_profile_id || t.player_id || t.player_name;
      if (!stats[key]) stats[key] = { count: 0, lastDate: null, products: new Set() };
      stats[key].count++;
      if (!stats[key].lastDate || new Date(t.test_date) > new Date(stats[key].lastDate)) {
        stats[key].lastDate = t.test_date;
      }
      if (t.product) stats[key].products.add(t.product);
    }
    return stats;
  }, [tests]);

  const filtered = useMemo(() => {
    if (!search) return profiles;
    const q = search.toLowerCase();
    return profiles.filter(p => (p.player_name || "").toLowerCase().includes(q));
  }, [profiles, search]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="h-16 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-32 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
            <Users size={22} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Jugadores VALD</h1>
            <p className="text-xs text-zinc-500">{profiles.length} perfiles · {tests.length} tests</p>
          </div>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar jugador..."
            className="pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-zinc-600 outline-none w-64"
          />
        </div>
      </div>

      {!filtered.length ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
          <Users size={32} className="text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm font-medium">No hay perfiles de VALD</p>
          <p className="text-zinc-600 text-xs mt-1">Ejecuta una sincronización desde el dashboard.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => {
            const key = p.vald_profile_id || p.id;
            const stat = playerStats[key] || { count: 0, lastDate: null, products: new Set() };
            const linked = !!p.player_id;
            return (
              <Link
                key={p.id}
                to={p.player_id ? `/vald/players/${p.player_id}` : "#"}
                className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-zinc-700 transition-colors ${!p.player_id ? "pointer-events-none" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-zinc-400">{(p.player_name || "?").charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{p.player_name || "—"}</p>
                    <p className="text-xs text-zinc-500 truncate">{p.squad_name || "Sin plantel"}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {linked ? (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Vinculado</span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700">Sin vincular</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
                  <div>
                    <p className="text-xs text-zinc-500">Tests</p>
                    <p className="text-lg font-bold text-white">{stat.count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Último</p>
                    <p className="text-sm font-medium text-zinc-300">{fmtDate(stat.lastDate)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end max-w-[120px]">
                    {PRODUCTS.filter(pr => stat.products.has(pr)).map(pr => (
                      <ValdProductBadge key={pr} product={pr} />
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}