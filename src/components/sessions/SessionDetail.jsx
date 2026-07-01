import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Users, Dumbbell, Zap, Calendar, Clock, Target, MapPin, Video, Download, FileText, Edit2, Save, X } from "lucide-react";
import SessionVideoPanel from "@/components/sessions/SessionVideoPanel";
import SessionPDFExport from "@/components/sessions/SessionPDFExport";
import moment from "moment";
import SessionPlayerTable from "@/components/sessions/SessionPlayerTable";
import SessionExercises from "@/components/sessions/SessionExercises";
import SessionGPS from "@/components/sessions/SessionGPS";
import SessionStrength from "@/components/sessions/SessionStrength";
import SessionVideoObs from "@/components/sessions/SessionVideoObs";
import { useToast } from "@/components/ui/use-toast";

const SESSION_TYPES = ["Campo", "Fuerza", "Regenerativo", "Activación", "Partido reducido", "Mixto", "Otro"];
const MD_CODES = ["MD-6", "MD-5", "MD-4", "MD-3", "MD-2", "MD-1", "MD", "MD+1", "MD+2", "MD+3", "MD+4", "Otro"];
const OBJECTIVE_OPTS = ["Tensión", "Volumen", "Activación", "Velocidad", "Recuperación", "Otro"];
const OBJECTIVE_COLORS = {
  "Tensión": "bg-red-500/15 text-red-300 border-red-500/30",
  "Volumen": "bg-blue-500/15 text-blue-300 border-blue-500/30",
  "Activación": "bg-orange-500/15 text-orange-300 border-orange-500/30",
  "Velocidad": "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  "Recuperación": "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "Otro": "bg-zinc-500/15 text-zinc-300 border-zinc-600",
};
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
  { key: "players",    label: "Jugadores",   icon: Users },
  { key: "exercises",  label: "Ejercicios",  icon: Dumbbell },
  { key: "strength",   label: "Fuerza",      icon: Zap },
  { key: "gps",        label: "GPS",         icon: Zap },
  { key: "video",      label: "Video / Obs.", icon: Video },
];

