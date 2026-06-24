import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, FileSpreadsheet, FileText, ExternalLink, Check, X, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from "recharts";
import CsvPreviewTable from "@/components/catapult/CsvPreviewTable";
import PlayerEvolution from "@/components/catapult/PlayerEvolution";
import SessionComparison from "@/components/catapult/SessionComparison";

// ── Fuzzy column matcher: maps any header string to an entity field ──────────
function matchColumn(raw) {
  const h = raw.toLowerCase().replace(/^\uFEFF/, "").trim();
  if (h === "name" || h === "jugador" || h === "player" || h === "nombre" || h === "athlete") return "player_name";
  if (h === "total duration" || h === "tot dur") return "total_duration";
  if (h.includes("total distance") || h === "tot dist (m)" || h === "tot dist") return "total_distance";
  // HSR: contains "19" — covers "D 19,8-25,0 km/h (m)" and "D 19.8-25.0 km/h (m)"
  if (h.startsWith("d") && h.includes("19")) return "distance_hsr";
  // Sprint distance: "D+" or "D +" followed by 25
  if ((h.startsWith("d+") || h.startsWith("d +")) && h.includes("25")) return "sprint_distance";
  if (h === "sprint efforts" || h === "sprint effs") return "sprint_efforts";
  if (h.includes("acc") && (h.includes("3mt") || h.includes("3 m"))) return "accelerations";
  if (h.includes("dec") && (h.includes("3mt") || h.includes("3 m"))) return "decelerations";
  if (h === "total player load" || h === "tot pl" || h === "player load") return "player_load";
  if (h.includes("maximum velocity") || h === "max vel (km/h)" || h === "max velocity (km/h)") return "max_velocity";
  if (h.includes("max vel") && h.includes("%")) return "max_velocity_percentage";
  if (h === "metros x min" || h === "m/min" || h === "meters per minute") return "meters_per_minute";
  return null;
}

