import React, { useState } from "react";
import { Search, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";

// Datos extraídos del Excel - Minutos Oficiales 1er Semestre 2026
const PLAYERS_DATA = [
  { num: 1,  name: "Ayala Gastón",          juv_min: 70,   juv_pct: 0.0559, res_min: 1165, res_pct: 0.6746 },
  { num: 2,  name: "Blasquez Thomas",        juv_min: 160,  juv_pct: 0.1278, res_min: 16,   res_pct: 0.0093 },
  { num: 3,  name: "Cabrera Jonás",           juv_min: 0,    juv_pct: 0,      res_min: 977,  res_pct: 0.5657 },
  { num: 4,  name: "Cantero Emiliano",        juv_min: 285,  juv_pct: 0.2276, res_min: 733,  res_pct: 0.4244 },
  { num: 5,  name: "Capponi José",            juv_min: 541,  juv_pct: 0.4321, res_min: 122,  res_pct: 0.0706 },
  { num: 6,  name: "Coria Alan",              juv_min: 0,    juv_pct: 0,      res_min: 507,  res_pct: 0.2936 },
  { num: 7,  name: "Ejea Joaquín",            juv_min: 525,  juv_pct: 0.4193, res_min: 115,  res_pct: 0.0666 },
  { num: 8,  name: "Gagliardi Ramiro",        juv_min: 0,    juv_pct: 0,      res_min: 649,  res_pct: 0.3758 },
  { num: 9,  name: "Martínez Thiago",         juv_min: 0,    juv_pct: 0,      res_min: 1720, res_pct: 0.9959 },
  { num: 10, name: "Neris Miño Sebastián",    juv_min: 923,  juv_pct: 0.7372, res_min: 90,   res_pct: 0.0521 },
  { num: 11, name: "Pastrana Franco",         juv_min: 257,  juv_pct: 0.2053, res_min: 440,  res_pct: 0.2548 },
  { num: 12, name: "Puchetta Juan",           juv_min: 583,  juv_pct: 0.4657, res_min: 131,  res_pct: 0.0759 },
  { num: 13, name: "Rodríguez Máximo",        juv_min: 0,    juv_pct: 0,      res_min: 1624, res_pct: 0.9404 },
  { num: 14, name: "Sosa Joan",               juv_min: 0,    juv_pct: 0,      res_min: 1301, res_pct: 0.7533 },
  { num: 16, name: "Almada Dylan",            juv_min: 669,  juv_pct: 0.5343, res_min: 18,   res_pct: 0.0104 },
  { num: 17, name: "Retamoso Brian",          juv_min: 0,    juv_pct: 0,      res_min: 291,  res_pct: 0.1685 },
  { num: 18, name: "Guennin Alessandro",      juv_min: 752,  juv_pct: 0.6006, res_min: 266,  res_pct: 0.1540 },
  { num: 19, name: "López Mateo",             juv_min: 0,    juv_pct: 0,      res_min: 1184, res_pct: 0.6856 },
  { num: 20, name: "López Pablo",             juv_min: 0,    juv_pct: 0,      res_min: 1183, res_pct: 0.6850 },
  { num: 21, name: "Loza Valentín",           juv_min: 0,    juv_pct: 0,      res_min: 663,  res_pct: 0.3839 },
  { num: 22, name: "Quiroga Lautaro",         juv_min: 362,  juv_pct: 0.2891, res_min: 95,   res_pct: 0.0550 },
  { num: 23, name: "Vázquez Lautaro",         juv_min: 354,  juv_pct: 0.2827, res_min: 348,  res_pct: 0.2015 },
  { num: 24, name: "Moreno Juan",             juv_min: 0,    juv_pct: 0,      res_min: 1080, res_pct: 0.6254 },
  { num: 25, name: "Noguera Facundo",         juv_min: 0,    juv_pct: 0,      res_min: 1360, res_pct: 0.7875 },
  { num: 26, name: "Quintana Facundo",        juv_min: 0,    juv_pct: 0,      res_min: 1727, res_pct: 1.0000 },
  { num: 27, name: "Uriel Ramos",             juv_min: 381,  juv_pct: 0.3043, res_min: 0,    res_pct: 0 },
  { num: 28, name: "Patricio Flores",         juv_min: 663,  juv_pct: 0.5296, res_min: 0,    res_pct: 0 },
];

// Total minutos del campeonato por competición (según el Excel)
const TOTAL_JUV = 1252;
const TOTAL_RES = 1727;

function PctBar({ pct, color }) {
  const width = Math.round(pct * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${width}%` }}
        />
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
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("res_min"); // res_min | juv_min | name
  const [view, setView] = useState("both"); // both | reserva | juveniles

  const filtered = PLAYERS_DATA
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "juv_min") return b.juv_min - a.juv_min;
      return b.res_min - a.res_min;
    });

  const totalJuvPlayed = PLAYERS_DATA.reduce((s, p) => s + p.juv_min, 0);
  const totalResPlayed = PLAYERS_DATA.reduce((s, p) => s + p.res_min, 0);

  return (
    <div className="space-y-5">
      {/* Header stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Minutos totales Reserva</p>
          <p className="text-2xl font-bold text-white">{TOTAL_RES.toLocaleString()}'</p>
          <p className="text-xs text-zinc-500 mt-1">18 fechas oficiales</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Minutos totales Juveniles</p>
          <p className="text-2xl font-bold text-white">{TOTAL_JUV.toLocaleString()}'</p>
          <p className="text-xs text-zinc-500 mt-1">15 fechas oficiales</p>
        </div>
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
        <div className="flex gap-2">
          {/* Vista */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            {[{ id: "both", label: "Ambas" }, { id: "reserva", label: "Reserva" }, { id: "juveniles", label: "Juveniles" }].map((v) => (
              <button key={v.id} onClick={() => setView(v.id)}
                className={`px-3 py-1.5 text-xs font-medium transition-all ${view === v.id ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>
                {v.label}
              </button>
            ))}
          </div>
          {/* Sort */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            {[{ id: "res_min", label: "↓ Reserva" }, { id: "juv_min", label: "↓ Juv." }, { id: "name", label: "A-Z" }].map((s) => (
              <button key={s.id} onClick={() => setSortBy(s.id)}
                className={`px-3 py-1.5 text-xs font-medium transition-all ${sortBy === s.id ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="grid text-xs text-zinc-500 uppercase tracking-wider px-4 py-2.5 border-b border-zinc-800"
          style={{ gridTemplateColumns: view === "both" ? "2rem 1fr 1fr 1fr" : "2rem 1fr 1fr" }}>
          <span>#</span>
          <span>Jugador</span>
          {(view === "both" || view === "reserva") && <span>Reserva</span>}
          {(view === "both" || view === "juveniles") && <span>Juveniles</span>}
        </div>

        <div className="divide-y divide-zinc-800/50">
          {filtered.map((p) => (
            <div key={p.num}
              className="grid items-center gap-4 px-4 py-3 hover:bg-zinc-800/30 transition-colors"
              style={{ gridTemplateColumns: view === "both" ? "2rem 1fr 1fr 1fr" : "2rem 1fr 1fr" }}>
              <span className="text-zinc-600 text-sm font-mono">{p.num}</span>

              <div>
                <p className="text-sm text-white font-medium">{p.name}</p>
              </div>

              {(view === "both" || view === "reserva") && (
                <div className="space-y-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-white font-semibold text-sm">{p.res_min}'</span>
                    <span className="text-zinc-500 text-xs">/ {TOTAL_RES}'</span>
                  </div>
                  <PctBar pct={p.res_pct} color={getPctColor(p.res_pct)} />
                </div>
              )}

              {(view === "both" || view === "juveniles") && (
                <div className="space-y-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-white font-semibold text-sm">{p.juv_min}'</span>
                    <span className="text-zinc-500 text-xs">/ {TOTAL_JUV}'</span>
                  </div>
                  <PctBar pct={p.juv_pct} color={getPctColor(p.juv_pct)} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-emerald-400 inline-block" /> ≥70%</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-yellow-400 inline-block" /> 40-69%</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-orange-400 inline-block" /> 10-39%</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-zinc-600 inline-block" /> &lt;10%</span>
      </div>
    </div>
  );
}