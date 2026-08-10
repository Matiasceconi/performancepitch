import React, { useState, useRef } from "react";
import { Upload, FileCheck2, AlertCircle, CheckCircle2, Loader2, X, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";

const TEST_TYPES = [
  { key: "CMJ", label: "Countermovement Jump" },
  { key: "SJ", label: "Squat Jump" },
  { key: "CMRJ", label: "Countermovement Rebound Jump" },
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

export default function ValdImportWizard({ onClose, onImported }) {
  const [step, setStep] = useState(1); // 1=upload, 2=preview, 3=done
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [files, setFiles] = useState({}); // { CMJ: {file, url}, SJ: ..., CMRJ: ... }
  const [uploading, setUploading] = useState(false);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  function handleFileSelect(testType, file) {
    setFiles((prev) => ({ ...prev, [testType]: { file } }));
  }

  function removeFile(testType) {
    setFiles((prev) => {
      const next = { ...prev };
      delete next[testType];
      return next;
    });
  }

  async function handleDryRun() {
    setError("");
    setUploading(true);
    try {
      // Upload all files first
      const fileEntries = [];
      for (const [testType, { file }] of Object.entries(files)) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        fileEntries.push({ url: file_url, test_type: testType, file_name: file.name });
      }

      // Call dry_run
      setDryRunLoading(true);
      const resp = await base44.functions.invoke("importValdCsv", {
        action: "dry_run",
        assessment_date: assessmentDate,
        files: fileEntries,
      });
      setPreview(resp.data);
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
      const fileEntries = preview.files.map((f) => ({
        url: f.file_url,
        test_type: f.test_type,
        file_name: f.file_name,
      }));
      const resp = await base44.functions.invoke("importValdCsv", {
        action: "confirm",
        assessment_date: assessmentDate,
        files: fileEntries,
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

  const selectedCount = Object.keys(files).length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Upload size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Importar CSV de ForceDecks</h2>
              <p className="text-xs text-zinc-500">Paso {step} de 3 — {step === 1 ? "Carga de archivos" : step === 2 ? "Vista previa y vinculación" : "Importación completada"}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Step 1: Upload */}
          {step === 1 && (
            <>
              <div>
                <label className="text-sm font-medium text-zinc-300 block mb-1.5">Fecha de la batería</label>
                <input
                  type="date"
                  value={assessmentDate}
                  onChange={(e) => setAssessmentDate(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm w-full sm:w-auto"
                />
              </div>

              <div className="space-y-3">
                {TEST_TYPES.map(({ key, label }) => (
                  <FileSlot
                    key={key}
                    testType={key}
                    label={label}
                    file={files[key]?.file}
                    onSelect={(f) => handleFileSelect(key, f)}
                    onRemove={() => removeFile(key)}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-zinc-500">
                  {selectedCount} archivo(s) seleccionado(s) · Se procesarán {selectedCount * 15 || 0} resultados aprox.
                </p>
                <button
                  onClick={handleDryRun}
                  disabled={selectedCount === 0 || uploading || dryRunLoading}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {(uploading || dryRunLoading) ? <Loader2 size={16} className="animate-spin" /> : <FileCheck2 size={16} />}
                  {uploading ? "Subiendo archivos..." : dryRunLoading ? "Analizando..." : "Vista previa"}
                </button>
              </div>
            </>
          )}

          {/* Step 2: Preview */}
          {step === 2 && preview && (
            <>
              {/* File hashes */}
              <div>
                <h3 className="text-sm font-bold text-zinc-300 mb-2">Archivos procesados</h3>
                <div className="space-y-2">
                  {preview.files.map((f, i) => (
                    <div key={i} className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileCheck2 size={16} className="text-emerald-400 shrink-0" />
                          <span className="text-sm text-white font-medium truncate">{f.file_name}</span>
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 text-xs font-semibold shrink-0">{f.test_type}</span>
                        </div>
                        <span className="text-xs text-zinc-500 shrink-0">{f.row_count} filas · {f.size_bytes} bytes</span>
                      </div>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                        <div className="text-zinc-500">SHA-256 raw: <span className="text-zinc-400 font-mono break-all">{f.raw_file_sha256}</span></div>
                        <div className="text-zinc-500">BOM: <span className="text-zinc-400">{f.has_bom ? "Sí" : "No"}</span> · Saltos: <span className="text-zinc-400">{f.line_ending}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatBox label="Resultados" value={preview.total_results} color="blue" />
                <StatBox label="Jugadores" value={preview.total_players} color="emerald" />
                <StatBox label="Vinculados" value={preview.linked_players} color="emerald" />
                <StatBox label="Pendientes" value={preview.pending_players} color="red" />
              </div>

              {(preview.duplicate_results > 0 || preview.retest_results > 0) && (
                <div className="flex gap-3 text-xs">
                  <span className="text-zinc-500">Duplicados: <span className="text-yellow-400 font-semibold">{preview.duplicate_results}</span></span>
                  <span className="text-zinc-500">Retests: <span className="text-yellow-400 font-semibold">{preview.retest_results}</span></span>
                </div>
              )}

              {/* Linking table */}
              <div>
                <h3 className="text-sm font-bold text-zinc-300 mb-2">Vinculación de jugadores ({preview.linking_preview.length})</h3>
                <div className="border border-zinc-800 rounded-lg overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
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
                          <tr key={i} className="border-t border-zinc-800/60 hover:bg-zinc-800/30">
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
              </div>

              <div className="flex items-center justify-between pt-2">
                <button onClick={() => setStep(1)} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors">
                  Volver
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {confirming ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {confirming ? "Importando..." : "Confirmar importación"}
                </button>
              </div>
            </>
          )}

          {/* Step 3: Done */}
          {step === 3 && result && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Importación completada</h3>
                <p className="text-sm text-zinc-400 mt-1">Batería del {assessmentDate} guardada correctamente</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-md mx-auto">
                <StatBox label="Resultados" value={result.imported_results} color="blue" />
                <StatBox label="Vinculados" value={result.linked_players} color="emerald" />
                <StatBox label="Pendientes" value={result.pending_players} color="red" />
                <StatBox label="Duplicados" value={result.duplicate_results} color="yellow" />
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-colors"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FileSlot({ testType, label, file, onSelect, onRemove }) {
  const inputRef = useRef(null);
  return (
    <div className="border border-zinc-800 rounded-lg p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 text-xs font-bold shrink-0">{testType}</span>
          <span className="text-sm text-zinc-400 truncate">{label}</span>
        </div>
        {file ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-emerald-400 font-medium truncate max-w-[150px]">{file.name}</span>
            <button onClick={onRemove} className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors">
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700 transition-colors shrink-0 flex items-center gap-1.5"
          >
            <Upload size={14} /> Seleccionar
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => e.target.files[0] && onSelect(e.target.files[0])}
      />
    </div>
  );
}

function StatBox({ label, value, color }) {
  const colors = {
    blue: "text-blue-400",
    emerald: "text-emerald-400",
    red: "text-red-400",
    yellow: "text-yellow-400",
  };
  return (
    <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-3 text-center">
      <p className={`text-2xl font-bold ${colors[color] || "text-white"}`}>{value}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
    </div>
  );
}