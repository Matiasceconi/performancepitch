import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, FileSpreadsheet, FileText, ExternalLink, Check, X, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import CsvPreviewTable from "@/components/catapult/CsvPreviewTable";

// ── Required columns for validation ────────────────────────────────────────
const REQUIRED_COLS = [
  "Jugador", "Tot Dur", "Tot Dist (m)", "D 19,8-25,0 km/h (m)",
  "D +25,0 km/h (m)", "Sprint Effs", "Acc +3 m/s² Eff",
  "Dec +3 m/s² Eff", "Tot PL", "Max Vel (km/h)", "Max Vel (% Max)", "Metros x Min",
];

// ── CSV column name → entity field mapping ──────────────────────────────────
const COL_MAP = {
  "jugador": "player_name", "player": "player_name", "nombre": "player_name", "athlete": "player_name",
  "tot dur": "total_duration", "total duration": "total_duration", "duration": "total_duration",
  "tot dist (m)": "total_distance", "total distance": "total_distance", "tot dist": "total_distance",
  "d 19,8-25,0 km/h (m)": "distance_hsr", "d 19.8-25.0 km/h (m)": "distance_hsr", "hsr": "distance_hsr",
  "d +25,0 km/h (m)": "sprint_distance", "d +25.0 km/h (m)": "sprint_distance", "sprint dist": "sprint_distance",
  "sprint effs": "sprint_efforts", "sprint efforts": "sprint_efforts",
  "acc +3 m/s² eff": "accelerations", "acc +3 m/s2 eff": "accelerations", "accelerations": "accelerations",
  "dec +3 m/s² eff": "decelerations", "dec +3 m/s2 eff": "decelerations", "decelerations": "decelerations",
  "tot pl": "player_load", "player load": "player_load",
  "max vel (km/h)": "max_velocity", "max velocity": "max_velocity", "max speed": "max_velocity",
  "max vel (% max)": "max_velocity_percentage", "max velocity %": "max_velocity_percentage",
  "metros x min": "meters_per_minute", "m/min": "meters_per_minute", "meters per minute": "meters_per_minute",
};

