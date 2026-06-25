import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronDown, ChevronUp, Upload, FileSpreadsheet, ExternalLink, X, Users, Maximize2, Clock, Target, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import "moment/locale/es";

moment.locale("es");

function parseCsvText(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((l) =>
    l.split(sep).map((v) => v.trim().replace(/^"|"$/g, ""))
  );
  return { headers, rows };
}

function CsvDataTable({ csvUrl }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!csvUrl) return;
    fetch(csvUrl)
      .then((r) => r.text())
      .then((text) => setData(parseCsvText(text)))
      .finally(() => setLoading(false));
  }, [csvUrl]);

  if (loading) return <div className="text-xs text-zinc-600 py-2">Cargando datos...</div>;
  if (!data || data.headers.length === 0) return <div className="text-xs text-zinc-600 py-2">No se pudieron leer los datos del CSV.</div>;

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800 mt-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-zinc-800/80">
            {data.headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left text-zinc-400 font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "bg-zinc-900" : "bg-zinc-800/30"}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-1.5 text-zinc-300 whitespace-nowrap">{cell || "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExerciseCard({ exercise, session, onDelete }) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [csvUrl, setCsvUrl] = useState(exercise.external_csv_url || null);
  const [csvLabel, setCsvLabel] = useState(exercise.external_csv_label || null);
  const fileRef = useRef();
  const { toast } = useToast();

  async function handleDelete(e) {
    e.stopPropagation();
    if (!confirm(`¿Eliminar el ejercicio "${exercise.name}"?`)) return;
    setDeleting(true);
    await base44.entities.FieldExercise.delete(exercise.id);
    toast({ title: "Ejercicio eliminado" });
    onDelete(exercise.id);
  }

  async function handleCsvUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.FieldExercise.update(exercise.id, {
        external_csv_url: file_url,
        external_csv_label: file.name,
      });
      setCsvUrl(file_url);
      setCsvLabel(file.name);
      toast({ title: "CSV cargado correctamente" });
    } catch {
      toast({ title: "Error al cargar el CSV", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function removeCsv() {
    await base44.entities.FieldExercise.update(exercise.id, {
      external_csv_url: null,
      external_csv_label: null,
    });
    setCsvUrl(null);
    setCsvLabel(null);
    toast({ title: "CSV eliminado" });
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 hover:bg-zinc-800/30 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">{exercise.name}</p>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-zinc-500">
            {session && (
              <span className="text-zinc-600">
                {session.title} · {moment(session.date).format("DD/MM/YY")}
              </span>
            )}
            {exercise.space && <span>📍 {exercise.space}</span>}
            {exercise.duration_minutes && <span>⏱ {exercise.duration_minutes} min</span>}
            {exercise.num_players && <span>👥 {exercise.num_players} jug.</span>}
            {(exercise.width_m || exercise.length_m) && (
              <span>📐 {exercise.width_m ?? "—"} × {exercise.length_m ?? "—"} m</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {csvUrl && (
            <span className="text-xs bg-green-900/40 text-green-400 border border-green-800/50 px-2 py-0.5 rounded-full">CSV</span>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-zinc-600 hover:text-red-400 transition-colors p-1 rounded"
          >
            <Trash2 size={14} />
          </button>
          {open ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
        </div>
      </button>

      {/* Expanded */}
      {open && (
        <div className="border-t border-zinc-800 p-4 space-y-4">

          {/* Imagen del ejercicio */}
          {exercise.image_url && (
            <img src={exercise.image_url} alt="Ejercicio" className="w-full max-h-64 object-cover rounded-lg border border-zinc-800" />
          )}

          {/* Detalles del ejercicio */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-zinc-800/60 rounded-lg p-3">
              <p className="text-zinc-500 text-xs flex items-center gap-1 mb-1"><Users size={11} /> Jugadores</p>
              <p className="text-white font-bold text-lg">{exercise.num_players ?? "—"}</p>
            </div>
            <div className="bg-zinc-800/60 rounded-lg p-3">
              <p className="text-zinc-500 text-xs flex items-center gap-1 mb-1"><Maximize2 size={11} /> Dimensiones</p>
              <p className="text-white font-bold text-sm">
                {exercise.width_m && exercise.length_m
                  ? `${exercise.width_m} × ${exercise.length_m} m`
                  : exercise.width_m ? `${exercise.width_m} m ancho`
                  : exercise.length_m ? `${exercise.length_m} m largo`
                  : "—"}
              </p>
            </div>
            <div className="bg-zinc-800/60 rounded-lg p-3">
              <p className="text-zinc-500 text-xs flex items-center gap-1 mb-1"><Clock size={11} /> Duración</p>
              <p className="text-white font-bold text-lg">{exercise.duration_minutes ? `${exercise.duration_minutes} min` : "—"}</p>
            </div>
            <div className="bg-zinc-800/60 rounded-lg p-3">
              <p className="text-zinc-500 text-xs flex items-center gap-1 mb-1">📍 Espacio</p>
              <p className="text-white text-sm font-medium truncate">{exercise.space || "—"}</p>
            </div>
          </div>

          {exercise.objective && (
            <div className="bg-zinc-800/40 rounded-lg p-3">
              <p className="text-zinc-500 text-xs flex items-center gap-1 mb-1"><Target size={11} /> Objetivo</p>
              <p className="text-zinc-300 text-sm">{exercise.objective}</p>
            </div>
          )}

          {exercise.description && (
            <div className="bg-zinc-800/40 rounded-lg p-3">
              <p className="text-zinc-500 text-xs mb-1">Descripción</p>
              <p className="text-zinc-300 text-sm">{exercise.description}</p>
            </div>
          )}

          {/* Interacción individual */}
          <ExercisePlayerLogs exerciseId={exercise.id} />

          {/* CSV Carga externa */}
          <div className="border-t border-zinc-800 pt-4">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Carga externa (CSV)</p>
            {csvUrl ? (
              <>
                <div className="flex items-center gap-3 bg-zinc-800/60 rounded-lg px-3 py-2.5">
                  <FileSpreadsheet size={16} className="text-green-400 shrink-0" />
                  <span className="text-zinc-300 text-xs flex-1 truncate">{csvLabel || "Archivo CSV"}</span>
                  <a href={csvUrl} target="_blank" rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-white transition-colors p-1">
                    <ExternalLink size={14} />
                  </a>
                  <button onClick={removeCsv} className="text-zinc-600 hover:text-red-400 transition-colors p-1">
                    <X size={14} />
                  </button>
                </div>
                <CsvDataTable csvUrl={csvUrl} />
              </>
            ) : (
              <label className="cursor-pointer">
                <div className={`flex items-center gap-2 border border-dashed border-zinc-700 rounded-lg px-4 py-3 text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                  {uploading ? (
                    <div className="w-3.5 h-3.5 border border-zinc-500 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Upload size={14} />
                  )}
                  {uploading ? "Subiendo..." : "Cargar CSV de carga externa del ejercicio"}
                </div>
                <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx" onChange={handleCsvUpload} className="hidden" disabled={uploading} />
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Muestra la interacción individual por jugador (solo lectura resumida)
function ExercisePlayerLogs({ exerciseId }) {
  const [logs, setLogs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    base44.entities.PlayerExerciseLog.filter({ exercise_id: exerciseId }, null, 100)
      .then(setLogs)
      .finally(() => setLoaded(true));
  }, [exerciseId]);

  if (!loaded) return <div className="text-xs text-zinc-600">Cargando interacción...</div>;
  if (logs.length === 0) return null;

  const participated = logs.filter((l) => l.participated);
  const notParticipated = logs.filter((l) => !l.participated);

  return (
    <div className="bg-zinc-800/40 rounded-lg p-3">
      <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2">
        Interacción individual — {participated.length} participaron
      </p>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {participated.map((log) => (
          <div key={log.player_id} className="flex items-center gap-2 text-xs">
            <span className="text-zinc-300 w-36 truncate">{log.player_name}</span>
            {log.performance && (
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                log.performance === "Muy bien" ? "bg-emerald-900/50 text-emerald-400"
                : log.performance === "Bien" ? "bg-blue-900/50 text-blue-400"
                : log.performance === "Regular" ? "bg-yellow-900/50 text-yellow-400"
                : "bg-red-900/50 text-red-400"
              }`}>{log.performance}</span>
            )}
            {log.notes && <span className="text-zinc-600 truncate flex-1">{log.notes}</span>}
          </div>
        ))}
        {notParticipated.length > 0 && (
          <p className="text-zinc-700 text-xs mt-1">No participaron: {notParticipated.map(l => l.player_name).join(", ")}</p>
        )}
      </div>
    </div>
  );
}

export default function ExercisesLibrary() {
  const [exercises, setExercises] = useState([]);
  const [sessions, setSessions] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterSession, setFilterSession] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const [exs, sess] = await Promise.all([
        base44.entities.FieldExercise.list("order", 500),
        base44.entities.TrainingSession.list("-date", 200),
      ]);
      const sessMap = {};
      sess.forEach((s) => { sessMap[s.id] = s; });
      setExercises(exs);
      setSessions(sessMap);
      setLoading(false);
    }
    load();
  }, []);

  const uniqueSessions = [...new Map(
    exercises.map((e) => [e.session_id, sessions[e.session_id]]).filter(([, s]) => s)
  ).entries()].map(([id, s]) => ({ id, title: s.title, date: s.date }))
    .sort((a, b) => b.date?.localeCompare(a.date));

  const filtered = exercises.filter((ex) => {
    const matchSession = filterSession === "all" || ex.session_id === filterSession;
    const matchSearch = !search || ex.name.toLowerCase().includes(search.toLowerCase());
    return matchSession && matchSearch;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Biblioteca de Ejercicios</h2>
        <p className="text-zinc-500 text-sm mt-0.5">Todos los ejercicios de las sesiones de campo</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar ejercicio..."
          className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:border-zinc-500 w-56"
        />
        <select
          value={filterSession}
          onChange={(e) => setFilterSession(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-3 py-1.5 outline-none focus:border-zinc-500"
        >
          <option value="all">Todas las sesiones</option>
          {uniqueSessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} ({moment(s.date).format("DD/MM/YY")})
            </option>
          ))}
        </select>
        <span className="text-xs text-zinc-600">{filtered.length} ejercicios</span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <FileSpreadsheet size={36} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">
            {exercises.length === 0 ? "No hay ejercicios registrados en ninguna sesión" : "Sin resultados para el filtro aplicado"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              session={sessions[ex.session_id]}
              onDelete={(id) => setExercises((prev) => prev.filter((e) => e.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}