import React, { useMemo, useState } from "react";
import { CheckCircle2, History, Loader2, RotateCcw, Star } from "lucide-react";
import { fmtDate, fmtVal } from "@/lib/evaluationChartUtils";
import { evaluationsGateway } from "@/lib/evaluationsApi";

export default function FullDataMode({ data, squadId, onPrimaryChanged }) {
  const { results, metric_definitions: metricDefinitions, capabilities, audit_events: auditEvents } = data;
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const defMap = new Map((metricDefinitions || []).map((metric) => [metric.metric_key, metric]));
  const groups = useMemo(() => {
    const map = new Map();
    for (const result of results || []) {
      const key = [result.session_id, result.test_key, result.test_side || "Bilateral"].join("|");
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(result);
    }
    return [...map.values()].map((group) => group.sort((left, right) => Number(left.attempt_number || 1) - Number(right.attempt_number || 1)));
  }, [results]);

  if (!results?.length) return <EmptyState message="Sin resultados para este jugador" />;

  async function setPrimary(result) {
    const reason = window.prompt("Motivo obligatorio para elegir este intento como principal:");
    if (!reason?.trim()) return;
    setBusyId(result.result_id);
    setError("");
    try {
      await evaluationsGateway("set_primary", { squad_id: squadId, result_id: result.result_id, reason: reason.trim() });
      await onPrimaryChanged?.();
    } catch (e) { setError(e.message || "No se pudo cambiar el intento principal"); }
    finally { setBusyId(null); }
  }

  async function restoreAutomatic(result) {
    if (!window.confirm("¿Restaurar el intento principal calculado por la regla vigente?")) return;
    setBusyId(result.result_id);
    setError("");
    try {
      await evaluationsGateway("restore_primary", { squad_id: squadId, result_id: result.result_id });
      await onPrimaryChanged?.();
    } catch (e) { setError(e.message || "No se pudo restaurar la selección automática"); }
    finally { setBusyId(null); }
  }

  const rows = [];
  for (const result of results) {
    const metrics = result.metrics || {};
    const asymmetries = result.asymmetries || {};
    for (const metricKey of [...new Set([...Object.keys(metrics), ...Object.keys(asymmetries)])].sort()) {
      const definition = defMap.get(metricKey) || {};
      const asymmetry = asymmetries[metricKey];
      rows.push({ ...result, metric_key: metricKey, metric_label: definition.metric_label || metricKey, unit: definition.unit || "", value: metrics[metricKey] ?? null, asymmetry_magnitude: asymmetry?.magnitude, asymmetry_direction: asymmetry?.direction });
    }
  }

  return <div className="space-y-4">
    {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">{error}</div>}
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3"><Star size={16} className="text-amber-400" /><div><h3 className="text-sm font-bold text-white">Intento principal por prueba</h3><p className="text-xs text-zinc-500">La regla automática se conserva en auditoría. Una elección manual exige motivo y puede restaurarse.</p></div></div>
      <div className="space-y-3">{groups.map((group) => {
        const primary = group.find((result) => result.is_primary);
        return <div key={[group[0].session_id, group[0].test_key, group[0].test_side].join("|")} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3"><div className="flex items-center justify-between gap-2 mb-2"><div><p className="text-xs text-white font-semibold">{fmtDate(group[0].assessment_date, true)} · {String(group[0].test_key).toUpperCase()} · {group[0].test_side || "Bilateral"}</p><p className="text-[10px] text-zinc-500">{group.length} intento(s) · {primary?.primary_reason || "Sin regla informada"}</p></div>{primary && <PrimaryBadge result={primary} />}</div><div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">{group.map((result) => <AttemptCard key={result.result_id} result={result} defMap={defMap} canEdit={capabilities?.can_edit} busy={busyId === result.result_id} onSelect={() => setPrimary(result)} onRestore={() => restoreAutomatic(result)} />)}</div></div>;
      })}</div>
    </div>

    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="bg-zinc-950/50 border-b border-zinc-800"><th className="text-left p-2.5 font-semibold text-zinc-500 sticky left-0 bg-zinc-950/50">Fecha</th><th className="text-left p-2.5 font-semibold text-zinc-500">Prueba</th><th className="text-center p-2.5 font-semibold text-zinc-500">Intento</th><th className="text-center p-2.5 font-semibold text-zinc-500">Principal</th><th className="text-left p-2.5 font-semibold text-zinc-500">Métrica</th><th className="text-right p-2.5 font-semibold text-zinc-500">Valor</th><th className="text-left p-2.5 font-semibold text-zinc-500">Unidad</th><th className="text-right p-2.5 font-semibold text-zinc-500">Asimetría</th><th className="text-center p-2.5 font-semibold text-zinc-500">Calidad</th><th className="text-left p-2.5 font-semibold text-zinc-500">Archivo</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.result_id}:${row.metric_key}`} className="border-b border-zinc-800/40 hover:bg-zinc-800/20"><td className="p-2.5 text-zinc-300 sticky left-0 bg-zinc-900 whitespace-nowrap">{fmtDate(row.assessment_date, true)}</td><td className="p-2.5"><span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 font-bold uppercase text-[10px]">{row.test_key}</span><span className="ml-1 text-zinc-500">{row.test_side}</span></td><td className="p-2.5 text-center text-zinc-400">{row.attempt_number}{row.retest ? " (R)" : ""}</td><td className="p-2.5 text-center">{row.is_primary ? <span className={row.primary_selection_mode === "manual" ? "text-amber-300" : "text-emerald-300"}>{row.primary_selection_mode === "manual" ? "Manual" : "Auto"}</span> : "—"}</td><td className="p-2.5 text-zinc-300">{row.metric_label}</td><td className="p-2.5 text-right text-white font-semibold tabular-nums">{row.value != null ? fmtVal(row.value) : "—"}</td><td className="p-2.5 text-zinc-500">{row.unit}</td><td className="p-2.5 text-right text-zinc-300">{row.asymmetry_magnitude != null ? `${fmtVal(row.asymmetry_magnitude)} ${row.asymmetry_direction || ""}` : "—"}</td><td className="p-2.5 text-center"><QualityBadge value={row.quality_status} /></td><td className="p-2.5 text-zinc-500 truncate max-w-[140px]" title={row.file_name}>{row.file_name || "—"}</td></tr>)}</tbody></table></div></div>

    {!!auditEvents?.length && <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"><div className="flex items-center gap-2 mb-3"><History size={16} className="text-zinc-400" /><h3 className="text-sm font-bold text-white">Auditoría reciente</h3></div><div className="space-y-2">{auditEvents.slice(0, 12).map((event) => <div key={event.id || event.event_id} className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-zinc-950/40 border border-zinc-800"><div><p className="text-xs text-zinc-200">{event.reason || event.event_type}</p><p className="text-[10px] text-zinc-500">{event.actor_name || event.actor_email || "Sistema"} · {event.test_key ? String(event.test_key).toUpperCase() : "evaluaciones"}</p></div><span className="text-[10px] text-zinc-600 whitespace-nowrap">{event.created_at ? new Date(event.created_at).toLocaleString("es-AR") : ""}</span></div>)}</div></div>}
  </div>;
}

function AttemptCard({ result, defMap, canEdit, busy, onSelect, onRestore }) {
  const metrics = Object.entries(result.metrics || {}).slice(0, 4);
  return <div className={`p-3 rounded-lg border ${result.is_primary ? "border-emerald-500/40 bg-emerald-500/5" : "border-zinc-800 bg-zinc-900"}`}><div className="flex items-center justify-between"><p className="text-xs font-semibold text-white">Intento {result.attempt_number || 1}{result.retest ? " · Retest" : ""}</p>{result.is_primary && <CheckCircle2 size={15} className={result.primary_selection_mode === "manual" ? "text-amber-400" : "text-emerald-400"} />}</div><div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">{metrics.map(([key, value]) => <div key={key} className="min-w-0"><p className="text-[9px] text-zinc-600 truncate">{defMap.get(key)?.metric_label || key}</p><p className="text-xs text-zinc-200 tabular-nums">{fmtVal(value)} {defMap.get(key)?.unit || ""}</p></div>)}</div>{result.primary_review_required && <p className="text-[10px] text-amber-300 mt-2">Hay un candidato automático nuevo para revisar.</p>}{canEdit && <div className="mt-3">{!result.is_primary ? <button onClick={onSelect} disabled={busy} className="px-2.5 py-1.5 rounded bg-blue-600 text-white text-[11px] disabled:opacity-50 flex items-center gap-1.5">{busy ? <Loader2 size={12} className="animate-spin" /> : <Star size={12} />}Elegir como principal</button> : result.primary_selection_mode === "manual" ? <button onClick={onRestore} disabled={busy} className="px-2.5 py-1.5 rounded bg-zinc-800 text-zinc-300 text-[11px] disabled:opacity-50 flex items-center gap-1.5">{busy ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}Restaurar automático</button> : null}</div>}</div>;
}

function PrimaryBadge({ result }) {
  const manual = result.primary_selection_mode === "manual";
  return <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${manual ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>{manual ? "Principal manual" : "Principal automático"}</span>;
}

function QualityBadge({ value }) {
  const cls = value === "ok" ? "bg-emerald-500/15 text-emerald-300" : value === "warning" ? "bg-yellow-500/15 text-yellow-300" : "bg-red-500/15 text-red-300";
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls}`}>{value || "—"}</span>;
}

function EmptyState({ message }) { return <div className="py-10 text-center"><p className="text-zinc-500 text-sm">{message}</p></div>; }
