import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Users, Activity, ChevronRight, AlertCircle, Cake, Map, X, Shield, Zap, ClipboardList } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import moment from "moment";
import "moment/locale/es";
moment.locale("es");

function NextMatchCard({ match, matchReport }) {
  const daysLeft = moment(match.date).diff(moment().startOf("day"), "days");
  const [logoError, setLogoError] = useState(false);
  const [showSquad, setShowSquad] = useState(false);
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 overflow-hidden">
          {match.rival_logo_url && !logoError ?
          <img src={match.rival_logo_url} alt="Rival" className="w-full h-full object-contain p-1" onError={() => setLogoError(true)} /> :
          <Shield size={24} className="text-zinc-500" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-0.5">Próximo partido</p>
          <p className="text-white font-bold text-base truncate">{match.title}</p>
          <p className="text-zinc-400 text-sm capitalize">
            {moment(match.date).format("dddd D [de] MMMM")}
            {match.time ? ` · ${match.time}hs` : ""}
            {match.location ? ` · ${match.location}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="text-right">
            <p className="text-3xl font-black text-white leading-none">{daysLeft}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{daysLeft === 1 ? "día" : "días"}</p>
          </div>
          {matchReport && matchReport.squad_names && matchReport.squad_names.length > 0 && (
            <button
              onClick={() => setShowSquad(!showSquad)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/25 transition-colors font-medium"
            >
              <Users size={12} />
              Convocados ({matchReport.squad_names.length})
            </button>
          )}
        </div>
      </div>
      {showSquad && matchReport && (
        <div className="border-t border-zinc-800 p-4">
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-3">Lista de convocados</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {matchReport.squad_names.map((name, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-white">
                <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 shrink-0">{i + 1}</span>
                {name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>);
}
import PlayerStatusBadge from "@/components/staff/PlayerStatusBadge";
import PlayerProfileDetail from "@/components/staff/PlayerProfileDetail";
import PlayerPhotoUpload from "@/components/staff/PlayerPhotoUpload";
import PitchMap from "@/components/staff/PitchMap";
import TournamentTable from "@/components/staff/TournamentTable";
import TournamentImporter from "@/components/staff/TournamentImporter";

export default function Dashboard() {
  const [players, setPlayers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [showStatusPanel, setShowStatusPanel] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const [nextMatch, setNextMatch] = useState(null);
  const [nextMatchReport, setNextMatchReport] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [p, events, s, matchReports] = await Promise.all([
        base44.entities.Player.filter({ division: "Reserva" }, "-created_date", 200),
        base44.entities.DayEvent.list("date", 200),
        base44.entities.TrainingSession.list("-date", 5),
        base44.entities.MatchReport.list("-date", 20)]
        );
        setPlayers(p);
        setSessions(s);
        const today = moment().format("YYYY-MM-DD");
        const match = events.find((e) => e.type === "Partido" && e.date >= today);
        setNextMatch(match || null);
        if (match) {
          const report = matchReports.find((r) => r.date === match.date);
          setNextMatchReport(report || null);
        }
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
      </div>);

  }

  const today = moment().format("MM-DD");
    const birthdayPlayers = players.filter((p) => p.birth_date && moment(p.birth_date).format("MM-DD") === today);

  const availablePlayers = players.filter((p) => p.status === "Disponible").sort((a, b) => (a.number || 0) - (b.number || 0));
   const unavailablePlayers = players.filter((p) => p.status !== "Disponible").sort((a, b) => (a.number || 0) - (b.number || 0));
   const availableField = availablePlayers.filter((p) => p.position !== "Arquero").length;
   const availableGoalkeepers = availablePlayers.filter((p) => p.position === "Arquero").length;
   const injured = players.filter((p) => p.status === "Lesionado").length;

  const stats = [
  { label: "Jugadores (Reserva)", value: players.length, icon: Users, color: "text-blue-400" },
  { label: "Campo disp.", value: availableField, icon: Activity, color: "text-emerald-400" },
  { label: "Lesionados", value: injured, icon: AlertCircle, color: "text-red-400" },
  { label: "Arqueros disp.", value: availableGoalkeepers, icon: Shield, color: "text-yellow-400" }];


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ESTADO DEL EQUIPO</h1>
          <p className="text-zinc-500 text-sm mt-1">{moment().format("dddd D [de] MMMM, YYYY")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStatusPanel(!showStatusPanel)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium transition-colors">
            
            {showStatusPanel ? <X size={15} /> : <ClipboardList size={15} />}
            {showStatusPanel ? "Cerrar estados" : "Estado del plantel"}
          </button>
          <button
            onClick={() => setShowMap(!showMap)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium transition-colors">
            
            {showMap ? <X size={15} /> : <Map size={15} />}
            {showMap ? "Cerrar mapa" : "Ver mapa del día"}
          </button>
        </div>
      </div>

      {showStatusPanel &&
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-white">Estado del plantel</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Modificá el estado de cada jugador directamente</p>
          </div>
          <div className="p-4">
            <div className="grid gap-2">
              {[...players].sort((a, b) => (a.number || 0) - (b.number || 0)).map((p) =>
            <div key={p.id} className="flex items-center gap-3 py-1.5">
                  <span className="text-zinc-600 text-xs font-mono w-6 text-center shrink-0">{p.number}</span>
                  {p.photo_url ?
                  <img src={p.photo_url} alt={p.full_name} className="w-7 h-7 rounded-full object-cover border border-zinc-700 shrink-0" /> :

                  <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                       <span className="text-xs font-bold text-zinc-500">{p.full_name?.charAt(0)}</span>
                     </div>
                  }
                   <span className="text-sm text-white flex-1 min-w-0 truncate">{p.full_name}</span>
                  <span className="text-xs text-zinc-600 hidden sm:block">{p.position}</span>
                  <Select
                value={p.status || "Disponible"}
                onValueChange={async (v) => {
                  await base44.entities.Player.update(p.id, { status: v });
                  setPlayers((prev) => prev.map((pl) => pl.id === p.id ? { ...pl, status: v } : pl));
                }}>
                
                    <SelectTrigger className="h-7 w-36 text-xs bg-zinc-800 border-zinc-700 text-white shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                       {["Disponible", "Lesionado", "En recuperación", "Suspendido", "Permiso", "Selección", "Juveniles", "Primera", "Subio a primera", "Bajo a juveniles", "Subio de juveniles", "Bajo de primera", "Sparring"].map((s) =>
                    <SelectItem key={s} value={s} className="text-white text-xs">{s}</SelectItem>
                    )}
                     </SelectContent>
                  </Select>
                </div>
            )}
            </div>
          </div>
        </div>
      }

      {showMap &&
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Mapa del día — Jugadores disponibles</h2>
              <p className="text-xs text-zinc-500 mt-0.5">{availablePlayers.length} jugadores disponibles hoy</p>
            </div>
          </div>
          <div className="p-4">
            <PitchMap players={availablePlayers} emptyLabel="No hay jugadores disponibles hoy" />
          </div>
        </div>
      }

      {nextMatch &&
      <NextMatchCard match={nextMatch} matchReport={nextMatchReport} />
      }

      {birthdayPlayers.length > 0 &&
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
          <Cake size={20} className="text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-yellow-300 font-semibold text-sm">¡Cumpleaños hoy! 🎂</p>
            <p className="text-yellow-200/80 text-sm mt-0.5">
              {birthdayPlayers.map((p) => `${p.full_name} (${moment().diff(moment(p.birth_date), "years")} años)`).join(" · ")}
            </p>
          </div>
        </div>
      }

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) =>
        <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <s.icon size={18} className={s.color} />
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
          </div>
        )}
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
            {availablePlayers.length === 0 ?
            <p className="text-zinc-600 text-sm text-center py-6">Sin jugadores disponibles</p> :

            <div className="space-y-2 max-h-72 overflow-y-auto">
                {availablePlayers.map((p) =>
              <div key={p.id} className="flex items-center gap-3 hover:bg-zinc-800/50 px-2 py-1.5 rounded transition-colors">
                    <span className="text-zinc-600 text-xs font-mono w-6 text-center shrink-0">{p.number}</span>
                    <div onClick={() => setSelectedPlayer(p)} className="cursor-pointer">
                      <PlayerPhotoUpload player={p} onPhotoUpdate={() => setPlayers([...players])} />
                    </div>
                    <div onClick={() => setSelectedPlayer(p)} className="flex-1 cursor-pointer">
                       <span className="text-sm text-white">{p.full_name}</span>
                       <span className="text-xs text-zinc-500">{p.position}</span>
                     </div>
                  </div>
              )}
              </div>
            }
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
            {unavailablePlayers.length === 0 ?
            <p className="text-zinc-600 text-sm text-center py-6">Todos los jugadores están disponibles</p> :

            <div className="space-y-2 max-h-72 overflow-y-auto">
                {unavailablePlayers.map((p) =>
              <div key={p.id} className="flex items-center justify-between hover:bg-zinc-800/50 px-2 py-1.5 rounded transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-600 text-xs font-mono w-6 text-center shrink-0">{p.number}</span>
                      <div onClick={() => setSelectedPlayer(p)} className="cursor-pointer">
                        <PlayerPhotoUpload player={p} onPhotoUpdate={() => setPlayers([...players])} />
                      </div>
                      <div onClick={() => setSelectedPlayer(p)} className="cursor-pointer flex-1">
                         <span className="text-sm text-white">{p.full_name}</span>
                       </div>
                    </div>
                    <PlayerStatusBadge status={p.status} />
                  </div>
              )}
              </div>
            }
          </div>
        </div>

        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl">
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-white">Clasificación — Torneo Proyección</h2>
          </div>
          <div className="p-4 space-y-4">
            <TournamentImporter />
            <TournamentTable />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-white">Últimas sesiones</h2>
                <Link to="/sessions" className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
              Ver sesiones <ChevronRight size={14} />
            </Link>
          </div>
          <div className="p-4">
            {sessions.length === 0 ?
            <p className="text-zinc-600 text-sm text-center py-6">No hay sesiones cargadas</p> :

            <div className="space-y-3">
                {sessions.map((s) =>
              <div key={s.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white">{s.title}</p>
                      <p className="text-xs text-zinc-500">{moment(s.date).format("DD/MM/YYYY")} · {s.session_type}</p>
                    </div>
                    <Link to="/catapult" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors shrink-0 ml-2">
                      <Zap size={13} /> GPS
                    </Link>
                  </div>
              )}
              </div>
            }
          </div>
        </div>
      </div>

      {selectedPlayer && (
        <PlayerProfileDetail
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>);

}