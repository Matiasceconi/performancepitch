import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Heart, AlertTriangle, Clock, CheckCircle, TrendingUp, User, Calendar, Activity, ChevronRight } from "lucide-react";
import moment from "moment";
import "moment/locale/es";
import PlayerMedicalHistory from "@/components/medical/PlayerMedicalHistory";
import { usePlayers } from "@/hooks/usePlayers";
moment.locale("es");

const statusColors = {
  "Lesionado": { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30", dot: "bg-red-400" },
  "En recuperación": { bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/30", dot: "bg-orange-400" },
  "Seguimiento": { bg: "bg-yellow-500/15", text: "text-yellow-400", border: "border-yellow-500/30", dot: "bg-yellow-400" },
  "Alta médica": { bg: "bg-green-500/15", text: "text-green-400", border: "border-green-500/30", dot: "bg-green-400" },
};

const rehabStageOrder = ["Etapa inicial", "Etapa intermedia", "Etapa avanzada", "Readaptación", "Retorno con el grupo"];

function RehabProgress({ stage }) {
  const idx = rehabStageOrder.findIndex(s => s.toLowerCase() === (stage || "").toLowerCase());
  const current = idx >= 0 ? idx : -1;
  return (
    <div className="mt-2">
      <p className="text-xs text-zinc-500 mb-1.5">Etapa RHB</p>
      <div className="flex items-center gap-1">
        {rehabStageOrder.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div className={`h-1.5 flex-1 rounded-full transition-all ${i <= current ? "bg-orange-400" : "bg-zinc-700"}`} />
            {i === rehabStageOrder.length - 1 && (
              <div className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 ${i <= current ? "bg-orange-400 border-orange-400" : "bg-transparent border-zinc-600"}`} />
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-orange-300 mt-1">{stage || "Sin etapa definida"}</p>
    </div>
  );
}

function DaysCounter({ injuryDate, expectedReturn }) {
  const today = moment();
  const start = moment(injuryDate);
  const end = expectedReturn ? moment(expectedReturn) : null;
  const daysSince = today.diff(start, "days");
  const daysLeft = end ? end.diff(today, "days") : null;
  return (
    <div className="flex gap-3 mt-2">
      <div className="bg-zinc-800 rounded-lg px-3 py-1.5 text-center">
        <p className="text-lg font-bold text-white">{daysSince}</p>
        <p className="text-xs text-zinc-500">días lesionado</p>
      </div>
      {daysLeft !== null && (
        <div className={`rounded-lg px-3 py-1.5 text-center ${daysLeft < 0 ? "bg-green-500/10" : "bg-zinc-800"}`}>
          <p className={`text-lg font-bold ${daysLeft < 0 ? "text-green-400" : daysLeft <= 7 ? "text-yellow-400" : "text-white"}`}>
            {daysLeft < 0 ? "Alta" : daysLeft}
          </p>
          <p className="text-xs text-zinc-500">{daysLeft < 0 ? "disponible" : "días restantes"}</p>
        </div>
      )}
    </div>
  );
}

export default function MedicalDashboard() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const { getPlayer } = usePlayers();

  useEffect(() => {
    async function load() {
      const recs = await base44.entities.MedicalRecord.list("-injury_date", 200);
      setRecords(recs);
      setLoading(false);
    }
    load();
  }, []);

  // Active injured: Lesionado or En recuperación
  const activeInjured = records.filter(r =>
    (r.status === "Lesionado" || r.status === "En recuperación") &&
    r.record_type !== "Consulta/Seguimiento"
  );

  // Seguimiento
  const seguimiento = records.filter(r => r.status === "Seguimiento");

  // Stats
  const totalInjured = activeInjured.length;
  const totalSeguimiento = seguimiento.length;
  const totalDaysLost = records.reduce((acc, r) => acc + (r.days_lost || 0), 0);
  const avgDaysLost = records.filter(r => r.days_lost > 0).length
    ? Math.round(totalDaysLost / records.filter(r => r.days_lost > 0).length)
    : 0;

  // Most common injuries
  const diagnosisCounts = {};
  records.forEach(r => {
    if (!r.diagnosis) return;
    const key = r.diagnosis.toLowerCase().trim();
    diagnosisCounts[key] = (diagnosisCounts[key] || 0) + 1;
  });
  const topInjuries = Object.entries(diagnosisCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([diag, count]) => ({ diag, count }));

  // Build list of players with any medical record, for the history panel
  const playersWithRecords = (() => {
    const seen = new Map();
    records.forEach(r => {
      const key = r.player_id || r.player_name;
      if (!seen.has(key)) {
        const playerData = getPlayer(r.player_id, r.player_name);
        seen.set(key, {
          id: r.player_id,
          name: playerData?.name || r.player_name,
          photo_url: playerData?.photo_url || null,
          position: playerData?.position || "",
          number: playerData?.number || null,
          category_division: r.category_division || "",
          count: 0,
          lastDate: r.injury_date || "",
        });
      }
      seen.get(key).count += 1;
    });
    return Array.from(seen.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  })();

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div>;

  return (
    <>
    {selectedPlayer && <PlayerMedicalHistory player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-red-400" />
            <span className="text-xs text-zinc-500">Actualmente lesionados</span>
          </div>
          <p className="text-3xl font-bold text-red-400">{totalInjured}</p>
        </div>
        <div className="bg-zinc-900 border border-yellow-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={16} className="text-yellow-400" />
            <span className="text-xs text-zinc-500">En seguimiento</span>
          </div>
          <p className="text-3xl font-bold text-yellow-400">{totalSeguimiento}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={16} className="text-zinc-400" />
            <span className="text-xs text-zinc-500">Días perdidos (total)</span>
          </div>
          <p className="text-3xl font-bold text-white">{totalDaysLost}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-blue-400" />
            <span className="text-xs text-zinc-500">Prom. días por lesión</span>
          </div>
          <p className="text-3xl font-bold text-blue-400">{avgDaysLost}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Active injured cards */}
        <div className="md:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse inline-block" />
            Jugadores lesionados / en recuperación
          </h2>
          {activeInjured.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
              <p className="text-zinc-400 text-sm">¡Plantel sin lesiones activas!</p>
            </div>
          ) : (
            activeInjured.map(r => {
              const sc = statusColors[r.status] || statusColors["Lesionado"];
              const playerData = getPlayer(r.player_id, r.player_name);
              const displayName = playerData?.name || r.player_name;
              const displayPhoto = playerData?.photo_url;
              return (
                <div key={r.id} className={`bg-zinc-900 border ${sc.border} rounded-xl p-4`}>
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => setSelectedPlayer({ id: r.player_id, name: displayName, photo_url: displayPhoto, position: playerData?.position, number: playerData?.number, category_division: r.category_division })}
                      className="shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      title="Ver historial médico"
                    >
                      {displayPhoto ? (
                        <img src={displayPhoto} alt={displayName} className="w-10 h-10 rounded-full object-cover border-2 border-zinc-600 hover:border-white transition-all" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-zinc-800 border-2 border-zinc-600 hover:border-white transition-all flex items-center justify-center">
                          <span className="text-sm font-bold text-zinc-500">{displayName?.charAt(0)}</span>
                        </div>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-semibold text-sm">{displayName}</span>
                        {r.category_division && <span className="text-xs text-zinc-500">{r.category_division}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded border ${sc.bg} ${sc.text} ${sc.border}`}>{r.status}</span>
                      </div>
                      <p className="text-zinc-300 text-sm mt-0.5">{r.diagnosis}</p>
                      {r.affected_limb && r.affected_limb !== "No corresponde" && (
                        <p className="text-xs text-zinc-500 mt-0.5">MMII: {r.affected_limb}</p>
                      )}
                      {r.injury_date && <DaysCounter injuryDate={r.injury_date} expectedReturn={r.expected_return} />}
                      {r.rehab_stage && <RehabProgress stage={r.rehab_stage} />}
                      {r.notes && <p className="text-xs text-zinc-600 mt-2 italic">{r.notes}</p>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Seguimiento */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
              Seguimiento activo
            </h2>
            {seguimiento.length === 0 ? (
              <p className="text-xs text-zinc-600">Sin jugadores en seguimiento</p>
            ) : (
              <div className="space-y-2">
                {seguimiento.map(r => (
                  <div key={r.id} className="bg-zinc-900 border border-yellow-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                      <span className="text-white text-sm font-medium">{r.player_name}</span>
                    </div>
                    <p className="text-zinc-400 text-xs mt-0.5 ml-4">{r.diagnosis}</p>
                    {r.notes && <p className="text-zinc-600 text-xs mt-0.5 ml-4 italic">{r.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top lesiones */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2 mb-3">
              <TrendingUp size={13} className="text-zinc-500" />
              Lesiones más frecuentes
            </h2>
            <div className="space-y-2">
              {topInjuries.map(({ diag, count }) => (
                <div key={diag} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-zinc-300 text-xs capitalize">{diag}</p>
                    <span className="text-xs font-bold text-white bg-zinc-700 rounded px-1.5 py-0.5">{count}x</span>
                  </div>
                  <div className="mt-1.5 h-1 bg-zinc-800 rounded-full">
                    <div
                      className="h-1 bg-blue-500 rounded-full"
                      style={{ width: `${Math.min(100, (count / records.length) * 100 * 3)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Historial médico por jugador */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2 mb-3">
          <User size={13} className="text-zinc-500" />
          Historial médico por jugador
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {playersWithRecords.map(p => (
            <button
              key={p.id || p.name}
              onClick={() => setSelectedPlayer(p)}
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-3 flex items-center gap-3 transition-all text-left group"
            >
              {p.photo_url ? (
                <img src={p.photo_url} alt={p.name} className="w-10 h-10 rounded-full object-cover border border-zinc-700 shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-zinc-500">{p.name?.charAt(0)}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">{p.name}</p>
                <p className="text-zinc-500 text-xs">{p.count} registro{p.count !== 1 ? "s" : ""}</p>
              </div>
              <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-400 shrink-0 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
    </>
  );
}