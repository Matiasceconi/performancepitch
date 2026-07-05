import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Calendar, ChevronLeft, ChevronRight, Copy, Download, GripVertical, Layers, Plus, Printer, Save, Sparkles, Trash2, X } from "lucide-react";
import moment from "moment";
import "moment/locale/es";
import { useToast } from "@/components/ui/use-toast";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { MICROCycle_TEMPLATES, TEMPLATE_BLOCKS } from "@/components/planning/microcycleTemplates";

moment.locale("es");

const WEEKDAY_NAMES_ES = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
const MD_OPTIONS = ["— MD —", "MD-6", "MD-5", "MD-4", "MD-3", "MD-2", "MD-1", "MD", "MD+1", "MD+2", "MD+3", "MD+4"];
const WEEK_TYPES = ["Normal", "Semana corta", "Semana larga", "Doble competencia", "Descarga", "Pretemporada"];
const GRAPH_TYPES = [{ id: "barras", label: "Barras" }, { id: "linea", label: "Línea" }, { id: "area", label: "Área" }, { id: "radar", label: "Radar" }];
const BLOCK_TYPES = ["Objetivo físico", "Objetivo táctico", "Campo", "Gimnasio", "Compensatorio", "Vuelta a la calma", "Recuperación", "Partido", "Observaciones", "Personalizado"];
const BLOCK_COLORS = {
  "Objetivo físico": "#2563eb",
  "Objetivo táctico": "#7c3aed",
  Campo: "#16a34a",
  Gimnasio: "#0f172a",
  Compensatorio: "#ea580c",
  "Vuelta a la calma": "#0891b2",
  Recuperación: "#8b5cf6",
  Partido: "#14532d",
  Observaciones: "#64748b",
  Personalizado: "#52525b",
};

function uid() { return Math.random().toString(36).slice(2, 10); }
function dayName(date) { return WEEKDAY_NAMES_ES[moment(date).day()] || "DÍA"; }
function defaultMeta(startDate) {
  const start = moment(startDate);
  const end = start.clone().add(6, "days");
  return {
    week_number: String(start.isoWeek()),
    range_label: `${start.format("DD/MM/YYYY")} - ${end.format("DD/MM/YYYY")}`,
    next_match: "",
    current_md: "— MD —",
    week_type: "Normal",
  };
}
function emptyBlock(type = "Campo", content = "") {
  return { id: uid(), type, title: type, content, color: BLOCK_COLORS[type] || BLOCK_COLORS.Personalizado, session_id: "", auto_sync: true };
}
function emptyDay(date, index = 0) {
  return { date, md: MD_OPTIONS[Math.min(index + 1, MD_OPTIONS.length - 1)] || "— MD —", blocks: [emptyBlock("Campo"), emptyBlock("Observaciones")] };
}
function normalizeDay(day, fallbackDate, index) {
  if (Array.isArray(day?.blocks)) return { ...emptyDay(fallbackDate, index), ...day, blocks: day.blocks.map(b => ({ ...emptyBlock(b.type || "Personalizado"), ...b, id: b.id || uid() })) };
  const blocks = [];
  if (day?.objetivo && day.objetivo !== "—") blocks.push(emptyBlock("Objetivo físico", day.objetivo));
  if (day?.sesionGimnasio) blocks.push(emptyBlock("Gimnasio", day.sesionGimnasio));
  if (day?.trabajoCompensatorio && day.trabajoCompensatorio !== "—") blocks.push(emptyBlock("Compensatorio", day.trabajoCompensatorio));
  if ((day?.vueltaCalma || []).length) blocks.push(emptyBlock("Vuelta a la calma", day.vueltaCalma.join("\n")));
  if ((day?.tareasTecnico || []).some(Boolean)) blocks.push(emptyBlock("Objetivo táctico", day.tareasTecnico.filter(Boolean).join("\n")));
  if (day?.observaciones) blocks.push(emptyBlock("Observaciones", day.observaciones));
  return { ...emptyDay(fallbackDate, index), ...day, blocks: blocks.length ? blocks : emptyDay(fallbackDate, index).blocks };
}
function sessionLoad(session) {
  const duration = Number(session?.duration_minutes || 60);
  const type = `${session?.session_type || ""} ${session?.objective || ""} ${session?.session_objective || ""}`.toLowerCase();
  const multiplier = type.includes("partido") ? 1.8 : type.includes("velocidad") ? 1.35 : type.includes("fuerza") ? 0.75 : type.includes("regener") ? 0.45 : 1;
  return {
    total_distance: Math.round(duration * 78 * multiplier),
    distance_19_8: Math.round(duration * 7.5 * multiplier),
    distance_25: Math.round(duration * 2.2 * multiplier),
    acc_3: Math.round(duration * 0.26 * multiplier),
    dec_3: Math.round(duration * 0.24 * multiplier),
    player_load: Math.round(duration * 7.8 * multiplier),
  };
}
function addLoads(a, b) {
  return Object.fromEntries(["total_distance", "distance_19_8", "distance_25", "acc_3", "dec_3", "player_load"].map(k => [k, (a[k] || 0) + (b[k] || 0)]));
}
function compactNumber(value) { return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value || 0)); }
function blockSession(block, sessionsById) { return block.auto_sync === false && block.session_snapshot ? block.session_snapshot : sessionsById[block.session_id]; }