function parseNum(val) {
  if (val == null || val === "" || val === "-") return null;
  // Handle both comma and dot as decimal separator
  const str = String(val).trim();
  // If it has a comma (e.g. "4.010,55" or "81,81"), normalize
  const hasCommaDecimal = /^\d+,\d+$/.test(str) || /^\d{1,3}(\.\d{3})*,\d+$/.test(str);
  const cleaned = hasCommaDecimal
    ? str.replace(/\./g, "").replace(",", ".")
    : str.replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// Parse "HH:MM:SS" or "MM:SS" duration to minutes
function parseDuration(val) {
  if (!val) return null;
  const parts = String(val).trim().split(":").map(Number);
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  return parseNum(val);
}

// Split a CSV line respecting quoted fields
function splitCSVLine(line, sep) {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === sep && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseCSVFile(text) {
  // Strip BOM
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);

  // Try semicolon first; if first line has more fields with ";" use it, else ","
  const firstSemi = lines[0].split(";").length;
  const firstComma = lines[0].split(",").length;
  const sep = firstSemi > firstComma ? ";" : ",";

  // Find header row: first col matches "name"/"jugador" OR ≥3 cols map to known fields
  let headerIdx = -1;
  let headers = [];
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cols = splitCSVLine(lines[i], sep);
    const firstLow = cols[0]?.replace(/^\uFEFF/, "").toLowerCase().trim();
    const mapped = cols.filter((c) => matchColumn(c) !== null).length;
    if (firstLow === "name" || firstLow === "jugador" || firstLow === "athlete" || mapped >= 3) {
      headerIdx = i;
      headers = cols.map((c, idx) => idx === 0 ? c.replace(/^\uFEFF/, "") : c);
      break;
    }
  }

  if (headerIdx === -1) {
    return { error: `No se encontró fila de encabezados. Primeras líneas del archivo: ${lines.slice(0, 2).join(" | ")}` };
  }

  console.log("[Catapult] Headers:", headers, "| Sep:", sep);

  // Build fieldMap: colIndex → entity field
  const fieldMap = {};
  headers.forEach((h, idx) => {
    const field = matchColumn(h);
    if (field) fieldMap[idx] = field;
    else if (idx === 0) fieldMap[idx] = "player_name";
  });

  const mappedFields = Object.values(fieldMap);
  const EXPECTED = ["player_name", "total_distance", "distance_hsr", "sprint_distance", "player_load", "max_velocity"];
  const missing = EXPECTED.filter((f) => !mappedFields.includes(f));

  const rows = [];
  const rawPreview = [];
  const totalLines = lines.length - headerIdx - 1;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i], sep);
    const obj = {};
    Object.entries(fieldMap).forEach(([colIdx, field]) => {
      const raw = cols[parseInt(colIdx)];
      if (field === "player_name") obj[field] = raw || "";
      else if (field === "total_duration") obj[field] = parseDuration(raw);
      else obj[field] = parseNum(raw);
    });

    const name = (obj.player_name || "").trim();
    if (!name) continue;
    if (["total", "promedio", "average", "team", "totals"].includes(name.toLowerCase())) continue;

    rows.push(obj);
    if (rawPreview.length < 5) rawPreview.push(obj);
  }

  console.log("[Catapult] Jugadores válidos:", rows.length, "/ Filas:", totalLines);

  return { rows, headers, rawPreview, missing, sep, totalLines };
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
      // Delete previous records for this session before importing
      await base44.entities.CatapultReport.deleteMany({ session_id: session.id });

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
                    Separador: <code className="text-zinc-400 bg-zinc-800 px-1 rounded">{csvState.sep === ";" ? ";" : ","}</code>
                    &nbsp;·&nbsp; Filas leídas: <span className="text-zinc-400">{csvState.totalLines}</span>
                    &nbsp;·&nbsp; Jugadores válidos: <span className="text-green-400">{csvState.rows.length}</span>
                  </p>
                  <p className="text-zinc-600 text-xs mt-1">
                    Columnas detectadas: {csvState.headers.join(", ")}
                  </p>
                  {csvState.missing?.length > 0 && (
                    <p className="text-orange-400 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={11} /> Columnas no mapeadas: {csvState.missing.join(", ")}
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
  const [selectedPlayer, setSelectedPlayer] = useState("all");
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
  const allPlayers = [...new Set(latestReports.map((r) => r.player_name).filter(Boolean))].sort();
  const filteredReports = selectedPlayer === "all" ? latestReports : latestReports.filter((r) => r.player_name === selectedPlayer);

  const currentMetric = CHART_METRICS.find((m) => m.key === selectedMetric);
  const chartData = filteredReports
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
          { key: "sessions",   label: "Sesiones" },
          { key: "data",       label: "Datos GPS" },
          { key: "evolution",   label: "Evolución" },
          { key: "comparison",  label: "Comparar" },
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

      {/* ── TAB: EVOLUTION ────────────────────────────────────────────── */}
      {activeTab === "evolution" && (
        <PlayerEvolution reports={reports} />
      )}

      {/* ── TAB: COMPARISON ───────────────────────────────────────────── */}
      {activeTab === "comparison" && (
        <SessionComparison reports={reports} sessions={sessions} />
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
              <div className="flex gap-2 flex-wrap items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  {CHART_METRICS.map((m) => (
                    <button key={m.key} onClick={() => setSelectedMetric(m.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedMetric === m.key ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
                <select
                  value={selectedPlayer}
                  onChange={(e) => setSelectedPlayer(e.target.value)}
                  className="bg-zinc-800 text-zinc-300 text-xs rounded-lg px-3 py-1.5 border border-zinc-700 focus:outline-none focus:border-zinc-500"
                >
                  <option value="all">Todos los jugadores</option>
                  {allPlayers.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
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
                      <Bar dataKey="value" fill={currentMetric?.color || "#60a5fa"} radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="value" position="right" style={{ fill: "#e4e4e7", fontSize: 11, fontWeight: 600 }} formatter={(v) => {
                          const isWhole = ["total_distance","distance_hsr","sprint_distance","sprint_efforts","accelerations","decelerations"].includes(selectedMetric);
                          return isWhole ? Math.round(v) : Number(v).toFixed(1);
                        }} />
                      </Bar>
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
                  <CsvPreviewTable rows={filteredReports} />
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