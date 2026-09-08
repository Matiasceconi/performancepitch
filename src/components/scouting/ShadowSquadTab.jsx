import React, { useMemo, useState } from "react";
import { Plus, Shield, UserRound, UsersRound } from "lucide-react";
import { scoutingGateway } from "@/lib/scoutingApi";

const HORIZONS = [
  ["current","Actual"],["next_window","Próxima ventana"],["6_months","6 meses"],["12_months","12 meses"],["24_months","24 meses"],
];

export default function ShadowSquadTab({ plans, slots, prospects, players, roles, needs, squads, canCreate, canEdit, onChanged }) {
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id || "");
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newPlan, setNewPlan] = useState({ name:"", squad_id:"", horizon:"next_window", formation:"4-3-3", notes:"" });
  const [slotForm, setSlotForm] = useState({ slot_key:"", position:"", role_profile_id:"", candidate_type:"prospect", current_player_id:"", prospect_id:"", status:"alternative", rank:1, recruitment_need_id:"", rationale:"" });
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0] || null;
  const planSlots = selectedPlan ? slots.filter((s) => s.plan_id === selectedPlan.id && s.status !== "remove") : [];
  const grouped = useMemo(() => {
    const map = new Map();
    planSlots.forEach((slot) => { if (!map.has(slot.slot_key)) map.set(slot.slot_key, []); map.get(slot.slot_key).push(slot); });
    return [...map.entries()].map(([key, rows]) => [key, rows.sort((a,b) => Number(a.rank||1)-Number(b.rank||1))]);
  }, [planSlots]);

  async function createPlan(e) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const squad = squads.find((s) => s.id === newPlan.squad_id);
      const res = await scoutingGateway("create_shadow_plan", { ...newPlan, squad_name:squad?.name, season_id:squad?.season });
      setSelectedPlanId(res.plan.id); setShowNew(false); setNewPlan({ name:"", squad_id:"", horizon:"next_window", formation:"4-3-3", notes:"" }); await onChanged?.();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  async function saveSlot(e) {
    e.preventDefault(); if (!selectedPlan) return; setSaving(true); setError("");
    try { await scoutingGateway("save_shadow_slot", { plan_id:selectedPlan.id, ...slotForm }); setSlotForm({ slot_key:"", position:"", role_profile_id:"", candidate_type:"prospect", current_player_id:"", prospect_id:"", status:"alternative", rank:1, recruitment_need_id:"", rationale:"" }); await onChanged?.(); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  async function removeSlot(slot) {
    try { await scoutingGateway("save_shadow_slot", { slot_id:slot.id, plan_id:slot.plan_id, slot_key:slot.slot_key, position:slot.position, role_profile_id:slot.role_profile_id, candidate_type:slot.candidate_type, current_player_id:slot.current_player_id, prospect_id:slot.prospect_id, status:"remove", rank:slot.rank, recruitment_need_id:slot.recruitment_need_id, rationale:slot.rationale }); await onChanged?.(); } catch (e) { setError(e.message); }
  }

  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3 flex-wrap"><div><h3 className="text-sm font-bold text-white flex items-center gap-2"><Shield size={16} className="text-cyan-400"/> Shadow Squad</h3><p className="text-xs text-zinc-600 mt-1">Proyecta el plantel por puesto: referencia actual, primera opción y alternativas de mercado.</p></div>{canCreate && <button onClick={() => setShowNew((v)=>!v)} className="px-3 py-2 rounded-lg bg-white text-zinc-950 text-sm font-semibold flex items-center gap-1"><Plus size={13}/> Nuevo Shadow Squad</button>}</div>
    {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}
    {showNew && <form onSubmit={createPlan} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 grid md:grid-cols-2 xl:grid-cols-5 gap-3"><Field label="Nombre"><input required value={newPlan.name} onChange={(e)=>setNewPlan({...newPlan,name:e.target.value})} className="input" placeholder="Ej: Primera 2027"/></Field><Field label="Plantel"><select value={newPlan.squad_id} onChange={(e)=>setNewPlan({...newPlan,squad_id:e.target.value})} className="input"><option value="">Institucional</option>{squads.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="Horizonte"><select value={newPlan.horizon} onChange={(e)=>setNewPlan({...newPlan,horizon:e.target.value})} className="input">{HORIZONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field><Field label="Estructura"><input value={newPlan.formation} onChange={(e)=>setNewPlan({...newPlan,formation:e.target.value})} className="input"/></Field><div className="flex items-end"><button disabled={saving} className="w-full px-3 py-2 rounded-lg bg-cyan-400 text-zinc-950 text-xs font-bold">Crear</button></div></form>}
    {!!plans.length && <div className="flex gap-2 overflow-x-auto">{plans.map((p)=><button key={p.id} onClick={()=>setSelectedPlanId(p.id)} className={`px-3 py-2 rounded-lg border text-xs whitespace-nowrap ${selectedPlan?.id===p.id?"bg-cyan-500/10 border-cyan-500/30 text-cyan-300":"bg-zinc-900 border-zinc-800 text-zinc-500"}`}>{p.name} · {p.formation || "—"}</button>)}</div>}
    {!selectedPlan ? <Empty text="Creá el primer Shadow Squad para proyectar reemplazos y profundidad por puesto."/> : <>
      {canEdit && <form onSubmit={saveSlot} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3"><div className="flex items-center justify-between"><p className="text-xs font-bold text-white">Agregar referencia u opción</p><span className="text-[10px] text-zinc-600">{selectedPlan.name}</span></div><div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3"><Field label="Puesto / slot"><input required value={slotForm.slot_key} onChange={(e)=>setSlotForm({...slotForm,slot_key:e.target.value})} className="input" placeholder="Ej: Central izquierdo"/></Field><Field label="Posición"><input value={slotForm.position} onChange={(e)=>setSlotForm({...slotForm,position:e.target.value})} className="input" placeholder="Defensor central"/></Field><Field label="Perfil de rol"><select value={slotForm.role_profile_id} onChange={(e)=>setSlotForm({...slotForm,role_profile_id:e.target.value})} className="input"><option value="">Sin perfil</option>{roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></Field><Field label="Necesidad"><select value={slotForm.recruitment_need_id} onChange={(e)=>setSlotForm({...slotForm,recruitment_need_id:e.target.value})} className="input"><option value="">Sin necesidad vinculada</option>{needs.map(n=><option key={n.id} value={n.id}>{n.title}</option>)}</select></Field><Field label="Tipo"><select value={slotForm.candidate_type} onChange={(e)=>setSlotForm({...slotForm,candidate_type:e.target.value,current_player_id:"",prospect_id:""})} className="input"><option value="current_player">Jugador actual</option><option value="prospect">Prospecto</option></select></Field>{slotForm.candidate_type==="current_player"?<Field label="Jugador actual"><select required value={slotForm.current_player_id} onChange={(e)=>setSlotForm({...slotForm,current_player_id:e.target.value})} className="input"><option value="">Seleccionar…</option>{players.map(p=><option key={p.id} value={p.id}>{p.full_name} · {p.position || "—"}</option>)}</select></Field>:<Field label="Prospecto"><select required value={slotForm.prospect_id} onChange={(e)=>setSlotForm({...slotForm,prospect_id:e.target.value})} className="input"><option value="">Seleccionar…</option>{prospects.map(p=><option key={p.id} value={p.id}>{p.full_name} · {p.current_club_name || "Sin club"}</option>)}</select></Field>}<Field label="Jerarquía"><select value={slotForm.status} onChange={(e)=>setSlotForm({...slotForm,status:e.target.value})} className="input"><option value="reference">Referencia actual</option><option value="first_option">Primera opción</option><option value="alternative">Alternativa</option><option value="monitor">Seguimiento</option></select></Field><Field label="Ranking"><input type="number" min="1" value={slotForm.rank} onChange={(e)=>setSlotForm({...slotForm,rank:Number(e.target.value)})} className="input"/></Field></div><Field label="Racional"><textarea value={slotForm.rationale} onChange={(e)=>setSlotForm({...slotForm,rationale:e.target.value})} className="input min-h-16" placeholder="Por qué ocupa este lugar en la proyección…"/></Field><div className="flex justify-end"><button disabled={saving} className="px-4 py-2 rounded-lg bg-white text-zinc-950 text-xs font-bold">Guardar opción</button></div></form>}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{grouped.map(([slotKey,rows])=><div key={slotKey} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden"><div className="px-4 py-3 border-b border-zinc-800"><p className="text-sm font-bold text-white">{slotKey}</p><p className="text-[10px] text-zinc-600">{rows[0]?.position || "Posición abierta"}</p></div><div className="p-2 space-y-1.5">{rows.map((row)=><div key={row.id} className={`rounded-lg border p-3 ${row.candidate_type==="current_player"?"border-cyan-500/20 bg-cyan-500/[0.04]":"border-zinc-800 bg-zinc-950"}`}><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2">{row.candidate_type==="current_player"?<UserRound size={14} className="text-cyan-400"/>:<UsersRound size={14} className="text-amber-400"/>}<div><p className="text-xs font-semibold text-white">{row.current_player_name || row.prospect_name}</p><p className="text-[9px] text-zinc-600">#{row.rank} · {labelStatus(row.status)}</p></div></div>{canEdit&&<button onClick={()=>removeSlot(row)} className="text-[10px] text-zinc-700 hover:text-red-400">Quitar</button>}</div>{row.rationale&&<p className="text-[10px] text-zinc-500 mt-2">{row.rationale}</p>}</div>)}</div></div>)}{!grouped.length&&<Empty text="Todavía no hay referencias ni candidatos asignados a puestos."/>}</div>
    </>}
    <style>{`.input{width:100%;background:#09090b;border:1px solid #27272a;border-radius:.5rem;padding:.5rem .75rem;font-size:.75rem;color:white;outline:none}.input:focus{border-color:#52525b}`}</style>
  </div>;
}

function Field({label,children}){return <label className="block"><span className="text-[10px] text-zinc-500 block mb-1">{label}</span>{children}</label>}
function Empty({text}){return <div className="md:col-span-2 xl:col-span-3 rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-600">{text}</div>}
function labelStatus(status){return {reference:"Referencia actual",first_option:"Primera opción",alternative:"Alternativa",monitor:"Seguimiento"}[status] || status}
