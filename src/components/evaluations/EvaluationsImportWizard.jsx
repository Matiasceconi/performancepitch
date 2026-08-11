import React, { useState, useRef, useCallback } from "react";
import { Upload, FileCheck2, AlertCircle, CheckCircle2, Loader2, X, ArrowRight, Info, Calendar } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useWorkspace } from "@/lib/WorkspaceContext";

const CONTEXTS = [
  "Pretemporada", "MD+2", "MD-4", "Control semanal", "Retorno al juego", "Evaluación inicial", "Cierre de bloque", "",
];

function StatusBadge({ status }) {
  const config = {
    exact_match: { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", label: "Vinculado" },
    possible_match: { cls: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30", label: "Posible" },
    collision: { cls: "bg-orange-500/15 text-orange-300 border-orange-500/30", label: "Colisión" },
    no_match: { cls: "bg-red-500/15 text-red-300 border-red-500/30", label: "Pendiente" },
  };
  const c = config[status] || config.no_match;
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${c.cls}`}>{c.label}</span>;
}

export default function EvaluationsImportWizard({ onClose, onImported, embedded }) {
  const { activeSquad } = useWorkspace();
  const [step, setStep] = useState(1);
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [context, setContext] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [playerOverrides, setPlayerOverrides] = useState({});
  const [appendToExisting, setAppendToExisting] = useState(true);
  const inputRef = useRef(null);

  const handleFiles = useCallback((fileList) => {
    const newFiles = [...fileList].filter((f) => f.name.endsWith(".csv") || f.type === "text/csv");
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  function removeFile(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleDryRun() {
    setError("");
    setUploading(true);
    try {
      const fileEntries = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        fileEntries.push({ url: file_url, test_type: "", file_name: file.name });
      }
      setDryRunLoading(true);
      const resp = await base44.functions.invoke("importEvaluationCsv", {
        action: "dry_run",
        assessment_date: assessmentDate,
        context,
        session_name: sessionName,
        squad_id: activeSquad?.id,
        files: fileEntries,
      });
      setPreview(resp.data);
      // Auto-fill session name if empty
      if (!sessionName && resp.data?.auto_session_name) {
        setSessionName(resp.data.auto_session_name);
      }
      setStep(2);
    } catch (e) {
      setError(e.message || "Error al procesar los archivos");
    } finally {
      setUploading(false);
      setDryRunLoading(false);
    }
  }

  async function handleConfirm() {
    setError("");
    setConfirming(true);
    try {
      const fileEntries = preview.files.map((f) => ({ url: f.file_url, test_type: f.test_type, file_name: f.file_name }));
      const resp = await base44.functions.invoke("importEvaluationCsv", {
        action: "confirm",
        assessment_date: assessmentDate,
        context,
        session_name: sessionName,
        squad_id: activeSquad?.id,
        files: fileEntries,
        player_overrides: playerOverrides,
        append_to_existing: appendToExisting,
      });
      setResult(resp.data);
      setStep(3);
      if (onImported) onImported();
    } catch (e) {
      setError(e.message || "Error al confirmar la importación");
    } finally {
      setConfirming(false);
    }
  }

  const content = (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {step === 1 && (
        <>
          {/* Drag-drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragOver ? "border-blue-500 bg-blue-500/5" : "border-zinc-700 hover:border-zinc-600"}`}
          >
            <Upload size={28} className="text-zinc-500 mx-auto mb-2" />
            <p className="text-sm text-zinc-300 font-medium">Arrastrá archivos CSV aquí o hacé clic para seleccionar</p>
            <p className="text-xs text-zinc-600 mt-1">ForceDecks · NordBord · ISO — múltiples archivos permitidos</p>
            <input ref={inputRef} type="file" accept=".csv" multiple className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-zinc-950/50 border border-zinc-800 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCheck2 size={16} className="text-emerald-400 shrink-0" />
                    <span className="text-sm text-white font-medium truncate">{f.name}</span>
                    <span className="text-xs text-zinc-500 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                  </div>
                  <button onClick={() => removeFile(i)} className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}

          {/* Session config */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Fecha de la batería</label>
              <input type="date" value={assessmentDate} onChange={(e) => setAssessmentDate(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Contexto</label>
              <select value={context} onChange={(e) => setContext(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white text-sm">
                {CONTEXTS.map((c) => <option key={c} value={c}>{c || "Sin contexto"}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Nombre de sesión</label>
              <input value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="Auto: DD/MM/AAAA · PRUEBAS" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white text-sm" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-zinc-500">{files.length} archivo(s) seleccionados</p>
            <button onClick={handleDryRun} disabled={files.length === 0 || uploading || dryRunLoading} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 flex items-center gap-2 disabled:opacity-50">
              {(uploading || dryRunLoading) ? <Loader2 size={16} className="animate-spin" /> : <FileCheck2 size={16} />}
              {uploading ? "Subiendo..." : dryRunLoading ? "Analizando..." : "Vista previa"}
            </button>
          </div>
        </>
      )}

      {step === 2 && preview && (
        <>
          {/* Existing session warning */}
          {preview.existing_session && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-300 font-medium">Ya existe una sesión para esta fecha</p>
                <p className="text-xs text-zinc-400 mt-0.5">"{preview.existing_session.name}" · {preview.existing_session.total_results} resultados · {preview.existing_session.test_keys?.join(", ")}</p>
                <label className="flex items-center gap-2 mt-2 text-xs text-zinc-300">
                  <input type="checkbox" checked={appendToExisting} onChange={(e) => setAppendToExisting(e.target.checked)} className="accent-blue-500" />
                  Agregar resultados a la sesión existente
                </label>
              </div>
            </div>
          )}

          {/* Auto-detected info */}
          {(preview.detected_date || preview.detected_time) && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
              <Calendar size={16} className="text-zinc-400" />
              <p className="text-xs text-zinc-300">
                Detectado del CSV: {preview.detected_date ? `fecha ${preview.detected_date}` : ""} {preview.detected_time ? `· hora ${preview.detected_time}` : ""}
              </p>
            </div>
          )}

          {/* Files processed */}
          <div>
            <h3 className="text-sm font-bold text-zinc-300 mb-2">Archivos procesados ({preview.files.length})</h3>
            <div className="space-y-2">
              {preview.files.map((f, i) => (
                <div key={i} className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCheck2 size={16} className="text-emerald-400 shrink-0" />
                      <span className="text-sm text-white font-medium truncate">{f.file_name}</span>
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 text-xs font-bold shrink-0 uppercase">{f.test_key}</span>
                    </div>
                    <span className="text-xs text-zinc-500 shrink-0">{f.row_count} filas</span>
                  </div>
                  <div className="mt-1.5 text-xs text-zinc-500">BOM: {f.has_bom ? "Sí" : "No"} · {f.line_ending} · {f.size_bytes} bytes</div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <StatBox label="Nuevos" value={preview.new_results} color="emerald" />
            <StatBox label="Duplicados" value={preview.duplicate_results} color="yellow" />
            <StatBox label="Jugadores" value={preview.total_players} color="blue" />
            <StatBox label="Vinculados" value={preview.linked_players} color="emerald" />
            <StatBox label="Pendientes" value={preview.pending_players} color="red" />
          </div>

          {/* Linking preview */}
          <div>
            <h3 className="text-sm font-bold text-zinc-300 mb-2">Vinculación de jugadores ({preview.linking_preview.length})</h3>
            <div className="border border-zinc-800 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-zinc-800 sticky top-0">
                  <tr>
                    <th className="text-left p-2 text-zinc-400 font-semibold">Nombre CSV</th>
                    <th className="text-left p-2 text-zinc-400 font-semibold hidden sm:table-cell">Jugador interno</th>
                    <th className="text-left p-2 text-zinc-400 font-semibold">Método</th>
                    <th className="text-left p-2 text-zinc-400 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.linking_preview.map((l, i) => (
                    <tr key={i} className="border-t border-zinc-800/60">
                      <td className="p-2 text-white">{l.csv_name}</td>
                      <td className="p-2 text-zinc-300 hidden sm:table-cell">{l.proposed_player_name || "—"}</td>
                      <td className="p-2 text-zinc-500">{l.method}</td>
                      <td className="p-2"><StatusBadge status={l.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button onClick={() => setStep(1)} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700">Volver</button>
            <button onClick={handleConfirm} disabled={confirming} className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 flex items-center gap-2 disabled:opacity-50">
              {confirming ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {confirming ? "Importando..." : "Confirmar importación"}
            </button>
          </div>
        </>
      )}

      {step === 3 && result && (
        <div className="text-center py-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Importación completada</h3>
            <p className="text-sm text-zinc-400 mt-1">
              {result.appended_to_existing ? "Resultados agregados a la sesión existente" : `Batería del ${assessmentDate} guardada correctamente`}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-md mx-auto">
            <StatBox label="Importados" value={result.imported_results} color="blue" />
            <StatBox label="Duplicados" value={result.duplicate_results} color="yellow" />
            <StatBox label="Vinculados" value={result.linked_players} color="emerald" />
            <StatBox label="Pendientes" value={result.pending_players} color="red" />
          </div>
          {onClose && <button onClick={onClose} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500">Cerrar</button>}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">{content}</div>;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center"><Upload size={20} className="text-blue-400" /></div>
            <div>
              <h2 className="text-lg font-bold text-white">Importar CSV de evaluaciones</h2>
              <p className="text-xs text-zinc-500">Paso {step} de 3 · {activeSquad?.name || "Sin plantel"}</p>
            </div>
          </div>
          {onClose && <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"><X size={20} /></button>}
        </div>
        <div className="p-5">{content}</div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  const colors = { blue: "text-blue-400", emerald: "text-emerald-400", red: "text-red-400", yellow: "text-yellow-400" };
  return (
    <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-3 text-center">
      <p className={`text-2xl font-bold ${colors[color] || "text-white"}`}>{value}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
    </div>
  );
}