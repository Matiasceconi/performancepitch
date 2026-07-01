import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { usePlayerCard360 } from "@/components/player/PlayerCard360Context";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { isGoalkeeper } from "@/components/squad/squadConstants";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import "moment/locale/es";
import {
  X, Edit2, Save, User, Shield, Activity, Zap, Heart,
  Award, Tag, Paperclip, BarChart2, CheckCircle, AlertCircle,
  Camera, ChevronRight, Clock, Copy, Check
} from "lucide-react";

moment.locale("es");

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(val, suffix = "") { return val != null && val !== "" ? `${val}${suffix}` : "—"; }
function fmtDate(d) { return d ? moment(d).format("DD/MM/YYYY") : "—"; }
function age(bd) { return bd ? moment().diff(moment(bd), "years") : null; }

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="ml-1 text-zinc-600 hover:text-zinc-300 transition-colors">
      {done ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
    </button>
  );
}

function InfoRow({ label, value }) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className="flex items-start justify-between py-2 border-b border-zinc-800/50 last:border-0 gap-3">
      <span className="text-xs text-zinc-500 w-36 shrink-0">{label}</span>
      <span className="text-sm text-white text-right font-medium">{value}</span>
    </div>
  );
}

function EmptyState({ text = "Sin registros" }) {
  return <div className="text-center py-10 text-zinc-600 text-sm">{text}</div>;
}

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div>;
}

