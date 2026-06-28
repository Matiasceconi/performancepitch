import React, { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";

const TORNEOS = [
  { id: "all",                  label: "Todo el semestre",                res_total: 1727, juv_total: 1252 },
  { id: "Proyección Apertura",  label: "Torneo Proyección Apertura 2026", res_total: 1727, juv_total: null },
  { id: "Juveniles",            label: "Torneo Juveniles 2026",           res_total: null,  juv_total: 1252 },
  { id: "Amistosos",            label: "Amistosos",                       res_total: 182,   juv_total: null },
];

function PctBar({ pct, color }) {
  const width = Math.min(100, Math.round(pct * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
      <span className="text-xs font-mono w-10 text-right">{width}%</span>
    </div>
  );
}

function getPctColor(pct) {
  if (pct >= 0.7) return "bg-emerald-400";
  if (pct >= 0.4) return "bg-yellow-400";
  if (pct >= 0.1) return "bg-orange-400";
  return "bg-zinc-600";
}

function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export default function MinutesTracker() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("res");
  const [torneoId, setTorneoId] = useState("all");
  const [records, setRecords] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.MinutesRecord.list("-created_date", 500),
      base44.entities.Player.list("-created_date", 200),
    ]).then(([recs, plrs]) => {
      setRecords(recs);
      setPlayers(plrs);
    }).finally(() => setLoading(false));

    // Suscripción en tiempo real: refresca cuando cambia cualquier MinutesRecord
    const unsub = base44.entities.MinutesRecord.subscribe(() => {
      base44.entities.MinutesRecord.list("-created_date", 500).then(setRecords);
    });
    return () => unsub();
  }, []);

  // Mapa player_id -> foto
  const photoMap = useMemo(() => {
    const map = {};
    players.forEach(p => { if (p.photo_url) map[p.id] = p.photo_url; });
    return map;
  }, [players]);

  // Mapa player_id -> jersey_number
  const numberMap = useMemo(() => {
    const map = {};
    players.forEach(p => { if (p.jersey_number) map[p.id] = p.jersey_number; });
    return map;
  }, [players]);

  // Consolidar registros por jugador (player_id o player_name como fallback)
  const playerData = useMemo(() => {
    const map = {};

    records.forEach(r => {
      const key = r.player_id || `name:${norm(r.player_name)}`;
      if (!map[key]) {
        map[key] = {
          player_id: r.player_id || null,
          player_name: r.player_name,
          player_number: r.player_number,
          reserva: 0,
          juveniles: 0,
          amistosos: 0,
        };
      }
      const t = r.tournament;
      const mins = r.minutes || 0;
      if (t === "Proyección Apertura") map[key].reserva += mins;
      else if (t === "Juveniles") map[key].juveniles += mins;
      else if (t === "Amistosos") map[key].amistosos += mins;
    });

    return Object.values(map);
  }, [records]);

  const torneo = TORNEOS.find(t => t.id === torneoId);
  const showRes = torneo.res_total !== null;
  const showJuv = torneo.juv_total !== null;

  function getMinutes(p) {
    switch (torneoId) {
      case "Proyección Apertura": return { res: p.reserva,    juv: null };
      case "Juveniles":           return { res: null,          juv: p.juveniles };
      case "Amistosos":           return { res: p.amistosos,   juv: null };
      default:                    return { res: p.reserva,     juv: p.juveniles };
    }
  }

  const display = useMemo(() => {
    return playerData
      .filter(p => !search || norm(p.player_name).includes(norm(search)))
      .map(p => ({ ...p, ...getMinutes(p) }))
      .sort((a, b) => {
        if (sortBy === "juv")  return (b.juv || 0) - (a.juv || 0);
        if (sortBy === "name") return (a.player_name || "").localeCompare(b.player_name || "");
        return (b.res || 0) - (a.res || 0);
      });
  }, [playerData, search, sortBy, torneoId]);

  const cols = showRes && showJuv ? "2rem 2.5rem 1fr 1fr 1fr" : "2rem 2.5rem 1fr 1fr";

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4">
        {showRes && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total disponible — Reserva</p>
            <p className="text-2xl font-bold text-white">{torneo.res_total.toLocaleString()}'</p>
            <p className="text-xs text-zinc-500 mt-1">{torneo.label}</p>
          </div>
        )}
        {showJuv && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total disponible — Juveniles</p>
            <p className="text-2xl font-bold text-white">{torneo.juv_total.toLocaleString()}'</p>
            <p className="text-xs text-zinc-500 mt-1">{torneo.label}</p>
          </div>
        )}
      </div>

      {/* Controles */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar jugador..."
            className="bg-zinc-900 border-zinc-800 text-white pl-8 w-56 h-8 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            {TORNEOS.map((t) => (
              <button key={t.id} onClick={() => { setTorneoId(t.id); setSortBy(t.res_total ? "res" : "juv"); }}
                className={`px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${torneoId === t.id ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            {showRes && <button onClick={() => setSortBy("res")} className={`px-3 py-1.5 text-xs font-medium transition-all ${sortBy === "res" ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>↓ Reserva</button>}
            {showJuv && <button onClick={() => setSortBy("juv")} className={`px-3 py-1.5 text-xs font-medium transition-all ${sortBy === "juv" ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>↓ Juv.</button>}
            <button onClick={() => setSortBy("name")} className={`px-3 py-1.5 text-xs font-medium transition-all ${sortBy === "name" ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>A-Z</button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="grid text-xs text-zinc-500 uppercase tracking-wider px-4 py-2.5 border-b border-zinc-800"
          style={{ gridTemplateColumns: cols }}>
          <span>#</span>
          <span />
          <span>Jugador</span>
          {showRes && <span>Reserva</span>}
          {showJuv && <span>Juveniles</span>}
        </div>

        <div className="divide-y divide-zinc-800/50">
          {display.map((p, i) => {
            const photo = p.player_id ? photoMap[p.player_id] : null;
            const num = p.player_id ? (numberMap[p.player_id] || p.player_number) : p.player_number;
            return (
              <div key={p.player_id || p.player_name}
                className="grid items-center gap-4 px-4 py-2.5 hover:bg-zinc-800/30 transition-colors"
                style={{ gridTemplateColumns: cols }}>
                <span className="text-zinc-600 text-sm font-mono">{num || i + 1}</span>
                {photo ? (
                  <img src={photo} alt={p.player_name} className="w-8 h-8 rounded-full object-cover border border-zinc-700 shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-zinc-500">{(p.player_name || "?").charAt(0)}</span>
                  </div>
                )}
                <p className="text-sm text-white font-medium">{p.player_name}</p>

                {showRes && (
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-white font-semibold text-sm">{p.res ?? 0}'</span>
                      <span className="text-zinc-500 text-xs">/ {torneo.res_total}'</span>
                    </div>
                    <PctBar pct={torneo.res_total > 0 ? (p.res || 0) / torneo.res_total : 0} color={getPctColor((p.res || 0) / torneo.res_total)} />
                  </div>
                )}

                {showJuv && (
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-white font-semibold text-sm">{p.juv ?? 0}'</span>
                      <span className="text-zinc-500 text-xs">/ {torneo.juv_total}'</span>
                    </div>
                    <PctBar pct={torneo.juv_total > 0 ? (p.juv || 0) / torneo.juv_total : 0} color={getPctColor((p.juv || 0) / torneo.juv_total)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-emerald-400 inline-block" /> ≥70%</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-yellow-400 inline-block" /> 40–69%</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-orange-400 inline-block" /> 10–39%</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-zinc-600 inline-block" /> &lt;10%</span>
      </div>
    </div>
  );
}