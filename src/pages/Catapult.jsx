import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, FileSpreadsheet, Zap, Gauge, Route, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function Catapult() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState("total_distance");
  const { toast } = useToast();

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    try {
      const data = await base44.entities.CatapultReport.list("-date", 100);
      setReports(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleCSVUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            players: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  player_name: { type: "string" },
                  total_distance: { type: "number" },
                  max_speed: { type: "number" },
                  high_speed_running: { type: "number" },
                  sprint_distance: { type: "number" },
                  accelerations: { type: "number" },
                  decelerations: { type: "number" },
                  player_load: { type: "number" },
                  heart_rate_avg: { type: "number" },
                },
              },
            },
          },
        },
      });

      if (result.status === "success" && result.output?.players) {
        const today = moment().format("YYYY-MM-DD");
        const records = result.output.players.map((p) => ({
          ...p,
          date: today,
          file_url,
        }));
        await base44.entities.CatapultReport.bulkCreate(records);
        toast({ title: `${records.length} registros importados` });
        setLoading(true);
        loadReports();
      } else {
        toast({ title: "No se pudieron extraer datos del archivo", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error al procesar archivo", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  const metrics = [
    { key: "total_distance", label: "Distancia (m)", icon: Route, color: "#60a5fa" },
    { key: "max_speed", label: "Vel. Máx (km/h)", icon: Gauge, color: "#f87171" },
    { key: "player_load", label: "Player Load", icon: Zap, color: "#a78bfa" },
    { key: "high_speed_running", label: "HSR (m)", icon: Zap, color: "#34d399" },
    { key: "sprint_distance", label: "Sprint (m)", icon: Gauge, color: "#fbbf24" },
    { key: "heart_rate_avg", label: "FC Prom", icon: HeartPulse, color: "#fb7185" },
  ];

  const currentMetric = metrics.find((m) => m.key === selectedMetric);

  const latestDate = reports.length > 0 ? reports.reduce((a, b) => (a.date > b.date ? a : b)).date : null;
  const latestReports = latestDate ? reports.filter((r) => r.date === latestDate) : [];

  const chartData = latestReports
    .filter((r) => r[selectedMetric] != null)
    .sort((a, b) => (b[selectedMetric] || 0) - (a[selectedMetric] || 0))
    .map((r) => ({
      name: r.player_name?.split(" ").pop() || "—",
      value: r[selectedMetric] || 0,
    }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Catapult</h1>
          <p className="text-zinc-500 text-sm mt-1">Cargá el CSV de Catapult para visualizar métricas</p>
        </div>
        <label>
          <Button asChild className="bg-white text-zinc-900 hover:bg-zinc-200 cursor-pointer">
            <span>
              {uploading ? (
                <div className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-900 rounded-full animate-spin mr-1.5" />
              ) : (
                <Upload size={16} className="mr-1.5" />
              )}
              Subir CSV
            </span>
          </Button>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleCSVUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      {reports.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <FileSpreadsheet size={40} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">No hay informes cargados</p>
          <p className="text-zinc-600 text-xs mt-1">Subí un archivo CSV de Catapult para empezar</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            {metrics.map((m) => (
              <button
                key={m.key}
                onClick={() => setSelectedMetric(m.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedMetric === m.key
                    ? "bg-white text-zinc-900"
                    : "bg-zinc-800 text-zinc-400 hover:text-white"
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
                  <YAxis dataKey="name" type="category" tick={{ fill: "#a1a1aa", fontSize: 11 }} width={80} />
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, color: "#fff", fontSize: 12 }}
                  />
                  <Bar dataKey="value" fill={currentMetric?.color || "#60a5fa"} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-white">Datos individuales — {moment(latestDate).format("DD/MM/YYYY")}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="text-left p-3 font-medium">Jugador</th>
                    <th className="text-right p-3 font-medium">Distancia</th>
                    <th className="text-right p-3 font-medium">Vel Máx</th>
                    <th className="text-right p-3 font-medium">HSR</th>
                    <th className="text-right p-3 font-medium">Sprint</th>
                    <th className="text-right p-3 font-medium">Acel</th>
                    <th className="text-right p-3 font-medium">Decel</th>
                    <th className="text-right p-3 font-medium">PL</th>
                    <th className="text-right p-3 font-medium">FC</th>
                  </tr>
                </thead>
                <tbody>
                  {latestReports.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="p-3 text-white font-medium">{r.player_name}</td>
                      <td className="p-3 text-right text-zinc-300">{r.total_distance?.toFixed(0) ?? "—"}</td>
                      <td className="p-3 text-right text-zinc-300">{r.max_speed?.toFixed(1) ?? "—"}</td>
                      <td className="p-3 text-right text-zinc-300">{r.high_speed_running?.toFixed(0) ?? "—"}</td>
                      <td className="p-3 text-right text-zinc-300">{r.sprint_distance?.toFixed(0) ?? "—"}</td>
                      <td className="p-3 text-right text-zinc-300">{r.accelerations ?? "—"}</td>
                      <td className="p-3 text-right text-zinc-300">{r.decelerations ?? "—"}</td>
                      <td className="p-3 text-right text-zinc-300">{r.player_load?.toFixed(1) ?? "—"}</td>
                      <td className="p-3 text-right text-zinc-300">{r.heart_rate_avg?.toFixed(0) ?? "—"}</td>
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