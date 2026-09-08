import React, { useEffect, useMemo, useState } from "react";
import { Activity, BookOpen, Dumbbell, Gauge, Search, ShieldAlert, TimerReset, Waypoints } from "lucide-react";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { evaluationsGateway } from "@/lib/evaluationsApi";

const DOMAIN_META = {
  jump_power: { label: "Salto y potencia", icon: Activity },
  speed_acceleration: { label: "Velocidad y aceleración", icon: Gauge },
  change_of_direction: { label: "Cambio de dirección", icon: Waypoints },
  max_strength: { label: "Fuerza máxima", icon: Dumbbell },
  eccentric_strength: { label: "Fuerza excéntrica", icon: Dumbbell },
  adductor_groin: { label: "Aductores / groin", icon: Dumbbell },
  intermittent_fitness: { label: "Capacidad intermitente", icon: TimerReset },
  repeated_sprint: { label: "Repeated sprint", icon: TimerReset },
  mobility: { label: "Movilidad", icon: Activity },
  anthropometry: { label: "Antropometría", icon: Activity },
  other: { label: "Otros", icon: BookOpen },
};

function domainMeta(key) { return DOMAIN_META[key] || DOMAIN_META.other; }

export default function EvaluationTestLibrary() {
  const { activeSquad } = useWorkspace();
  const [tests, setTests] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeSquad?.id) return;
    setLoading(true);
    evaluationsGateway("config", { squad_id: activeSquad.id })
      .then((data) => {
        setTests((data.test_definitions || []).filter((item) => item.active !== false));
        setMetrics((data.metric_definitions || []).filter((item) => item.active !== false));
        setTemplates((data.battery_templates || []).filter((item) => item.active !== false));
      })
      .finally(() => setLoading(false));
  }, [activeSquad?.id]);

  const metricMap = useMemo(() => new Map(metrics.map((metric) => [metric.metric_key, metric])), [metrics]);
  const domains = useMemo(() => [...new Set(tests.map((test) => test.performance_domain || "other"))], [tests]);
  const filtered = useMemo(() => tests.filter((test) => {
    if (domain !== "all" && (test.performance_domain || "other") !== domain) return false;
    if (!search) return true;
    const hay = [test.name, test.short_name, test.test_key, test.protocol_summary, test.equipment, ...(test.purpose_tags || [])].join(" ").toLowerCase();
    return hay.includes(search.toLowerCase());
  }), [tests, domain, search]);

  if (loading) return <div className="py-16 text-center text-sm text-zinc-500">Cargando biblioteca…</div>;

  return <div className="space-y-5">
    <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-2.5"><BookOpen size={18} className="text-blue-300" /></div>
          <div><h2 className="text-base font-bold text-white">Biblioteca de evaluaciones</h2><p className="mt-1 text-sm text-zinc-400">La prueba define el protocolo y la métrica define qué se interpreta. El proveedor es sólo la fuente de medición.</p></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1"><Search size={14} className="absolute left-3 top-3 text-zinc-600" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar prueba, protocolo o objetivo…" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 pl-9 pr-3 text-sm text-white" /></div>
          <select value={domain} onChange={(e) => setDomain(e.target.value)} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-300"><option value="all">Todos los dominios</option>{domains.map((key) => <option key={key} value={key}>{domainMeta(key).label}</option>)}</select>
        </div>
      </div>
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 text-amber-200"><ShieldAlert size={16}/><p className="text-sm font-semibold">Regla de interpretación</p></div>
        <p className="mt-2 text-xs leading-5 text-zinc-400">PerformancePitch muestra tendencias, referencias y variabilidad. No transforma una caída puntual, una asimetría o un test aislado en diagnóstico médico ni predicción automática de lesión.</p>
      </div>
    </div>

    {templates.length > 0 && <section className="space-y-2"><div><h3 className="text-xs font-black uppercase tracking-wider text-zinc-500">Baterías sugeridas</h3><p className="mt-1 text-xs text-zinc-600">Son plantillas editables; no obligan a ejecutar todas las pruebas el mismo día.</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{templates.map((template) => <div key={template.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"><p className="text-sm font-semibold text-white">{template.name}</p><p className="mt-1 text-xs text-zinc-500 line-clamp-2">{template.description}</p><div className="mt-3 flex flex-wrap gap-1">{(template.test_keys || []).map((key) => <span key={key} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-300">{key}</span>)}</div></div>)}</div></section>}

    <section className="grid gap-3 lg:grid-cols-2">
      {filtered.map((test) => {
        const meta = domainMeta(test.performance_domain || "other");
        const Icon = meta.icon;
        const testMetrics = [...new Set([...(test.priority_metrics || []), ...(test.asymmetry_metrics || [])])].map((key) => metricMap.get(key)).filter(Boolean);
        return <article key={test.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="rounded-xl border border-zinc-700 bg-zinc-950 p-2"><Icon size={17} className="text-zinc-300" /></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-white">{test.name}</h3><span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-300">{test.short_name || test.test_key}</span></div><p className="mt-0.5 text-xs text-zinc-500">{meta.label} · {test.side_mode === "unilateral" ? "unilateral" : test.side_mode === "bilateral" ? "bilateral" : "sin lado"}</p></div></div>{test.maturity_sensitive && <span title="Contextualizar por maduración biológica en juveniles" className="rounded-lg border border-violet-500/20 bg-violet-500/10 px-2 py-1 text-[10px] text-violet-300">Maduración sensible</span>}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><Info label="Protocolo" value={test.protocol_summary || "Definir protocolo interno"}/><Info label="Equipamiento" value={test.equipment || "No definido"}/><Info label="Intentos" value={`${test.default_attempts || 1}${test.rest_seconds ? ` · ${test.rest_seconds}s recuperación` : ""}`}/><Info label="Resumen" value={test.aggregation_method === "best" ? "Mejor intento" : test.aggregation_method === "last" ? "Último resultado" : test.aggregation_method || "Definir"}/></div>
          {testMetrics.length > 0 && <div className="mt-4"><p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">Métricas principales</p><div className="mt-2 flex flex-wrap gap-2">{testMetrics.map((metric) => <span key={metric.id} title={metric.description || ""} className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-300">{metric.metric_label}{metric.unit ? ` · ${metric.unit}` : ""}</span>)}</div></div>}
          {test.evidence_note && <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs leading-5 text-zinc-500">{test.evidence_note}</div>}
        </article>;
      })}
    </section>
    {filtered.length === 0 && <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center text-sm text-zinc-600">No hay pruebas con estos filtros.</div>}
  </div>;
}

function Info({ label, value }) { return <div><p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">{label}</p><p className="mt-1 text-xs leading-5 text-zinc-300">{value}</p></div>; }
