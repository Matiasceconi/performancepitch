import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Edit2, ChevronUp, ChevronDown, Copy, BookOpen, X, Image, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

export const METHOD_OPTIONS = ["Dinámicos", "Balísticos", "Biseries", "Triseries", "Contrastes", "Complejos", "Isométricos", "Excéntricos", "Preventivos", "Otro"];
export const TYPE_OPTIONS = ["Esfuerzos repetidos", "Esfuerzos dinámicos", "Antagonistas", "Pliométrico HI", "S/CEA Estato/Dinámico", "Potencia", "Fuerza máxima", "Hipertrofia", "Preventivo", "Otro"];

const EMPTY_STATION = {
  method: "", exercise_type: "", exercise_name: "", volume: "",
  indications: "", compensations: "", notes: "", image_url: "",
};

// Header fields for the strength session
const HEADER_FIELDS = [
  { key: "strength_microcycle", label: "Microciclo" },
  { key: "strength_session_number", label: "N° Sesión" },
  { key: "strength_purpose", label: "Propósito mecánico" },
  { key: "strength_session_type", label: "Tipo de sesión" },
  { key: "strength_vector_pattern", label: "Patrón vectorial" },
];

function normalize(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

async function syncToLibrary(stationData, sessionId, squadId, squadName) {
  const name = stationData.exercise_name || "";
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
      exercise_type: stationData.exercise_type || undefined,
      volume: stationData.volume || undefined,
      image_url: stationData.image_url || undefined,
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
  const [suggesting, setSuggesting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    base44.entities.StrengthStation.filter({ session_id: session.id }, "order", 200)
      .then(rows => setStations(rows.sort((a, b) => (a.order || 0) - (b.order || 0))));
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
      method: st.method || "", exercise_type: st.exercise_type || "",
      exercise_name: st.exercise_name || "", volume: st.volume || "",
      indications: st.indications || "", compensations: st.compensations || "",
      notes: st.notes || "", image_url: st.image_url || "",
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
      exercise_type: form.exercise_type || undefined,
      exercise_name: form.exercise_name || undefined,
      volume: form.volume || undefined,
      indications: form.indications || undefined,
      compensations: form.compensations || undefined,
      notes: form.notes || undefined,
      image_url: form.image_url || undefined,
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
      exercise_type: ex.exercise_type || "",
      exercise_name: ex.name || "",
      volume: ex.volume || "",
      indications: "",
      compensations: "",
      notes: ex.notes || "",
      image_url: ex.image_url || "",
    });
    setEditId(null);
    setShowLibrary(false);
    setShowForm(true);
    base44.entities.StrengthExerciseLibrary.update(ex.id, {
      times_used: (ex.times_used || 1) + 1,
      last_used_at: moment().format("YYYY-MM-DD"),
    });
  }

  async function suggestStation() {
    setSuggesting(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Sos un preparador físico de fútbol profesional. Sugerí UNA estación de trabajo de fuerza para una sesión con estos datos:
- MD (día relativo al partido): ${session.match_day_code || "no especificado"}
- Propósito mecánico: ${session.strength_purpose || "no especificado"}
- Patrón vectorial: ${session.strength_vector_pattern || "no especificado"}
- Tipo de sesión de fuerza: ${session.strength_session_type || "no especificado"}

Elegí el método más adecuado de esta lista exacta: ${METHOD_OPTIONS.join(", ")}.
Elegí el tipo más adecuado de esta lista exacta: ${TYPE_OPTIONS.join(", ")}.
Proponé un ejercicio concreto y realista de fuerza para fútbol, y un volumen en formato libre (ej: 3x8, 3+3, 12+12).`,
        response_json_schema: {
          type: "object",
          properties: {
            method: { type: "string", enum: METHOD_OPTIONS },
            exercise_type: { type: "string", enum: TYPE_OPTIONS },
            exercise_name: { type: "string" },
            volume: { type: "string" },
          },
          required: ["method", "exercise_type", "exercise_name", "volume"],
        },
      });
      setForm(f => ({ ...f, ...result }));
      setEditId(null);
      setShowForm(true);
      toast({ title: "✓ Estación sugerida por IA" });
    } finally {
      setSuggesting(false);
    }
  }

  const filteredLib = libraryExercises.filter(e => {
    const q = libSearch.toLowerCase();
    return !q || (e.name || "").toLowerCase().includes(q) || (e.method || "").toLowerCase().includes(q);
  });

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
        <button onClick={suggestStation} disabled={suggesting}
          className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/15 border border-purple-500/30 text-purple-300 rounded-lg text-xs hover:bg-purple-500/25 transition-colors disabled:opacity-50">
          <Sparkles size={13} /> {suggesting ? "Pensando..." : "Sugerir estación"}
        </button>
      </div>

      {stations.length === 0 && !showForm && (
        <p className="text-zinc-600 text-sm text-center py-6">Sin estaciones de fuerza</p>
      )}

      {/* Stations list */}
      {stations.length > 0 && (
        <div className="space-y-2">
          {stations.map((st, i) => (
            <div key={st.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-start gap-3">
              <div className="flex flex-col items-center gap-0.5 shrink-0 pt-1">
                <button onClick={() => moveUp(i)} className="text-zinc-600 hover:text-zinc-300"><ChevronUp size={13} /></button>
                <span className="text-xs font-bold text-white w-5 text-center">{i + 1}</span>
                <button onClick={() => moveDown(i)} className="text-zinc-600 hover:text-zinc-300"><ChevronDown size={13} /></button>
              </div>

              {st.image_url
                ? <img src={st.image_url} alt="" className="w-16 h-16 object-cover rounded-lg shrink-0" />
                : <div className="w-16 h-16 bg-zinc-800 rounded-lg border border-zinc-700 flex items-center justify-center shrink-0"><Image size={16} className="text-zinc-600" /></div>
              }

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {st.method && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">{st.method}</span>}
                  {st.exercise_type && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">{st.exercise_type}</span>}
                  {st.volume && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">{st.volume}</span>}
                </div>
                <p className="text-sm font-semibold text-white truncate">{st.exercise_name || "—"}</p>
                {(st.indications || st.compensations || st.notes) && (
                  <div className="mt-1 space-y-0.5">
                    {st.indications && <p className="text-[11px] text-zinc-500">Indicaciones: {st.indications}</p>}
                    {st.compensations && <p className="text-[11px] text-zinc-500">Compensaciones: {st.compensations}</p>}
                    {st.notes && <p className="text-[11px] text-zinc-500">Obs: {st.notes}</p>}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(st)} className="p-1.5 text-zinc-600 hover:text-white transition-colors"><Edit2 size={13} /></button>
                <button onClick={() => duplicateStation(st)} className="p-1.5 text-zinc-600 hover:text-blue-400 transition-colors"><Copy size={13} /></button>
                <button onClick={() => removeStation(st.id)} className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
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
              <select value={form.method} onChange={e => setF("method", e.target.value)}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
                <option value="">Seleccionar...</option>
                {METHOD_OPTIONS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Tipo</label>
              <select value={form.exercise_type} onChange={e => setF("exercise_type", e.target.value)}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
                <option value="">Seleccionar...</option>
                {TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-zinc-400 mb-1 block">Ejercicio</label>
              <input value={form.exercise_name} onChange={e => setF("exercise_name", e.target.value)} placeholder="ej: Hip Thrust Asimétrico"
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Volumen</label>
              <input value={form.volume} onChange={e => setF("volume", e.target.value)} placeholder="ej: 3x8, 3+3, 12+12"
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Imagen</label>
              {form.image_url
                ? <div className="relative">
                    <img src={form.image_url} alt="" className="w-full h-9 object-cover rounded-lg border border-zinc-600" />
                    <button type="button" onClick={() => setF("image_url", "")}
                      className="absolute top-0.5 right-0.5 bg-zinc-900/80 text-zinc-300 hover:text-red-400 rounded-full p-0.5"><X size={10} /></button>
                  </div>
                : <label className={`flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-xs text-zinc-300 cursor-pointer hover:bg-zinc-600 transition-colors ${uploadingImg ? "opacity-60 pointer-events-none" : ""}`}>
                    <Image size={13} /> {uploadingImg ? "Subiendo..." : "Subir"}
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e.target.files[0])} />
                  </label>
              }
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-zinc-400 mb-1 block">Indicaciones (opcional)</label>
              <input value={form.indications} onChange={e => setF("indications", e.target.value)}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-zinc-400 mb-1 block">Compensaciones (opcional)</label>
              <input value={form.compensations} onChange={e => setF("compensations", e.target.value)}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-zinc-400 mb-1 block">Observaciones (opcional)</label>
              <textarea value={form.notes} onChange={e => setF("notes", e.target.value)} rows={2}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none resize-none" />
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
                    {ex.method && <p className="text-[10px] text-zinc-400">{ex.method} {ex.exercise_type ? `· ${ex.exercise_type}` : ""}</p>}
                    <p className="text-[10px] text-zinc-600">✓ {ex.times_used || 1} usos</p>
                  </div>
                  {ex.volume && <div className="text-[10px] text-amber-300 font-semibold shrink-0">{ex.volume}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}