import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Activity, AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, ClipboardPlus, HeartPulse, Loader2, RefreshCw, Search, Settings2, ShieldCheck, Stethoscope, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { medicalOverview, reviewMedicalWellnessSignal, convertMedicalWellnessSignal } from "@/lib/medicalApi";
import MedicalEpisodeCreateModal from "@/components/medical/MedicalEpisodeCreateModal";
import MedicalEpisodeEditModal from "@/components/medical/MedicalEpisodeEditModal";
import MedicalFollowUpModal from "@/components/medical/MedicalFollowUpModal";
import PlayerMedicalHistory from "@/components/medical/PlayerMedicalHistory";
import MedicalLinkRepairModal from "@/components/medical/MedicalLinkRepairModal";

const AVAILABILITY_LABEL = {
  unavailable: "No disponible", physiotherapy: "Kinesiología", individual_field: "Campo individual",
  modified_training: "Trabajo modificado", partial_integration: "Integración parcial",
  full_training: "Entrenamiento completo", available_to_compete: "Disponible para competir",
};
const AVAILABILITY_BADGE = {
  unavailable: "bg-red-500/10 text-red-300 border-red-500/30", physiotherapy: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30",
  individual_field: "bg-orange-500/10 text-orange-300 border-orange-500/30", modified_training: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  partial_integration: "bg-blue-500/10 text-blue-300 border-blue-500/30", full_training: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  available_to_compete: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};
const TYPE_LABEL = { injury:"Lesión", illness:"Enfermedad", consultation:"Consulta", discomfort_followup:"Molestia / seguimiento", control:"Control", rehabilitation:"Rehabilitación", return_to_training:"Retorno" };
const PHASE_LABEL = { clinical:"Fase clínica", rehabilitation:"Rehabilitación", individual_field:"Campo individual", partial_integration:"Integración parcial", full_training:"Entrenamiento completo", available:"Disponible" };
const DEFAULT_COLUMNS = ["player","availability","restriction","reason","body","start","days","phase","updated","control","expected","professional","actions"];

function fmtDate(value) { if (!value) return "—"; const [y,m,d] = String(value).slice(0,10).split("-"); return y && m && d ? `${d}/${m}/${y}` : value; }
function daysSince(value) { if (!value) return "—"; const d = new Date(`${value}T12:00:00`); if (Number.isNaN(d.getTime())) return "—"; return Math.max(0, Math.floor((Date.now()-d.getTime())/86400000)); }
function todayBA() { return new Intl.DateTimeFormat("en-CA", { timeZone:"America/Argentina/Buenos_Aires" }).format(new Date()); }
function addDaysISO(iso, days) { const d = new Date(`${iso}T12:00:00-03:00`); d.setDate(d.getDate()+days); return new Intl.DateTimeFormat("en-CA", { timeZone:"America/Argentina/Buenos_Aires" }).format(d); }
function playerName(p) { return p?.full_name || [p?.first_name,p?.last_name].filter(Boolean).join(" ") || p?.name || "Jugador"; }

