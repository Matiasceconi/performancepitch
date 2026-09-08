import React, { useMemo, useState } from "react";
import { X, UserPlus } from "lucide-react";
import { scoutingGateway } from "@/lib/scoutingApi";

const EMPTY = {
  first_name: "", last_name: "", full_name: "", birth_date: "", nationality: "", second_nationality: "",
  position: "", secondary_positions: [], dominant_leg: "unknown", height_cm: "", weight_kg: "", photo_url: "",
  current_club_name: "", current_competition: "", country: "", market_value_estimate: "", market_value_currency: "USD",
  contract_end_date: "", ownership_status: "unknown", agent_name: "", agent_contact: "", availability_status: "unknown",
  availability_source: "", source_type: "manual", source_name: "", internal_notes: "", role_profile_ids: [], pipeline_stage: "discovered",
};

function Field({ label, children, span = "" }) { return <div className={span}><label className="text-[11px] text-zinc-500 block mb-1.5">{label}</label>{children}</div>; }
const input = "w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-zinc-500";

export default function ProspectFormModal({ prospect, roleProfiles = [], needs = [], onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...(prospect || {}), recruitment_need_id: "" }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEdit = !!prospect?.id;
  const displayName = useMemo(() => form.full_name || [form.first_name, form.last_name].filter(Boolean).join(" "), [form.full_name, form.first_name, form.last_name]);
  function setF(key, value) { setForm((f) => ({ ...f, [key]: value })); }
  function toggleRole(id) { setF("role_profile_ids", form.role_profile_ids?.includes(id) ? form.role_profile_ids.filter((x) => x !== id) : [...(form.role_profile_ids || []), id]); }

  async function save(e) {
    e.preventDefault(); setError("");
    if (!displayName.trim()) { setError("Ingresá el nombre del jugador."); return; }
    setSaving(true);
    try {
      const payload = { ...form, full_name: displayName.trim(), height_cm: form.height_cm === "" ? null : Number(form.height_cm), weight_kg: form.weight_kg === "" ? null : Number(form.weight_kg), market_value_estimate: form.market_value_estimate === "" ? null : Number(form.market_value_estimate) };
      const data = isEdit
        ? await scoutingGateway("update_prospect", { prospect_id: prospect.id, ...payload })
        : await scoutingGateway("create_prospect", payload);
      onSaved?.(data.prospect); onClose?.();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-3" onClick={onClose}>
    <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center"><UserPlus size={18} className="text-blue-400" /></div><div><h2 className="text-lg font-bold text-white">{isEdit ? "Editar prospecto" : "Nuevo prospecto"}</h2><p className="text-xs text-zinc-500">Identidad externa. No crea un Player del club.</p></div></div>
        <button type="button" onClick={onClose} className="p-2 text-zinc-500 hover:text-white"><X size={18} /></button>
      </div>
      <div className="p-5 space-y-6">
        {error && <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-sm text-red-300">{error}</div>}
        <section><h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Identidad y fútbol</h3><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Nombre"><input value={form.first_name || ""} onChange={(e)=>setF("first_name",e.target.value)} className={input} /></Field>
          <Field label="Apellido"><input value={form.last_name || ""} onChange={(e)=>setF("last_name",e.target.value)} className={input} /></Field>
          <Field label="Nombre completo"><input value={form.full_name || ""} onChange={(e)=>setF("full_name",e.target.value)} placeholder="Se completa con nombre + apellido" className={input} /></Field>
          <Field label="Fecha de nacimiento"><input type="date" value={form.birth_date || ""} onChange={(e)=>setF("birth_date",e.target.value)} className={input} /></Field>
          <Field label="Nacionalidad"><input value={form.nationality || ""} onChange={(e)=>setF("nationality",e.target.value)} className={input} /></Field>
          <Field label="Posición"><input value={form.position || ""} onChange={(e)=>setF("position",e.target.value)} placeholder="Ej. Defensor central" className={input} /></Field>
          <Field label="Pie"><select value={form.dominant_leg || "unknown"} onChange={(e)=>setF("dominant_leg",e.target.value)} className={input}><option value="unknown">Sin dato</option><option value="right">Derecho</option><option value="left">Izquierdo</option><option value="both">Ambos</option></select></Field>
          <Field label="Altura (cm)"><input type="number" value={form.height_cm ?? ""} onChange={(e)=>setF("height_cm",e.target.value)} className={input} /></Field>
        </div></section>
        <section><h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Club y mercado</h3><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Club actual"><input value={form.current_club_name || ""} onChange={(e)=>setF("current_club_name",e.target.value)} className={input} /></Field>
          <Field label="Competición"><input value={form.current_competition || ""} onChange={(e)=>setF("current_competition",e.target.value)} className={input} /></Field>
          <Field label="País / mercado"><input value={form.country || ""} onChange={(e)=>setF("country",e.target.value)} className={input} /></Field>
          <Field label="Fin de contrato"><input type="date" value={form.contract_end_date || ""} onChange={(e)=>setF("contract_end_date",e.target.value)} className={input} /></Field>
          <Field label="Valor estimado"><div className="flex gap-2"><input type="number" value={form.market_value_estimate ?? ""} onChange={(e)=>setF("market_value_estimate",e.target.value)} className={input} /><select value={form.market_value_currency || "USD"} onChange={(e)=>setF("market_value_currency",e.target.value)} className={`${input} max-w-24`}><option>USD</option><option>EUR</option><option>ARS</option></select></div></Field>
          <Field label="Situación"><select value={form.ownership_status || "unknown"} onChange={(e)=>setF("ownership_status",e.target.value)} className={input}><option value="unknown">Sin confirmar</option><option value="owned">Propiedad del club</option><option value="loan">A préstamo</option><option value="free_agent">Libre</option></select></Field>
          <Field label="Disponibilidad"><select value={form.availability_status || "unknown"} onChange={(e)=>setF("availability_status",e.target.value)} className={input}><option value="unknown">Sin verificar</option><option value="available">Disponible</option><option value="potentially_available">Potencialmente disponible</option><option value="not_available">No disponible</option></select></Field>
          <Field label="Fuente disponibilidad"><input value={form.availability_source || ""} onChange={(e)=>setF("availability_source",e.target.value)} placeholder="Agente, club, proveedor..." className={input} /></Field>
          <Field label="Agente"><input value={form.agent_name || ""} onChange={(e)=>setF("agent_name",e.target.value)} className={input} /></Field>
          <Field label="Contacto agente"><input value={form.agent_contact || ""} onChange={(e)=>setF("agent_contact",e.target.value)} className={input} /></Field>
        </div></section>
        <section><h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Perfil buscado</h3><div className="flex flex-wrap gap-2">{roleProfiles.map((r)=><button type="button" key={r.id} onClick={()=>toggleRole(r.id)} className={`px-3 py-1.5 rounded-lg border text-xs ${form.role_profile_ids?.includes(r.id)?"bg-blue-500/15 border-blue-500/40 text-blue-200":"bg-zinc-900 border-zinc-800 text-zinc-500"}`}>{r.name}</button>)}{!roleProfiles.length&&<span className="text-xs text-zinc-600">Todavía no hay perfiles de rol.</span>}</div></section>
        {!isEdit && <section className="grid sm:grid-cols-2 gap-3"><Field label="Vincular a una necesidad"><select value={form.recruitment_need_id || ""} onChange={(e)=>setF("recruitment_need_id",e.target.value)} className={input}><option value="">Sin necesidad específica</option>{needs.filter((n)=>!["filled","cancelled"].includes(n.status)).map((n)=><option key={n.id} value={n.id}>{n.title}</option>)}</select></Field><Field label="Origen"><div className="flex gap-2"><select value={form.source_type || "manual"} onChange={(e)=>setF("source_type",e.target.value)} className={input}><option value="manual">Manual</option><option value="provider">Proveedor</option><option value="scout_report">Informe scout</option><option value="referral">Referencia</option><option value="other">Otro</option></select><input value={form.source_name || ""} onChange={(e)=>setF("source_name",e.target.value)} placeholder="Fuente" className={input}/></div></Field></section>}
        <Field label="Notas internas"><textarea value={form.internal_notes || ""} onChange={(e)=>setF("internal_notes",e.target.value)} rows={3} className={`${input} resize-none`} placeholder="Información útil para el departamento; diferenciar hechos confirmados de rumores." /></Field>
        <div className="flex justify-end gap-2 border-t border-zinc-800 pt-4"><button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300">Cancelar</button><button disabled={saving} className="px-4 py-2 rounded-lg bg-white text-zinc-950 font-semibold text-sm disabled:opacity-50">{saving?"Guardando…":isEdit?"Guardar cambios":"Crear prospecto"}</button></div>
      </div>
    </form>
  </div>;
}