function MicrocycleExportView({ days, meta, dayLoads, summary, onExit }) {
  return <div className="min-h-screen bg-white text-zinc-950 p-6 print:p-0">
    <style>{`@media print { .no-print { display: none !important; } body { background: white !important; } }`}</style>
    <div className="no-print flex justify-end gap-2 mb-4">
      <button onClick={() => window.print()} className="px-3 py-2 bg-zinc-900 text-white rounded-lg text-sm flex items-center gap-2"><Printer size={15} /> Imprimir / PDF</button>
      <button onClick={onExit} className="px-3 py-2 bg-zinc-200 rounded-lg text-sm">Volver</button>
    </div>
    <div className="border-b-4 border-emerald-700 pb-4 mb-5 flex justify-between items-start">
      <div><p className="text-xs font-bold text-emerald-700 uppercase">PerformancePitch</p><h1 className="text-3xl font-black">Plan de Microciclo</h1><p className="text-sm text-zinc-600">Semana {meta.week_number} · {meta.range_label}</p></div>
      <div className="text-right text-sm"><p className="font-bold">{meta.week_type}</p><p>{meta.current_md}</p><p>{meta.next_match}</p></div>
    </div>
    <div className="grid grid-cols-7 gap-2 mb-5">
      {days.map((day, idx) => <div key={idx} className="border rounded-xl overflow-hidden break-inside-avoid">
        <div className="bg-emerald-900 text-white p-2 text-center"><p className="text-xs font-bold">{dayName(day.date)}</p><p className="text-lg font-black">{moment(day.date).format("DD/MM")}</p><p className="text-xs text-emerald-200">{day.md}</p></div>
        <div className="p-2 space-y-2 min-h-[230px]">
          {(day.blocks || []).map(block => <div key={block.id} className="border-l-4 rounded bg-zinc-50 p-2" style={{ borderColor: block.color }}>
            <p className="text-[10px] font-black uppercase" style={{ color: block.color }}>{block.title}</p>
            <p className="text-xs whitespace-pre-wrap mt-1">{block.content || "—"}</p>
          </div>)}
        </div>
        <div className="bg-zinc-100 p-2 text-[10px] font-bold">DT {compactNumber(dayLoads[idx]?.total_distance)} · PL {compactNumber(dayLoads[idx]?.player_load)}</div>
      </div>)}
    </div>
    <div className="grid grid-cols-3 gap-3"><div className="border rounded-xl p-3"><p className="text-xs font-black text-emerald-700 uppercase">Resumen automático</p><p className="text-sm mt-2 whitespace-pre-wrap">{summary}</p></div><div className="border rounded-xl p-3 col-span-2"><LoadChart data={dayLoads} type="barras" clean /></div></div>
  </div>;
}

