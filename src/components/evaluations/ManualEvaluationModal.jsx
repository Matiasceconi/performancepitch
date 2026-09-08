import React, { useEffect, useMemo, useState } from "react";
import { X, Plus, Minus, Search, ClipboardPlus } from "lucide-react";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { evaluationsGateway } from "@/lib/evaluationsApi";

function nameOf(p) { return p?.full_name || p?.name || [p?.first_name,p?.last_name].filter(Boolean).join(" ") || "Jugador"; }
function todayBA() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()); }

export default function ManualEvaluationModal({ onClose, onSaved }) {
  const { activeSquad } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tests, setTests] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [attemptCount, setAttemptCount] = useState(3);
  const [values, setValues] = useState({});
  const [form, setForm] = useState({ assessment_date: todayBA(), assessment_time: "", context: "", session_name: "", test_key: "" });

  useEffect(() => {
    if (!activeSquad?.id) return;
    setLoading(true);
    Promise.all([
      evaluationsGateway("config", { squad_id: activeSquad.id }),
      evaluationsGateway("sessions", { squad_id: activeSquad.id }),
    ]).then(([config, squad]) => {
      const deduped = [...new Map((config.test_definitions || []).filter((t)=>t.active!==false).map((t)=>[t.test_key,t])).values()];
      setTests(deduped);
      setMetrics((config.metric_definitions || []).filter((m)=>m.active!==false));
      setPlayers((squad.players || []).sort((a,b)=>nameOf(a).localeCompare(nameOf(b))));
      if (deduped[0]) setForm((f)=>({...f,test_key:deduped[0].test_key}));
    }).catch((e)=>setError(e?.message || "No se pudo preparar la carga manual")).finally(()=>setLoading(false));
  }, [activeSquad?.id]);

  const test = tests.find((t)=>t.test_key===form.test_key);
  const applicableMetrics = useMemo(() => metrics.filter((m)=>!m.test_keys?.length || m.test_keys.includes(form.test_key)), [metrics,form.test_key]);

  useEffect(() => {
    if (!form.test_key) return;
    const priority = (test?.priority_metrics || []).filter((key)=>applicableMetrics.some((m)=>m.metric_key===key));
    const fallback = applicableMetrics.slice(0, Math.max(1, 4-priority.length)).map((m)=>m.metric_key);
    setSelectedMetrics([...new Set([...priority,...fallback])].slice(0,6));
    setValues({});
  }, [form.test_key]);

  const filteredPlayers = players.filter((p)=>nameOf(p).toLowerCase().includes(search.toLowerCase()));
  const metricMap = new Map(metrics.map((m)=>[m.metric_key,m]));

  function togglePlayer(id) { setSelectedPlayers((prev)=>prev.includes(id)?prev.filter((x)=>x!==id):[...prev,id]); }
  function setMetricValue(playerId, attemptIndex, metricKey, value) {
    setValues((prev) => {
      const player = prev[playerId] || { attempts: [] };
      const attempts = Array.from({length:attemptCount},(_,i)=>player.attempts?.[i] || { metrics:{} });
      attempts[attemptIndex] = { ...attempts[attemptIndex], metrics: { ...(attempts[attemptIndex]?.metrics||{}), [metricKey]: value } };
      return { ...prev, [playerId]: { attempts } };
    });
  }
  function toggleMetric(key) { setSelectedMetrics((prev)=>prev.includes(key)?prev.filter((x)=>x!==key):[...prev,key]); }

  async function save() {
    setError("");
    if (!form.test_key || !selectedPlayers.length || !selectedMetrics.length) { setError("Seleccioná prueba, jugadores y al menos una métrica."); return; }
    const entries = selectedPlayers.map((playerId) => ({
      player_id: playerId,
      test_side: test?.side_mode === "unilateral" ? "Bilateral" : "Bilateral",
      attempts: Array.from({length:attemptCount},(_,i)=>({
        attempt_number:i+1,
        metrics:Object.fromEntries(selectedMetrics.map((key)=>[key, values[playerId]?.attempts?.[i]?.metrics?.[key] ?? ""]).filter(([,v])=>v!=="" && v!=null)),
      })),
    })).filter((entry)=>entry.attempts.some((a)=>Object.keys(a.metrics).length));
    if (!entries.length) { setError("Ingresá al menos un valor antes de guardar."); return; }
    setSaving(true);
    try {
      await evaluationsGateway("manual_create", { squad_id: activeSquad.id, evaluation: { ...form, entries } });
      onSaved?.(); onClose?.();
    } catch(e) { setError(e?.message || "No se pudo guardar la evaluación"); }
    finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3" onClick={onClose}>
    <div className="w-full max-w-6xl max-h-[94vh] overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl" onClick={(e)=>e.stopPropagation()}>
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-5 py-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center"><ClipboardPlus size={19} className="text-emerald-400"/></div><div><h2 className="text-lg font-bold text-white">Nueva evaluación manual</h2><p className="text-xs text-zinc-500">Usa el mismo catálogo, intentos y regla de mejor intento que las importaciones.</p></div></div><button onClick={onClose} className="p-2 text-zinc-500 hover:text-white"><X size={19}/></button></div>
      {loading ? <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin"/></div> : <div className="p-5 space-y-5">
        {error&&<div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
        <section className="grid md:grid-cols-5 gap-3"><Field label="Fecha"><input type="date" value={form.assessment_date} onChange={(e)=>setForm({...form,assessment_date:e.target.value})} className="input"/></Field><Field label="Hora"><input type="time" value={form.assessment_time} onChange={(e)=>setForm({...form,assessment_time:e.target.value})} className="input"/></Field><Field label="Prueba"><select value={form.test_key} onChange={(e)=>setForm({...form,test_key:e.target.value})} className="input">{tests.map((t)=><option key={t.test_key} value={t.test_key}>{t.name || t.test_key.toUpperCase()}</option>)}</select></Field><Field label="Contexto"><input value={form.context} onChange={(e)=>setForm({...form,context:e.target.value})} placeholder="Ej. MD-3 · control" className="input"/></Field><Field label="Nombre de batería"><input value={form.session_name} onChange={(e)=>setForm({...form,session_name:e.target.value})} placeholder="Automático si queda vacío" className="input"/></Field></section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3"><div><p className="text-sm font-semibold text-white">Métricas a cargar</p><p className="text-xs text-zinc-500">Las etiquetas vienen del catálogo; la clave técnica queda detrás.</p></div><div className="flex items-center gap-2"><span className="text-xs text-zinc-500">Intentos por jugador</span><button onClick={()=>setAttemptCount((n)=>Math.max(1,n-1))} className="p-1.5 rounded bg-zinc-800 text-zinc-300"><Minus size={13}/></button><b className="text-white text-sm w-5 text-center">{attemptCount}</b><button onClick={()=>setAttemptCount((n)=>Math.min(6,n+1))} className="p-1.5 rounded bg-zinc-800 text-zinc-300"><Plus size={13}/></button></div></div><div className="flex flex-wrap gap-2 mt-3">{applicableMetrics.map((m)=><button key={m.metric_key} onClick={()=>toggleMetric(m.metric_key)} className={`px-3 py-1.5 rounded-lg border text-xs ${selectedMetrics.includes(m.metric_key)?"border-blue-500/40 bg-blue-500/10 text-blue-200":"border-zinc-800 bg-zinc-950 text-zinc-500"}`}>{m.metric_label || m.metric_key}{m.unit?` (${m.unit})`:""}</button>)}</div>{applicableMetrics.length===0&&<p className="text-xs text-amber-400 mt-2">Esta prueba todavía no tiene métricas configuradas en el catálogo.</p>}</section>

        <section className="grid lg:grid-cols-[270px_1fr] gap-4"><div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden"><div className="p-3 border-b border-zinc-800"><div className="relative"><Search size={13} className="absolute left-2.5 top-2.5 text-zinc-600"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar jugador" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-2 py-2 text-xs text-white"/></div><p className="text-[10px] text-zinc-600 mt-2">{selectedPlayers.length} seleccionados</p></div><div className="max-h-[480px] overflow-y-auto divide-y divide-zinc-800">{filteredPlayers.map((p)=><label key={p.id} className="flex items-center gap-2 p-2.5 text-xs cursor-pointer hover:bg-zinc-800/50"><input type="checkbox" checked={selectedPlayers.includes(p.id)} onChange={()=>togglePlayer(p.id)} className="accent-blue-500"/><span className="text-zinc-200 flex-1 truncate">{nameOf(p)}</span><span className="text-zinc-600">{p.position||"—"}</span></label>)}</div></div>
          <div className="space-y-3">{selectedPlayers.length===0?<div className="rounded-xl border border-dashed border-zinc-800 p-12 text-center text-sm text-zinc-600">Seleccioná jugadores para abrir la planilla de intentos.</div>:selectedPlayers.map((pid)=>{const p=players.find((x)=>x.id===pid);return <div key={pid} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-x-auto"><div className="px-3 py-2 border-b border-zinc-800"><p className="text-sm font-semibold text-white">{nameOf(p)}</p><p className="text-[10px] text-zinc-600">{p?.position||"—"} · player_id vinculado</p></div><table className="w-full min-w-[650px] text-xs"><thead><tr className="text-zinc-500 bg-zinc-950/50"><th className="text-left p-2">Intento</th>{selectedMetrics.map((key)=><th key={key} className="text-left p-2">{metricMap.get(key)?.metric_label||key}<span className="text-zinc-700"> {metricMap.get(key)?.unit||""}</span></th>)}</tr></thead><tbody>{Array.from({length:attemptCount},(_,i)=><tr key={i} className="border-t border-zinc-800"><td className="p-2 text-zinc-400 font-semibold">#{i+1}</td>{selectedMetrics.map((key)=><td key={key} className="p-2"><input type="number" step="any" value={values[pid]?.attempts?.[i]?.metrics?.[key] ?? ""} onChange={(e)=>setMetricValue(pid,i,key,e.target.value)} className="w-full min-w-[105px] bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-white"/></td>)}</tr>)}</tbody></table></div>})}</div>
        </section>

        <div className="flex justify-end gap-2 border-t border-zinc-800 pt-4"><button onClick={onClose} className="px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300">Cancelar</button><button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-semibold text-white">{saving?"Guardando…":"Guardar evaluación"}</button></div>
      </div>}
    </div>
    <style>{`.input{width:100%;background:#18181b;border:1px solid #3f3f46;border-radius:.5rem;padding:.55rem .7rem;font-size:.75rem;color:white;outline:none}`}</style>
  </div>;
}
function Field({label,children}){return <div><label className="text-xs text-zinc-500 block mb-1.5">{label}</label>{children}</div>}
