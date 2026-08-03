import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ArrowLeft, Download, Activity, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ValdTestTable from "@/components/vald/ValdTestTable";
import ValdProductBadge, { PRODUCT_CONFIG } from "@/components/vald/ValdProductBadge";

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}

const KEY_METRICS = ["jump_height", "rsi", "peak_force", "peak_power", "left_force", "right_force", "asymmetry", "speed", "time"];

export default function ValdPlayerDetail() {
  const { id } = useParams();
  const [tests, setTests] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [playerTests, profiles] = await Promise.all([
          base44.entities.ValdTest.filter({ player_id: id }, "-test_date", 500),
          base44.entities.ValdProfile.filter({ player_id: id }, "player_name", 10),
        ]);
        setTests(playerTests || []);
        setProfile(profiles[0] || null);
      } catch (e) { console.error("vald player detail", e); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [id]);

  const testsByType = useMemo(() => {
    const groups = {};
    for (const t of tests) {
      const key = t.test_type || "Unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return groups;
  }, [tests]);

  const bilateralData = useMemo(() => {
    return tests
      .filter(t => t.metrics && (t.metrics.left_force != null || t.metrics.right_force != null))
      .sort((a, b) => new Date(a.test_date) - new Date(b.test_date))
      .slice(-10)
      .map(t => ({
        date: fmtDate(t.test_date),
        left: t.metrics.left_force || 0,
        right: t.metrics.right_force || 0,
        asymmetry: t.metrics.asymmetry || 0,
      }));
  }, [tests]);

  function exportCSV() {
    const headers = ["Fecha", "Producto", "Tipo", "Lado", "Métricas"];
    const rows = tests.map(t => [
      t.test_date || "",
      t.product || "",
      t.test_type || "",
      t.test_side || "",
      JSON.stringify(t.metrics || {}),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vald_tests_${id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="h-24 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse mb-4" />
        <div className="h-64 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Back link */}
      <Link to="/vald/players" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
        <ArrowLeft size={16} /> Volver a jugadores
      </Link>

      {/* Player header */}
      <div className="bg-gradient-to-br from-blue-600/10 via-zinc-900 to-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
            <span className="text-xl font-bold text-zinc-400">{(profile?.player_name || "?").charAt(0)}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{profile?.player_name || "Jugador"}</h1>
            <p className="text-sm text-zinc-400">{profile?.squad_name || "Sin plantel"}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs text-zinc-500">{tests.length} tests</span>
              {profile?.height && <span className="text-xs text-zinc-500">· {profile.height} cm</span>}
              {profile?.weight && <span className="text-xs text-zinc-500">· {profile.weight} kg</span>}
              {profile?.gender && <span className="text-xs text-zinc-500">· {profile.gender}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Export button */}
      {tests.length > 0 && (
        <button onClick={exportCSV} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors">
          <Download size={16} /> Exportar CSV
        </button>
      )}

      {/* Bilateral comparison */}
      {bilateralData.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Comparación Bilateral (Left vs Right)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={bilateralData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="left" name="Izquierda" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="right" name="Derecha" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Charts per test type */}
      {Object.entries(testsByType).map(([testType, typeTests]) => {
        const sorted = [...typeTests].sort((a, b) => new Date(a.test_date) - new Date(b.test_date));
        const metricKeys = new Set();
        sorted.forEach(t => Object.keys(t.metrics || {}).forEach(k => { if (KEY_METRICS.includes(k)) metricKeys.add(k); }));
        const chartData = sorted.map(t => ({
          date: fmtDate(t.test_date),
          ...Object.fromEntries(Object.entries(t.metrics || {}).filter(([k]) => metricKeys.has(k))),
        }));
        if (chartData.length < 2 || metricKeys.size === 0) return null;
        return (
          <div key={testType} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <ValdProductBadge product={sorted[0].product} />
              <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">{testType}</h2>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {[...metricKeys].map((mk, i) => (
                  <Line key={mk} type="monotone" dataKey={mk} stroke={Object.values(PRODUCT_CONFIG)[i % 6].chartColor} strokeWidth={2} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })}

      {/* Test table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Historial de Tests</h2>
        <ValdTestTable tests={tests} limit={50} showPlayer={false} />
      </div>
    </div>
  );
}