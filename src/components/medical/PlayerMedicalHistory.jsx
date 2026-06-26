import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Heart, AlertCircle, Activity, CheckCircle, Clock, FileText } from "lucide-react";
import moment from "moment";
import "moment/locale/es";
import { usePlayers } from "@/hooks/usePlayers";
moment.locale("es");

const statusColors = {
  "Lesionado": "bg-red-500/15 text-red-400 border-red-500/30",
  "En recuperación": "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "Seguimiento": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  "Alta médica": "bg-green-500/15 text-green-400 border-green-500/30",
};

const statusIcon = {
  "Lesionado": AlertCircle,
  "En recuperación": Activity,
  "Seguimiento": Clock,
  "Alta médica": CheckCircle,
};

export default function PlayerMedicalHistory({ player, onClose }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const { getPlayer } = usePlayers();
  const playerData = getPlayer(player.id, player.name);
  const displayName = playerData?.name || player.name;
  const displayPhoto = playerData?.photo_url || player.photo_url;

  useEffect(() => {
    async function load() {
      // Try by player_id first, fallback to player_name
      let recs = [];
      if (player.id) {
        recs = await base44.entities.MedicalRecord.filter({ player_id: player.id }, "-injury_date", 100);
      }
      if (recs.length === 0 && player.name) {
        recs = await base44.entities.MedicalRecord.filter({ player_name: player.name }, "-injury_date", 100);
      }
      setRecords(recs);
      setLoading(false);
    }
    load();
  }, [player.id, player.name]);

  const lesiones = records.filter(r => r.record_type === "Lesión" || !r.record_type);
  const consultas = records.filter(r => r.record_type === "Consulta/Seguimiento");
  const displayed = filterType === "lesiones" ? lesiones : filterType === "consultas" ? consultas : records;

  const totalDaysLost = lesiones.reduce((acc, r) => acc + (r.days_lost || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {displayPhoto ? (
              <img src={displayPhoto} alt={displayName} className="w-12 h-12 rounded-full object-cover border border-zinc-700 shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                <span className="text-lg font-bold text-zinc-500">{displayName?.charAt(0)}</span>
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-white">{displayName}</h2>
              <p className="text-xs text-zinc-500">{playerData?.position || player.position}{(playerData?.number || player.number) ? ` · #${playerData?.number || player.number}` : ""}{player.category_division ? ` · ${player.category_division}` : ""}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Stats rápidos */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{lesiones.length}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Lesiones totales</p>
            </div>
            <div className="bg-zinc-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-orange-400">{totalDaysLost}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Días perdidos</p>
            </div>
            <div className="bg-zinc-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-400">{consultas.length}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Consultas</p>
            </div>
          </div>

          {/* Filtro tipo */}
          <div className="flex gap-1 bg-zinc-800 border border-zinc-700 rounded-lg p-1 w-fit">
            {[
              { id: "all", label: `Todo (${records.length})` },
              { id: "lesiones", label: `Lesiones (${lesiones.length})` },
              { id: "consultas", label: `Consultas (${consultas.length})` },
            ].map(f => (
              <button key={f.id} onClick={() => setFilterType(f.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filterType === f.id ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Lista */}
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-10 text-center">
              <Heart size={32} className="text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">Sin registros médicos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayed.map(r => {
                const Icon = statusIcon[r.status] || FileText;
                return (
                  <div key={r.id} className={`border rounded-xl p-4 ${statusColors[r.status] || "bg-zinc-800/50 border-zinc-700 text-zinc-300"}`}>
                    <div className="flex items-start gap-3">
                      <Icon size={16} className="mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{r.diagnosis}</span>
                          {r.record_type && (
                            <span className="text-xs opacity-60 border rounded px-1.5 py-0.5 border-current">{r.record_type}</span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-3 mt-2 text-xs opacity-75">
                          {r.injury_date && <span>📅 {moment(r.injury_date).format("DD/MM/YYYY")}</span>}
                          {r.expected_return && <span>🏁 Retorno: {moment(r.expected_return).format("DD/MM/YYYY")}</span>}
                          {r.affected_limb && r.affected_limb !== "No corresponde" && <span>🦵 {r.affected_limb}</span>}
                          {(r.days_lost !== undefined && r.days_lost !== null && r.days_lost > 0) && (
                            <span className="font-semibold">⏱ {r.days_lost} días perdidos</span>
                          )}
                        </div>

                        {r.rehab_stage && (
                          <span className="inline-block mt-2 text-xs bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded">
                            RHB: {r.rehab_stage}
                          </span>
                        )}
                        {r.treatment && (
                          <p className="text-xs opacity-70 mt-1.5">
                            <span className="font-medium">Tratamiento:</span> {r.treatment}
                          </p>
                        )}
                        {r.notes && (
                          <p className="text-xs opacity-60 mt-1 italic border-l-2 border-current/30 pl-2">{r.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}