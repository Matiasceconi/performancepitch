import React, { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Activity, Users, FlaskConical, RefreshCw, Calendar, Loader2, Link as LinkIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useWorkspace } from "@/lib/WorkspaceContext";
import ValdTestTable from "@/components/vald/ValdTestTable";
import ValdProductBadge, { PRODUCT_CONFIG, PRODUCTS } from "@/components/vald/ValdProductBadge";

function fmtSync(iso) {
  if (!iso) return "Nunca";
  try { return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

export default function ValdDashboard() {
  const { activeSquad } = useWorkspace();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [filterProduct, setFilterProduct] = useState("all");

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await base44.functions.invoke("getValdDashboard", { squad_id: activeSquad?.id });
      setData(resp.data);
    } catch (e) {
      console.error("vald dashboard", e);
    } finally {
      setLoading(false);
    }
  }, [activeSquad?.id]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg("Sincronizando perfiles...");
    try {
      await base44.functions.invoke("syncValdProfiles", {});
      for (const product of PRODUCTS) {
        setSyncMsg(`Sincronizando ${product}...`);
        try { await base44.functions.invoke("syncValdTests", { product }); }
        catch (e) { console.error(`sync ${product}`, e); }
      }
      setSyncMsg("Sincronización completada");
      await fetchDashboard();
    } catch (e) {
      setSyncMsg(`Error: ${e.message || e}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(""), 5000);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
        <div className="h-24 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-64 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const summary = data?.summary || { total_tests: 0, total_players_tested: 0, total_profiles: 0, product_counts: {}, month_counts: {} };
  const productData = Object.entries(summary.product_counts || {}).map(([name, count]) => ({ name, count, fill: PRODUCT_CONFIG[name]?.chartColor || "#3b82f6" }));
  const monthData = Object.entries(summary.month_counts || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month: month.substring(5) + "/" + month.substring(2, 4), count }));
  const recentTests = (data?.recent_tests || []).filter(t => filterProduct === "all" || t.product === filterProduct);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600/10 via-zinc-900 to-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0">
              <Activity size={26} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">VALD Performance</h1>
              <p className="text-xs text-zinc-500 mt-1">Evaluaciones físicas · ForceDecks · NordBord · ForceFrame · SmartSpeed · DynaMo</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/vald/settings" className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors flex items-center gap-2">
              <LinkIcon size={16} /> Configurar
            </Link>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {syncing ? "Sincronizando..." : "Sincronizar"}
            </button>
          </div>
        </div>
        {syncMsg && <p className="text-xs text-blue-300 mt-3">{syncMsg}</p>}
        {data?.settings && (
          <p className="text-xs text-zinc-500 mt-2">Última sincronización: {fmtSync(data.settings.last_sync_at)} · Región: {data.settings.region?.toUpperCase()}</p>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center"><Users size={20} className="text-blue-400" /></div>
          <div><p className="text-xs text-zinc-500 uppercase">Jugadores</p><p className="text-2xl font-bold text-white">{summary.total_players_tested}</p></div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center"><FlaskConical size={20} className="text-emerald-400" /></div>
          <div><p className="text-xs text-zinc-500 uppercase">Tests</p><p className="text-2xl font-bold text-white">{summary.total_tests}</p></div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center"><Activity size={20} className="text-purple-400" /></div>
          <div><p className="text-xs text-zinc-500 uppercase">Perfiles VALD</p><p className="text-2xl font-bold text-white">{summary.total_profiles}</p></div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-500/15 flex items-center justify-center"><Calendar size={20} className="text-orange-400" /></div>
          <div><p className="text-xs text-zinc-500 uppercase">Última sync</p><p className="text-sm font-bold text-white">{fmtSync(data?.settings?.last_sync_at)}</p></div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Tests por Producto</h2>
          {productData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={productData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-zinc-500 text-sm text-center py-16">Sin datos</p>}
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Tests en el Tiempo</h2>
          {monthData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} />
                <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6" }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-zinc-500 text-sm text-center py-16">Sin datos</p>}
        </div>
      </div>

      {/* Recent tests */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Tests Recientes</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setFilterProduct("all")} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${filterProduct === "all" ? "bg-blue-500 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}>Todos</button>
            {PRODUCTS.map(p => (
              <button key={p} onClick={() => setFilterProduct(p)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${filterProduct === p ? "bg-blue-500 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}>{p}</button>
            ))}
          </div>
        </div>
        <ValdTestTable tests={recentTests} limit={20} />
      </div>
    </div>
  );
}