// ── Stat mini card ────────────────────────────────────────────────────────────
function MiniStat({ label, value, color = "text-white", sub }) {
  return (
    <div className="bg-zinc-800/60 rounded-xl p-3 text-center">
      <p className={`text-xl font-bold ${color}`}>{value ?? "—"}</p>
      <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight">{label}</p>
      {sub && <p className="text-[9px] text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Tabs config ───────────────────────────────────────────────────────────────
const TABS = [
  { id: "resumen",    label: "Resumen",       icon: User },
  { id: "planteles",  label: "Planteles",     icon: Shield },
  { id: "sesiones",   label: "Sesiones",      icon: Activity },
  { id: "gps",        label: "GPS",           icon: Zap },
  { id: "partidos",   label: "Partidos",      icon: BarChart2 },
  { id: "medico",     label: "Médico",        icon: Heart },
  { id: "wellness",   label: "Wellness",      icon: CheckCircle },
  { id: "evaluaciones",label: "Evaluaciones", icon: Award },
  { id: "identidad",  label: "Identidad",     icon: Tag },
  { id: "archivos",   label: "Archivos",      icon: Paperclip },
];

const POSITIONS = [
  "Arquero","Defensor Central","Lateral Derecho","Lateral Izquierdo",
  "Mediocampista Central","Volante Interno","Extremo","Delantero Centro",
];
const POSITION_GROUPS = ["Arqueros","Defensores","Mediocampistas","Extremos","Delanteros"];
const LEG_OPTIONS = ["Derecha","Izquierda","Ambidiestro"];
const STATUS_OPTIONS = [
  "Disponible","Lesionado","En recuperación","Suspendido","Permiso",
  "Selección","Subio a primera","Bajo a juveniles","Subieron de juveniles",
  "Bajo de primera","Sparring",
];

// ─────────────────────────────────────────────────────────────────────────────
export default function PlayerCard360() {
  const { playerId, playerData: preloaded, closeCard } = usePlayerCard360();
  const { can, canAccessSquad, squads } = useWorkspace();
  const canEdit = can("edit");
  const reservaSquad = squads.find(s => (s.name || "").trim().toLowerCase() === "reserva");
  const canUploadPhoto = canEdit || (reservaSquad && canAccessSquad(reservaSquad.id));
  const { toast } = useToast();

  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("resumen");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Tab data
  const [memberships, setMemberships] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sessionPlayers, setSessionPlayers] = useState([]);
  const [gpsData, setGpsData] = useState([]);
  const [minutes, setMinutes] = useState([]);
  const [medical, setMedical] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [dayStatus, setDayStatus] = useState(null);
  const [loadedTabs, setLoadedTabs] = useState(new Set());
  const [tabLoading, setTabLoading] = useState(false);

  // Load player
  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    setActiveTab("resumen");
    setLoadedTabs(new Set());
    if (preloaded?.id === playerId) {
      setPlayer(preloaded);
      setEditForm(preloaded);
      setLoading(false);
      loadTabData("resumen", playerId);
    } else {
      base44.entities.Player.get(playerId).then(p => {
        setPlayer(p);
        setEditForm(p);
        setLoading(false);
        loadTabData("resumen", playerId);
      });
    }
  }, [playerId]);

  const loadTabData = useCallback(async (tab, pid) => {
    const id = pid || playerId;
    if (!id || loadedTabs.has(tab)) return;
    setTabLoading(true);
    const today = moment().format("YYYY-MM-DD");

    if (tab === "resumen") {
      const [med, mins, gps, ds] = await Promise.all([
        base44.entities.MedicalRecord.filter({ player_id: id }, "-injury_date", 5),
        base44.entities.MinutesRecord.filter({ player_id: id }, "-match_date", 10),
        base44.entities.SessionGPSData.filter({ player_id: id }, "-created_date", 5),
        base44.entities.DailySquadStatus.filter({ player_id: id, date: today }, "-created_date", 1),
      ]);
      setMedical(med);
      setMinutes(mins);
      setGpsData(gps);
      setDayStatus(ds[0] || null);
    } else if (tab === "planteles") {
      const mb = await base44.entities.SquadMembership.filter({ player_id: id }, "-effective_from", 50);
      setMemberships(mb);
    } else if (tab === "sesiones") {
      const sp = await base44.entities.SessionPlayer.filter({ player_id: id }, "-created_date", 100);
      setSessionPlayers(sp);
      if (sp.length > 0) {
        const sessionIds = [...new Set(sp.map(s => s.session_id))].slice(0, 30);
        const allSessions = await base44.entities.TrainingSession.list("-date", 200);
        setSessions(allSessions.filter(s => sessionIds.includes(s.id)));
      }
    } else if (tab === "gps") {
      const gps = await base44.entities.SessionGPSData.filter({ player_id: id }, "-created_date", 200);
      setGpsData(gps);
    } else if (tab === "partidos") {
      const mins = await base44.entities.MinutesRecord.filter({ player_id: id }, "-match_date", 200);
      setMinutes(mins);
    } else if (tab === "medico") {
      const med = await base44.entities.MedicalRecord.filter({ player_id: id }, "-injury_date", 100);
      setMedical(med);
    } else if (tab === "identidad") {
      const al = await base44.entities.PlayerAlias.filter({ player_id: id }, "-created_date", 100);
      setAliases(al);
    }

    setLoadedTabs(prev => new Set([...prev, tab]));
    setTabLoading(false);
  }, [playerId, loadedTabs]);

  function handleTabChange(tab) {
    setActiveTab(tab);
    loadTabData(tab);
  }

  async function handleSave() {
    setSaving(true);
    const updated = await base44.entities.Player.update(player.id, editForm);
    setPlayer(updated);
    setEditing(false);
    setSaving(false);
    toast({ title: "Jugador actualizado" });
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const updated = await base44.entities.Player.update(player.id, { photo_url: file_url });
    setPlayer(updated);
    setEditForm(f => ({ ...f, photo_url: file_url }));
    toast({ title: "Foto actualizada" });
  }

  if (!playerId) return null;

  if (loading) return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  if (!player) return null;

  const playerAge = age(player.birth_date);
  const isGK = isGoalkeeper(player);
  const statusClass = player.status === "Disponible" ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/30"
    : player.status === "Lesionado" ? "text-red-400 bg-red-500/15 border-red-500/30"
    : "text-zinc-300 bg-zinc-700/30 border-zinc-600";

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-start justify-center p-3 overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-3xl shadow-2xl my-4">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-t-2xl p-5 border-b border-zinc-800">
          <div className="flex items-start gap-4">
            {/* Photo */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-zinc-700 bg-zinc-800">
                {(editing ? editForm.photo_url : player.photo_url) ? (
                  <img src={editing ? editForm.photo_url : player.photo_url} alt={player.full_name}
                    className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-zinc-400">{(player.full_name || "?").charAt(0)}</span>
                  </div>
                )}
              </div>
              {canUploadPhoto && (
                <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-zinc-700 border border-zinc-600 flex items-center justify-center cursor-pointer hover:bg-zinc-600 transition-colors">
                  <Camera size={11} className="text-zinc-300" />
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input value={editForm.first_name || ""} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))}
                      placeholder="Nombre" className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none" />
                    <input value={editForm.last_name || ""} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))}
                      placeholder="Apellido" className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none" />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <input value={editForm.dni || ""} onChange={e => setEditForm(f => ({ ...f, dni: e.target.value }))}
                      placeholder="DNI" className="w-32 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                    <input type="date" value={editForm.birth_date || ""} onChange={e => setEditForm(f => ({ ...f, birth_date: e.target.value }))}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-white leading-tight">{player.full_name}</h2>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusClass}`}>
                      {player.status || "Sin estado"}
                    </span>
                    {isGK && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-300">🥅 Arquero</span>}
                    {player.position && <span className="text-xs text-zinc-400">{player.position}</span>}
                    {player.jersey_number && <span className="text-xs text-zinc-500">#{player.jersey_number}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-500">
                    {playerAge && <span>{playerAge} años</span>}
                    {player.category && <span>{player.category}</span>}
                    {player.division && <span>{player.division}</span>}
                    {dayStatus && (
                      <span className="text-amber-400">Hoy: {dayStatus.status}</span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {canEdit && !editing && (
                <button onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors">
                  <Edit2 size={12} /> Editar
                </button>
              )}
              {editing && (
                <>
                  <button onClick={() => { setEditing(false); setEditForm(player); }}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-medium transition-colors">
                    Cancelar
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-zinc-900 text-xs font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50">
                    <Save size={12} /> {saving ? "Guardando..." : "Guardar"}
                  </button>
                </>
              )}
              <button onClick={closeCard}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Edit extended fields */}
          {editing && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Posición</label>
                <select value={editForm.position || ""} onChange={e => setEditForm(f => ({ ...f, position: e.target.value }))}
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                  <option value="">—</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Grupo posicional</label>
                <select value={editForm.position_group || ""} onChange={e => setEditForm(f => ({ ...f, position_group: e.target.value }))}
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                  <option value="">—</option>
                  {POSITION_GROUPS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Tipo</label>
                <select value={editForm.player_type || "jugador_campo"} onChange={e => setEditForm(f => ({ ...f, player_type: e.target.value }))}
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                  <option value="jugador_campo">Jugador de campo</option>
                  <option value="arquero">Arquero</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Pierna hábil</label>
                <select value={editForm.dominant_leg || ""} onChange={e => setEditForm(f => ({ ...f, dominant_leg: e.target.value }))}
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                  <option value="">—</option>
                  {LEG_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Altura (cm)</label>
                <input type="number" value={editForm.height || ""} onChange={e => setEditForm(f => ({ ...f, height: +e.target.value }))}
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Peso (kg)</label>
                <input type="number" value={editForm.weight || ""} onChange={e => setEditForm(f => ({ ...f, weight: +e.target.value }))}
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Estado</label>
                <select value={editForm.status || ""} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Notas</label>
                <textarea value={editForm.notes || ""} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none resize-none" />
              </div>
            </div>
          )}

          {/* Quick stats row */}
          {!editing && (
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mt-4">
              <MiniStat label="Estado" value={player.status || "—"} color={player.status === "Disponible" ? "text-emerald-400 text-sm" : "text-zinc-300 text-sm"} />
              <MiniStat label="Hoy" value={dayStatus?.status || "—"} color="text-amber-300 text-xs" />
              <MiniStat label="Sesiones" value={sessionPlayers.length || "—"} color="text-blue-400" />
              <MiniStat label="Min. temporada" value={minutes.reduce((s, r) => s + (r.minutes || 0), 0) || "—"} color="text-yellow-400" />
              <MiniStat label="Últ. GPS" value={gpsData[0] ? moment(gpsData[0].created_date).format("DD/MM") : "—"} color="text-purple-400" />
              <MiniStat label="Lesiones" value={medical.filter(m => m.status === "Activa" || m.status === "activa").length || 0} color="text-red-400" />
              <MiniStat label="Posición" value={player.position_group || player.position || "—"} color="text-zinc-300 text-xs" />
              <MiniStat label="Pierna" value={player.dominant_leg || "—"} color="text-zinc-300 text-xs" />
            </div>
          )}
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div className="flex border-b border-zinc-800 overflow-x-auto shrink-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => handleTabChange(id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-all whitespace-nowrap shrink-0 ${
                activeTab === id ? "border-white text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}>
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ────────────────────────────────────────────────── */}
        <div className="p-5 min-h-64">
          {tabLoading && <Spinner />}
          {!tabLoading && (
            <>
              {activeTab === "resumen" && <TabResumen player={player} gpsData={gpsData} minutes={minutes} medical={medical} dayStatus={dayStatus} />}
              {activeTab === "planteles" && <TabPlanteles memberships={memberships} />}
              {activeTab === "sesiones" && <TabSesiones sessions={sessions} sessionPlayers={sessionPlayers} playerId={player.id} />}
              {activeTab === "gps" && <TabGPS gpsData={gpsData} />}
              {activeTab === "partidos" && <TabPartidos minutes={minutes} />}
              {activeTab === "medico" && <TabMedico medical={medical} />}
              {activeTab === "wellness" && <TabWellness playerId={player.id} />}
              {activeTab === "evaluaciones" && <TabEvaluaciones playerId={player.id} />}
              {activeTab === "identidad" && <TabIdentidad aliases={aliases} player={player} onAliasChange={setAliases} />}
              {activeTab === "archivos" && <TabArchivos player={player} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

function TabResumen({ player, gpsData, minutes, medical, dayStatus }) {
  const playerAge = age(player.birth_date);
  const totalMins = minutes.reduce((s, r) => s + (r.minutes || 0), 0);
  const lastGPS   = gpsData[0];
  const lastMatch = minutes[0];
  const activeMed = medical.filter(m => ["Activa", "activa", "En tratamiento"].includes(m.status));

  return (
    <div className="space-y-5">
      {/* Datos clave */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2">Datos personales</p>
          <div className="bg-zinc-900 rounded-xl px-4 divide-y divide-zinc-800/50">
            <InfoRow label="Nombre completo" value={player.full_name} />
            <InfoRow label="DNI" value={player.dni || player.document_number} />
            <InfoRow label="Fecha de nacimiento" value={fmtDate(player.birth_date)} />
            <InfoRow label="Edad" value={playerAge ? `${playerAge} años` : null} />
            <InfoRow label="Pierna hábil" value={player.dominant_leg} />
            <InfoRow label="Altura" value={player.height ? `${player.height} cm` : null} />
            <InfoRow label="Peso" value={player.weight ? `${player.weight} kg` : null} />
          </div>
        </div>
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2">Plantel y posición</p>
          <div className="bg-zinc-900 rounded-xl px-4 divide-y divide-zinc-800/50">
            <InfoRow label="Plantel / División" value={player.division} />
            <InfoRow label="Categoría" value={player.category} />
            <InfoRow label="Posición" value={player.position} />
            <InfoRow label="Grupo posicional" value={player.position_group} />
            <InfoRow label="Tipo" value={player.player_type === "arquero" ? "🥅 Arquero" : "Jugador de campo"} />
            <InfoRow label="Estado" value={player.status} />
            <InfoRow label="Disponibilidad hoy" value={dayStatus?.status} />
          </div>
        </div>
      </div>

      {/* ID oficial */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2">ID oficial del sistema</p>
        <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
          <span className="text-xs font-mono text-zinc-300 flex-1 break-all">{player.id}</span>
          <CopyBtn text={player.id} />
        </div>
      </div>

      {/* Últimas actividades */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-zinc-900 rounded-xl p-3">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Último GPS</p>
          <p className="text-sm text-white font-semibold">{lastGPS ? fmtDate(lastGPS.created_date) : "—"}</p>
          {lastGPS && <p className="text-[10px] text-zinc-500 mt-0.5">{lastGPS.total_distance?.toFixed(0)} m</p>}
        </div>
        <div className="bg-zinc-900 rounded-xl p-3">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Último partido</p>
          <p className="text-sm text-white font-semibold">{lastMatch ? fmtDate(lastMatch.match_date) : "—"}</p>
          {lastMatch && <p className="text-[10px] text-zinc-500 mt-0.5">{lastMatch.minutes}' · {lastMatch.rival || ""}</p>}
        </div>
        <div className="bg-zinc-900 rounded-xl p-3">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Min. temporada</p>
          <p className="text-xl font-bold text-yellow-400">{totalMins}'</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-3">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Lesiones activas</p>
          <p className={`text-xl font-bold ${activeMed.length > 0 ? "text-red-400" : "text-emerald-400"}`}>{activeMed.length}</p>
        </div>
      </div>

      {/* Lesiones activas */}
      {activeMed.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-xs text-red-400 font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <AlertCircle size={12} /> Lesiones activas
          </p>
          <div className="space-y-2">
            {activeMed.map(m => (
              <div key={m.id} className="text-sm text-white">
                <span className="font-medium">{m.diagnosis}</span>
                {m.injury_date && <span className="text-zinc-500 ml-2">{fmtDate(m.injury_date)}</span>}
                {m.body_zone && <span className="text-zinc-500 ml-1">· {m.body_zone}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {player.notes && (
        <div className="bg-zinc-900 rounded-xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2">Notas</p>
          <p className="text-sm text-zinc-300 whitespace-pre-wrap">{player.notes}</p>
        </div>
      )}
    </div>
  );
}

function TabPlanteles({ memberships }) {
  if (!memberships.length) return <EmptyState />;
  const active  = memberships.filter(m => m.status === "activo");
  const history = memberships.filter(m => m.status !== "activo");
  return (
    <div className="space-y-4">
      {active.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2">Plantel actual</p>
          {active.map(m => (
            <div key={m.id} className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
              <p className="text-white font-semibold">{m.squad_name}</p>
              <p className="text-xs text-zinc-500 mt-1">Desde {fmtDate(m.effective_from)} {m.reason ? `· ${m.reason}` : ""}</p>
            </div>
          ))}
        </div>
      )}
      {history.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2">Historial de planteles</p>
          <div className="space-y-2">
            {history.map(m => (
              <div key={m.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white">{m.squad_name}</p>
                  <p className="text-xs text-zinc-500">{fmtDate(m.effective_from)} → {fmtDate(m.effective_to) || "vigente"}</p>
                  {m.reason && <p className="text-xs text-zinc-600 italic mt-0.5">{m.reason}</p>}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 shrink-0">{m.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TabSesiones({ sessions, sessionPlayers, playerId }) {
  if (!sessionPlayers.length) return <EmptyState />;
  const spById = {};
  sessionPlayers.forEach(sp => { spById[sp.session_id] = sp; });
  const present = sessionPlayers.filter(sp => sp.attendance === "presente" || !sp.attendance);
  const totalMins = sessionPlayers.reduce((s, sp) => s + (sp.minutes || 0), 0);
  const avgRpe = sessionPlayers.filter(sp => sp.rpe).length
    ? (sessionPlayers.filter(sp => sp.rpe).reduce((s, sp) => s + sp.rpe, 0) / sessionPlayers.filter(sp => sp.rpe).length).toFixed(1)
    : "—";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Sesiones totales" value={sessionPlayers.length} color="text-blue-400" />
        <MiniStat label="Presentes" value={present.length} color="text-emerald-400" />
        <MiniStat label="Min. entrenamiento" value={totalMins > 0 ? `${totalMins}'` : "—"} color="text-yellow-400" />
      </div>
      <MiniStat label="RPE promedio" value={avgRpe} color="text-orange-400" />
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2">Historial de sesiones</p>
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {sessions.slice(0, 30).map(s => {
            const sp = spById[s.id];
            return (
              <div key={s.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{s.title}</p>
                  <p className="text-xs text-zinc-500">{fmtDate(s.date)} · {s.session_type}</p>
                </div>
                {sp && (
                  <div className="text-right shrink-0">
                    {sp.minutes ? <p className="text-xs text-yellow-400 font-semibold">{sp.minutes}'</p> : null}
                    {sp.rpe ? <p className="text-xs text-orange-400">RPE {sp.rpe}</p> : null}
                    <p className={`text-[10px] ${sp.attendance === "presente" ? "text-emerald-400" : "text-zinc-500"}`}>
                      {sp.attendance || "presente"}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const GPS_COLS = [
  { key: "total_distance", label: "Dist. total (m)" },
  { key: "m_min",          label: "m/min" },
  { key: "distance_19_8",  label: "D >19.8 (m)" },
  { key: "distance_25",    label: "D >25 (m)" },
  { key: "sprints",        label: "Sprints" },
  { key: "acc_3",          label: "ACC +3" },
  { key: "dec_3",          label: "DEC +3" },
  { key: "player_load",    label: "Player Load" },
  { key: "smax",           label: "Smax (km/h)" },
];

function avg(arr, key) {
  const vals = arr.map(r => r[key]).filter(v => v != null && !isNaN(v));
  if (!vals.length) return "—";
  return (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1);
}
function max(arr, key) {
  const vals = arr.map(r => r[key]).filter(v => v != null && !isNaN(v));
  if (!vals.length) return "—";
  return Math.max(...vals).toFixed(1);
}

function TabGPS({ gpsData }) {
  if (!gpsData.length) return <EmptyState />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Registros GPS" value={gpsData.length} color="text-purple-400" />
        <MiniStat label="Última carga" value={fmtDate(gpsData[0]?.created_date)} color="text-zinc-300 text-xs" />
        <MiniStat label="Dist. prom." value={avg(gpsData, "total_distance") + " m"} color="text-blue-400 text-sm" />
      </div>
      {/* Promedios y máximos */}
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2">Promedios y máximos</p>
        <div className="bg-zinc-900 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-3 py-2 text-zinc-500 font-medium">Variable</th>
                <th className="text-right px-3 py-2 text-zinc-500 font-medium">Promedio</th>
                <th className="text-right px-3 py-2 text-zinc-500 font-medium">Máximo</th>
              </tr>
            </thead>
            <tbody>
              {GPS_COLS.map(col => (
                <tr key={col.key} className="border-b border-zinc-800/50 last:border-0">
                  <td className="px-3 py-2 text-zinc-400">{col.label}</td>
                  <td className="px-3 py-2 text-right text-white font-medium">{avg(gpsData, col.key)}</td>
                  <td className="px-3 py-2 text-right text-yellow-400 font-medium">{max(gpsData, col.key)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Tabla histórica (últimas 15) */}
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2">Últimas cargas</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-max">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-2 py-2 text-zinc-500">Fecha</th>
                {GPS_COLS.map(c => <th key={c.key} className="text-right px-2 py-2 text-zinc-500 whitespace-nowrap">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {gpsData.slice(0, 15).map(r => (
                <tr key={r.id} className="border-b border-zinc-800/40 last:border-0">
                  <td className="px-2 py-1.5 text-zinc-400 whitespace-nowrap">{fmtDate(r.created_date)}</td>
                  {GPS_COLS.map(c => (
                    <td key={c.key} className="px-2 py-1.5 text-right text-white">{r[c.key] ?? "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TabPartidos({ minutes }) {
  if (!minutes.length) return <EmptyState />;
  const total = minutes.reduce((s, r) => s + (r.minutes || 0), 0);
  const played = minutes.filter(r => (r.minutes || 0) > 0).length;
  const today = moment();
  const last7  = minutes.filter(r => r.match_date && today.diff(moment(r.match_date), "days") <= 7).reduce((s, r) => s + (r.minutes || 0), 0);
  const last28 = minutes.filter(r => r.match_date && today.diff(moment(r.match_date), "days") <= 28).reduce((s, r) => s + (r.minutes || 0), 0);
  const starters = minutes.filter(r => (r.minutes || 0) >= 70).length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Partidos jugados" value={played} color="text-blue-400" />
        <MiniStat label="Min. totales" value={`${total}'`} color="text-yellow-400" />
        <MiniStat label="Min. últ. 7 días" value={`${last7}'`} color="text-emerald-400" />
        <MiniStat label="Min. últ. 28 días" value={`${last28}'`} color="text-cyan-400" />
        <MiniStat label="Titularidades" value={starters} color="text-violet-400" />
        <MiniStat label="Promedio" value={played ? `${Math.round(total / played)}'` : "—"} color="text-orange-400" />
      </div>
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2">Historial de partidos</p>
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {minutes.map(r => (
            <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white">{r.rival || r.match_label || "Partido"}</p>
                <p className="text-xs text-zinc-500">{fmtDate(r.match_date)}{r.competition ? ` · ${r.competition}` : ""}</p>
              </div>
              <span className={`text-lg font-bold ${(r.minutes || 0) >= 70 ? "text-yellow-400" : (r.minutes || 0) > 0 ? "text-white" : "text-zinc-600"}`}>
                {r.minutes || 0}'
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TabMedico({ medical }) {
  if (!medical.length) return <EmptyState />;
  const active  = medical.filter(m => ["Activa", "activa", "En tratamiento"].includes(m.status));
  const history = medical.filter(m => !["Activa", "activa", "En tratamiento"].includes(m.status));
  return (
    <div className="space-y-4">
      {active.length > 0 && (
        <div>
          <p className="text-xs text-red-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
            <AlertCircle size={11} /> Lesiones activas ({active.length})
          </p>
          {active.map(m => (
            <div key={m.id} className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-1.5">
              <p className="text-white font-semibold">{m.diagnosis}</p>
              <div className="grid grid-cols-2 gap-1 text-xs text-zinc-400">
                {m.body_zone && <span>Zona: {m.body_zone}</span>}
                {m.injury_date && <span>Fecha: {fmtDate(m.injury_date)}</span>}
                {m.expected_return && <span>Alta estimada: {fmtDate(m.expected_return)}</span>}
                {m.days_out && <span>Días de baja: {m.days_out}</span>}
              </div>
              {m.notes && <p className="text-xs text-zinc-500 italic">{m.notes}</p>}
            </div>
          ))}
        </div>
      )}
      {history.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2">Historial médico</p>
          <div className="space-y-2">
            {history.map(m => (
              <div key={m.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-white">{m.diagnosis}</p>
                  {m.status && <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 shrink-0">{m.status}</span>}
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  {fmtDate(m.injury_date)}
                  {m.body_zone ? ` · ${m.body_zone}` : ""}
                  {m.days_out ? ` · ${m.days_out} días` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TabWellness({ playerId }) {
  return (
    <div className="text-center py-12">
      <p className="text-zinc-500 text-sm">Módulo Wellness próximamente</p>
      <p className="text-zinc-600 text-xs mt-1">Sueño · Fatiga · Dolor muscular · Estrés · Ánimo</p>
    </div>
  );
}

function TabEvaluaciones({ playerId }) {
  return (
    <div className="text-center py-12">
      <p className="text-zinc-500 text-sm">Módulo de Evaluaciones próximamente</p>
      <p className="text-zinc-600 text-xs mt-1">CMJ · VALD · Antropometría · Fuerza · Historial</p>
    </div>
  );
}

const ALIAS_SOURCES = ["Catapult", "CSV GPS", "Wellness", "Minutos", "Manual", "Excel", "Otro"];
const SOURCE_COLORS = {
  "Catapult": "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "CSV GPS":  "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Minutos":  "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  "Manual":   "bg-zinc-700/60 text-zinc-300 border-zinc-600",
  "Excel":    "bg-green-500/20 text-green-300 border-green-500/30",
  "Otro":     "bg-purple-500/20 text-purple-300 border-purple-500/30",
};

function TabIdentidad({ aliases, player, onAliasChange }) {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [source, setSource] = useState("Manual");

  const bySource = {};
  aliases.forEach(a => { if (!bySource[a.source]) bySource[a.source] = []; bySource[a.source].push(a); });

  async function addAlias(e) {
    e.preventDefault();
    if (!input.trim()) return;
    const normalized = input.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
    const created = await base44.entities.PlayerAlias.create({
      player_id: player.id, player_name: player.full_name || "",
      alias_name: input.trim(), normalized_alias: normalized, source, confidence_score: 1,
    });
    onAliasChange(prev => [created, ...prev]);
    setInput("");
    toast({ title: "Alias agregado" });
  }

  async function delAlias(id) {
    await base44.entities.PlayerAlias.delete(id);
    onAliasChange(prev => prev.filter(a => a.id !== id));
    toast({ title: "Alias eliminado" });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <MiniStat label="Alias totales" value={aliases.length} color="text-white" />
        <MiniStat label="Fuentes" value={Object.keys(bySource).length} color="text-blue-400" />
      </div>
      <form onSubmit={addAlias} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Agregar alias</p>
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            placeholder="Nombre en CSV..." className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
          <select value={source} onChange={e => setSource(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-sm text-white focus:outline-none">
            {ALIAS_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="submit" className="px-3 py-2 bg-white text-zinc-900 rounded-lg text-sm font-semibold hover:bg-zinc-200 transition-colors">+</button>
        </div>
      </form>
      {aliases.length === 0 ? <EmptyState text="Sin alias registrados" /> : (
        <div className="space-y-3">
          {ALIAS_SOURCES.filter(src => bySource[src]?.length > 0).map(src => (
            <div key={src}>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${SOURCE_COLORS[src] || ""}`}>{src}</span>
              <div className="mt-2 space-y-1.5">
                {bySource[src].map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm text-white">{a.alias_name}</p>
                      {a.normalized_alias !== a.alias_name?.toLowerCase() && (
                        <p className="text-xs text-zinc-600 font-mono">{a.normalized_alias}</p>
                      )}
                    </div>
                    <button onClick={() => delAlias(a.id)} className="text-zinc-600 hover:text-red-400 transition-colors p-1">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabArchivos({ player }) {
  const links = [player.video_url].filter(Boolean);
  if (!links.length && !player.photo_url) return <EmptyState text="Sin archivos vinculados" />;
  return (
    <div className="space-y-3">
      {player.photo_url && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2">Foto de perfil</p>
          <img src={player.photo_url} alt={player.full_name} className="w-20 h-20 rounded-xl object-cover" />
        </div>
      )}
      {links.map((url, i) => (
        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition-colors">
          <Paperclip size={14} className="text-zinc-500 shrink-0" />
          <span className="text-sm text-blue-400 truncate">{url}</span>
          <ChevronRight size={14} className="text-zinc-600 shrink-0 ml-auto" />
        </a>
      ))}
    </div>
  );
}