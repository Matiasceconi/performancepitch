import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Users, Dumbbell, Zap, Calendar, Clock, Target, MapPin, Video, BookOpen } from "lucide-react";
import moment from "moment";
import SessionPlayerTable from "@/components/sessions/SessionPlayerTable";
import SessionExercises from "@/components/sessions/SessionExercises";
import SessionGPS from "@/components/sessions/SessionGPS";
import SessionStrength from "@/components/sessions/SessionStrength";
import FieldLibraryPanel from "@/components/sessions/FieldLibraryPanel";
import StrengthLibraryPanel from "@/components/sessions/StrengthLibraryPanel";

const INTENSITY_COLORS = { Baja: "text-emerald-400", Media: "text-yellow-400", Alta: "text-red-400" };
const TYPE_COLORS = {
  Campo: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Fuerza: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  Regenerativo: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  Activación: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  "Partido reducido": "bg-purple-500/15 text-purple-300 border-purple-500/30",
  Mixto: "bg-zinc-500/15 text-zinc-300 border-zinc-600",
  Otro: "bg-zinc-500/15 text-zinc-300 border-zinc-600",
};

const TABS = [
  { key: "players",          label: "Jugadores",       icon: Users },
  { key: "exercises",        label: "Ejercicios",      icon: Dumbbell },
  { key: "field_library",    label: "Bibl. Campo",     icon: BookOpen },
  { key: "strength",         label: "Fuerza",          icon: Zap },
  { key: "strength_library", label: "Bibl. Fuerza",    icon: BookOpen },
  { key: "gps",              label: "GPS",             icon: Zap },
];

export default function SessionDetail({ session, onBack }) {
  const [sessionPlayers, setSessionPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("players");
  const [currentSession, setCurrentSession] = useState(session);

  useEffect(() => { setCurrentSession(session); }, [session]);

  useEffect(() => {
    base44.entities.SessionPlayer.filter({ session_id: session.id }, "player_name", 200)
      .then(sp => { setSessionPlayers(sp); setLoading(false); });
  }, [session.id]);

  const present = sessionPlayers.filter(sp => sp.attendance === "presente").length;
  const absent = sessionPlayers.filter(sp => sp.attendance === "ausente").length;
  const diff = sessionPlayers.filter(sp => sp.attendance === "diferenciado").length;
  const typeClass = TYPE_COLORS[session.session_type] || TYPE_COLORS["Otro"];

  return (
    <div className="space-y-5">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
        <ArrowLeft size={15} /> Volver a sesiones
      </button>

      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${typeClass}`}>
                {session.session_type}
              </span>
              {session.match_day_code && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
                  {session.match_day_code}
                </span>
              )}
              {session.intensity_goal && (
                <span className={`text-[11px] font-semibold ${INTENSITY_COLORS[session.intensity_goal] || "text-zinc-400"}`}>
                  Intensidad: {session.intensity_goal}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-white">{session.title}</h1>
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Calendar size={12} className="shrink-0" />
            <span>{moment(session.date).format("DD/MM/YYYY")}</span>
          </div>
          {session.squad_name && (
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Users size={12} className="shrink-0" />
              <span>{session.squad_name}</span>
            </div>
          )}
          {session.duration_minutes && (
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Clock size={12} className="shrink-0" />
              <span>{session.duration_minutes} min</span>
            </div>
          )}
          {session.location && (
            <div className="flex items-center gap-1.5 text-zinc-400">
              <MapPin size={12} className="shrink-0" />
              <span>{session.location}</span>
            </div>
          )}
        </div>

        {session.objective && (
          <div className="flex items-start gap-1.5 text-xs text-zinc-400">
            <Target size={12} className="shrink-0 mt-0.5" />
            <span>{session.objective}</span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total", value: sessionPlayers.length, color: "text-blue-400" },
            { label: "Presentes", value: present, color: "text-emerald-400" },
            { label: "Diferenciados", value: diff, color: "text-amber-400" },
            { label: "Ausentes", value: absent, color: "text-zinc-500" },
          ].map(s => (
            <div key={s.label} className="text-center bg-zinc-800/50 rounded-xl p-3">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {session.notes && (
          <p className="text-xs text-zinc-500 italic border-t border-zinc-800 pt-3">{session.notes}</p>
        )}

        {/* Video link */}
        {session.video_url && (
          <a href={session.video_url} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 border-t border-zinc-800 pt-3 w-fit">
            <Video size={13} /> Ver video de la sesión
          </a>
        )}
      </div>

      {/* Tabs — scrollable on mobile */}
      <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 gap-1 overflow-x-auto">
        {TABS.map(({ key, label, icon: TabIcon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              tab === key ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"
            }`}>
            <TabIcon size={12} /> {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {tab === "players"          && <SessionPlayerTable sessionPlayers={sessionPlayers} sessionId={currentSession.id} />}
            {tab === "exercises"        && <SessionExercises sessionId={currentSession.id} />}
            {tab === "field_library"    && <FieldLibraryPanel />}
            {tab === "strength"         && <SessionStrength session={currentSession} onSessionUpdate={setCurrentSession} />}
            {tab === "strength_library" && <StrengthLibraryPanel />}
            {tab === "gps"              && <SessionGPS session={currentSession} sessionPlayers={sessionPlayers} />}
          </>
        )}
      </div>
    </div>
  );
}