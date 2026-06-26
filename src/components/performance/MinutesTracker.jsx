import React, { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

// Datos por torneo extraídos del Excel
// Amistosos: 3 partidos (col 5,7,9) - Reserva: Torneo Proyección Apertura 2026 (fechas 1-18) - Juveniles: JUV F1-F15
const PLAYERS_RAW = [
  {
    num: 1, name: "Ayala Gastón",
    amistosos_res: 50+47+45, // 142 min en amistosos Reserva
    reserva: 1165,
    amistosos_juv: 0,
    juveniles: 70,
  },
  {
    num: 2, name: "Blasquez Thomas",
    amistosos_res: 0,
    reserva: 16,
    amistosos_juv: 0+0+0,
    juveniles: 160,
  },
  {
    num: 3, name: "Cabrera Jonás",
    amistosos_res: 50+43+33,
    reserva: 977,
    amistosos_juv: 0,
    juveniles: 0,
  },
  {
    num: 4, name: "Cantero Emiliano",
    amistosos_res: 41+42+60,
    reserva: 733,
    amistosos_juv: 0,
    juveniles: 285,
  },
  {
    num: 5, name: "Capponi José",
    amistosos_res: 25+60+70,
    reserva: 122,
    amistosos_juv: 0,
    juveniles: 541,
  },
  {
    num: 6, name: "Coria Alan",
    amistosos_res: 50+60+72,
    reserva: 507,
    amistosos_juv: 0,
    juveniles: 0,
  },
  {
    num: 7, name: "Ejea Joaquín",
    amistosos_res: 50+60+60,
    reserva: 115,
    amistosos_juv: 0,
    juveniles: 525,
  },
  {
    num: 8, name: "Gagliardi Ramiro",
    amistosos_res: 0+60+38,
    reserva: 649,
    amistosos_juv: 0,
    juveniles: 0,
  },
  {
    num: 9, name: "Martínez Thiago",
    amistosos_res: 50+60+72,
    reserva: 1720,
    amistosos_juv: 0,
    juveniles: 0,
  },
  {
    num: 10, name: "Neris Miño Sebastián",
    amistosos_res: 0,
    reserva: 90,
    amistosos_juv: 0,
    juveniles: 923,
  },
  {
    num: 11, name: "Pastrana Franco",
    amistosos_res: 50+45+68,
    reserva: 440,
    amistosos_juv: 0,
    juveniles: 257,
  },
  {
    num: 12, name: "Puchetta Juan",
    amistosos_res: 43+48+40,
    reserva: 131,
    amistosos_juv: 0,
    juveniles: 583,
  },
  {
    num: 13, name: "Rodríguez Máximo",
    amistosos_res: 50+60+72,
    reserva: 1624,
    amistosos_juv: 0,
    juveniles: 0,
  },
  {
    num: 14, name: "Sosa Joan",
    amistosos_res: 50+42+68,
    reserva: 1301,
    amistosos_juv: 0,
    juveniles: 0,
  },
  {
    num: 16, name: "Almada Dylan",
    amistosos_res: 43+42+35,
    reserva: 18,
    amistosos_juv: 0,
    juveniles: 669,
  },
  {
    num: 17, name: "Retamoso Brian",
    amistosos_res: 36+30+43,
    reserva: 291,
    amistosos_juv: 0,
    juveniles: 0,
  },
  {
    num: 18, name: "Guennin Alessandro",
    amistosos_res: 36+60+68,
    reserva: 266,
    amistosos_juv: 0,
    juveniles: 752,
  },
  {
    num: 19, name: "López Mateo",
    amistosos_res: 50+60+72,
    reserva: 1184,
    amistosos_juv: 0,
    juveniles: 0,
  },
  {
    num: 20, name: "López Pablo",
    amistosos_res: 25+60+35,
    reserva: 1183,
    amistosos_juv: 0,
    juveniles: 0,
  },
  {
    num: 21, name: "Loza Valentín",
    amistosos_res: 50+60+35,
    reserva: 663,
    amistosos_juv: 0,
    juveniles: 0,
  },
  {
    num: 22, name: "Quiroga Lautaro",
    amistosos_res: 50+55+56,
    reserva: 95,
    amistosos_juv: 0,
    juveniles: 362,
  },
  {
    num: 23, name: "Vázquez Lautaro",
    amistosos_res: 60+40+72,
    reserva: 348,
    amistosos_juv: 0,
    juveniles: 354,
  },
  {
    num: 24, name: "Moreno Juan",
    amistosos_res: 40+60+72,
    reserva: 1080,
    amistosos_juv: 0,
    juveniles: 0,
  },
  {
    num: 25, name: "Noguera Facundo",
    amistosos_res: 0+30+85,
    reserva: 1360,
    amistosos_juv: 0,
    juveniles: 0,
  },
  {
    num: 26, name: "Quintana Facundo",
    amistosos_res: 0+30+85,
    reserva: 1727,
    amistosos_juv: 0,
    juveniles: 0,
  },
  {
    num: 27, name: "Uriel Ramos",
    amistosos_res: 0,
    reserva: 0,
    amistosos_juv: 0,
    juveniles: 381,
  },
  {
    num: 28, name: "Patricio Flores",
    amistosos_res: 0,
    reserva: 0,
    amistosos_juv: 0,
    juveniles: 663,
  },
];

const TORNEOS = [
  { id: "all",         label: "Todo el semestre",            res_total: 1727, juv_total: 1252 },
  { id: "reserva",     label: "Torneo Proyección Apertura 2026", res_total: 1727, juv_total: null },
  { id: "juveniles",   label: "Torneo Juveniles 2026",       res_total: null,  juv_total: 1252 },
  { id: "amistosos",   label: "Amistosos",                   res_total: 182,   juv_total: null },
];

function getMinutes(p, torneoId) {
  switch (torneoId) {
    case "reserva":   return { res: p.reserva,      juv: null };
    case "juveniles": return { res: null,            juv: p.juveniles };
    case "amistosos": return { res: p.amistosos_res, juv: p.amistosos_juv };
    default:          return { res: p.reserva,       juv: p.juveniles };
  }
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
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("res");
  const [torneoId, setTorneoId] = useState("all");

  const torneo = TORNEOS.find((t) => t.id === torneoId);
  const showRes = torneo.res_total !== null;
  const showJuv = torneo.juv_total !== null;

  const filtered = PLAYERS_RAW
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .map((p) => ({ ...p, ...getMinutes(p, torneoId) }))
    .filter((p) => (showRes ? p.res > 0 : false) || (showJuv ? p.juv > 0 : false) || (!showRes && !showJuv))
    .sort((a, b) => {
      if (sortBy === "juv") return (b.juv || 0) - (a.juv || 0);
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return (b.res || 0) - (a.res || 0);
    });

  // Mostrar todos si ninguno tiene minutos (evitar lista vacía rara)
  const display = filtered.length > 0 ? filtered : PLAYERS_RAW.map((p) => ({ ...p, ...getMinutes(p, torneoId) }));

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
          {/* Filtro torneo */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            {TORNEOS.map((t) => (
              <button key={t.id} onClick={() => setTorneoId(t.id)}
                className={`px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${torneoId === t.id ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>
                {t.label}
              </button>
            ))}
          </div>
          {/* Sort */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            {showRes && <button onClick={() => setSortBy("res")} className={`px-3 py-1.5 text-xs font-medium transition-all ${sortBy === "res" ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>↓ Reserva</button>}
            {showJuv && <button onClick={() => setSortBy("juv")} className={`px-3 py-1.5 text-xs font-medium transition-all ${sortBy === "juv" ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>↓ Juv.</button>}
            <button onClick={() => setSortBy("name")} className={`px-3 py-1.5 text-xs font-medium transition-all ${sortBy === "name" ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>A-Z</button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className={`grid text-xs text-zinc-500 uppercase tracking-wider px-4 py-2.5 border-b border-zinc-800`}
          style={{ gridTemplateColumns: showRes && showJuv ? "2rem 1fr 1fr 1fr" : "2rem 1fr 1fr" }}>
          <span>#</span>
          <span>Jugador</span>
          {showRes && <span>Reserva</span>}
          {showJuv && <span>Juveniles</span>}
        </div>

        <div className="divide-y divide-zinc-800/50">
          {display.map((p) => (
            <div key={p.num}
              className="grid items-center gap-4 px-4 py-3 hover:bg-zinc-800/30 transition-colors"
              style={{ gridTemplateColumns: showRes && showJuv ? "2rem 1fr 1fr 1fr" : "2rem 1fr 1fr" }}>
              <span className="text-zinc-600 text-sm font-mono">{p.num}</span>
              <p className="text-sm text-white font-medium">{p.name}</p>

              {showRes && (
                <div className="space-y-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-white font-semibold text-sm">{p.res}'</span>
                    <span className="text-zinc-500 text-xs">/ {torneo.res_total}'</span>
                  </div>
                  <PctBar pct={torneo.res_total > 0 ? p.res / torneo.res_total : 0} color={getPctColor(p.res / torneo.res_total)} />
                </div>
              )}

              {showJuv && (
                <div className="space-y-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-white font-semibold text-sm">{p.juv}'</span>
                    <span className="text-zinc-500 text-xs">/ {torneo.juv_total}'</span>
                  </div>
                  <PctBar pct={torneo.juv_total > 0 ? p.juv / torneo.juv_total : 0} color={getPctColor(p.juv / torneo.juv_total)} />
                </div>
              )}
            </div>
          ))}
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