import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Edit2, ChevronUp, ChevronDown, Copy, BookOpen, X, Image } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

const EMPHASIS_OPTIONS = ["", "↑", "↓", "→"];

const EMPTY_STATION = {
  method: "", exercise_restore: "", exercise_compensate: "",
  sets: "", reps: "", duration: "", rest_time: "", rir: "",
  emphasis_ce: "", emphasis_velocity: "", emphasis_time: "",
  image_url: "", video_url: "", description: "", notes: "",
};

function normalize(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

async function syncToLibrary(stationData, sessionId, squadId, squadName) {
  const name = stationData.exercise_restore || stationData.exercise_compensate || stationData.method || "";
  if (!name) return;
  const today = moment().format("YYYY-MM-DD");
  const existing = await base44.entities.StrengthExerciseLibrary.filter({}, "-times_used", 500);
  const match = existing.find(e => normalize(e.name) === normalize(name) && (e.global === true || e.squad_id === squadId));
  if (match) {
    await base44.entities.StrengthExerciseLibrary.update(match.id, {
      times_used: (match.times_used || 1) + 1,
      last_used_at: today,
    });
  } else {
    await base44.entities.StrengthExerciseLibrary.create({
      name,
      method: stationData.method || undefined,
      sets: stationData.sets ? parseInt(stationData.sets) : undefined,
      reps: stationData.reps || undefined,
      rest_time: stationData.rest_time || undefined,
      rir: stationData.rir || undefined,
      image_url: stationData.image_url || undefined,
      video_url: stationData.video_url || undefined,
      description: stationData.description || undefined,
      notes: stationData.notes || undefined,
      squad_id: squadId || undefined,
      squad_name: squadName || undefined,
      global: false,
      times_used: 1,
      first_created_at: today,
      last_used_at: today,
      created_from_session_id: sessionId,
    });
  }
}

// Header fields for the strength session
const HEADER_FIELDS = [
  { key: "strength_microcycle", label: "Microciclo" },
  { key: "strength_session_number", label: "N° Sesión" },
  { key: "strength_purpose", label: "Propósito mecánico" },
  { key: "strength_session_type", label: "Tipo de sesión" },
  { key: "strength_vector_pattern", label: "Patrón vectorial" },
];

export default function SessionStrength({ session, onSessionUpdate }) {
  const [stations, setStations] = useState([]);
  const [form, setForm] = useState(EMPTY_STATION);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryExercises, setLibraryExercises] = useState([]);
  const [libSearch, setLibSearch] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);
  const [headerVals, setHeaderVals] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    base44.entities.StrengthStation.filter({ session_id: session.id }, "order", 200)
      .then(rows => setStations(rows.sort((a, b) => (a.order || 0) - (b.order || 0))));
    // Init header vals from session
    const h = {};
    HEADER_FIELDS.forEach(f => { h[f.key] = session[f.key] || ""; });
    setHeaderVals(h);
  }, [session.id]);

  async function saveHeader() {
    const update = {};
    HEADER_FIELDS.forEach(f => { if (headerVals[f.key]) update[f.key] = headerVals[f.key]; });
    await base44.entities.TrainingSession.update(session.id, update);
    if (onSessionUpdate) onSessionUpdate({ ...session, ...update });
    toast({ title: "✓ Encabezado guardado" });
  }

  async function handleImageUpload(file) {
    if (!file) return;
    setUploadingImg(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, image_url: file_url }));
    setUploadingImg(false);
  }

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function openNew() { setForm(EMPTY_STATION); setEditId(null); setShowForm(true); }

  function openEdit(st) {
    setForm({
      method: st.method || "", exercise_restore: st.exercise_restore || "",
      exercise_compensate: st.exercise_compensate || "",
      sets: st.sets ?? "", reps: st.reps || "", duration: st.duration || "",
      rest_time: st.rest_time || "", rir: st.rir || "",
      emphasis_ce: st.emphasis_ce || "", emphasis_velocity: st.emphasis_velocity || "",
      emphasis_time: st.emphasis_time || "",
      image_url: st.image_url || "", video_url: st.video_url || "",
      description: st.description || "", notes: st.notes || "",
    });
    setEditId(st.id);
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      session_id: session.id,
      method: form.method || undefined,
      exercise_restore: form.exercise_restore || undefined,
      exercise_compensate: form.exercise_compensate || undefined,
      sets: form.sets ? parseInt(form.sets) : undefined,
      reps: form.reps || undefined,
      duration: form.duration || undefined,
      rest_time: form.rest_time || undefined,
      rir: form.rir || undefined,
      emphasis_ce: form.emphasis_ce || undefined,
      emphasis_velocity: form.emphasis_velocity || undefined,
      emphasis_time: form.emphasis_time || undefined,
      image_url: form.image_url || undefined,
      video_url: form.video_url || undefined,
      description: form.description || undefined,
      notes: form.notes || undefined,
    };
    if (editId) {
      const updated = await base44.entities.StrengthStation.update(editId, payload);
      setStations(prev => prev.map(s => s.id === editId ? { ...s, ...updated } : s));
      toast({ title: "✓ Estación actualizada" });
    } else {
      payload.order = stations.length + 1;
      payload.station_number = stations.length + 1;
      const created = await base44.entities.StrengthStation.create(payload);
      setStations(prev => [...prev, created]);
      toast({ title: "✓ Estación agregada" });
      // Sync to library
      await syncToLibrary(form, session.id, session?.squad_id, session?.squad_name);
    }
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_STATION);
    setSaving(false);
  }

  async function removeStation(id) {
    if (!window.confirm("¿Eliminar estación?")) return;
    await base44.entities.StrengthStation.delete(id);
    setStations(prev => prev.filter(s => s.id !== id));
  }

  async function duplicateStation(st) {
    const { id, created_date, updated_date, ...rest } = st;
    rest.order = stations.length + 1;
    rest.station_number = stations.length + 1;
    const created = await base44.entities.StrengthStation.create(rest);
    setStations(prev => [...prev, created]);
    toast({ title: "✓ Estación duplicada" });
  }

  async function moveUp(idx) {
    if (idx === 0) return;
    const list = [...stations];
    [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
    const updated = list.map((s, i) => ({ ...s, order: i + 1, station_number: i + 1 }));
    setStations(updated);
    await Promise.all(updated.map(s => base44.entities.StrengthStation.update(s.id, { order: s.order, station_number: s.station_number })));
  }

  async function moveDown(idx) {
    if (idx === stations.length - 1) return;
    const list = [...stations];
    [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
    const updated = list.map((s, i) => ({ ...s, order: i + 1, station_number: i + 1 }));
    setStations(updated);
    await Promise.all(updated.map(s => base44.entities.StrengthStation.update(s.id, { order: s.order, station_number: s.station_number })));
  }

  async function openLibrary() {
    const data = await base44.entities.StrengthExerciseLibrary.list("-times_used", 300);
    const visible = data.filter(e => e.global === true || e.squad_id === session?.squad_id);
    setLibraryExercises(visible);
    setShowLibrary(true);
  }

  function addFromLibrary(ex) {
    setForm({
      method: ex.method || "",
      exercise_restore: ex.name || "",
      exercise_compensate: "",
      sets: ex.sets || "",
      reps: ex.reps || "",
      duration: "",
      rest_time: ex.rest_time || "",
      rir: ex.rir || "",
      emphasis_ce: "", emphasis_velocity: "", emphasis_time: "",
      image_url: ex.image_url || "",
      video_url: ex.video_url || "",
      description: ex.description || "",
      notes: ex.notes || "",
    });
    setEditId(null);
    setShowLibrary(false);
    setShowForm(true);
    // Update library usage
    base44.entities.StrengthExerciseLibrary.update(ex.id, {
      times_used: (ex.times_used || 1) + 1,
      last_used_at: moment().format("YYYY-MM-DD"),
    });
  }

  const filteredLib = libraryExercises.filter(e => {
    const q = libSearch.toLowerCase();
    return !q || (e.name || "").toLowerCase().includes(q) || (e.method || "").toLowerCase().includes(q);
  });

  const emphasisColor = v => v === "↑" ? "text-emerald-400" : v === "↓" ? "text-red-400" : v === "→" ? "text-amber-400" : "text-zinc-600";

  return (
    <div className="space-y-5">
      {/* Session header */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Encabezado de sesión de fuerza</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {HEADER_FIELDS.map(f => (
            <div key={f.key}>
              <label className="text-[10px] text-zinc-500 mb-1 block">{f.label}</label>
              <input value={headerVals[f.key] || ""} onChange={e => setHeaderVals(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
            </div>
          ))}
          <div className="flex items-end">
            <button onClick={saveHeader} className="px-3 py-1.5 bg-zinc-600 hover:bg-zinc-500 text-white rounded-lg text-xs transition-colors">
              Guardar encabezado
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-zinc-500 border-t border-zinc-700 pt-3">
          <span>📅 {moment(session.date).format("dddd DD/MM/YYYY")}</span>
          {session.squad_name && <span>👥 {session.squad_name}</span>}
          {session.match_day_code && <span>🏟️ {session.match_day_code}</span>}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-2 bg-white text-zinc-900 font-semibold rounded-lg text-xs hover:bg-zinc-200 transition-colors">
          <Plus size={13} /> Nueva estación
        </button>
        <button onClick={openLibrary} className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg text-xs hover:bg-zinc-700 transition-colors">
          <BookOpen size={13} /> Agregar desde Biblioteca
        </button>
      </div>

      {stations.length === 0 && !showForm && (
        <p className="text-zinc-600 text-sm text-center py-6">Sin estaciones de fuerza</p>
      )}

      {/* Stations table */}
      {stations.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900">
                  <th className="text-left py-3 px-3 text-zinc-500 font-medium whitespace-nowrap w-8">#</th>
                  <th className="text-left py-3 px-3 text-zinc-500 font-medium whitespace-nowrap">Imagen</th>
                  <th className="text-left py-3 px-3 text-zinc-500 font-medium whitespace-nowrap">Método</th>
                  <th className="text-left py-3 px-3 text-zinc-500 font-medium whitespace-nowrap">Ejercicio Restaura</th>
                  <th className="text-left py-3 px-3 text-zinc-500 font-medium whitespace-nowrap">Ejercicio Compensa</th>
                  <th className="text-center py-3 px-3 text-zinc-500 font-medium whitespace-nowrap">Series</th>
                  <th className="text-center py-3 px-3 text-zinc-500 font-medium whitespace-nowrap">Reps</th>
                  <th className="text-center py-3 px-3 text-zinc-500 font-medium whitespace-nowrap">Tiempo</th>
                  <th className="text-center py-3 px-3 text-zinc-500 font-medium whitespace-nowrap">Pausa</th>
                  <th className="text-center py-3 px-3 text-zinc-500 font-medium whitespace-nowrap">RIR</th>
                  <th className="text-center py-3 px-3 text-zinc-500 font-medium whitespace-nowrap">C.E.</th>
                  <th className="text-center py-3 px-3 text-zinc-500 font-medium whitespace-nowrap">Vel.</th>
                  <th className="text-center py-3 px-3 text-zinc-500 font-medium whitespace-nowrap">Tiempo</th>
                  <th className="text-left py-3 px-3 text-zinc-500 font-medium whitespace-nowrap">Observaciones</th>
                  <th className="py-3 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {stations.map((st, i) => (
                  <tr key={st.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/20 transition-colors">
                    <td className="py-2 px-3">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveUp(i)} className="text-zinc-600 hover:text-zinc-300"><ChevronUp size={11} /></button>
                        <span className="text-[10px] text-zinc-500 text-center font-bold">{i + 1}</span>
                        <button onClick={() => moveDown(i)} className="text-zinc-600 hover:text-zinc-300"><ChevronDown size={11} /></button>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      {st.image_url
                        ? <img src={st.image_url} alt="" className="w-10 h-10 object-cover rounded" />
                        : <div className="w-10 h-10 bg-zinc-800 rounded border border-zinc-700 flex items-center justify-center"><Image size={12} className="text-zinc-600" /></div>
                      }
                    </td>
                    <td className="py-2 px-3 text-zinc-300 whitespace-nowrap">{st.method || "—"}</td>
                    <td className="py-2 px-3 text-white font-medium whitespace-nowrap">{st.exercise_restore || "—"}</td>
                    <td className="py-2 px-3 text-zinc-300 whitespace-nowrap">{st.exercise_compensate || "—"}</td>
                    <td className="py-2 px-3 text-center text-amber-300 font-bold">{st.sets || "—"}</td>
                    <td className="py-2 px-3 text-center text-zinc-300">{st.reps || "—"}</td>
                    <td className="py-2 px-3 text-center text-zinc-300">{st.duration || "—"}</td>
                    <td className="py-2 px-3 text-center text-zinc-300">{st.rest_time || "—"}</td>
                    <td className="py-2 px-3 text-center text-blue-300">{st.rir || "—"}</td>
                    <td className={`py-2 px-3 text-center font-bold text-lg ${emphasisColor(st.emphasis_ce)}`}>{st.emphasis_ce || "—"}</td>
                    <td className={`py-2 px-3 text-center font-bold text-lg ${emphasisColor(st.emphasis_velocity)}`}>{st.emphasis_velocity || "—"}</td>
                    <td className={`py-2 px-3 text-center font-bold text-lg ${emphasisColor(st.emphasis_time)}`}>{st.emphasis_time || "—"}</td>
                    <td className="py-2 px-3 text-zinc-500 max-w-[140px] truncate">{st.notes || "—"}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(st)} className="p-1 text-zinc-600 hover:text-white transition-colors"><Edit2 size={11} /></button>
                        <button onClick={() => duplicateStation(st)} className="p-1 text-zinc-600 hover:text-blue-400 transition-colors"><Copy size={11} /></button>
                        <button onClick={() => removeStation(st.id)} className="p-1 text-zinc-600 hover:text-red-400 transition-colors"><Trash2 size={11} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Station form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">{editId ? "Editar estación" : "Nueva estación"}</p>
            <button type="button" onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-white"><X size={15} /></button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Método</label>
              <input value={form.method} onChange={e => setF("method", e.target.value)} placeholder="ej: Contraste, Potencia"
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Ejercicio Restaura</label>
              <input value={form.exercise_restore} onChange={e => setF("exercise_restore", e.target.value)}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Ejercicio Compensa</label>
              <input value={form.exercise_compensate} onChange={e => setF("exercise_compensate", e.target.value)}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Series</label>
              <input type="number" value={form.sets} onChange={e => setF("sets", e.target.value)}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Repeticiones</label>
              <input value={form.reps} onChange={e => setF("reps", e.target.value)} placeholder="ej: 6-8, 10"
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Tiempo</label>
              <input value={form.duration} onChange={e => setF("duration", e.target.value)} placeholder="ej: 30s, 2min"
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Pausa</label>
              <input value={form.rest_time} onChange={e => setF("rest_time", e.target.value)} placeholder="ej: 90s"
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">RIR</label>
              <input value={form.rir} onChange={e => setF("rir", e.target.value)} placeholder="ej: 2, 0-1"
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>

            {/* Emphasis */}
            {[
              { key: "emphasis_ce", label: "C.E." },
              { key: "emphasis_velocity", label: "Velocidad" },
              { key: "emphasis_time", label: "Tiempo" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="text-[10px] text-zinc-400 mb-1 block">Énfasis {label}</label>
                <div className="flex gap-1">
                  {EMPHASIS_OPTIONS.map(opt => (
                    <button key={opt} type="button"
                      onClick={() => setF(key, opt)}
                      className={`flex-1 py-1.5 rounded text-sm font-bold border transition-colors ${
                        form[key] === opt
                          ? opt === "↑" ? "bg-emerald-500/30 border-emerald-500 text-emerald-300"
                          : opt === "↓" ? "bg-red-500/30 border-red-500 text-red-300"
                          : opt === "→" ? "bg-amber-500/30 border-amber-500 text-amber-300"
                          : "bg-zinc-600 border-zinc-500 text-zinc-300"
                          : "bg-zinc-700 border-zinc-600 text-zinc-500 hover:border-zinc-500"
                      }`}>
                      {opt || "—"}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="col-span-2">
              <label className="text-[10px] text-zinc-400 mb-1 block">Descripción</label>
              <textarea value={form.description} onChange={e => setF("description", e.target.value)} rows={2}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none resize-none" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-zinc-400 mb-1 block">Observaciones</label>
              <input value={form.notes} onChange={e => setF("notes", e.target.value)}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Imagen</label>
              {form.image_url
                ? <div className="relative">
                    <img src={form.image_url} alt="" className="w-full max-h-32 object-cover rounded-lg border border-zinc-600" />
                    <button type="button" onClick={() => setF("image_url", "")}
                      className="absolute top-1 right-1 bg-zinc-900/80 text-zinc-300 hover:text-red-400 rounded-full p-1"><X size={11} /></button>
                  </div>
                : <label className={`flex items-center gap-2 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-xs text-zinc-300 cursor-pointer hover:bg-zinc-600 transition-colors ${uploadingImg ? "opacity-60 pointer-events-none" : ""}`}>
                    <Image size={13} /> {uploadingImg ? "Subiendo..." : "Subir imagen"}
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e.target.files[0])} />
                  </label>
              }
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">URL Video</label>
              <input value={form.video_url} onChange={e => setF("video_url", e.target.value)} placeholder="https://youtube.com/..."
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
              className="px-3 py-1.5 rounded-lg bg-zinc-700 text-zinc-300 text-xs hover:bg-zinc-600 transition-colors">Cancelar</button>
            <button type="submit" disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-white text-zinc-900 font-semibold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50">
              {saving ? "Guardando..." : editId ? "Actualizar" : "Agregar"}
            </button>
          </div>
        </form>
      )}

      {/* Library modal */}
      {showLibrary && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <p className="text-sm font-semibold text-white">Biblioteca de Fuerza</p>
              <button onClick={() => setShowLibrary(false)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-3 border-b border-zinc-800">
              <input value={libSearch} onChange={e => setLibSearch(e.target.value)} placeholder="Buscar ejercicio..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <div className="overflow-y-auto flex-1 p-3 space-y-2">
              {filteredLib.length === 0 && <p className="text-zinc-600 text-sm text-center py-4">Sin ejercicios en la biblioteca.</p>}
              {filteredLib.map(ex => (
                <div key={ex.id} className="flex items-center gap-3 p-3 bg-zinc-800 border border-zinc-700 rounded-lg hover:border-zinc-500 cursor-pointer transition-colors"
                  onClick={() => addFromLibrary(ex)}>
                  {ex.image_url && <img src={ex.image_url} alt="" className="w-10 h-10 object-cover rounded shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{ex.name}</p>
                    {ex.method && <p className="text-[10px] text-zinc-400">{ex.method}</p>}
                    <p className="text-[10px] text-zinc-600">✓ {ex.times_used || 1} usos</p>
                  </div>
                  <div className="text-[10px] text-zinc-500 shrink-0 text-right">
                    {ex.sets && <p>{ex.sets} series</p>}
                    {ex.reps && <p>{ex.reps} reps</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}