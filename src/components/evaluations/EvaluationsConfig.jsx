import React, { useState, useEffect } from "react";
import { Settings2, Loader2, Plus, Check, X, Edit2, Trash2, Search, Tag, Gauge, Users, BookOpen } from "lucide-react";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { evaluationsGateway } from "@/lib/evaluationsApi";

export default function EvaluationsConfig() {
  const { activeSquad } = useWorkspace();
  const [sources, setSources] = useState([]);
  const [testDefs, setTestDefs] = useState([]);
  const [metricDefs, setMetricDefs] = useState([]);
  const [thresholds, setThresholds] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("sources");

  async function loadConfig() {
    if (!activeSquad?.id) return;
    setLoading(true);
    setError("");
    try {
      const data = await evaluationsGateway("config", { squad_id: activeSquad.id });
      setSources(data.sources || []);
      setTestDefs(data.test_definitions || []);
      setMetricDefs(data.metric_definitions || []);
      setThresholds(data.thresholds || []);
      setAliases(data.aliases || []);
    } catch (e) {
      setError(e.message || "No se pudo cargar la configuración");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadConfig(); }, [activeSquad?.id]);

  if (loading) return <div className="py-10 flex justify-center"><Loader2 size={20} className="text-zinc-500 animate-spin" /></div>;
  if (error) return <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">{error}</div>;

  const SECTIONS = [
    { key: "sources", label: "Fuentes", icon: BookOpen },
    { key: "tests", label: "Pruebas", icon: Tag },
    { key: "metrics", label: "Catálogo de métricas", icon: Gauge },
    { key: "thresholds", label: "Umbrales", icon: Settings2 },
    { key: "aliases", label: "Alias de jugadores", icon: Users },
  ];

  return (
    <div className="space-y-4">
      {/* Section tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-800 pb-px">
        {SECTIONS.map((sec) => (
          <button
            key={sec.key}
            onClick={() => setActiveSection(sec.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              activeSection === sec.key ? "text-blue-400 border-blue-400" : "text-zinc-400 hover:text-white border-transparent"
            }`}
          >
            <sec.icon size={16} />
            {sec.label}
          </button>
        ))}
      </div>

      {activeSection === "sources" && <SourcesSection sources={sources} />}
      {activeSection === "tests" && <TestsSection testDefs={testDefs} metricDefs={metricDefs} squadId={activeSquad?.id} onReload={loadConfig} />}
      {activeSection === "metrics" && <MetricsSection metricDefs={metricDefs} squadId={activeSquad?.id} onReload={loadConfig} />}
      {activeSection === "thresholds" && <ThresholdsSection thresholds={thresholds} testDefs={testDefs} metricDefs={metricDefs} squadId={activeSquad?.id} onReload={loadConfig} />}
      {activeSection === "aliases" && <AliasesSection aliases={aliases} squadId={activeSquad?.id} />}
    </div>
  );
}

function SourcesSection({ sources }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings2 size={16} className="text-blue-400" />
          <h3 className="text-sm font-bold text-white">Fuentes de evaluación</h3>
        </div>
        <span className="text-xs text-zinc-500">{sources.length} fuente(s)</span>
      </div>
      {!sources.length ? (
        <div className="text-center py-6">
          <p className="text-zinc-500 text-sm">No hay fuentes configuradas.</p>
          <p className="text-zinc-600 text-xs mt-1">ForceDecks se registra automáticamente al importar el primer CSV.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-3 bg-zinc-950/50 border border-zinc-800 rounded-lg">
              <div>
                <p className="text-sm font-medium text-white">{s.name}</p>
                <p className="text-xs text-zinc-500">{s.source_key} · {s.product_type}</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {s.supports_csv && <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">CSV</span>}
                {s.supports_api && <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300">API</span>}
                {s.active ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-zinc-500" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TestsSection({ testDefs, metricDefs, squadId, onReload }) {
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  function startEdit(test) {
    setEditing(test.id);
    setForm({
      test_key: test.test_key,
      source_key: test.source_key,
      name: test.name,
      short_name: test.short_name || test.test_key?.toUpperCase(),
      side_mode: test.side_mode || "bilateral",
      supports_attempts: test.supports_attempts !== false,
      priority_metrics: test.priority_metrics || [],
      primary_metric_key: test.primary_metric_key || test.priority_metrics?.[0] || "",
      primary_direction: test.primary_direction || "higher",
      secondary_metric_key: test.secondary_metric_key || test.priority_metrics?.[1] || "",
      secondary_direction: test.secondary_direction || "higher",
      asymmetry_metrics: test.asymmetry_metrics || [],
      active: test.active !== false,
      display_order: test.display_order || 0,
    });
  }

  async function saveRule() {
    setSaving(true);
    try {
      await evaluationsGateway("save_test_definition", { squad_id: squadId, id: editing, definition: form });
      setEditing(null);
      await onReload();
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white">Pruebas definidas</h3>
        <span className="text-xs text-zinc-500">{testDefs.length} prueba(s)</span>
      </div>
      {!testDefs.length ? (
        <div className="text-center py-6">
          <p className="text-zinc-500 text-sm">No hay pruebas configuradas.</p>
          <p className="text-zinc-600 text-xs mt-1">Se detectan automáticamente al importar (CMJ, SJ, CMRJ).</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {testDefs.map((t) => (
            <div key={t.id} className="p-3 bg-zinc-950/50 border border-zinc-800 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 text-xs font-bold uppercase">{t.short_name || t.test_key}</span>
                <span className="text-xs text-zinc-500">{t.source_key}</span>
              </div>
              <p className="text-sm text-white mt-1.5">{t.name}</p>
              <p className="text-xs text-zinc-500">{t.side_mode} · {t.supports_attempts ? "Multi-intento" : "Single"}</p>
              <p className="text-[11px] text-zinc-400 mt-2">Mejor intento: <span className="text-white">{t.primary_metric_key || t.priority_metrics?.[0] || "primer intento"}</span> · {t.primary_direction === "lower" ? "menor" : "mayor"}</p>
              {t.secondary_metric_key && <p className="text-[10px] text-zinc-500">Desempate: {t.secondary_metric_key} · {t.secondary_direction === "lower" ? "menor" : "mayor"}</p>}
              {t.priority_metrics?.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-zinc-600">Principal:</span>
                  {t.priority_metrics.map((m) => (
                    <span key={m} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]">{m}</span>
                  ))}
                </div>
              )}
              <button onClick={() => startEdit(t)} className="mt-3 px-2.5 py-1.5 rounded bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700 flex items-center gap-1.5"><Edit2 size={12} /> Editar regla</button>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <div className="mt-5 pt-5 border-t border-zinc-800">
          <h4 className="text-sm font-bold text-white mb-3">Regla auditable del mejor intento</h4>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <RuleMetricSelect label="Métrica principal" value={form.primary_metric_key} onChange={(value) => setForm({ ...form, primary_metric_key: value })} metricDefs={metricDefs} />
            <DirectionSelect label="Dirección principal" value={form.primary_direction} onChange={(value) => setForm({ ...form, primary_direction: value })} />
            <RuleMetricSelect label="Métrica de desempate" value={form.secondary_metric_key} onChange={(value) => setForm({ ...form, secondary_metric_key: value })} metricDefs={metricDefs} optional />
            <DirectionSelect label="Dirección de desempate" value={form.secondary_direction} onChange={(value) => setForm({ ...form, secondary_direction: value })} />
          </div>
          <p className="text-xs text-zinc-500 mt-2">Si ambas métricas empatan, prevalece la menor hora y luego el menor número de intento. Cada guardado incrementa la versión de configuración.</p>
          <div className="flex gap-2 mt-3">
            <button onClick={saveRule} disabled={saving || !form.primary_metric_key} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:opacity-50">{saving ? "Guardando..." : "Guardar nueva versión"}</button>
            <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function RuleMetricSelect({ label, value, onChange, metricDefs, optional }) {
  return <div><label className="text-xs text-zinc-500 block mb-1">{label}</label><select value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"><option value="">{optional ? "Sin desempate" : "Seleccionar..."}</option>{metricDefs.filter((metric) => metric.active !== false).map((metric) => <option key={metric.id} value={metric.metric_key}>{metric.metric_label || metric.metric_key}</option>)}</select></div>;
}

function DirectionSelect({ label, value, onChange }) {
  return <div><label className="text-xs text-zinc-500 block mb-1">{label}</label><select value={value || "higher"} onChange={(e) => onChange(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"><option value="higher">Mayor es mejor</option><option value="lower">Menor es mejor</option></select></div>;
}

function MetricsSection({ metricDefs, squadId, onReload }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const filtered = search ? metricDefs.filter((m) => (m.metric_label || m.metric_key || "").toLowerCase().includes(search.toLowerCase())) : metricDefs;

  function startEdit(metric) {
    setEditing(metric.id);
    setForm({ metric_label: metric.metric_label || metric.metric_key, unit: metric.unit || "", direction: metric.direction || "higher_is_better", precision: Number.isInteger(metric.precision) ? metric.precision : 3, active: metric.active !== false });
  }

  async function saveMetric() {
    setSaving(true);
    try {
      await evaluationsGateway("save_metric_definition", { squad_id: squadId, id: editing, definition: form });
      setEditing(null);
      await onReload();
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-white">Catálogo de métricas</h3>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar métrica..." className="pl-8 pr-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white w-48" />
        </div>
      </div>
      {!metricDefs.length ? (
        <div className="text-center py-6">
          <p className="text-zinc-500 text-sm">No hay métricas catalogadas.</p>
          <p className="text-zinc-600 text-xs mt-1">Las métricas se registran automáticamente al importar CSVs.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-zinc-950/50 text-zinc-500 border-b border-zinc-800">
                <th className="text-left p-2 font-semibold">Clave</th>
                <th className="text-left p-2 font-semibold">Etiqueta</th>
                <th className="text-left p-2 font-semibold">Columna CSV</th>
                <th className="text-left p-2 font-semibold">Unidad</th>
                <th className="text-left p-2 font-semibold">Tipo</th>
                <th className="text-left p-2 font-semibold">Dirección</th>
                <th className="text-left p-2 font-semibold">Categoría</th>
                <th className="text-center p-2 font-semibold">Precisión</th>
                <th className="text-center p-2 font-semibold">Activa</th>
                <th className="text-center p-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/20">
                  <td className="p-2 text-zinc-400 font-mono">{m.metric_key}</td>
                  <td className="p-2 text-white font-medium">{m.metric_label}</td>
                  <td className="p-2 text-zinc-500 font-mono">{m.csv_column || "—"}</td>
                  <td className="p-2 text-zinc-300">{m.unit || "—"}</td>
                  <td className="p-2 text-zinc-300">{m.value_type || "—"}</td>
                  <td className="p-2 text-zinc-300">{m.direction || "—"}</td>
                  <td className="p-2 text-zinc-300">{m.category || "—"}</td>
                  <td className="p-2 text-center text-zinc-300">{Number.isInteger(m.precision) ? m.precision : 3}</td>
                  <td className="p-2 text-center">{m.active ? <Check size={14} className="text-emerald-400 inline" /> : <X size={14} className="text-zinc-500 inline" />}</td>
                  <td className="p-2 text-center"><button onClick={() => startEdit(m)} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400"><Edit2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <div className="mt-4 pt-4 border-t border-zinc-800"><h4 className="text-sm font-bold text-white mb-3">Editar métrica y regla de huella</h4><div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3"><div><label className="text-xs text-zinc-500 block mb-1">Etiqueta</label><input value={form.metric_label} onChange={(e) => setForm({ ...form, metric_label: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white" /></div><div><label className="text-xs text-zinc-500 block mb-1">Unidad</label><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white" /></div><div><label className="text-xs text-zinc-500 block mb-1">Dirección</label><select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"><option value="higher_is_better">Mayor es mejor</option><option value="lower_is_better">Menor es mejor</option><option value="range">Rango esperado</option><option value="contextual">Contextual</option><option value="none">Sin dirección</option></select></div><div><label className="text-xs text-zinc-500 block mb-1">Decimales de duplicado</label><input type="number" min="0" max="8" value={form.precision} onChange={(e) => setForm({ ...form, precision: Number(e.target.value) })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white" /></div><label className="flex items-center gap-2 text-xs text-zinc-400 self-end pb-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-blue-500" />Activa</label></div><p className="text-xs text-zinc-500 mt-2">La precisión sólo normaliza la huella canónica para deduplicar; el valor original y su signo nunca se alteran.</p><div className="flex gap-2 mt-3"><button onClick={saveMetric} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:opacity-50">{saving ? "Guardando..." : "Guardar versión"}</button><button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs">Cancelar</button></div></div>}
    </div>
  );
}

function ThresholdsSection({ thresholds: initialThresholds, testDefs, metricDefs, squadId, onReload }) {
  const [thresholds, setThresholds] = useState(initialThresholds);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ source_key: "forcedecks", test_key: "", metric_key: "", moderate_threshold: 1.0, important_threshold: 1.5, threshold_type: "sd", improvement_threshold: null, decline_threshold: null, asymmetry_threshold: 10 });

  useEffect(() => { setThresholds(initialThresholds); }, [initialThresholds]);

  async function saveThreshold() {
    try {
      await evaluationsGateway("save_threshold", { squad_id: squadId, id: editing?.id || null, threshold: form });
      await onReload();
      setEditing(null);
      setForm({ source_key: "forcedecks", test_key: "", metric_key: "", moderate_threshold: 1.0, important_threshold: 1.5, threshold_type: "sd", improvement_threshold: null, decline_threshold: null, asymmetry_threshold: 10 });
    } catch (e) { alert("Error: " + e.message); }
  }

  async function deleteThreshold(id) {
    if (!confirm("¿Eliminar este umbral?")) return;
    try {
      await evaluationsGateway("delete_threshold", { squad_id: squadId, id });
      setThresholds((prev) => prev.filter((t) => t.id !== id));
    } catch (e) { alert("Error: " + e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-bold text-white mb-3">{editing ? "Editar umbral" : "Nuevo umbral"}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Fuente</label>
            <select value={form.source_key} onChange={(e) => setForm({ ...form, source_key: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
              <option value="forcedecks">ForceDecks</option>
              <option value="nordbord">NordBord</option>
              <option value="isopush">ISO Push</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Prueba</label>
            <input value={form.test_key} onChange={(e) => setForm({ ...form, test_key: e.target.value })} placeholder="cmj, sj..." className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Métrica</label>
            <input value={form.metric_key} onChange={(e) => setForm({ ...form, metric_key: e.target.value })} placeholder="Jump Height..." className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Tipo</label>
            <select value={form.threshold_type} onChange={(e) => setForm({ ...form, threshold_type: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
              <option value="sd">Desv. estándar</option>
              <option value="percentage">Porcentaje</option>
              <option value="absolute">Absoluto</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Umbral moderado</label>
            <input type="number" step="0.1" value={form.moderate_threshold} onChange={(e) => setForm({ ...form, moderate_threshold: parseFloat(e.target.value) })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Umbral importante</label>
            <input type="number" step="0.1" value={form.important_threshold} onChange={(e) => setForm({ ...form, important_threshold: parseFloat(e.target.value) })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Umbral mejora (%)</label>
            <input type="number" step="0.1" value={form.improvement_threshold || ""} onChange={(e) => setForm({ ...form, improvement_threshold: e.target.value ? parseFloat(e.target.value) : null })} placeholder="Opcional" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Umbral caída (%)</label>
            <input type="number" step="0.1" value={form.decline_threshold || ""} onChange={(e) => setForm({ ...form, decline_threshold: e.target.value ? parseFloat(e.target.value) : null })} placeholder="Opcional" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white" />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button onClick={saveThreshold} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 flex items-center gap-1.5">
            {editing ? <Check size={14} /> : <Plus size={14} />} {editing ? "Guardar" : "Crear umbral"}
          </button>
          {editing && <button onClick={() => { setEditing(null); setForm({ source_key: "forcedecks", test_key: "", metric_key: "", moderate_threshold: 1.0, important_threshold: 1.5, threshold_type: "sd", improvement_threshold: null, decline_threshold: null, asymmetry_threshold: 10 }); }} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs">Cancelar</button>}
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-bold text-white mb-3">Umbrales configurados ({thresholds.length})</h3>
        {!thresholds.length ? (
          <p className="text-zinc-500 text-sm text-center py-4">No hay umbrales configurados. Se usan valores por defecto (1.0 SD moderado, 1.5 SD importante).</p>
        ) : (
          <div className="space-y-2">
            {thresholds.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-zinc-950/50 border border-zinc-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 text-xs font-bold uppercase">{t.test_key}</span>
                  <span className="text-sm text-white">{t.metric_key}</span>
                  <span className="text-xs text-zinc-500">{t.threshold_type}</span>
                  <span className="text-xs text-zinc-400">mod: {t.moderate_threshold} · imp: {t.important_threshold}</span>
                  {t.improvement_threshold != null && <span className="text-xs text-emerald-400">↑{t.improvement_threshold}%</span>}
                  {t.decline_threshold != null && <span className="text-xs text-red-400">↓{t.decline_threshold}%</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditing(t); setForm({ source_key: t.source_key, test_key: t.test_key, metric_key: t.metric_key, moderate_threshold: t.moderate_threshold, important_threshold: t.important_threshold, threshold_type: t.threshold_type, improvement_threshold: t.improvement_threshold, decline_threshold: t.decline_threshold, asymmetry_threshold: t.asymmetry_threshold || 10 }); }} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400"><Edit2 size={14} /></button>
                  <button onClick={() => deleteThreshold(t.id)} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AliasesSection({ aliases: initialAliases, squadId }) {
  const [aliases, setAliases] = useState(initialAliases);
  const [search, setSearch] = useState("");

  async function toggleAlias(alias) {
    try {
      await evaluationsGateway("toggle_alias", { squad_id: squadId, id: alias.id });
      setAliases((prev) => prev.map((a) => a.id === alias.id ? { ...a, active: !a.active } : a));
    } catch (e) { alert("Error: " + e.message); }
  }

  async function deleteAlias(id) {
    if (!confirm("¿Eliminar este alias definitivamente?")) return;
    try {
      await evaluationsGateway("delete_alias", { squad_id: squadId, id });
      setAliases((prev) => prev.filter((a) => a.id !== id));
    } catch (e) { alert("Error: " + e.message); }
  }

  const filtered = search ? aliases.filter((a) => (a.alias_name || "").toLowerCase().includes(search.toLowerCase()) || (a.player_name || "").toLowerCase().includes(search.toLowerCase())) : aliases;
  const active = aliases.filter((a) => a.active).length;
  const inactive = aliases.length - active;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-white">Alias de jugadores</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{active} activos · {inactive} inactivos · {aliases.length} total</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar alias o jugador..." className="pl-8 pr-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white w-56" />
        </div>
      </div>

      {!aliases.length ? (
        <div className="text-center py-6">
          <p className="text-zinc-500 text-sm">No hay alias confirmados.</p>
          <p className="text-zinc-600 text-xs mt-1">Los alias se crean al confirmar vinculaciones manuales durante la importación.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filtered.map((a) => (
            <div key={a.id} className={`flex items-center justify-between p-3 border rounded-lg ${a.active ? "bg-zinc-950/50 border-zinc-800" : "bg-zinc-950/30 border-zinc-800/50 opacity-60"}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate">{a.alias_name}</p>
                  <p className="text-xs text-zinc-500 truncate">→ {a.player_name || "Sin vincular"} · {a.source_key || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {a.active ? <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-xs">Activo</span> : <span className="px-2 py-0.5 rounded bg-zinc-700 text-zinc-400 text-xs">Inactivo</span>}
                <button onClick={() => toggleAlias(a)} className="px-2 py-1 rounded bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700">{a.active ? "Desactivar" : "Activar"}</button>
                <button onClick={() => deleteAlias(a.id)} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
