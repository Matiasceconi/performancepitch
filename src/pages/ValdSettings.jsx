import React, { useState, useEffect } from "react";
import { Settings2, Loader2, CheckCircle2, AlertCircle, RefreshCw, History } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PRODUCTS } from "@/components/vald/ValdProductBadge";

const REGIONS = [
  { value: "use", label: "US East" },
  { value: "usw", label: "US West" },
  { value: "eu", label: "Europe" },
  { value: "au", label: "Australia" },
];

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

export default function ValdSettings() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ client_id: "", client_secret: "", tenant_id: "", region: "use" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncingProduct, setSyncingProduct] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);

  useEffect(() => {
    async function fetchSettings() {
      setLoading(true);
      try {
        const [settingsList, logs] = await Promise.all([
          base44.entities.ValdSettings.list("-created_date", 1),
          base44.entities.ValdSyncLog.list("-started_at", 20),
        ]);
        const s = settingsList[0];
        if (s) {
          setSettings(s);
          setForm({ client_id: s.client_id || "", client_secret: "", tenant_id: s.tenant_id || "", region: s.region || "use" });
        }
        setSyncLogs(logs || []);
      } catch (e) { console.error("vald settings", e); }
      finally { setLoading(false); }
    }
    fetchSettings();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      if (settings) {
        const updateData = { region: form.region, tenant_id: form.tenant_id };
        if (form.client_id) updateData.client_id = form.client_id;
        if (form.client_secret) updateData.client_secret = form.client_secret;
        await base44.entities.ValdSettings.update(settings.id, updateData);
      }
      setTestResult(null);
      setSettings(await base44.entities.ValdSettings.get(settings?.id));
    } catch (e) { console.error("save settings", e); }
    finally { setSaving(false); }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const resp = await base44.functions.invoke("valdAuth", form.client_id ? form : {});
      setTestResult({ success: true, message: "Conexión exitosa" });
    } catch (e) {
      setTestResult({ success: false, message: e.response?.data?.error || e.message || "Error de conexión" });
    } finally { setTesting(false); }
  }

  async function handleSyncProduct(product) {
    setSyncingProduct(product);
    try {
      await base44.functions.invoke("syncValdTests", { product });
      const logs = await base44.entities.ValdSyncLog.list("-started_at", 20);
      setSyncLogs(logs || []);
    } catch (e) { console.error(`sync ${product}`, e); }
    finally { setSyncingProduct(null); }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="h-64 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
          <Settings2 size={22} className="text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Configuración VALD</h1>
          <p className="text-xs text-zinc-500">Credenciales API · Sincronización · Historial</p>
        </div>
      </div>

      {/* Credentials form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Credenciales API</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-500 font-medium uppercase">Client ID</label>
            <input
              value={form.client_id}
              onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
              placeholder="Client ID de VALD"
              className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-zinc-600 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium uppercase">Client Secret</label>
            <input
              type="password"
              value={form.client_secret}
              onChange={e => setForm(f => ({ ...f, client_secret: e.target.value }))}
              placeholder={settings ? "•••••••• (dejar vacío para mantener)" : "Client Secret"}
              className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-zinc-600 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium uppercase">Tenant ID</label>
            <input
              value={form.tenant_id}
              onChange={e => setForm(f => ({ ...f, tenant_id: e.target.value }))}
              placeholder="Tenant ID"
              className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-zinc-600 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium uppercase">Región</label>
            <select
              value={form.region}
              onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
              className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white focus:border-zinc-600 outline-none"
            >
              {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-colors flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Settings2 size={16} />} Guardar
          </button>
          <button onClick={handleTestConnection} disabled={testing} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-semibold hover:bg-zinc-700 transition-colors flex items-center gap-2 disabled:opacity-50">
            {testing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Probar conexión
          </button>
          {testResult && (
            <span className={`text-sm flex items-center gap-1.5 ${testResult.success ? "text-emerald-400" : "text-red-400"}`}>
              {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {testResult.message}
            </span>
          )}
        </div>
      </div>

      {/* Manual sync per product */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Sincronización Manual por Producto</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PRODUCTS.map(product => (
            <button
              key={product}
              onClick={() => handleSyncProduct(product)}
              disabled={syncingProduct === product}
              className="px-4 py-3 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {syncingProduct === product ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {product}
            </button>
          ))}
        </div>
      </div>

      {/* Sync history */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <History size={16} /> Historial de Sincronización
        </h2>
        {!syncLogs.length ? (
          <p className="text-zinc-500 text-sm text-center py-6">No hay sincronizaciones registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-xs uppercase border-b border-zinc-800">
                  <th className="text-left py-2 px-2">Producto</th>
                  <th className="text-left py-2 px-2">Estado</th>
                  <th className="text-left py-2 px-2">Obtenidos</th>
                  <th className="text-left py-2 px-2">Importados</th>
                  <th className="text-left py-2 px-2">Actualizados</th>
                  <th className="text-left py-2 px-2">Inicio</th>
                  <th className="text-left py-2 px-2">Fin</th>
                </tr>
              </thead>
              <tbody>
                {syncLogs.map(log => (
                  <tr key={log.id} className="border-b border-zinc-800/50">
                    <td className="py-2 px-2 text-white font-medium">{log.product}</td>
                    <td className="py-2 px-2">
                      <span className={`text-xs px-2 py-0.5 rounded-lg font-semibold ${
                        log.status === "completed" ? "bg-emerald-500/15 text-emerald-300" :
                        log.status === "failed" ? "bg-red-500/15 text-red-300" :
                        log.status === "partial" ? "bg-yellow-500/15 text-yellow-300" :
                        "bg-zinc-800 text-zinc-400"
                      }`}>{log.status}</span>
                    </td>
                    <td className="py-2 px-2 text-zinc-300">{log.tests_fetched || 0}</td>
                    <td className="py-2 px-2 text-zinc-300">{log.tests_imported || 0}</td>
                    <td className="py-2 px-2 text-zinc-300">{log.tests_updated || 0}</td>
                    <td className="py-2 px-2 text-zinc-400">{fmtDate(log.started_at)}</td>
                    <td className="py-2 px-2 text-zinc-400">{fmtDate(log.completed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}