export default function SessionDetail({ session, onBack }) {
  const { toast } = useToast();
  const [sessionPlayers, setSessionPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("players");
  const [currentSession, setCurrentSession] = useState(session);
  const [showVideoPanel, setShowVideoPanel] = useState(false);
  const [showPDFExport, setShowPDFExport] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(session);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setCurrentSession(session); setEditForm(session); }, [session]);

  useEffect(() => {
    base44.entities.SessionPlayer.filter({ session_id: session.id }, "player_name", 200)
      .then(sp => { setSessionPlayers(sp); setLoading(false); });
  }, [session.id]);

  async function handleSaveEdit() {
    setSaving(true);
    const updated = await base44.entities.TrainingSession.update(currentSession.id, {
      title: editForm.title, date: editForm.date, session_type: editForm.session_type,
      match_day_code: editForm.match_day_code, session_objective: editForm.session_objective,
      duration_minutes: editForm.duration_minutes, location: editForm.location,
      objective: editForm.objective, notes: editForm.notes,
    });
    setCurrentSession(updated);
    setEditForm(updated);
    setEditing(false);
    setSaving(false);
    toast({ title: "✓ Sesión actualizada" });
  }

  const present = sessionPlayers.filter(sp => sp.attendance === "presente").length;
  const absent = sessionPlayers.filter(sp => sp.attendance === "ausente").length;
  const diff = sessionPlayers.filter(sp => sp.attendance === "diferenciado").length;
  const typeClass = TYPE_COLORS[currentSession.session_type] || TYPE_COLORS["Otro"];

  return (
    <div className="space-y-5">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
        <ArrowLeft size={15} /> Volver a sesiones
      </button>

      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          {/* Action buttons */}
          <div className="w-full flex justify-end gap-2 mb-1">
            {!editing && (
              <button
                onClick={() => { setEditForm(currentSession); setEditing(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <Edit2 size={12} /> Editar sesión
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  <X size={12} /> Cancelar
                </button>
                <button
                  onClick={handleSaveEdit} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  <Save size={12} /> {saving ? "Guardando..." : "Guardar"}
                </button>
              </>
            )}
            <button
              onClick={() => setShowVideoPanel(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-500/15 border border-blue-500/30 text-blue-300 hover:bg-blue-500/25 rounded-lg transition-colors"
            >
              <Video size={12} /> Videos
            </button>
            <button
              onClick={() => setShowPDFExport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/25 rounded-lg transition-colors"
            >
              <FileText size={12} /> Exportar PDF
            </button>
          </div>

          {!editing ? (
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${typeClass}`}>
                  {currentSession.session_type}
                </span>
                {currentSession.match_day_code && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
                    {currentSession.match_day_code}
                  </span>
                )}
                {currentSession.session_objective && (
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${OBJECTIVE_COLORS[currentSession.session_objective] || OBJECTIVE_COLORS["Otro"]}`}>
                    {currentSession.session_objective}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-white">{currentSession.title}</h1>
            </div>
          ) : (
            <div className="w-full space-y-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Título</label>
                <input value={editForm.title || ""} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Fecha</label>
                  <input type="date" value={editForm.date || ""} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Tipo</label>
                  <select value={editForm.session_type || ""} onChange={e => setEditForm(f => ({ ...f, session_type: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500">
                    {SESSION_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">MD</label>
                  <select value={editForm.match_day_code || ""} onChange={e => setEditForm(f => ({ ...f, match_day_code: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500">
                    {MD_CODES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Objetivo físico</label>
                  <select value={editForm.session_objective || ""} onChange={e => setEditForm(f => ({ ...f, session_objective: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500">
                    {OBJECTIVE_OPTS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Duración (min)</label>
                  <input type="number" value={editForm.duration_minutes || ""} onChange={e => setEditForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Lugar</label>
                  <input value={editForm.location || ""} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Objetivo</label>
                <input value={editForm.objective || ""} onChange={e => setEditForm(f => ({ ...f, objective: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Notas</label>
                <textarea rows={2} value={editForm.notes || ""} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 resize-none" />
              </div>
            </div>
          )}
        </div>

        {!editing && (
          <>
            {/* Meta */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Calendar size={12} className="shrink-0" />
                <span>{moment(currentSession.date).format("DD/MM/YYYY")}</span>
              </div>
              {currentSession.squad_name && (
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Users size={12} className="shrink-0" />
                  <span>{currentSession.squad_name}</span>
                </div>
              )}
              {currentSession.duration_minutes && (
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Clock size={12} className="shrink-0" />
                  <span>{currentSession.duration_minutes} min</span>
                </div>
              )}
              {currentSession.location && (
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <MapPin size={12} className="shrink-0" />
                  <span>{currentSession.location}</span>
                </div>
              )}
            </div>

            {currentSession.objective && (
              <div className="flex items-start gap-1.5 text-xs text-zinc-400">
                <Target size={12} className="shrink-0 mt-0.5" />
                <span>{currentSession.objective}</span>
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

            {currentSession.notes && (
              <p className="text-xs text-zinc-500 italic border-t border-zinc-800 pt-3">{currentSession.notes}</p>
            )}

            {/* Video link */}
            {currentSession.video_url && (
              <a href={currentSession.video_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 border-t border-zinc-800 pt-3 w-fit">
                <Video size={13} /> Ver video de la sesión
              </a>
            )}
          </>
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

      {/* Modals */}
      {showVideoPanel && (
        <SessionVideoPanel session={currentSession} onClose={() => setShowVideoPanel(false)} />
      )}
      {showPDFExport && (
        <SessionPDFExport session={currentSession} sessionPlayers={sessionPlayers} onClose={() => setShowPDFExport(false)} />
      )}

      {/* Tab content */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {tab === "players"   && <SessionPlayerTable sessionPlayers={sessionPlayers} sessionId={currentSession.id} />}
            {tab === "exercises" && <SessionExercises session={currentSession} sessionPlayers={sessionPlayers} />}
            {tab === "strength"  && <SessionStrength session={currentSession} onSessionUpdate={setCurrentSession} />}
            {tab === "gps"       && <SessionGPS session={currentSession} sessionPlayers={sessionPlayers} />}
            {tab === "video"     && <SessionVideoObs session={currentSession} onUpdate={setCurrentSession} />}
          </>
        )}
      </div>
    </div>
  );
}