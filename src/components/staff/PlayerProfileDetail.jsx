import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus, Trash2, AlertCircle, User, Activity, Zap, MapPin, Home, FileText, Calendar, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import moment from "moment";
import "moment/locale/es";
moment.locale("es");

const medicalStatuses = ["Lesionado", "En recuperación", "Seguimiento", "Alta médica"];

const TABS = [
  { id: "info", label: "Info general", icon: User },
  { id: "rendimiento", label: "Rendimiento", icon: Activity },
  { id: "carga", label: "Carga externa", icon: Zap },
];

const statusColors = {
  "Lesionado": "bg-red-500/20 text-red-300 border-red-500/30",
  "En recuperación": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  "Seguimiento": "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Alta médica": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

function StatCard({ label, value, sub, color = "text-white" }) {
  return (
    <div className="bg-zinc-800/60 rounded-xl p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value ?? "—"}</p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function InfoRow({ label, value, icon: Icon }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-zinc-800/60 last:border-0">
      {Icon && <Icon size={15} className="text-zinc-600 mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-sm text-white font-medium mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// Tab: Info General
function TabInfo({ player, medicalRecords, loadingRecords, showMedicalForm, setShowMedicalForm, medicalForm, setMedicalForm, handleAddMedical, deleteMedical }) {
  const age = player.birth_date ? moment().diff(moment(player.birth_date), "years") : null;

  return (
    <div className="space-y-6">
      {/* Datos personales */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Datos personales</h3>
        <div className="bg-zinc-800/30 rounded-xl px-4 divide-y divide-zinc-800/60">
          <InfoRow label="Edad" value={age !== null ? `${age} años` : null} icon={Calendar} />
          <InfoRow label="Fecha de nacimiento" value={player.birth_date ? moment(player.birth_date).format("DD/MM/YYYY") : null} icon={Calendar} />
          <InfoRow label="DNI / Documento" value={player.document_number} icon={FileText} />
          <InfoRow label="Lugar de nacimiento" value={player.birth_place} icon={MapPin} />
          <InfoRow label="Residencia actual" value={player.current_residence} icon={Home} />
          <InfoRow label="Pierna hábil" value={player.dominant_foot} icon={Activity} />
        </div>
      </div>

      {/* Datos del club */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Datos del club</h3>
        <div className="bg-zinc-800/30 rounded-xl px-4 divide-y divide-zinc-800/60">
          <InfoRow label="Categoría" value={player.category} icon={Shield} />
          <InfoRow label="División" value={player.division} icon={Shield} />
          <InfoRow label="Período de temporada" value={player.season_period} icon={Calendar} />
          <InfoRow label="Pensión del club" value={player.club_housing ? "Sí" : "No"} icon={Home} />
          <InfoRow label="Contrato" value={player.has_contract ? "Sí" : "No"} icon={FileText} />
        </div>
      </div>

      {/* Historial médico */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
            <AlertCircle size={13} className="text-red-400" /> Historial médico
          </h3>
          <button
            onClick={() => setShowMedicalForm(!showMedicalForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 rounded-lg transition-colors font-medium"
          >
            <Plus size={13} /> Nuevo
          </button>
        </div>

        {showMedicalForm && (
          <form onSubmit={handleAddMedical} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 mb-4 space-y-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Diagnóstico *</label>
              <Input value={medicalForm.diagnosis} onChange={(e) => setMedicalForm((f) => ({ ...f, diagnosis: e.target.value }))} placeholder="Ej: Desgarro muscular" required className="bg-zinc-900 border-zinc-600 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Fecha de lesión</label>
                <Input type="date" value={medicalForm.injury_date} onChange={(e) => setMedicalForm((f) => ({ ...f, injury_date: e.target.value }))} className="bg-zinc-900 border-zinc-600 text-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Retorno estimado</label>
                <Input type="date" value={medicalForm.expected_return} onChange={(e) => setMedicalForm((f) => ({ ...f, expected_return: e.target.value }))} className="bg-zinc-900 border-zinc-600 text-white" />
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Estado</label>
              <Select value={medicalForm.status} onValueChange={(v) => setMedicalForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="bg-zinc-900 border-zinc-600 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {medicalStatuses.map((s) => <SelectItem key={s} value={s} className="text-white">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Notas</label>
              <Textarea value={medicalForm.notes} onChange={(e) => setMedicalForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="bg-zinc-900 border-zinc-600 text-white resize-none" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm">Guardar</Button>
              <Button type="button" onClick={() => setShowMedicalForm(false)} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white text-sm">Cancelar</Button>
            </div>
          </form>
        )}

        {loadingRecords ? (
          <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div>
        ) : medicalRecords.length === 0 ? (
          <div className="bg-zinc-800/30 border border-zinc-800 rounded-lg p-5 text-center">
            <p className="text-zinc-500 text-sm">Sin registros médicos</p>
          </div>
        ) : (
          <div className="space-y-2">
            {medicalRecords.map((record) => (
              <div key={record.id} className={`border rounded-lg p-3 ${statusColors[record.status] || "bg-zinc-800/50 border-zinc-700"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{record.diagnosis}</p>
                    <p className="text-xs opacity-75 mt-0.5">{record.injury_date ? moment(record.injury_date).format("DD/MM/YYYY") : "Fecha no registrada"}</p>
                    {record.expected_return && <p className="text-xs opacity-75">Retorno: {moment(record.expected_return).format("DD/MM/YYYY")}</p>}
                    {record.notes && <p className="text-xs opacity-60 italic mt-1">"{record.notes}"</p>}
                  </div>
                  <button onClick={() => deleteMedical(record.id)} className="p-1.5 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Tab: Rendimiento
function TabRendimiento({ player }) {
  const [minutesRecords, setMinutesRecords] = useState([]);
  const [gpsRecords, setGpsRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [mins, gps] = await Promise.all([
        base44.entities.MinutesRecord.filter({ player_id: player.id }, "-match_date", 50),
        base44.entities.GPSRecord.filter({ player_id: player.id }, "-date", 30),
      ]);
      setMinutesRecords(mins);
      setGpsRecords(gps);
      setLoading(false);
    }
    load();
  }, [player.id]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div>;

  const totalMinutes = minutesRecords.reduce((s, r) => s + (r.minutes || 0), 0);
  const matchesPlayed = minutesRecords.filter(r => (r.minutes || 0) > 0).length;
  const avgMinutes = matchesPlayed ? Math.round(totalMinutes / matchesPlayed) : 0;

  const avgGps = (field) => {
    const vals = gpsRecords.filter(r => r[field] > 0).map(r => r[field]);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };

  const minutesChartData = [...minutesRecords].reverse().slice(-10).map(r => ({
    label: r.rival ? r.rival.slice(0, 6) : moment(r.match_date).format("DD/MM"),
    min: r.minutes || 0,
  }));

  const gpsChartData = [...gpsRecords].reverse().slice(-10).map(r => ({
    label: moment(r.date).format("DD/MM"),
    dist: Math.round((r.total_distance || 0) / 1000 * 10) / 10,
  }));

  return (
    <div className="space-y-6">
      {/* Minutos */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Minutos oficiales</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard label="Total minutos" value={totalMinutes} color="text-yellow-400" />
          <StatCard label="Partidos jugados" value={matchesPlayed} color="text-blue-400" />
          <StatCard label="Prom. por partido" value={avgMinutes ? `${avgMinutes}'` : "—"} color="text-white" />
        </div>
        {minutesChartData.length > 0 ? (
          <div className="bg-zinc-800/40 rounded-xl p-3">
            <p className="text-xs text-zinc-500 mb-3">Últimos partidos (minutos)</p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={minutesChartData} barSize={20}>
                <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide domain={[0, 90]} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }} labelStyle={{ color: "#fff" }} itemStyle={{ color: "#facc15" }} formatter={(v) => [`${v}'`, "Minutos"]} />
                <Bar dataKey="min" fill="#facc15" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-zinc-600 text-sm text-center py-4">Sin registros de minutos</p>
        )}
      </div>

      {/* GPS resumen */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">GPS — Promedios generales</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatCard label="Dist. total prom." value={avgGps("total_distance") ? `${Math.round(avgGps("total_distance") / 100) / 10} km` : "—"} color="text-blue-400" />
          <StatCard label="Vel. máx. prom." value={avgGps("max_speed") ? `${avgGps("max_speed")} km/h` : "—"} color="text-orange-400" />
          <StatCard label="HSR prom." value={avgGps("high_speed_running") ? `${avgGps("high_speed_running")} m` : "—"} color="text-purple-400" />
          <StatCard label="Player Load prom." value={avgGps("player_load")} color="text-emerald-400" />
        </div>
        {gpsChartData.length > 0 ? (
          <div className="bg-zinc-800/40 rounded-xl p-3">
            <p className="text-xs text-zinc-500 mb-3">Distancia total por sesión (km)</p>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={gpsChartData}>
                <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }} labelStyle={{ color: "#fff" }} itemStyle={{ color: "#60a5fa" }} formatter={(v) => [`${v} km`, "Distancia"]} />
                <Line type="monotone" dataKey="dist" stroke="#60a5fa" strokeWidth={2} dot={{ fill: "#60a5fa", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-zinc-600 text-sm text-center py-4">Sin registros GPS</p>
        )}
      </div>
    </div>
  );
}

// Tab: Carga Externa GPS
function TabCarga({ player }) {
  const [gpsRecords, setGpsRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("7");

  // Normalizar nombre: remover tildes, espacios extras, convertir a minúsculas
  const normalizeName = (name) => {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  };

  // Obtener palabras del nombre (para matching flexible)
  const getNameWords = (name) => {
    return normalizeName(name).split(" ").filter(w => w.length > 2);
  };

  // Verificar si dos nombres coinciden (búsqueda flexible)
  const namesMatch = (name1, name2) => {
    const norm1 = normalizeName(name1);
    const norm2 = normalizeName(name2);
    
    // Coincidencia exacta
    if (norm1 === norm2) return true;
    
    const words1 = getNameWords(name1);
    const words2 = getNameWords(name2);
    if (words1.length === 0 || words2.length === 0) return false;
    
    // Contar coincidencias de palabras
    const matches = words1.filter(w => words2.includes(w)).length;
    // Al menos 1 palabra debe coincidir si hay pocas palabras, o más palabras si hay muchas
    const minMatches = Math.max(1, Math.min(words1.length, words2.length) - 1);
    return matches >= minMatches;
  };

  useEffect(() => {
    async function load() {
      try {
        const allCatapult = await base44.entities.CatapultReport.list("-date", 200);
        const filtered = allCatapult.filter(r => namesMatch(player.name, r.player_name));
        // Deduplicar por fecha: mantener el último (más reciente) de cada día
        const deduped = {};
        filtered.forEach(r => {
          if (!deduped[r.date] || new Date(r.created_date) > new Date(deduped[r.date].created_date)) {
            deduped[r.date] = r;
          }
        });
        setGpsRecords(Object.values(deduped) || []);
      } catch (e) {
        console.error("Error loading GPS records:", e);
        setGpsRecords([]);
      } finally {
        setLoading(false);
      }
    }
    load();

    // Suscribirse a cambios en CatapultReport para actualizaciones en tiempo real
    const unsubscribe = base44.entities.CatapultReport.subscribe((event) => {
      load();
    });
    return unsubscribe;
  }, [player.id, player.name]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div>;

  const cutoff = moment().subtract(Number(period), "days").format("YYYY-MM-DD");
  const filtered = gpsRecords.filter(r => r.date >= cutoff);

  const sum = (field) => filtered.reduce((s, r) => s + (r[field] || 0), 0);
  const avg = (field) => {
    const vals = filtered.filter(r => r[field] > 0);
    return vals.length ? Math.round(vals.reduce((s, r) => s + r[field], 0) / vals.length) : null;
  };

  const chartData = [...filtered].reverse().map(r => ({
    label: moment(r.date).format("DD/MM"),
    dist: Math.round((r.total_distance || 0) / 100) / 10,
    hsr: r.high_speed_running || 0,
    pl: r.player_load || 0,
  }));

  const periodLabels = { "7": "7 días", "14": "14 días", "30": "Último mes" };

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex gap-1 bg-zinc-800 rounded-lg p-1 w-fit">
        {Object.entries(periodLabels).map(([val, lbl]) => (
          <button key={val} onClick={() => setPeriod(val)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${period === val ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>
            {lbl}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-zinc-800/30 border border-zinc-800 rounded-xl p-8 text-center">
          <Zap size={28} className="text-zinc-700 mx-auto mb-2" />
          <p className="text-zinc-500 text-sm">Sin registros GPS en los últimos {period} días</p>
        </div>
      ) : (
        <>
          {/* Resumen del período */}
          <div>
            <p className="text-xs text-zinc-500 mb-3">Resumen — últimos {period} días ({filtered.length} sesiones)</p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Dist. total acum." value={`${Math.round(sum("total_distance") / 100) / 10} km`} color="text-blue-400" />
              <StatCard label="HSR acumulado" value={`${sum("high_speed_running")} m`} color="text-purple-400" />
              <StatCard label="Sprint acum." value={`${sum("sprint_distance")} m`} color="text-orange-400" />
              <StatCard label="Player Load total" value={Math.round(sum("player_load"))} color="text-emerald-400" />
              <StatCard label="Vel. máx. prom." value={avg("max_speed") ? `${avg("max_speed")} km/h` : "—"} color="text-yellow-400" />
              <StatCard label="Sesiones" value={filtered.length} color="text-white" />
            </div>
          </div>

          {/* Gráfico distancia */}
          {chartData.length > 1 && (
            <div className="bg-zinc-800/40 rounded-xl p-3">
              <p className="text-xs text-zinc-500 mb-3">Distancia por sesión (km)</p>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={chartData} barSize={18}>
                  <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }} labelStyle={{ color: "#fff" }} itemStyle={{ color: "#60a5fa" }} formatter={(v) => [`${v} km`, "Distancia"]} />
                  <Bar dataKey="dist" fill="#60a5fa" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabla de sesiones */}
          <div>
            <p className="text-xs text-zinc-500 mb-2">Detalle por sesión</p>
            <div className="bg-zinc-800/30 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-3 py-2 text-zinc-500 font-medium">Fecha</th>
                    <th className="text-right px-3 py-2 text-zinc-500 font-medium">Dist (km)</th>
                    <th className="text-right px-3 py-2 text-zinc-500 font-medium">HSR (m)</th>
                    <th className="text-right px-3 py-2 text-zinc-500 font-medium">PL</th>
                    <th className="text-right px-3 py-2 text-zinc-500 font-medium">Vmáx</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-3 py-2 text-zinc-300">{moment(r.date).format("DD/MM")}</td>
                      <td className="px-3 py-2 text-right text-white font-medium">{r.total_distance ? `${Math.round(r.total_distance / 100) / 10}` : "—"}</td>
                      <td className="px-3 py-2 text-right text-purple-300">{r.high_speed_running || "—"}</td>
                      <td className="px-3 py-2 text-right text-emerald-300">{r.player_load || "—"}</td>
                      <td className="px-3 py-2 text-right text-yellow-300">{r.max_speed ? `${r.max_speed}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Main component
export default function PlayerProfileDetail({ player, onClose }) {
  const [activeTab, setActiveTab] = useState("info");
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [showMedicalForm, setShowMedicalForm] = useState(false);
  const [medicalForm, setMedicalForm] = useState({
    diagnosis: "", status: "Lesionado",
    injury_date: moment().format("YYYY-MM-DD"),
    expected_return: "", treatment: "", notes: "",
  });
  const { toast } = useToast();

  useEffect(() => { 
    loadMedicalRecords();
    // Suscribirse a cambios en registros médicos para sincronización en tiempo real
    const unsubscribe = base44.entities.MedicalRecord.subscribe((event) => {
      if (event.data?.player_id === player.id || event.old_data?.player_id === player.id) {
        loadMedicalRecords();
      }
    });
    return unsubscribe;
  }, [player.id]);

  async function loadMedicalRecords() {
    setLoadingRecords(true);
    const records = await base44.entities.MedicalRecord.filter({ player_id: player.id }, "-injury_date", 100);
    setMedicalRecords(records);
    setLoadingRecords(false);
  }

  async function handleAddMedical(e) {
    e.preventDefault();
    try {
      await base44.entities.MedicalRecord.create({ ...medicalForm, player_id: player.id, player_name: player.name });
      toast({ title: "Registro médico agregado" });
      setShowMedicalForm(false);
      setMedicalForm({ diagnosis: "", status: "Lesionado", injury_date: moment().format("YYYY-MM-DD"), expected_return: "", treatment: "", notes: "" });
      await loadMedicalRecords();
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  }

  async function deleteMedical(id) {
    if (!confirm("¿Eliminar este registro médico?")) return;
    await base44.entities.MedicalRecord.delete(id);
    setMedicalRecords((prev) => prev.filter((r) => r.id !== id));
    toast({ title: "Registro eliminado" });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-4">
            {player.photo_url ? (
              <img src={player.photo_url} alt={player.name} className="w-14 h-14 rounded-full object-cover border-2 border-zinc-700" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center">
                <span className="text-lg font-bold text-zinc-500">{player.name.charAt(0)}</span>
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-white">{player.name}</h2>
              <p className="text-sm text-zinc-500">{player.position}{player.number ? ` · #${player.number}` : ""}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0 border-b border-zinc-800 shrink-0 px-6">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
                activeTab === id
                  ? "border-white text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Tab content — scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "info" && (
            <TabInfo
              player={player}
              medicalRecords={medicalRecords}
              loadingRecords={loadingRecords}
              showMedicalForm={showMedicalForm}
              setShowMedicalForm={setShowMedicalForm}
              medicalForm={medicalForm}
              setMedicalForm={setMedicalForm}
              handleAddMedical={handleAddMedical}
              deleteMedical={deleteMedical}
            />
          )}
          {activeTab === "rendimiento" && <TabRendimiento player={player} />}
          {activeTab === "carga" && <TabCarga player={player} />}
        </div>
      </div>
    </div>
  );
}