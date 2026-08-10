import React, { useState, useEffect } from "react";
import { Settings2, Loader2, Plus, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function EvaluationsConfig() {
  const [sources, setSources] = useState([]);
  const [testDefs, setTestDefs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.EvaluationSource.list("display_order", 50).catch(() => []),
      base44.entities.EvaluationTestDefinition.list("display_order", 50).catch(() => []),
    ]).then(([s, t]) => {
      setSources(s || []);
      setTestDefs(t || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-10 flex justify-center"><Loader2 size={20} className="text-zinc-500 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Sources */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings2 size={16} className="text-blue-400" />
            <h3 className="text-sm font-bold text-white">Fuentes de evaluación</h3>
          </div>
          <span className="text-xs text-zinc-500">{sources.length} fuente(s)</span>
        </div>
        {!sources.length ? (
          <p className="text-zinc-500 text-sm text-center py-6">No hay fuentes configuradas. ForceDecks se carga automáticamente al importar.</p>
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
                  {s.active ? <Check size={14} className="text-emerald-400" /> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test definitions */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">Pruebas definidas</h3>
          <span className="text-xs text-zinc-500">{testDefs.length} prueba(s)</span>
        </div>
        {!testDefs.length ? (
          <p className="text-zinc-500 text-sm text-center py-6">No hay pruebas definidas. Se detectan automáticamente al importar (CMJ, SJ, CMRJ).</p>
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Baseline config info */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-bold text-white mb-2">Configuración de líneas de base</h3>
        <p className="text-xs text-zinc-500">Las líneas de base se calculan automáticamente con los últimos resultados primarios de cada jugador. Se requieren mínimo 3 sesiones para considerar una línea de base suficiente. Los umbrales de señal (moderado/importante) se configuran por métrica desde esta sección en una próxima iteración.</p>
      </div>
    </div>
  );
}