function parseNum(val) {
  if (val == null || val === "" || val === "-") return null;
  const cleaned = String(val).replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseCSVFile(text) {
  const firstLine = text.split("\n")[0];
  const sep = firstLine.includes(";") ? ";" : ",";
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let headerIdx = -1;
  let headers = [];
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cols = lines[i].split(sep).map((c) => c.replace(/"/g, "").trim());
    const normalized = cols.map((c) => c.toLowerCase());
    if (normalized.some((c) => c.includes("jugador") || c.includes("player") || c.includes("athlete"))) {
      headerIdx = i;
      headers = cols;
      break;
    }
  }
  if (headerIdx === -1) return { error: "No se encontró la columna 'Jugador' o 'Player' en el archivo." };

  // Validate required columns
  const headersLower = headers.map((h) => h.toLowerCase().trim());
  const missing = REQUIRED_COLS.filter((req) => {
    const reqLow = req.toLowerCase();
    return !headersLower.some((h) => h === reqLow || COL_MAP[h] === COL_MAP[reqLow]);
  });

  const fieldMap = {};
  headers.forEach((h, idx) => {
    const field = COL_MAP[h.toLowerCase().trim()];
    if (field) fieldMap[idx] = field;
  });

  const rows = [];
  const rawPreview = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.replace(/"/g, "").trim());
    const obj = {};
    Object.entries(fieldMap).forEach(([colIdx, field]) => {
      const raw = cols[parseInt(colIdx)];
      obj[field] = field === "player_name" ? (raw || "") : parseNum(raw);
    });
    const name = obj.player_name || "";
    if (!name) continue;
    const lname = name.toLowerCase();
    if (lname === "total" || lname === "promedio" || lname === "average" || lname === "team") continue;
    rows.push(obj);
    if (rawPreview.length < 5) rawPreview.push(obj);
  }

  return { rows, headers, rawPreview, missing, sep };
}

const CHART_METRICS = [
  { key: "total_distance",  label: "Distancia (m)",    color: "#60a5fa" },
  { key: "sprint_distance", label: "+25 km/h (m)",     color: "#fbbf24" },
  { key: "distance_hsr",   label: "19.8-25 km/h (m)", color: "#34d399" },
  { key: "player_load",    label: "Player Load",       color: "#a78bfa" },
  { key: "max_velocity",   label: "Vel. Máx (km/h)",  color: "#f87171" },
  { key: "accelerations",  label: "Aceleraciones",     color: "#fb923c" },
];

// ── Session Row with inline CSV import ─────────────────────────────────────
function SessionRow({ session, sessionReports, onImportDone }) {
  const [expanded, setExpanded] = useState(false);
  const [csvState, setCsvState] = useState(null); // { rows, rawPreview, headers, missing, file_url, error }
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null); // { count } or { error }
  const fileRef = useRef();
  const { toast } = useToast();

  const hasData = sessionReports.length > 0;

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setCsvState(null);
    setImportResult(null);
    try {
      const text = await file.text();
      console.log("[Catapult] Archivo leído:", file.name, "Tamaño:", file.size);
      const parsed = parseCSVFile(text);
      console.log("[Catapult] Resultado del parseo:", parsed);

      if (parsed.error) {
        setCsvState({ error: parsed.error });
        return;
      }

      if (parsed.rows.length === 0) {
        setCsvState({ error: "No se encontraron jugadores válidos en el archivo." });
        return;
      }

      // Upload file for storage
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setCsvState({ ...parsed, file_url });
    } catch (err) {
      console.error("[Catapult] Error al leer archivo:", err);
      setCsvState({ error: "Error al procesar el archivo: " + err.message });
    } finally {
      setUploading(false);
    }
  }

  async function confirmImport() {
    if (!csvState?.rows) return;
    setImporting(true);
    try {
      const records = csvState.rows.map((r) => ({
        ...r,
        date: session.date,
        session_id: session.id,
        session_label: session.title,
        file_url: csvState.file_url,
      }));
      console.log("[Catapult] Importando", records.length, "registros para sesión:", session.title);
      await base44.entities.CatapultReport.bulkCreate(records);
      console.log("[Catapult] Importación exitosa:", records.length, "registros");
      setImportResult({ count: records.length });
      setCsvState(null);
      toast({ title: `✓ ${records.length} jugadores importados para "${session.title}"` });
      onImportDone();
    } catch (err) {
      console.error("[Catapult] Error al importar:", err);
      setImportResult({ error: err.message });
      toast({ title: "Error al importar", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Session header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-800/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm truncate">{session.title}</p>
            <p className="text-zinc-500 text-xs mt-0.5">
              {moment(session.date).format("DD/MM/YYYY")}
              {session.match_day_code && <span className="ml-2 text-yellow-500">{session.match_day_code}</span>}
              {session.session_type && <span className="ml-2 text-zinc-600">· {session.session_type}</span>}
            </p>
          </div>
          {hasData && (
            <span className="shrink-0 text-xs bg-green-900/40 text-green-400 border border-green-800/50 px-2 py-0.5 rounded-full">
              {sessionReports.length} jugadores
            </span>
          )}
          {importResult?.count && (
            <span className="shrink-0 text-xs bg-blue-900/40 text-blue-400 border border-blue-800/50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 size={10} /> {importResult.count} importados
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 ml-3">
          {/* CSV upload button */}
          <label onClick={(e) => e.stopPropagation()} className="cursor-pointer">
            <span
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                uploading ? "bg-zinc-700 text-zinc-400" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
              }`}
            >
              {uploading ? (
                <div className="w-3 h-3 border border-zinc-500 border-t-white rounded-full animate-spin" />
              ) : (
                <Upload size={12} />
              )}
              {uploading ? "Leyendo..." : hasData ? "Reimportar GPS" : "Cargar GPS"}
            </span>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" disabled={uploading} />
          </label>
          {expanded ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-zinc-800">
          {/* CSV parse error */}
          {csvState?.error && (
            <div className="mx-4 my-3 flex items-start gap-2 bg-red-900/20 border border-red-800/40 rounded-lg p-3">
              <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-red-300 text-xs font-medium">Error al leer el archivo</p>
                <p className="text-red-400/80 text-xs mt-0.5">{csvState.error}</p>
              </div>
            </div>
          )}

          {/* Preview panel */}
          {csvState && !csvState.error && (
            <div className="p-4 space-y-3">
              {/* Header info */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-yellow-300 font-semibold text-sm">Vista previa — {csvState.rows.length} jugadores detectados</p>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    Separador detectado: <code className="text-zinc-400 bg-zinc-800 px-1 rounded">{csvState.sep === ";" ? "punto y coma (;)" : "coma (,)"}</code>
                    &nbsp;·&nbsp; Columnas: {csvState.headers.length}
                  </p>
                  {csvState.missing?.length > 0 && (
                    <p className="text-orange-400 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={11} /> Columnas no encontradas: {csvState.missing.join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setCsvState(null)} className="border-zinc-600 text-zinc-300 hover:bg-zinc-800">
                    <X size={13} className="mr-1" /> Cancelar
                  </Button>
                  <Button size="sm" onClick={confirmImport} disabled={importing} className="bg-green-600 hover:bg-green-700 text-white">
                    {importing ? (
                      <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin mr-1.5" />
                    ) : (
                      <Check size={13} className="mr-1" />
                    )}
                    Confirmar importación
                  </Button>
                </div>
              </div>

              {/* Preview table (first 5 rows) */}
              <div>
                <p className="text-zinc-500 text-xs mb-2">Primeras {csvState.rawPreview.length} filas:</p>
                <CsvPreviewTable rows={csvState.rawPreview} />
              </div>
            </div>
          )}

          {/* Existing GPS data */}
          {!csvState && sessionReports.length > 0 && (
            <div className="p-4">
              <p className="text-zinc-500 text-xs mb-3">Datos GPS cargados — {sessionReports.length} jugadores</p>
              <CsvPreviewTable rows={sessionReports} />
            </div>
          )}

          {/* No data and no preview */}
          {!csvState && sessionReports.length === 0 && (
            <div className="p-6 text-center">
              <FileSpreadsheet size={28} className="text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-600 text-xs">Sin datos GPS para esta sesión. Cargá el CSV de Catapult.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function Catapult() {
  const [sessions, setSessions] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("sessions");
  const [selectedMetric, setSelectedMetric] = useState("total_distance");
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [s, r] = await Promise.all([
        base44.entities.TrainingSession.list("-date", 100),
        base44.entities.CatapultReport.list("-date", 500),
      ]);
      setSessions(s);
      setReports(r);
    } finally {
      setLoading(false);
    }
  }

  async function handlePDFUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (latestDate) {
        const toUpdate = reports.filter((r) => r.date === latestDate);
        await Promise.all(toUpdate.map((r) => base44.entities.CatapultReport.update(r.id, { pdf_url: file_url })));
        toast({ title: "PDF cargado correctamente" });
        loadAll();
      }
    } catch {
      toast({ title: "Error al subir PDF", variant: "destructive" });
    } finally {
      setUploadingPdf(false);
      e.target.value = "";
    }
  }

  const latestDate = reports.length > 0 ? reports.reduce((a, b) => (a.date > b.date ? a : b)).date : null;
  const latestReports = latestDate ? reports.filter((r) => r.date === latestDate) : [];

  const currentMetric = CHART_METRICS.find((m) => m.key === selectedMetric);
  const chartData = latestReports
    .filter((r) => r[selectedMetric] != null)
    .sort((a, b) => (b[selectedMetric] || 0) - (a[selectedMetric] || 0))
    .map((r) => ({ name: r.player_name?.split(" ").slice(-1)[0] || "—", value: r[selectedMetric] || 0 }));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Catapult GPS</h1>
        <p className="text-zinc-500 text-sm mt-1">Importá el CSV de OpenField por sesión de entrenamiento</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
        {[
          { key: "sessions", label: "Sesiones" },
          { key: "data",     label: "Datos GPS" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.key ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: SESSIONS ─────────────────────────────────────────────── */}
      {activeTab === "sessions" && (
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
              <FileSpreadsheet size={40} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">No hay sesiones de campo registradas</p>
              <p className="text-zinc-600 text-xs mt-1">Creá sesiones en el módulo de Campo para cargar GPS aquí</p>
            </div>
          ) : (
            sessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                sessionReports={reports.filter((r) => r.session_id === s.id)}
                onImportDone={loadAll}
              />
            ))
          )}
        </div>
      )}

      {/* ── TAB: GPS DATA ──────────────────────────────────────────────── */}
      {activeTab === "data" && (
        <>
          {reports.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
              <FileSpreadsheet size={40} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">No hay datos GPS cargados</p>
              <p className="text-zinc-600 text-xs mt-1">Importá el CSV desde la solapa Sesiones</p>
            </div>
          ) : (
            <>
              <div className="flex gap-2 flex-wrap">
                {CHART_METRICS.map((m) => (
                  <button key={m.key} onClick={() => setSelectedMetric(m.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedMetric === m.key ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}>
                    {m.label}
                  </button>
                ))}
              </div>

              {chartData.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">{currentMetric?.label}</h3>
                    <span className="text-xs text-zinc-500">{moment(latestDate).format("DD/MM/YYYY")}</span>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" tick={{ fill: "#a1a1aa", fontSize: 11 }} width={90} />
                      <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, color: "#fff", fontSize: 12 }} />
                      <Bar dataKey="value" fill={currentMetric?.color || "#60a5fa"} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Datos individuales — última sesión</h3>
                    <span className="text-xs text-zinc-500">{moment(latestDate).format("DD [de] MMMM YYYY")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {latestReports[0]?.pdf_url && (
                      <a href={latestReports[0].pdf_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors">
                        <ExternalLink size={12} /> Ver PDF
                      </a>
                    )}
                    <label className="cursor-pointer">
                      <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${uploadingPdf ? "bg-zinc-800 text-zinc-500" : "bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700"}`}>
                        {uploadingPdf ? <div className="w-3 h-3 border border-zinc-500 border-t-white rounded-full animate-spin" /> : <FileText size={12} />}
                        {uploadingPdf ? "Subiendo..." : latestReports[0]?.pdf_url ? "Reemplazar PDF" : "Subir PDF"}
                      </span>
                      <input type="file" accept=".pdf" onChange={handlePDFUpload} className="hidden" disabled={uploadingPdf} />
                    </label>
                  </div>
                </div>
                <div className="p-4">
                  <CsvPreviewTable rows={latestReports} />
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-zinc-500 px-1">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-900/70 inline-block" /> Alto rendimiento</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-900/70 inline-block" /> Rendimiento medio</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-900/70 inline-block" /> Bajo rendimiento</span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}