function LoadChart({ data, type, clean = false }) {
  const chartData = data.map(d => ({ day: d.day, Carga: Math.round(d.player_load || 0), Distancia: Math.round((d.total_distance || 0) / 100) }));
  const text = clean ? "#111827" : "#a1a1aa";
  if (type === "radar") return <ResponsiveContainer width="100%" height={260}><RadarChart data={chartData}><PolarGrid stroke="#334155" /><PolarAngleAxis dataKey="day" tick={{ fill: text, fontSize: 10 }} /><Radar dataKey="Carga" stroke="#22c55e" fill="#22c55e" fillOpacity={0.35} /></RadarChart></ResponsiveContainer>;
  const common = <><CartesianGrid strokeDasharray="3 3" stroke={clean ? "#e5e7eb" : "#27272a"} /><XAxis dataKey="day" tick={{ fill: text, fontSize: 11 }} /><YAxis tick={{ fill: text, fontSize: 10 }} /><Tooltip /></>;
  if (type === "linea") return <ResponsiveContainer width="100%" height={260}><LineChart data={chartData}>{common}<Line type="monotone" dataKey="Carga" stroke="#22c55e" strokeWidth={3} /></LineChart></ResponsiveContainer>;
  if (type === "area") return <ResponsiveContainer width="100%" height={260}><AreaChart data={chartData}>{common}<Area type="monotone" dataKey="Carga" stroke="#22c55e" fill="#22c55e" fillOpacity={0.28} /></AreaChart></ResponsiveContainer>;
  return <ResponsiveContainer width="100%" height={260}><BarChart data={chartData}>{common}<Bar dataKey="Carga" fill="#22c55e" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer>;
}

