import React, { useState, useEffect } from "react";
import { Settings2, Loader2, Plus, Check, X, Edit2, Trash2, Search, Tag, Gauge, Users, BookOpen } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useWorkspace } from "@/lib/WorkspaceContext";

export default function EvaluationsConfig() {
  const [sources, setSources] = useState([]);
  const [testDefs, setTestDefs] = useState([]);
  const [metricDefs, setMetricDefs] = useState([]);
  const [thresholds, setThresholds] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("sources");

  useEffect(() => {
    Promise.all([
      base44.entities.EvaluationSource.list("display_order", 50).catch(() => []),
      base44.entities.EvaluationTestDefinition.list("display_order", 50).catch(() => []),
      base44.entities.EvaluationMetricDefinition.list("display_order", 200).catch(() => []),
      base44.entities.EvaluationThresholdConfig.filter({ active: true }).catch(() => []),
      base44.entities.EvaluationPlayerAlias.list("alias_name", 200).catch(() => []),
    ]).then(([s, t, m, th, a]) => {
      setSources(s || []);
      setTestDefs(t || []);
      setMetricDefs(m || []);
      setThresholds(th || []);
      setAliases(a || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-10 flex justify-center"><Loader2 size={20} className="text-zinc-500 animate-spin" /></div>;

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
      {activeSection === "tests" && <TestsSection testDefs={testDefs} />}
      {activeSection === "metrics" && <MetricsSection metricDefs={metricDefs} />}
      {activeSection === "thresholds" && <ThresholdsSection thresholds={thresholds} testDefs={testDefs} metricDefs={metricDefs} />}
      {activeSection === "aliases" && <AliasesSection aliases={aliases} />}
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

function TestsSection({ testDefs }) {
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
              {t.priority_metrics?.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-zinc-600">Principal:</span>
                  {t.priority_metrics.map((m) => (
                    <span key={m} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]">{m}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricsSection({ metricDefs }) {
  const [search, setSearch] = useState("");
  const filtered = search ? metricDefs.filter((m) => (m.metric_label || m.metric_key || "").toLowerCase().includes(search.toLowerCase())) : metricDefs;

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
                <th className="text-center p-2 font-semibold">Activa</th>
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
                  <td className="p-2 text-center">{m.active ? <Check size={14} className="text-emerald-400 inline" /> : <X size={14} className="text-zinc-500 inline" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ThresholdsSection({ thresholds: initialThresholds, testDefs, metricDefs }) {
  const [thresholds, setThresholds] = useState(initialThresholds);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ source_key: "forcedecks", test_key: "", metric_key: "", moderate_threshold: 1.0, important_threshold: 1.5, threshold_type: "sd", improvement_threshold: null, decline_threshold: null, asymmetry_threshold: 10 });

  async function saveThreshold() {
    try {
      if (editing) {
        await base44.entities.EvaluationThresholdConfig.update(editing.id, { ...form, active: true });
      } else {
        await base44.entities.EvaluationThresholdConfig.create({ threshold_id: crypto.randomUUID(), ...form, active: true });
      }
      const refreshed = await base44.entities.EvaluationThresholdConfig.filter({ active: true });
      setThresholds(refreshed || []);
      setEditing(null);
      setForm({ source_key: "forcedecks", test_key: "", metric_key: "", moderate_threshold: 1.0, important_threshold: 1.5, threshold_type: "sd", improvement_threshold: null, decline_threshold: null, asymmetry_threshold: 10 });
    } catch (e) { alert("Error: " + e.message); }
  }

  async function deleteThreshold(id) {
    if (!confirm("¿Eliminar este umbral?")) return;
    try {
      await base44.entities.EvaluationThresholdConfig.delete(id);
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

function AliasesSection({ aliases: initialAliases }) {
  const [aliases, setAliases] = useState(initialAliases);
  const [search, setSearch] = useState("");

  async function toggleAlias(alias) {
    try {
      await base44.entities.EvaluationPlayerAlias.update(alias.id, { active: !alias.active });
      setAliases((prev) => prev.map((a) => a.id === alias.id ? { ...a, active: !a.active } : a));
    } catch (e) { alert("Error: " + e.message); }
  }

  async function deleteAlias(id) {
    if (!confirm("¿Eliminar este alias definitivamente?")) return;
    try {
      await base44.entities.EvaluationPlayerAlias.delete(id);
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