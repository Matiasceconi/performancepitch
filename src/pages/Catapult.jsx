import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, FileSpreadsheet, FileText, ExternalLink, Check, X, Zap, Gauge, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import CsvPreviewTable from "@/components/catapult/CsvPreviewTable";

// ── CSV column name → entity field mapping ──────────────────────────────────
const COL_MAP = {
  // Player name variations
  "jugador": "player_name",
  "player": "player_name",
  "nombre": "player_name",
  "athlete": "player_name",
  // Duration
  "tot dur": "total_duration",
  "total duration": "total_duration",
  "duration": "total_duration",
  // Total distance
  "tot dist (m)": "total_distance",
  "total distance": "total_distance",
  "distancia total": "total_distance",
  "tot dist": "total_distance",
  // HSR
  "d 19,8-25,0 km/h (m)": "distance_hsr",
  "d 19.8-25.0 km/h (m)": "distance_hsr",
  "hsr distance": "distance_hsr",
  "hsr": "distance_hsr",
  // Sprint distance
  "d +25,0 km/h (m)": "sprint_distance",
  "d +25.0 km/h (m)": "sprint_distance",
  "sprint distance": "sprint_distance",
  "sprint dist": "sprint_distance",
  // Sprint efforts
  "sprint effs": "sprint_efforts",
  "sprint efforts": "sprint_efforts",
  // Accelerations
  "acc +3 m/s² eff": "accelerations",
  "acc +3 m/s2 eff": "accelerations",
  "accelerations": "accelerations",
  "aceleraciones": "accelerations",
  // Decelerations
  "dec +3 m/s² eff": "decelerations",
  "dec +3 m/s2 eff": "decelerations",
  "decelerations": "decelerations",
  "desaceleraciones": "decelerations",
  // Player load
  "tot pl": "player_load",
  "player load": "player_load",
  "total player load": "player_load",
  // Max velocity
  "max vel (km/h)": "max_velocity",
  "max velocity": "max_velocity",
  "max speed": "max_velocity",
  "velocidad maxima": "max_velocity",
  // Max velocity %
  "max vel (% max)": "max_velocity_percentage",
  "max velocity %": "max_velocity_percentage",
  "% max vel": "max_velocity_percentage",
  // Meters per minute
  "metros x min": "meters_per_minute",
  "m/min": "meters_per_minute",
  "meters per minute": "meters_per_minute",
};