export default function WeeklyPlannerBoard() {
  const { toast } = useToast();
  const { activeSquadId, activeSquad, activeSeasonId } = useWorkspace();
  const aiInputRef = useRef(null);
  const [startDate, setStartDate] = useState(moment().startOf("isoWeek").format("YYYY-MM-DD"));
  const [days, setDays] = useState(() => Array.from({ length: 7 }, (_, i) => emptyDay(moment().startOf("isoWeek").add(i, "days").format("YYYY-MM-DD"), i)));
  const [meta, setMeta] = useState(defaultMeta(moment().startOf("isoWeek").format("YYYY-MM-DD")));
  const [graphType, setGraphType] = useState("barras");
  const [recordId, setRecordId] = useState(null);
  const [sessionLibrary, setSessionLibrary] = useState([]);
  const [sessionDetails, setSessionDetails] = useState({});
  const [savedPlans, setSavedPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [exportMode, setExportMode] = useState(false);

  useEffect(() => {
    async function loadPlans() {
      const all = await base44.entities.WeeklyPlan.list("-week_start", 100);
      setSavedPlans(activeSquadId ? all.filter(r => r.squad_id === activeSquadId && (!r.season_id || !activeSeasonId || r.season_id === activeSeasonId)) : all);
    }
    loadPlans();
  }, [activeSquadId, activeSeasonId, recordId]);

  useEffect(() => {
    async function loadPlan() {
      setLoading(true);
      const all = await base44.entities.WeeklyPlan.filter({ week_start: startDate });
      const records = activeSquadId ? all.filter(r => r.squad_id === activeSquadId && (!r.season_id || !activeSeasonId || r.season_id === activeSeasonId)) : all;
      const rec = records[0];
      if (rec) {
        setRecordId(rec.id);
        setMeta({ ...defaultMeta(startDate), ...(rec.microcycle_meta || {}) });
        setGraphType(rec.graph_type || "barras");
        const loaded = (rec.days_data || []).map((d, i) => normalizeDay(d, moment(startDate).add(i, "days").format("YYYY-MM-DD"), i));
        setDays(loaded.length ? loaded : Array.from({ length: 7 }, (_, i) => emptyDay(moment(startDate).add(i, "days").format("YYYY-MM-DD"), i)));
      } else {
        setRecordId(null);
        setMeta(defaultMeta(startDate));
        setGraphType("barras");
        setDays(Array.from({ length: 7 }, (_, i) => emptyDay(moment(startDate).add(i, "days").format("YYYY-MM-DD"), i)));
      }
      setLoading(false);
    }
    loadPlan();
  }, [startDate, activeSquadId, activeSeasonId]);

  useEffect(() => {
    async function loadSessions() {
      const all = await base44.entities.TrainingSession.list("-date", 300);
      setSessionLibrary(all.filter(s => (!activeSquadId || s.squad_id === activeSquadId) && (!activeSeasonId || !s.season_id || s.season_id === activeSeasonId)));
    }
    loadSessions();
  }, [activeSquadId, activeSeasonId]);

  useEffect(() => {
    async function detectMatchFromCalendar() {
      const all = await base44.entities.DayEvent.list("date", 500);
      const match = all.find(ev =>
        ev.date >= days[0]?.date && ev.date <= days[days.length - 1]?.date &&
        (!activeSquadId || ev.squad_id === activeSquadId) &&
        (!activeSeasonId || !ev.season_id || ev.season_id === activeSeasonId) &&
        `${ev.event_type || ev.type || ev.title || ""}`.toLowerCase().includes("partido")
      );
      if (match) setMeta(prev => prev.next_match ? prev : { ...prev, next_match: match.rival ? `vs ${match.rival}` : match.title || "Partido" });
    }
    if (days.length) detectMatchFromCalendar();
  }, [days[0]?.date, days[days.length - 1]?.date, activeSquadId, activeSeasonId]);

  const sessionsById = useMemo(() => Object.fromEntries(sessionLibrary.map(s => [s.id, s])), [sessionLibrary]);
  const linkedSessionIds = useMemo(() => [...new Set(days.flatMap(d => (d.blocks || []).map(b => b.session_id).filter(Boolean)))], [days]);

  useEffect(() => {
    async function loadDetails() {
      const entries = await Promise.all(linkedSessionIds.map(async id => {
        const [strength, exercises] = await Promise.all([
          base44.entities.StrengthStation.filter({ session_id: id }, "order"),
          base44.entities.SessionExercise.filter({ session_id: id }, "order"),
        ]);
        return [id, { strength, exercises }];
      }));
      setSessionDetails(Object.fromEntries(entries));
    }
    if (linkedSessionIds.length) loadDetails(); else setSessionDetails({});
  }, [linkedSessionIds.join("|")]);

  const dayLoads = useMemo(() => days.map(day => {
    const load = (day.blocks || []).reduce((acc, block) => {
      const session = block.session_id ? blockSession(block, sessionsById) : null;
      return session ? addLoads(acc, sessionLoad(session)) : acc;
    }, {});
    return { ...load, day: dayName(day.date).slice(0, 3), date: day.date };
  }), [days, sessionsById]);

  const summary = useMemo(() => {
    const total = dayLoads.reduce((sum, d) => sum + (d.player_load || 0), 0);
    const peak = dayLoads.reduce((a, b) => (b.player_load || 0) > (a.player_load || 0) ? b : a, dayLoads[0] || {});
    const recovery = days.find(d => (d.blocks || []).some(b => ["Recuperación", "Vuelta a la calma"].includes(b.type))) || days[dayLoads.findIndex(d => (d.player_load || 0) === Math.min(...dayLoads.map(x => x.player_load || 0)))] || days[0];
    const field = days.flatMap(d => d.blocks || []).filter(b => b.type === "Campo" || sessionsById[b.session_id]?.session_type === "Campo").length;
    const gym = days.flatMap(d => d.blocks || []).filter(b => b.type === "Gimnasio" || sessionsById[b.session_id]?.session_type === "Fuerza").length;
    const status = total > 3500 ? "Alta demanda" : total < 1600 ? "Descarga / baja carga" : "Equilibrada";
    return { total, peak, recovery, field, gym, status };
  }, [days, dayLoads, sessionsById]);

  const autoText = `La semana queda estructurada como ${meta.week_type}. El pico principal aparece el ${summary.peak?.day || "—"}, con una carga semanal aproximada de ${compactNumber(summary.total)} PL. Se planifican ${summary.field} bloques de campo y ${summary.gym} bloques de gimnasio. El día de recuperación queda ubicado en ${summary.recovery?.date ? dayName(summary.recovery.date) : "—"}. Estado general: ${summary.status}.`;

  function updateDay(idx, patch) { setDays(prev => prev.map((d, i) => i === idx ? { ...d, ...patch } : d)); }
  function updateBlock(dayIdx, blockId, patch) {
    setDays(prev => prev.map((d, i) => i !== dayIdx ? d : { ...d, blocks: d.blocks.map(b => b.id === blockId ? { ...b, ...patch } : b) }));
  }
  function addBlock(dayIdx, type = "Campo") { updateDay(dayIdx, { blocks: [...days[dayIdx].blocks, emptyBlock(type)] }); }
  function duplicateBlock(dayIdx, block) { updateDay(dayIdx, { blocks: [...days[dayIdx].blocks, { ...block, id: uid(), title: `${block.title} copia` }] }); }
  function deleteBlock(dayIdx, blockId) { updateDay(dayIdx, { blocks: days[dayIdx].blocks.filter(b => b.id !== blockId) }); }
  function onDragEnd(result) {
    if (!result.destination) return;
    const from = Number(result.source.droppableId);
    const to = Number(result.destination.droppableId);
    const next = [...days];
    const [moved] = next[from].blocks.splice(result.source.index, 1);
    next[to].blocks.splice(result.destination.index, 0, moved);
    setDays(next);
  }
  function selectSession(dayIdx, blockId, sessionId) {
    const session = sessionsById[sessionId];
    updateBlock(dayIdx, blockId, { session_id: sessionId, session_snapshot: session ? { title: session.title, duration_minutes: session.duration_minutes, objective: session.objective, session_type: session.session_type } : null });
  }
  function addDay() { setDays(prev => [...prev, emptyDay(moment(prev[prev.length - 1]?.date || startDate).add(1, "days").format("YYYY-MM-DD"), prev.length)]); }
  function removeDay() { if (days.length > 1) setDays(prev => prev.slice(0, -1)); }
  function shiftWeek(delta) { setStartDate(moment(startDate).add(delta * days.length, "days").format("YYYY-MM-DD")); }
  function applyTemplate(id) {
    const tpl = MICROCycle_TEMPLATES.find(t => t.id === id);
    if (!tpl) return;
    setMeta(prev => ({ ...prev, week_type: tpl.type }));
    setDays(tpl.days.map((md, i) => {
      const objective = tpl.objectives[i] || "Campo";
      return { date: moment(startDate).add(i, "days").format("YYYY-MM-DD"), md, blocks: (TEMPLATE_BLOCKS[objective] || [{ type: "Campo", title: objective, content: "" }]).map(b => ({ ...emptyBlock(b.type, b.content), title: b.title })) };
    }));
  }
  async function save() {
    setSaving(true);
    const payload = { week_start: startDate, squad_id: activeSquadId || null, squad_name: activeSquad?.name || "", season_id: activeSeasonId || activeSquad?.season || "", microcycle_meta: meta, graph_type: graphType, template_type: meta.week_type, days_data: days, notes: autoText };
    if (recordId) await base44.entities.WeeklyPlan.update(recordId, payload); else { const rec = await base44.entities.WeeklyPlan.create(payload); setRecordId(rec.id); }
    setSaving(false);
    toast({ title: "Microciclo guardado correctamente" });
  }
  async function handleAiFile(file) {
    if (!file) return;
    setAiLoading(true);
    try {
      const upload = await base44.integrations.Core.UploadFile({ file });
      const output = await base44.integrations.Core.InvokeLLM({
        file_urls: [upload.file_url],
        response_json_schema: { type: "object", properties: { week_type: { type: "string" }, next_match: { type: "string" }, days: { type: "array", items: { type: "object", properties: { date: { type: "string" }, md: { type: "string" }, blocks: { type: "array", items: { type: "object", properties: { type: { type: "string" }, title: { type: "string" }, content: { type: "string" } } } } } } } } },
        prompt: `Interpretá este cronograma o plan semanal deportivo y generá un microciclo editable. Usá fechas YYYY-MM-DD, días MD, objetivos físicos/tácticos, campo, gimnasio, preventivos y recuperación. Fecha de inicio esperada: ${startDate}.`,
      });
      if (output.week_type || output.next_match) setMeta(prev => ({ ...prev, week_type: output.week_type || prev.week_type, next_match: output.next_match || prev.next_match }));
      if (Array.isArray(output.days) && output.days.length) setDays(output.days.map((d, i) => ({ date: d.date || moment(startDate).add(i, "days").format("YYYY-MM-DD"), md: d.md || "— MD —", blocks: (d.blocks || []).map(b => ({ ...emptyBlock(b.type || "Personalizado", b.content || ""), title: b.title || b.type || "Bloque" })) })));
    } catch {
      toast({ title: "No se pudo crear el microciclo con IA", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  if (exportMode) return <MicrocycleExportView days={days} meta={meta} dayLoads={dayLoads} summary={autoText} onExit={() => setExportMode(false)} />;
  if (loading) return <div className="h-64 flex items-center justify-center"><div className="w-7 h-7 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div>;

  return <div className="space-y-6">
    <input ref={aiInputRef} type="file" className="hidden" accept=".pdf,.xlsx,.xls,.doc,.docx,.csv,.png,.jpg,.jpeg" onChange={e => handleAiFile(e.target.files?.[0])} />
    <section className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-emerald-950/40 p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><p className="text-emerald-400 text-xs font-black uppercase tracking-widest">Centro de planificación del cuerpo técnico</p><h2 className="text-2xl font-black text-white mt-1">Microciclo editable</h2><p className="text-zinc-500 text-sm mt-1">{activeSquad?.name || "Plantel"} · {activeSeasonId || activeSquad?.season || "Temporada"}</p></div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => shiftWeek(-1)} className="p-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300"><ChevronLeft size={16} /></button>
          <button onClick={() => shiftWeek(1)} className="p-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300"><ChevronRight size={16} /></button>
          {savedPlans.length > 0 && <select value="" onChange={e => e.target.value && setStartDate(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-300 text-sm"><option value="">Buscar microciclo...</option>{savedPlans.map(plan => <option key={plan.id} value={plan.week_start}>{moment(plan.week_start).format("DD/MM/YYYY")}</option>)}</select>}
          <button onClick={() => aiInputRef.current?.click()} className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-2"><Sparkles size={15} /> {aiLoading ? "Creando..." : "Crear microciclo con IA"}</button>
          <button onClick={save} disabled={saving} className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold flex items-center gap-2"><Save size={15} /> {saving ? "Guardando..." : "Guardar"}</button>
          <button onClick={() => setExportMode(true)} className="px-3 py-2 rounded-xl bg-zinc-100 text-zinc-950 text-sm font-bold flex items-center gap-2"><Download size={15} /> Vista exportación</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-5">
        <label className="space-y-1"><span className="text-xs text-zinc-500">Semana del año</span><input value={meta.week_number} onChange={e => setMeta({ ...meta, week_number: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white" /></label>
        <label className="space-y-1"><span className="text-xs text-zinc-500">Rango de fechas</span><input value={meta.range_label} onChange={e => setMeta({ ...meta, range_label: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white" /></label>
        <label className="space-y-1"><span className="text-xs text-zinc-500">Próximo partido</span><input value={meta.next_match} onChange={e => setMeta({ ...meta, next_match: e.target.value })} placeholder="Ej: vs River" className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white" /></label>
        <label className="space-y-1"><span className="text-xs text-zinc-500">Día actual</span><select value={meta.current_md} onChange={e => setMeta({ ...meta, current_md: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white">{MD_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></label>
        <label className="space-y-1"><span className="text-xs text-zinc-500">Tipo de semana</span><select value={meta.week_type} onChange={e => setMeta({ ...meta, week_type: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white">{WEEK_TYPES.map(o => <option key={o}>{o}</option>)}</select></label>
      </div>
    </section>

    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
      {[{ label: "Carga semanal", value: compactNumber(summary.total), sub: "Player Load estimado" }, { label: "Pico de carga", value: summary.peak?.day || "—", sub: compactNumber(summary.peak?.player_load) }, { label: "Día recuperación", value: summary.recovery?.date ? dayName(summary.recovery.date).slice(0, 3) : "—", sub: summary.recovery?.md || "" }, { label: "Campo", value: summary.field, sub: "bloques / sesiones" }, { label: "Gimnasio", value: summary.gym, sub: "bloques / sesiones" }, { label: "Estado", value: summary.status, sub: "automático" }].map(card => <div key={card.label} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500 font-bold uppercase">{card.label}</p><p className="text-2xl font-black text-white mt-2">{card.value}</p><p className="text-xs text-emerald-400 mt-1">{card.sub}</p></div>)}
    </div>

    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div><h3 className="text-white font-black text-lg">Plantillas inteligentes</h3><p className="text-zinc-500 text-sm">Generan estructura, días MD y bloques iniciales.</p></div>
        <div className="flex gap-2 flex-wrap"><select onChange={e => applyTemplate(e.target.value)} defaultValue="" className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm"><option value="" disabled>Aplicar plantilla...</option>{MICROCycle_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><button onClick={addDay} className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm flex items-center gap-2"><Plus size={14} /> Día</button><button onClick={removeDay} className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm flex items-center gap-2"><X size={14} /> Quitar</button></div>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 xl:grid-cols-7 gap-3">
          {days.map((day, dayIdx) => <div key={dayIdx} className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden min-w-0">
            <div className="bg-zinc-800/80 p-3 border-b border-zinc-700"><div className="flex items-center justify-between"><div><p className="text-xs text-emerald-400 font-black">{dayName(day.date)}</p><input type="date" value={day.date} onChange={e => updateDay(dayIdx, { date: e.target.value })} className="bg-transparent text-white text-sm font-bold focus:outline-none" /></div><select value={day.md} onChange={e => updateDay(dayIdx, { md: e.target.value })} className="bg-zinc-900 border border-zinc-700 rounded-lg text-white text-xs px-2 py-1">{MD_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></div>
              <div className="grid grid-cols-3 gap-1 mt-3 text-[10px] text-zinc-400"><span>DT {compactNumber(dayLoads[dayIdx]?.total_distance)}</span><span>+19 {compactNumber(dayLoads[dayIdx]?.distance_19_8)}</span><span>+25 {compactNumber(dayLoads[dayIdx]?.distance_25)}</span><span>ACC {compactNumber(dayLoads[dayIdx]?.acc_3)}</span><span>DEC {compactNumber(dayLoads[dayIdx]?.dec_3)}</span><span>PL {compactNumber(dayLoads[dayIdx]?.player_load)}</span></div></div>
            <Droppable droppableId={String(dayIdx)}>
              {(provided) => <div ref={provided.innerRef} {...provided.droppableProps} className="p-3 space-y-2 min-h-[180px]">
                {(day.blocks || []).map((block, index) => <Draggable key={block.id} draggableId={block.id} index={index}>{(dragProvided) => <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} className="rounded-xl border border-zinc-700 bg-zinc-950 p-3" style={{ borderLeft: `4px solid ${block.color}`, ...dragProvided.draggableProps.style }}>
                  <div className="flex items-center gap-2 mb-2"><button {...dragProvided.dragHandleProps} className="text-zinc-500"><GripVertical size={14} /></button><input value={block.title} onChange={e => updateBlock(dayIdx, block.id, { title: e.target.value })} className="flex-1 bg-transparent text-white text-sm font-bold focus:outline-none" /><button onClick={() => duplicateBlock(dayIdx, block)} className="text-zinc-500 hover:text-white"><Copy size={13} /></button><button onClick={() => deleteBlock(dayIdx, block.id)} className="text-zinc-500 hover:text-red-400"><Trash2 size={13} /></button></div>
                  <div className="grid grid-cols-2 gap-2 mb-2"><select value={block.type} onChange={e => updateBlock(dayIdx, block.id, { type: e.target.value, title: e.target.value, color: BLOCK_COLORS[e.target.value] || block.color })} className="bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-300 text-xs px-2 py-1">{BLOCK_TYPES.map(t => <option key={t}>{t}</option>)}</select><input type="color" value={block.color || "#52525b"} onChange={e => updateBlock(dayIdx, block.id, { color: e.target.value })} className="w-full h-8 bg-zinc-900 border border-zinc-700 rounded-lg" /></div>
                  <textarea value={block.content || ""} onChange={e => updateBlock(dayIdx, block.id, { content: e.target.value })} placeholder="Escribir planificación..." rows={3} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 text-xs p-2 resize-none focus:outline-none focus:border-emerald-700" />
                  <select value={block.session_id || ""} onChange={e => selectSession(dayIdx, block.id, e.target.value)} className="w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 text-xs px-2 py-2"><option value="">Vincular sesión creada...</option>{sessionLibrary.map(s => <option key={s.id} value={s.id}>{s.date ? `${moment(s.date).format("DD/MM")} · ` : ""}{s.title}</option>)}</select>
                  {block.session_id && blockSession(block, sessionsById) && (() => {
                    const shownSession = blockSession(block, sessionsById);
                    return <div className="mt-2 rounded-lg bg-emerald-950/30 border border-emerald-900/40 p-2 text-xs text-emerald-100"><p className="font-bold">{shownSession.title}</p><p className="text-emerald-300">{shownSession.duration_minutes || "—"} min · {shownSession.objective || shownSession.session_objective || "Objetivo sin definir"}</p>{(sessionDetails[block.session_id]?.exercises || []).slice(0, 3).map(ex => <p key={ex.id} className="text-zinc-300 truncate">• {ex.name}</p>)}<label className="mt-2 flex items-center gap-2 text-[11px]"><input type="checkbox" checked={block.auto_sync !== false} onChange={e => updateBlock(dayIdx, block.id, { auto_sync: e.target.checked })} /> Actualizar si cambia la sesión</label></div>;
                  })()}
                </div>}</Draggable>)}
                {provided.placeholder}
                <select onChange={e => { if (e.target.value) addBlock(dayIdx, e.target.value); e.target.value = ""; }} defaultValue="" className="w-full bg-zinc-800 border border-dashed border-zinc-700 rounded-xl text-zinc-400 text-xs px-3 py-2"><option value="" disabled>+ Agregar bloque</option>{BLOCK_TYPES.map(t => <option key={t}>{t}</option>)}</select>
              </div>}
            </Droppable>
          </div>)}
        </div>
      </DragDropContext>
    </section>

    <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex items-center justify-between mb-4"><div><h3 className="text-white font-black">Distribución semanal de carga</h3><p className="text-zinc-500 text-sm">Calculada desde las sesiones vinculadas.</p></div><div className="flex gap-1 bg-zinc-950 rounded-xl p-1">{GRAPH_TYPES.map(g => <button key={g.id} onClick={() => setGraphType(g.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${graphType === g.id ? "bg-emerald-600 text-white" : "text-zinc-400"}`}>{g.label}</button>)}</div></div><LoadChart data={dayLoads} type={graphType} /></div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex items-center gap-2 mb-3"><Layers size={18} className="text-emerald-400" /><h3 className="text-white font-black">Resumen automático</h3></div><p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{autoText}</p><div className="mt-4 rounded-xl bg-zinc-950 border border-zinc-800 p-3 text-xs text-zinc-500"><Calendar size={14} className="inline mr-1" /> La información queda guardada en Plan Semanal y se mantiene disponible para dashboard, calendario, sesiones y exportaciones.</div></div>
    </section>
  </div>;
}