export default function Medical() {
  const { activeSquadId, activeSeasonId, activeSquad, can, isAdmin } = useWorkspace();
  const { toast } = useToast();
  const [data, setData] = useState({ players:[], episodes:[], statuses:[], follow_ups:[], wellness_signals:[], capabilities:{}, can_view_clinical:true });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [followEpisode, setFollowEpisode] = useState(null);
  const [clearanceEpisode, setClearanceEpisode] = useState(null);
  const [historyPlayer, setHistoryPlayer] = useState(null);
  const [showRepair, setShowRepair] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeOnly, setActiveOnly] = useState(true);
  const [showColumns, setShowColumns] = useState(false);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);

  async function load() {
    if (!activeSquadId) { setLoading(false); return; }
    setLoading(true);
    try { setData(await medicalOverview(activeSquadId)); }
    catch (err) { toast({ title: err?.message || "No se pudo cargar Área Médica", variant:"destructive" }); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [activeSquadId]);

  const playerMap = useMemo(() => new Map(data.players.map((p) => [p.id,p])), [data.players]);
  const episodeMap = useMemo(() => new Map(data.episodes.map((e) => [e.id,e])), [data.episodes]);
  const followUpsByEpisode = useMemo(() => {
    const map = new Map(); for (const f of data.follow_ups) { if (!map.has(f.medical_episode_id)) map.set(f.medical_episode_id,[]); map.get(f.medical_episode_id).push(f); } return map;
  }, [data.follow_ups]);
  const statusRows = useMemo(() => data.statuses.map((s) => ({ status:s, episode:episodeMap.get(s.active_episode_id), player:playerMap.get(s.player_id) })).filter((r)=>r.player), [data.statuses,episodeMap,playerMap]);
  const notAvailable = statusRows.filter((r)=>r.status.availability && r.status.availability !== "available_to_compete");
  const modified = statusRows.filter((r)=>["modified_training","partial_integration","individual_field"].includes(r.status.availability));
  const physio = statusRows.filter((r)=>r.status.availability === "physiotherapy");
  const returning = statusRows.filter((r)=>["individual_field","partial_integration","full_training"].includes(r.status.availability));
  const today = todayBA();
  const nextWeek = addDaysISO(today, 7);
  const controlsToday = statusRows.filter((r)=>r.status.next_control_date === today);
  const overdueControls = statusRows.filter((r)=>r.status.next_control_date && r.status.next_control_date < today && r.status.availability !== "available_to_compete");
  const upcomingControls = statusRows.filter((r)=>r.status.next_control_date && r.status.next_control_date > today && r.status.next_control_date <= nextWeek);
  const pendingPain = data.wellness_signals.filter((s)=>s.status === "pending_review");
  const recentClearances = data.episodes.filter((e)=>e.medical_clearance_date && String(e.medical_clearance_date) >= new Date(Date.now()-7*86400000).toISOString().slice(0,10));

  async function syncSheets() {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("syncMedicalFromSheet", { squad_id: activeSquadId });
      const r = res.data || {};
      toast({ title:`Sheets: ${r.created||0} creados · ${r.updated||0} actualizados · ${r.conflicts||0} conflictos${r.requires_review?` · ${r.requires_review} requieren revisión`:""}` });
      await load();
    } catch(err){ toast({title:err?.message||"Error al sincronizar",variant:"destructive"}); }
    finally { setSyncing(false); }
  }

  const canCreate = isAdmin || data.capabilities?.can_create || can("create","/performance/medical");
  const canEdit = isAdmin || data.capabilities?.can_edit || can("edit","/performance/medical");

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-zinc-500" /></div>;

  return <div className="space-y-5">
    <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      <div><div className="flex items-center gap-2"><Stethoscope className="text-emerald-400" size={20}/><h1 className="text-xl font-bold text-white">Área Médica</h1></div><p className="text-xs text-zinc-500 mt-1">Operación diaria, seguimiento longitudinal y disponibilidad deportiva. Sheets es una integración opcional.</p></div>
      <div className="flex flex-wrap gap-2">
        {canCreate && <Button onClick={()=>setCreateOpen(true)} className="bg-white text-zinc-950 hover:bg-zinc-200"><ClipboardPlus size={15} className="mr-1.5"/>Nuevo registro médico</Button>}
        <Button variant="outline" onClick={syncSheets} disabled={syncing} className="border-zinc-700 text-zinc-300"><RefreshCw size={14} className={`mr-1.5 ${syncing?"animate-spin":""}`}/>Importar / Sincronizar</Button>
        <Button variant="outline" onClick={()=>setShowRepair(true)} className="border-zinc-700 text-zinc-300"><UserCheck size={14} className="mr-1.5"/>Reparar vínculos</Button>
      </div>
    </header>

    <nav className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit overflow-x-auto">
      {[["dashboard","Dashboard"],["sheet","Planilla médica"],["controls",`Controles${overdueControls.length?` (${overdueControls.length} venc.)`:controlsToday.length?` (${controlsToday.length} hoy)`:""}`],["pain",`Dolor Wellness${pendingPain.length?` (${pendingPain.length})`:""}`]].map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${tab===id?"bg-white text-zinc-950 font-semibold":"text-zinc-400 hover:text-white"}`}>{label}</button>)}
    </nav>

    {tab === "dashboard" && <>
      <section className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi icon={AlertTriangle} label="No disponibles" value={notAvailable.length} tone="red" onClick={()=>{setAvailabilityFilter("unavailable");setTab("sheet")}} />
        <Kpi icon={Activity} label="Modificados" value={modified.length} tone="amber" onClick={()=>setTab("sheet")} />
        <Kpi icon={HeartPulse} label="Kinesiología" value={physio.length} tone="fuchsia" onClick={()=>{setAvailabilityFilter("physiotherapy");setTab("sheet")}} />
        <Kpi icon={RefreshCw} label="Retornando" value={returning.length} tone="blue" onClick={()=>setTab("sheet")} />
        <Kpi icon={CalendarClock} label="Control hoy" value={controlsToday.length} tone="cyan" onClick={()=>setTab("controls")} />
        <Kpi icon={AlertTriangle} label="Controles vencidos" value={overdueControls.length} tone="red" onClick={()=>setTab("controls")} />
      </section>

      {pendingPain.length > 0 && <section className="border border-amber-500/25 bg-amber-500/5 rounded-xl p-4 flex items-center justify-between gap-4"><div><p className="text-sm text-amber-200 font-semibold">{pendingPain.length} reporte{pendingPain.length!==1?"s":""} de dolor pendiente{pendingPain.length!==1?"s":""}</p><p className="text-xs text-zinc-500 mt-0.5">Wellness no crea lesiones. El área médica decide si revisa, descarta o genera una consulta.</p></div><Button size="sm" variant="outline" onClick={()=>setTab("pain")} className="border-amber-500/30 text-amber-200">Revisar</Button></section>}

      <section className="grid xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"><div className="p-4 border-b border-zinc-800"><h2 className="text-sm font-semibold text-white">Disponibilidad de hoy</h2><p className="text-xs text-zinc-500">Prioriza quién no puede entrenar normal y qué restricción tiene.</p></div><div className="divide-y divide-zinc-800">{notAvailable.length===0?<Empty text="No hay restricciones médicas activas registradas"/>:notAvailable.slice(0,12).map((r)=><PlayerOperationalRow key={r.status.id} row={r} onHistory={()=>setHistoryPlayer(r.player)} onFollow={()=>r.episode&&setFollowEpisode(r.episode)} />)}</div></div>
        <div className="space-y-4"><Panel title="Controles de hoy">{controlsToday.length===0?<Empty text="Sin controles programados"/>:controlsToday.map((r)=><MiniPlayer key={r.status.id} row={r} />)}</Panel><Panel title="Altas recientes">{recentClearances.length===0?<Empty text="Sin altas en los últimos 7 días"/>:recentClearances.slice(0,6).map((e)=><div key={e.id} className="px-3 py-2"><p className="text-sm text-white">{playerName(playerMap.get(e.player_id))}</p><p className="text-xs text-zinc-500">{fmtDate(e.medical_clearance_date)} · {e.medical_clearance_by_name||"Profesional"}</p></div>)}</Panel></div>
      </section>
    </>}

    {tab === "sheet" && <section className="space-y-3">
      <div className="flex flex-col lg:flex-row gap-2 lg:items-center justify-between"><div className="flex flex-1 flex-wrap gap-2"><div className="relative min-w-[220px] flex-1 max-w-md"><Search size={14} className="absolute left-3 top-3 text-zinc-600"/><Input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Jugador, diagnóstico, zona…" className="pl-9 bg-zinc-900 border-zinc-800"/></div><select value={availabilityFilter} onChange={(e)=>setAvailabilityFilter(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 text-xs text-zinc-300"><option value="all">Todas las disponibilidades</option>{Object.entries(AVAILABILITY_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><select value={typeFilter} onChange={(e)=>setTypeFilter(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 text-xs text-zinc-300"><option value="all">Todos los tipos</option>{Object.entries(TYPE_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><label className="flex items-center gap-2 px-3 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400"><input type="checkbox" checked={activeOnly} onChange={(e)=>setActiveOnly(e.target.checked)}/>Sólo activos</label></div><div className="relative"><Button variant="outline" onClick={()=>setShowColumns((v)=>!v)} className="border-zinc-700 text-zinc-300"><Settings2 size={14} className="mr-1.5"/>Columnas<ChevronDown size={13} className="ml-1"/></Button>{showColumns&&<ColumnPicker columns={columns} setColumns={setColumns} onClose={()=>setShowColumns(false)}/>}</div></div>
      <MedicalTable episodes={data.episodes} playerMap={playerMap} followUpsByEpisode={followUpsByEpisode} search={search} availabilityFilter={availabilityFilter} typeFilter={typeFilter} activeOnly={activeOnly} columns={columns} canEdit={canEdit} canViewClinical={data.can_view_clinical} onHistory={(p)=>setHistoryPlayer(p)} onFollow={(e)=>setFollowEpisode(e)} onClearance={(e)=>setClearanceEpisode(e)} onEdit={(e)=>setEditing(e)} />
    </section>}

    {tab === "controls" && <ControlsBoard overdue={overdueControls} todayRows={controlsToday} upcoming={upcomingControls} onHistory={(p)=>setHistoryPlayer(p)} onFollow={(e)=>setFollowEpisode(e)} />}

    {tab === "pain" && <PainInbox signals={data.wellness_signals} playerMap={playerMap} squadId={activeSquadId} onChanged={load} />}

    <MedicalEpisodeCreateModal open={createOpen} onClose={()=>setCreateOpen(false)} onSaved={load} players={data.players} squadId={activeSquadId} seasonId={activeSeasonId} organizationId={activeSquad?.organization_id} canViewClinical={data.can_view_clinical}/>
    {editing&&<MedicalEpisodeEditModal episode={editing} squadId={activeSquadId} canViewClinical={data.can_view_clinical} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);load()}}/>}
    {followEpisode&&<MedicalFollowUpModal open episode={followEpisode} squadId={activeSquadId} canViewClinical={data.can_view_clinical} onClose={()=>setFollowEpisode(null)} onSaved={load}/>} 
    {clearanceEpisode&&<MedicalFollowUpModal open mode="clearance" episode={clearanceEpisode} squadId={activeSquadId} canViewClinical={data.can_view_clinical} onClose={()=>setClearanceEpisode(null)} onSaved={load}/>} 
    {historyPlayer&&<PlayerMedicalHistory player={historyPlayer} squadId={activeSquadId} onClose={()=>setHistoryPlayer(null)}/>} 
    {showRepair&&<MedicalLinkRepairModal onClose={()=>setShowRepair(false)} onRepaired={load}/>} 
  </div>;
}

function Kpi({icon:Icon,label,value,tone,onClick}) { const t={red:"text-red-300 border-red-500/20",amber:"text-amber-300 border-amber-500/20",fuchsia:"text-fuchsia-300 border-fuchsia-500/20",blue:"text-blue-300 border-blue-500/20",cyan:"text-cyan-300 border-cyan-500/20",emerald:"text-emerald-300 border-emerald-500/20"}[tone]; return <button onClick={onClick} className={`text-left bg-zinc-900 border rounded-xl p-4 ${t} ${onClick?"hover:bg-zinc-800/70":""}`}><Icon size={15}/><p className="text-2xl font-bold mt-2">{value}</p><p className="text-[11px] text-zinc-500 mt-0.5">{label}</p></button> }
function Panel({title,children}) { return <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"><div className="px-3 py-2.5 border-b border-zinc-800 text-xs font-semibold text-zinc-300">{title}</div><div className="divide-y divide-zinc-800">{children}</div></div> }
function Empty({text}) { return <div className="p-5 text-xs text-zinc-600 text-center">{text}</div> }
function MiniPlayer({row}) { return <div className="px-3 py-2"><p className="text-sm text-white">{playerName(row.player)}</p><p className="text-xs text-zinc-500">{row.episode?.lesion_consulta||row.status.restriction_summary||"Control programado"}</p></div> }
function PlayerOperationalRow({row,onHistory,onFollow}) { const a=row.status.availability; return <div className="p-3 flex items-center gap-3"><button onClick={onHistory} className="shrink-0">{row.player?.photo_url?<img src={row.player.photo_url} alt="" className="w-9 h-9 rounded-full object-cover"/>:<div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs">{playerName(row.player)[0]}</div>}</button><div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-2"><button onClick={onHistory} className="text-sm font-medium text-white hover:underline">{playerName(row.player)}</button><span className={`text-[10px] px-2 py-0.5 rounded border ${AVAILABILITY_BADGE[a]||"border-zinc-700 text-zinc-400"}`}>{AVAILABILITY_LABEL[a]||a}</span></div><p className="text-xs text-zinc-400 mt-0.5 truncate">{row.status.restriction_summary||row.episode?.operational_note||row.episode?.lesion_consulta||"Sin detalle operativo"}</p></div>{row.episode&&<Button size="sm" variant="outline" onClick={onFollow} className="border-zinc-700 text-xs">Seguimiento</Button>}</div> }

function ControlsBoard({overdue,todayRows,upcoming,onHistory,onFollow}) {
  return <div className="space-y-4"><div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex items-center gap-2"><CalendarClock size={16} className="text-cyan-300"/><h2 className="text-sm font-semibold text-white">Agenda de controles</h2></div><p className="mt-1 text-xs text-zinc-500">Prioriza controles vencidos y de hoy. Cada seguimiento puede actualizar disponibilidad, fase, restricción y próximo control sin salir de la página.</p></div><div className="grid gap-4 xl:grid-cols-3"><ControlGroup title="Vencidos" rows={overdue} tone="red" empty="No hay controles vencidos" onHistory={onHistory} onFollow={onFollow}/><ControlGroup title="Hoy" rows={todayRows} tone="cyan" empty="No hay controles para hoy" onHistory={onHistory} onFollow={onFollow}/><ControlGroup title="Próximos 7 días" rows={upcoming} tone="blue" empty="Sin controles próximos" onHistory={onHistory} onFollow={onFollow}/></div></div>;
}
function ControlGroup({title,rows,tone,empty,onHistory,onFollow}) { const toneClass={red:"border-red-500/20",cyan:"border-cyan-500/20",blue:"border-blue-500/20"}[tone]||"border-zinc-800"; return <div className={`rounded-xl border bg-zinc-900 overflow-hidden ${toneClass}`}><div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3"><p className="text-sm font-semibold text-white">{title}</p><span className="rounded-full bg-zinc-950 px-2 py-0.5 text-xs text-zinc-400">{rows.length}</span></div><div className="divide-y divide-zinc-800">{rows.length===0?<Empty text={empty}/>:rows.sort((a,b)=>String(a.status.next_control_date||"").localeCompare(String(b.status.next_control_date||""))).map((row)=><div key={row.status.id} className="p-3"><div className="flex items-start gap-3"><button onClick={()=>onHistory(row.player)} className="shrink-0">{row.player?.photo_url?<img src={row.player.photo_url} alt="" className="h-9 w-9 rounded-full object-cover"/>:<div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-500">{playerName(row.player)[0]}</div>}</button><div className="min-w-0 flex-1"><button onClick={()=>onHistory(row.player)} className="text-sm font-semibold text-white hover:underline">{playerName(row.player)}</button><p className="mt-0.5 text-xs text-zinc-500">{fmtDate(row.status.next_control_date)} · {AVAILABILITY_LABEL[row.status.availability]||row.status.availability||"Sin disponibilidad"}</p><p className="mt-1 line-clamp-2 text-xs text-zinc-300">{row.status.restriction_summary||row.episode?.operational_note||row.episode?.lesion_consulta||"Sin detalle"}</p></div></div>{row.episode&&<div className="mt-3 flex justify-end"><Button size="sm" variant="outline" onClick={()=>onFollow(row.episode)} className="h-7 border-zinc-700 text-[11px]">Registrar control / seguimiento</Button></div>}</div>)}</div></div> }

function ColumnPicker({columns,setColumns,onClose}) { const items={player:"Jugador",availability:"Disponibilidad",restriction:"Restricción operativa",reason:"Diagnóstico / motivo",body:"Zona / lado",start:"Inicio",days:"Días",phase:"Fase",updated:"Última actualización",control:"Próximo control",professional:"Responsable",actions:"Acciones",expected:"Retorno estimado",source:"Origen"}; const toggle=(k)=>setColumns((c)=>c.includes(k)?c.filter((x)=>x!==k):[...c,k]); return <div className="absolute right-0 top-11 z-30 w-60 bg-zinc-950 border border-zinc-700 rounded-xl shadow-2xl p-2">{Object.entries(items).map(([k,l])=><label key={k} className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 rounded"><input type="checkbox" checked={columns.includes(k)} onChange={()=>toggle(k)}/>{l}</label>)}<button onClick={onClose} className="w-full text-xs text-zinc-500 mt-1 py-1">Cerrar</button></div> }

function MedicalTable({episodes,playerMap,followUpsByEpisode,search,availabilityFilter,typeFilter,activeOnly,columns,canEdit,canViewClinical,onHistory,onFollow,onClearance,onEdit}) {
  const rows=episodes.filter((e)=>{ if(activeOnly&&e.episode_state==="closed")return false; if(availabilityFilter!=="all"&&e.availability!==availabilityFilter)return false; if(typeFilter!=="all"&&e.record_type!==typeFilter)return false; const p=playerMap.get(e.player_id); const hay=[playerName(p),e.lesion_consulta,e.body_region,e.body_area,e.mmii_afectado,e.operational_note].join(" ").toLowerCase(); return !search||hay.includes(search.toLowerCase()); }).sort((a,b)=>String(b.event_date||b.fecha_inicio_tto||"").localeCompare(String(a.event_date||a.fecha_inicio_tto||"")));
  const show=(k)=>columns.includes(k);
  return <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto"><table className="w-full text-xs min-w-[1050px]"><thead><tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wide">{show("player")&&<th className="p-3 text-left sticky left-0 z-10 bg-zinc-900">Jugador</th>}{show("availability")&&<th className="p-3 text-left">Disponibilidad</th>}{show("restriction")&&<th className="p-3 text-left">Restricción operativa</th>}{show("reason")&&<th className="p-3 text-left">Diagnóstico / motivo</th>}{show("body")&&<th className="p-3 text-left">Zona</th>}{show("start")&&<th className="p-3 text-left">Inicio</th>}{show("days")&&<th className="p-3 text-left">Días</th>}{show("phase")&&<th className="p-3 text-left">Fase</th>}{show("updated")&&<th className="p-3 text-left">Última actualización</th>}{show("control")&&<th className="p-3 text-left">Próx. control</th>}{show("professional")&&<th className="p-3 text-left">Responsable</th>}{show("expected")&&<th className="p-3 text-left">Retorno estimado</th>}{show("source")&&<th className="p-3 text-left">Origen</th>}{show("actions")&&<th className="p-3 text-right">Acciones</th>}</tr></thead><tbody>{rows.length===0?<tr><td colSpan={20}><Empty text="Sin registros con estos filtros"/></td></tr>:rows.map((e)=>{const p=playerMap.get(e.player_id);const fus=followUpsByEpisode.get(e.id)||[];const last=fus[0];return <tr key={e.id} className="border-b border-zinc-800/70 hover:bg-zinc-800/30">{show("player")&&<td className="p-3 sticky left-0 z-[5] bg-zinc-900"><button onClick={()=>p&&onHistory(p)} className="text-white font-medium hover:underline">{playerName(p)||e.player_name_original}</button><div className="text-[10px] text-zinc-600">{TYPE_LABEL[e.record_type]||"Registro"}</div></td>}{show("availability")&&<td className="p-3"><span className={`text-[10px] px-2 py-1 rounded border ${AVAILABILITY_BADGE[e.availability]||"border-zinc-700 text-zinc-400"}`}>{AVAILABILITY_LABEL[e.availability]||"Sin definir"}</span></td>}{show("restriction")&&<td className="p-3 text-zinc-300 max-w-[260px]"><div className="line-clamp-2">{e.operational_note||"Sin restricción operativa cargada"}</div></td>}{show("reason")&&<td className="p-3 text-zinc-300 max-w-[230px]"><div className="line-clamp-2">{canViewClinical?(e.confirmed_diagnosis||e.preliminary_diagnosis||e.lesion_consulta):e.lesion_consulta}</div>{e.sync_conflict&&<span className="text-[10px] text-amber-400">Requiere revisar conflicto de sincronización</span>}</td>}{show("body")&&<td className="p-3 text-zinc-400">{e.body_area||e.body_region||e.mmii_afectado||"—"}{e.laterality&&e.laterality!=="unknown"?<div className="text-[10px] text-zinc-600">{e.laterality}</div>:null}</td>}{show("start")&&<td className="p-3 text-zinc-400">{fmtDate(e.event_date||e.fecha_inicio_tto)}</td>}{show("days")&&<td className="p-3 text-zinc-300">{daysSince(e.event_date||e.fecha_inicio_tto)}</td>}{show("phase")&&<td className="p-3 text-zinc-400">{PHASE_LABEL[e.rehab_phase]||e.etapa_rhb||"—"}</td>}{show("updated")&&<td className="p-3 text-zinc-400">{last?fmtDate(last.follow_up_date):fmtDate((e.edited_at||e.last_synced_at||e.updated_date||"").slice(0,10))}</td>}{show("control")&&<td className="p-3 text-zinc-400">{fmtDate(e.next_control_date)}</td>}{show("professional")&&<td className="p-3 text-zinc-400">{last?.professional_name||e.professional_name||e.edited_by||"—"}</td>}{show("expected")&&<td className="p-3 text-zinc-400"><div>{fmtDate(e.expected_return_date)}</div>{e.expected_return_date&&<div className="text-[10px] text-zinc-600">estimación</div>}</td>}{show("source")&&<td className="p-3 text-zinc-500">{e.source==="google_sheets"?"Sheets":e.source==="app"?"PerformancePitch":"Legacy"}</td>}{show("actions")&&<td className="p-3"><div className="flex justify-end gap-1">{canEdit&&e.episode_state!=="closed"&&<><Button size="sm" variant="outline" onClick={()=>onFollow(e)} className="h-7 border-zinc-700 text-[11px]">Seguimiento</Button>{canViewClinical&&<Button size="sm" variant="outline" onClick={()=>onClearance(e)} className="h-7 border-emerald-500/30 text-emerald-300 text-[11px]">Dar alta</Button>}<Button size="sm" variant="ghost" onClick={()=>onEdit(e)} className="h-7 text-[11px]">Editar</Button></>}</div></td>}</tr>})}</tbody></table></div>
}

function PainInbox({signals,playerMap,squadId,onChanged}) { const {toast}=useToast(); const [busy,setBusy]=useState(null); const pending=signals.filter((s)=>s.status==="pending_review"); async function act(signal,kind){setBusy(signal.id+kind);try{if(kind==="dismiss")await reviewMedicalWellnessSignal(squadId,signal.id,{dismiss:true,review_note:"Revisado desde bandeja médica"});else if(kind==="review")await reviewMedicalWellnessSignal(squadId,signal.id,{dismiss:false,review_note:"Revisado por área médica"});else await convertMedicalWellnessSignal(squadId,signal.id,{availability:"full_training"});toast({title:kind==="convert"?"Consulta médica creada":"Reporte actualizado"});await onChanged?.();}catch(err){toast({title:err?.message||"Error",variant:"destructive"})}finally{setBusy(null)}} return <div className="space-y-3"><div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"><div className="flex items-center gap-2"><ShieldCheck size={16} className="text-amber-300"/><h2 className="text-sm font-semibold text-white">Reportes de dolor por Wellness</h2></div><p className="text-xs text-zinc-500 mt-1">Son señales para revisión. No son diagnósticos ni crean lesiones automáticamente.</p></div>{pending.length===0?<div className="bg-zinc-900 border border-zinc-800 rounded-xl"><Empty text="No hay reportes de dolor pendientes"/></div>:pending.map((s)=>{const p=playerMap.get(s.player_id);return <div key={s.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4"><div className="flex-1"><div className="flex items-center gap-2"><p className="text-sm font-semibold text-white">{playerName(p)||s.player_name}</p><span className="text-[10px] border border-amber-500/30 bg-amber-500/10 text-amber-300 rounded px-2 py-0.5">Dolor {s.pain_intensity??"—"}/10</span></div><p className="text-xs text-zinc-400 mt-1">{s.pain_zone||"Zona no especificada"} · {fmtDate(s.response_date)}</p>{s.comment&&<p className="text-xs text-zinc-500 mt-1">“{s.comment}”</p>}</div><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!!busy} onClick={()=>act(s,"review")} className="border-zinc-700">Marcar revisado</Button><Button size="sm" variant="outline" disabled={!!busy} onClick={()=>act(s,"dismiss")} className="border-zinc-700 text-zinc-400">Descartar</Button><Button size="sm" disabled={!!busy} onClick={()=>act(s,"convert")} className="bg-white text-zinc-950">Crear consulta</Button></div></div>})}</div> }