function parseNum(val) {
  if (val == null || val === "" || val === "-") return null;
  // replace commas used as decimal separator
  const cleaned = String(val).replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseCSV(text) {
  // Detect separator: semicolon or comma
  const firstLine = text.split("\n")[0];
  const sep = firstLine.includes(";") ? ";" : ",";

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Find header row: the one that contains a player/athlete name column
  let headerIdx = -1;
  let headers = [];
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cols = lines[i].split(sep).map((c) => c.replace(/"/g, "").trim());
    const normalized = cols.map((c) => c.toLowerCase());
    if (
      normalized.some((c) => c.includes("jugador") || c.includes("player") || c.includes("nombre") || c.includes("athlete"))
    ) {
      headerIdx = i;
      headers = cols;
      break;
    }
  }

  if (headerIdx === -1) return null;

  // Map header index → entity field
  const fieldMap = {}; // colIndex → fieldName
  headers.forEach((h, idx) => {
    const key = h.toLowerCase().trim();
    const field = COL_MAP[key];
    if (field) fieldMap[idx] = field;
  });

  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.replace(/"/g, "").trim());
    const obj = {};
    Object.entries(fieldMap).forEach(([colIdx, field]) => {
      const raw = cols[parseInt(colIdx)];
      if (field === "player_name") {
        obj[field] = raw || "";
      } else {
        obj[field] = parseNum(raw);
      }
    });

    const name = obj.player_name || "";
    // Skip empty rows, totals and averages
    if (!name) continue;
    const lname = name.toLowerCase();
    if (lname === "total" || lname === "promedio" || lname === "average" || lname === "team") continue;

    rows.push(obj);
  }

  return rows;
}

const CHART_METRICS = [
  { key: "total_distance",  label: "Distancia (m)",    color: "#60a5fa" },
  { key: "sprint_distance", label: "+25 km/h (m)",     color: "#fbbf24" },
  { key: "distance_hsr",   label: "19.8-25 km/h (m)", color: "#34d399" },
  { key: "player_load",    label: "Player Load",       color: "#a78bfa" },
  { key: "max_velocity",   label: "Vel. Máx (km/h)",  color: "#f87171" },
  { key: "accelerations",  label: "Aceleraciones",     color: "#fb923c" },
];

export default function Catapult() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState("total_distance");
  const [preview, setPreview] = useState(null); // { rows, date, file_url }
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadReports(); }, []);

  async function loadReports() {
    try {
      const data = await base44.entities.CatapultReport.list("-date", 200);
      setReports(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleCSVUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (!rows || rows.length === 0) {
        toast({ title: "No se encontraron datos en el archivo", description: "Verificá que sea un CSV de Catapult OpenField.", variant: "destructive" });
        return;
      }

      // Upload file for storage reference
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const date = moment().format("YYYY-MM-DD");
      setPreview({ rows, date, file_url });
    } catch (err) {
      toast({ title: "Error al leer el archivo", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setImporting(true);
    try {
      const records = preview.rows.map((r) => ({
        ...r,
        date: preview.date,
        file_url: preview.file_url,
      }));
      await base44.entities.CatapultReport.bulkCreate(records);
      toast({ title: `${records.length} jugadores importados correctamente` });
      setPreview(null);
      setLoading(true);
      loadReports();
    } catch {
      toast({ title: "Error al importar", variant: "destructive" });
    } finally {
      setImporting(false);
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
        loadReports();
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
    .map((r) => ({
      name: r.player_name?.split(" ").slice(-1)[0] || "—",
      value: r[selectedMetric] || 0,
    }));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Catapult GPS</h1>
          <p className="text-zinc-500 text-sm mt-1">Importá el CSV exportado desde Catapult OpenField</p>
        </div>
        <label>
          <Button asChild className="bg-white text-zinc-900 hover:bg-zinc-200 cursor-pointer">
            <span>
              {uploading ? (
                <div className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-900 rounded-full animate-spin mr-1.5" />
              ) : (
                <Upload size={16} className="mr-1.5" />
              )}
              {uploading ? "Leyendo..." : "Subir CSV"}
            </span>
          </Button>
          <input type="file" accept=".csv,.txt" onChange={handleCSVUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      {/* ── PREVIEW PANEL ──────────────────────────────────────────────── */}
      {preview && (
        <div className="bg-zinc-900 border border-yellow-500/40 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-yellow-500/10 border-b border-yellow-500/30 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-yellow-300 font-semibold text-sm">Vista previa — {preview.rows.length} jugadores detectados</p>
              <p className="text-yellow-400/70 text-xs mt-0.5">Revisá los datos antes de confirmar la importación</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPreview(null)}
                className="border-zinc-600 text-zinc-300 hover:bg-zinc-800"
              >
                <X size={14} className="mr-1" /> Cancelar
              </Button>
              <Button
                size="sm"
                onClick={confirmImport}
                disabled={importing}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {importing ? (
                  <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin mr-1.5" />
                ) : (
                  <Check size={14} className="mr-1" />
                )}
                Confirmar importación
              </Button>
            </div>
          </div>
          <div className="p-4">
            <CsvPreviewTable rows={preview.rows} />
          </div>
        </div>
      )}

      {/* ── EMPTY STATE ─────────────────────────────────────────────────── */}
      {!preview && reports.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <FileSpreadsheet size={40} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">No hay informes cargados</p>
          <p className="text-zinc-600 text-xs mt-1">Subí un archivo CSV exportado desde Catapult OpenField</p>
        </div>
      )}

      {/* ── CHARTS & TABLE ──────────────────────────────────────────────── */}
      {!preview && reports.length > 0 && (
        <>
          {/* Metric selector */}
          <div className="flex gap-2 flex-wrap">
            {CHART_METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setSelectedMetric(m.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedMetric === m.key ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
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

          {/* Data table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-white">Datos individuales</h3>
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

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-zinc-500 px-1">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-900/70 inline-block" /> Alto rendimiento</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-900/70 inline-block" /> Rendimiento medio</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-900/70 inline-block" /> Bajo rendimiento</span>
          </div>
        </>
      )}
    </div>
  );
}