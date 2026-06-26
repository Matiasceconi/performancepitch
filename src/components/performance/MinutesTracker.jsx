import React, { useState, useEffect, useMemo } from "react";
import { Search, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";

const PLAYER_NUMS = {
  "Ayala Gaston": 1, "Blasquez Thomas": 2, "Cabrera Jonas": 3, "Cantero Emiliano": 4,
  "Capponi Jose": 5, "Coria Alan": 6, "Ejea Joaquin": 7, "Gagliardi Ramiro": 8,
  "Martinez Thiago": 9, "Neris Miño Sebastian": 10, "Pastrana Franco": 11, "Puchetta Juan": 12,
  "Rodriguez Maximo": 13, "Sosa Joan": 14, "Almada Dylan": 16, "Retamoso Brian": 17,
  "Guennin Alessandro": 18, "Lopez Mateo": 19, "Lopez Pablo": 20, "Loza Valentin": 21,
  "Quiroga Lautaro": 22, "Vazquez Lautaro": 23, "Moreno Juan": 24, "Noguera Facundo": 25,
  "Quintana Facundo": 26, "Ramos Uriel": 27, "Flores Patricio": 28,
};

function norm(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

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

export default function MinutesTracker() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("total");
  const [photoMap, setPhotoMap] = useState({});
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    Promise.all([
      base44.entities.MinutesRecord.filter({ tournament: "Juveniles" }, "match_date", 500),
      base44.entities.Player.list("-created_date", 100),
    ]).then(([recs, players]) => {
      setRecords(recs);
      const map = {};
      players.forEach((p) => { map[norm(p.name)] = p.photo_url || null; });
      setPhotoMap(map);
      setLoading(false);
    });
  }, []);

  function getPhoto(name) {
    const key = norm(name);
    if (photoMap[key]) return photoMap[key];
    const keys = Object.keys(photoMap);
    const match = keys.find((k) => k.includes(key) || key.includes(k));
    return match ? photoMap[match] : null;
  }

  // Matches disponibles para mostrar en el selector de fecha
  const allMatches = useMemo(() => {
    const seen = new Set();
    return records
      .filter((r) => r.match_date)
      .map((r) => ({ label: r.match_label, date: r.match_date }))
      .filter((m) => { if (seen.has(m.date)) return false; seen.add(m.date); return true; })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [records]);

  // Fechas mín y máx para mostrar en las cards de resumen
  const minDate = allMatches[0]?.date || "";
  const maxDate = allMatches[allMatches.length - 1]?.date || "";

  // Filtrar registros por rango de fechas
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (!r.match_date) return true;
      if (dateFrom && r.match_date < dateFrom) return false;
      if (dateTo && r.match_date > dateTo) return false;
      return true;
    });
  }, [records, dateFrom, dateTo]);

  // Total de minutos disponibles en el período filtrado (partido con más minutos)
  const maxAvailableByMatch = useMemo(() => {
    const matchTotals = {};
    filteredRecords.forEach((r) => {
      if (!matchTotals[r.match_date] || r.minutes > matchTotals[r.match_date]) {
        matchTotals[r.match_date] = r.minutes;
      }
    });
    return Object.values(matchTotals).reduce((a, b) => a + b, 0);
  }, [filteredRecords]);

  // Contar partidos en el período
  const matchCount = useMemo(() => {
    return new Set(filteredRecords.map((r) => r.match_date)).size;
  }, [filteredRecords]);

  // Agrupar minutos por jugador
  const playerData = useMemo(() => {
    const map = {};
    filteredRecords.forEach((r) => {
      if (!map[r.player_name]) map[r.player_name] = 0;
      map[r.player_name] += Number(r.minutes) || 0;
    });
    return map;
  }, [filteredRecords]);

  // Lista final ordenada
  const display = useMemo(() => {
    const names = Object.keys(playerData);
    return names
      .filter((n) => !search || norm(n).includes(norm(search)))
      .map((n) => ({ name: n, num: PLAYER_NUMS[n] || 99, total: playerData[n] }))
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        return b.total - a.total;
      });
  }, [playerData, search, sortBy]);

  const activeFilters = dateFrom || dateTo;

  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total disponible</p>
          <p className="text-2xl font-bold text-white">{maxAvailableByMatch}'</p>
          <p className="text-xs text-zinc-500 mt-1">Torneo Juveniles 2026</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Partidos en período</p>
          <p className="text-2xl font-bold text-white">{matchCount}</p>
          <p className="text-xs text-zinc-500 mt-1">{activeFilters ? "Según filtro aplicado" : "Total del torneo"}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Jugadores registrados</p>
          <p className="text-2xl font-bold text-white">{display.length}</p>
          <p className="text-xs text-zinc-500 mt-1">{activeFilters ? "Con minutos en el período" : "Plantel completo"}</p>
        </div>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Buscar */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar jugador..."
              className="bg-zinc-900 border-zinc-800 text-white pl-8 w-48 h-8 text-sm"
            />
          </div>

          {/* Filtro de fechas */}
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5">
            <Calendar size={13} className="text-zinc-500 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              min={minDate}
              max={dateTo || maxDate}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-white text-xs outline-none w-32 [color-scheme:dark]"
              placeholder="Desde"
            />
            <span className="text-zinc-600 text-xs">—</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || minDate}
              max={maxDate}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-white text-xs outline-none w-32 [color-scheme:dark]"
              placeholder="Hasta"
            />
            {activeFilters && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="ml-1 text-zinc-500 hover:text-red-400 text-xs transition-colors">✕</button>
            )}
          </div>
        </div>

        {/* Ordenar */}
        <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <button onClick={() => setSortBy("total")} className={`px-3 py-1.5 text-xs font-medium transition-all ${sortBy === "total" ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>↓ Minutos</button>
          <button onClick={() => setSortBy("name")} className={`px-3 py-1.5 text-xs font-medium transition-all ${sortBy === "name" ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>A-Z</button>
        </div>
      </div>

      {/* Partidos en el rango (chips) */}
      {allMatches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allMatches.map((m) => {
            const inRange = (!dateFrom || m.date >= dateFrom) && (!dateTo || m.date <= dateTo);
            return (
              <span key={m.date}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  inRange
                    ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                    : "bg-zinc-800/50 border-zinc-700/50 text-zinc-600"
                }`}>
                {m.label} · {m.date.slice(5).replace("-", "/")}
              </span>
            );
          })}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="grid text-xs text-zinc-500 uppercase tracking-wider px-4 py-2.5 border-b border-zinc-800"
          style={{ gridTemplateColumns: "2rem 2.5rem 1fr 1fr" }}>
          <span>#</span>
          <span />
          <span>Jugador</span>
          <span>Juveniles</span>
        </div>

        <div className="divide-y divide-zinc-800/50">
          {display.map((p) => {
            const photo = getPhoto(p.name);
            const pct = maxAvailableByMatch > 0 ? p.total / maxAvailableByMatch : 0;
            return (
              <div key={p.name}
                className="grid items-center gap-4 px-4 py-2.5 hover:bg-zinc-800/30 transition-colors"
                style={{ gridTemplateColumns: "2rem 2.5rem 1fr 1fr" }}>
                <span className="text-zinc-600 text-sm font-mono">{p.num}</span>
                {photo ? (
                  <img src={photo} alt={p.name} className="w-8 h-8 rounded-full object-cover border border-zinc-700 shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-zinc-500">{p.name.charAt(0)}</span>
                  </div>
                )}
                <p className="text-sm text-white font-medium">{p.name}</p>
                <div className="space-y-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-white font-semibold text-sm">{p.total}'</span>
                    <span className="text-zinc-500 text-xs">/ {maxAvailableByMatch}'</span>
                  </div>
                  <PctBar pct={pct} color={getPctColor(pct)} />
                </div>
              </div>
            );
          })}
          {display.length === 0 && (
            <div className="text-center py-8 text-zinc-500 text-sm">Sin datos para el período seleccionado</div>
          )}
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