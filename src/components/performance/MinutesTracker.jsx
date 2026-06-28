import React, { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";

// Datos estáticos de minutos por torneo
const MINUTES_DATA = [
  { num: 1,  name: "Ayala Gastón",        playerKey: "ayala gaston",          amistosos_res: 142, reserva: 1165, juveniles: 70 },
  { num: 2,  name: "Blasquez Thomas",     playerKey: "thomas blasquez",        amistosos_res: 0,   reserva: 16,   juveniles: 160 },
  { num: 3,  name: "Cabrera Jonás",       playerKey: "jonas cabrera",          amistosos_res: 126, reserva: 977,  juveniles: 0 },
  { num: 4,  name: "Cantero Emiliano",    playerKey: "emiliano cantero",       amistosos_res: 143, reserva: 733,  juveniles: 285 },
  { num: 5,  name: "Capponi José",        playerKey: "jose capponi",           amistosos_res: 155, reserva: 122,  juveniles: 541 },
  { num: 6,  name: "Coria Alan",          playerKey: "alan coria",             amistosos_res: 182, reserva: 507,  juveniles: 0 },
  { num: 7,  name: "Ejea Joaquín",        playerKey: "joaquin ejea",           amistosos_res: 170, reserva: 115,  juveniles: 525 },
  { num: 8,  name: "Gagliardi Ramiro",    playerKey: "ramiro gagliardi",       amistosos_res: 98,  reserva: 649,  juveniles: 0 },
  { num: 9,  name: "Martínez Thiago",     playerKey: "thiago martinez",        amistosos_res: 182, reserva: 1720, juveniles: 0 },
  { num: 10, name: "Neris Miño Sebastián",playerKey: "sebastian neris miño",   amistosos_res: 0,   reserva: 90,   juveniles: 923 },
  { num: 11, name: "Pastrana Franco",     playerKey: "franco pastrana",        amistosos_res: 163, reserva: 440,  juveniles: 257 },
  { num: 12, name: "Puchetta Juan",       playerKey: "juan puchetta",          amistosos_res: 131, reserva: 131,  juveniles: 583 },
  { num: 13, name: "Rodríguez Máximo",    playerKey: "maximo rodriguez",       amistosos_res: 182, reserva: 1624, juveniles: 0 },
  { num: 14, name: "Sosa Joan",           playerKey: "joan sosa",              amistosos_res: 160, reserva: 1301, juveniles: 0 },
  { num: 16, name: "Almada Dylan",        playerKey: "dylan almada",           amistosos_res: 120, reserva: 18,   juveniles: 669 },
  { num: 17, name: "Retamoso Brian",      playerKey: "brian retamoso",         amistosos_res: 109, reserva: 291,  juveniles: 0 },
  { num: 18, name: "Guennin Alessandro",  playerKey: "alessandro guennin",     amistosos_res: 164, reserva: 266,  juveniles: 752 },
  { num: 19, name: "López Mateo",         playerKey: "mateo lopez",            amistosos_res: 182, reserva: 1184, juveniles: 0 },
  { num: 20, name: "López Pablo",         playerKey: "lopez pablo",            amistosos_res: 120, reserva: 1183, juveniles: 0 },
  { num: 21, name: "Loza Valentín",       playerKey: "loza valentin",          amistosos_res: 145, reserva: 663,  juveniles: 0 },
  { num: 22, name: "Quiroga Lautaro",     playerKey: "lautaro quiroga",        amistosos_res: 161, reserva: 95,   juveniles: 362 },
  { num: 23, name: "Vázquez Lautaro",     playerKey: "lautaro vazquez",        amistosos_res: 172, reserva: 348,  juveniles: 354 },
  { num: 24, name: "Moreno Juan",         playerKey: "juan moreno",            amistosos_res: 172, reserva: 1080, juveniles: 0 },
  { num: 25, name: "Noguera Facundo",     playerKey: "facundo noguera",        amistosos_res: 115, reserva: 1360, juveniles: 0 },
  { num: 26, name: "Quintana Facundo",    playerKey: "facundo quintana",       amistosos_res: 115, reserva: 1727, juveniles: 0 },
  { num: 27, name: "Uriel Ramos",         playerKey: "uriel ramos",            amistosos_res: 0,   reserva: 0,    juveniles: 381 },
  { num: 28, name: "Patricio Flores",     playerKey: "patricio flores",        amistosos_res: 0,   reserva: 0,    juveniles: 663 },
];

const TORNEOS = [
  { id: "all",       label: "Todo el semestre",                res_total: 1727, juv_total: 1252 },
  { id: "reserva",   label: "Torneo Proyección Apertura 2026", res_total: 1727, juv_total: null },
  { id: "juveniles", label: "Torneo Juveniles 2026",           res_total: null,  juv_total: 1252 },
  { id: "amistosos", label: "Amistosos",                       res_total: 182,   juv_total: null },
];

function norm(s) {
  if (!s) return "";
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function getMinutes(p, torneoId) {
  switch (torneoId) {
    case "reserva":   return { res: p.reserva,       juv: null };
    case "juveniles": return { res: null,             juv: p.juveniles };
    case "amistosos": return { res: p.amistosos_res,  juv: null };
    default:          return { res: p.reserva,        juv: p.juveniles };
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
  const [photoMap, setPhotoMap] = useState({});

  useEffect(() => {
    base44.entities.Player.list("-created_date", 100).then((players) => {
      const map = {};
      players.forEach((p) => {
        map[norm(p.full_name || p.name)] = p.photo_url || null;
      });
      setPhotoMap(map);
    });
  }, []);

  function getPhoto(playerKey) {
    // Try exact key first, then partial match
    if (photoMap[playerKey]) return photoMap[playerKey];
    const keys = Object.keys(photoMap);
    const match = keys.find((k) => k.includes(playerKey) || playerKey.includes(k));
    return match ? photoMap[match] : null;
  }

  const torneo = TORNEOS.find((t) => t.id === torneoId);
  const showRes = torneo.res_total !== null;
  const showJuv = torneo.juv_total !== null;

  const display = MINUTES_DATA
    .filter((p) => !search || norm(p.name).includes(norm(search)))
    .map((p) => ({ ...p, ...getMinutes(p, torneoId) }))
    .sort((a, b) => {
      if (sortBy === "juv") return (b.juv || 0) - (a.juv || 0);
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return (b.res || 0) - (a.res || 0);
    });

  const cols = showRes && showJuv ? "2rem 2.5rem 1fr 1fr 1fr" : "2rem 2.5rem 1fr 1fr";

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
          {display.map((p) => {
            const photo = getPhoto(p.playerKey);
            return (
              <div key={p.num}
                className="grid items-center gap-4 px-4 py-2.5 hover:bg-zinc-800/30 transition-colors"
                style={{ gridTemplateColumns: cols }}>
                <span className="text-zinc-600 text-sm font-mono">{p.num}</span>
                {photo ? (
                  <img src={photo} alt={p.name} className="w-8 h-8 rounded-full object-cover border border-zinc-700 shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-zinc-500">{p.name.charAt(0)}</span>
                  </div>
                )}
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