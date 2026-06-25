import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Video, FileSpreadsheet, Users, Activity, ChevronRight, AlertCircle, Cake } from "lucide-react";
import PlayerStatusBadge from "@/components/staff/PlayerStatusBadge";
import moment from "moment";

export default function Dashboard() {
  const [players, setPlayers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [p, s] = await Promise.all([
          base44.entities.Player.list("-created_date", 50),
          base44.entities.TrainingSession.list("-date", 5),
        ]);
        setPlayers(p);
        setSessions(s);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const today = moment().format("MM-DD");
  const birthdayPlayers = players.filter((p) => p.birth_date && moment(p.birth_date).format("MM-DD") === today);

  const availablePlayers = players.filter((p) => p.status === "Disponible").sort((a, b) => (a.number || 0) - (b.number || 0));
  const unavailablePlayers = players.filter((p) => p.status !== "Disponible").sort((a, b) => (a.number || 0) - (b.number || 0));
  const available = availablePlayers.length;
  const injured = players.filter((p) => p.status === "Lesionado").length;

  const stats = [
    { label: "Jugadores", value: players.length, icon: Users, color: "text-blue-400" },
    { label: "Disponibles", value: available, icon: Activity, color: "text-emerald-400" },
    { label: "Lesionados", value: injured, icon: AlertCircle, color: "text-red-400" },
    { label: "Sesiones", value: sessions.length, icon: Video, color: "text-purple-400" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">{moment().format("dddd D [de] MMMM, YYYY")}</p>
      </div>

      {birthdayPlayers.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
          <Cake size={20} className="text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-yellow-300 font-semibold text-sm">¡Cumpleaños hoy! 🎂</p>
            <p className="text-yellow-200/80 text-sm mt-0.5">
              {birthdayPlayers.map((p) => `${p.name} (${moment().diff(moment(p.birth_date), "years")} años)`).join(" · ")}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <s.icon size={18} className={s.color} />
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Disponibles */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              Disponibles
              <span className="text-xs text-emerald-400 font-normal">({availablePlayers.length})</span>
            </h2>
            <Link to="/squad" className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
              Ver plantel <ChevronRight size={14} />
            </Link>
          </div>
          <div className="p-4">
            {availablePlayers.length === 0 ? (
              <p className="text-zinc-600 text-sm text-center py-6">Sin jugadores disponibles</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {availablePlayers.map((p) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="text-zinc-600 text-xs font-mono w-6 text-center shrink-0">{p.number}</span>
                    <span className="text-sm text-white">{p.name}</span>
                    <span className="text-xs text-zinc-500 ml-auto">{p.position}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* No disponibles */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
              No disponibles
              <span className="text-xs text-red-400 font-normal">({unavailablePlayers.length})</span>
            </h2>
            <Link to="/squad" className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
              Ver plantel <ChevronRight size={14} />
            </Link>
          </div>
          <div className="p-4">
            {unavailablePlayers.length === 0 ? (
              <p className="text-zinc-600 text-sm text-center py-6">Todos los jugadores están disponibles</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {unavailablePlayers.map((p) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-600 text-xs font-mono w-6 text-center shrink-0">{p.number}</span>
                      <span className="text-sm text-white">{p.name}</span>
                    </div>
                    <PlayerStatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-white">Últimas sesiones</h2>
            <Link to="/sessions" className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
              Ver todas <ChevronRight size={14} />
            </Link>
          </div>
          <div className="p-4">
            {sessions.length === 0 ? (
              <p className="text-zinc-600 text-sm text-center py-6">No hay sesiones cargadas</p>
            ) : (
              <div className="space-y-3">
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white">{s.title}</p>
                      <p className="text-xs text-zinc-500">{moment(s.date).format("DD/MM/YYYY")} · {s.session_type}</p>
                    </div>
                    {s.intensity && (
                      <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">{s.intensity}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}