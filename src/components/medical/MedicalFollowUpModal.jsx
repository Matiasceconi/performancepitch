import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addMedicalFollowUp, giveMedicalClearance } from "@/lib/medicalApi";
import { useToast } from "@/components/ui/use-toast";

const AVAILABILITY = [["unavailable","No disponible"],["physiotherapy","Kinesiología"],["individual_field","Campo individual"],["modified_training","Trabajo modificado"],["partial_integration","Integración parcial"],["full_training","Entrenamiento completo"],["available_to_compete","Disponible para competir"]];
const PHASES = [["clinical","Fase clínica"],["rehabilitation","Rehabilitación"],["individual_field","Campo individual"],["partial_integration","Integración parcial"],["full_training","Entrenamiento completo"],["available","Disponible"]];

export default function MedicalFollowUpModal({ open, onClose, onSaved, episode, squadId, mode = "followup", canViewClinical = true }) {
  const today = new Date().toISOString().slice(0,10);
  const [form, setForm] = useState({ follow_up_date: today, follow_up_time: "", note: "", private_note: "", operational_note: episode?.operational_note || "", availability: episode?.availability || "unavailable", rehab_phase: episode?.rehab_phase || "clinical", next_control_date: episode?.next_control_date || "", decision: "continue", medical_clearance_date: today, actual_return_date: "", medical_clearance_note: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const clearance = mode === "clearance";
  const set = (k,v) => setForm((f) => ({...f,[k]:v}));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (clearance) {
        await giveMedicalClearance(squadId, episode.id, { medical_clearance_date: form.medical_clearance_date, actual_return_date: form.actual_return_date, medical_clearance_note: form.medical_clearance_note });
        toast({ title: "Alta médica registrada y auditada" });
      } else {
        await addMedicalFollowUp(squadId, episode.id, { follow_up_date: form.follow_up_date, follow_up_time: form.follow_up_time, note: form.note, private_note: form.private_note, operational_note: form.operational_note, availability: form.availability, rehab_phase: form.rehab_phase, next_control_date: form.next_control_date, decision: form.decision });
        toast({ title: "Seguimiento agregado" });
      }
      onSaved?.(); onClose?.();
    } catch (err) { toast({ title: err?.message || "No se pudo guardar", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  return <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}><DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-xl"><DialogHeader><DialogTitle>{clearance ? "Dar alta médica" : `Agregar seguimiento — ${episode?.player_name_original || "Jugador"}`}</DialogTitle></DialogHeader>
    <form onSubmit={submit} className="space-y-4">
      {clearance ? <>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">El alta es una acción explícita. La fecha estimada de retorno nunca ejecuta esta acción.</div>
        <div className="grid grid-cols-2 gap-3"><Field label="Fecha de alta"><Input type="date" value={form.medical_clearance_date} onChange={(e)=>set("medical_clearance_date",e.target.value)} className="bg-zinc-900 border-zinc-700" /></Field><Field label="Retorno real"><Input type="date" value={form.actual_return_date} onChange={(e)=>set("actual_return_date",e.target.value)} className="bg-zinc-900 border-zinc-700" /></Field></div>
        <Field label="Observación / criterio"><Textarea required value={form.medical_clearance_note} onChange={(e)=>set("medical_clearance_note",e.target.value)} rows={4} className="bg-zinc-900 border-zinc-700" /></Field>
      </> : <>
        <div className="grid grid-cols-2 gap-3"><Field label="Fecha"><Input type="date" value={form.follow_up_date} onChange={(e)=>set("follow_up_date",e.target.value)} className="bg-zinc-900 border-zinc-700" /></Field><Field label="Hora"><Input type="time" value={form.follow_up_time} onChange={(e)=>set("follow_up_time",e.target.value)} className="bg-zinc-900 border-zinc-700" /></Field></div>
        <div className="grid md:grid-cols-2 gap-3"><Field label="Disponibilidad"><Select value={form.availability} onValueChange={(v)=>set("availability",v)}><SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger><SelectContent className="bg-zinc-900 border-zinc-700">{AVAILABILITY.map(([v,l])=><SelectItem key={v} value={v} className="text-white">{l}</SelectItem>)}</SelectContent></Select></Field><Field label="Fase"><Select value={form.rehab_phase} onValueChange={(v)=>set("rehab_phase",v)}><SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger><SelectContent className="bg-zinc-900 border-zinc-700">{PHASES.map(([v,l])=><SelectItem key={v} value={v} className="text-white">{l}</SelectItem>)}</SelectContent></Select></Field></div>
        <div className="grid md:grid-cols-2 gap-3"><Field label="Decisión del control"><Select value={form.decision} onValueChange={(v)=>set("decision",v)}><SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger><SelectContent className="bg-zinc-900 border-zinc-700"><SelectItem value="continue" className="text-white">Continuar plan</SelectItem><SelectItem value="change_phase" className="text-white">Cambiar fase</SelectItem><SelectItem value="change_availability" className="text-white">Cambiar disponibilidad</SelectItem><SelectItem value="request_study" className="text-white">Solicitar estudio</SelectItem><SelectItem value="other" className="text-white">Otra decisión</SelectItem></SelectContent></Select></Field><Field label="Próximo control"><Input type="date" value={form.next_control_date} onChange={(e)=>set("next_control_date",e.target.value)} className="bg-zinc-900 border-zinc-700" /></Field></div>
        <Field label="Nota de seguimiento"><Textarea value={form.note} onChange={(e)=>set("note",e.target.value)} rows={3} className="bg-zinc-900 border-zinc-700" /></Field>
        <Field label="Información operativa para staff"><Textarea value={form.operational_note} onChange={(e)=>set("operational_note",e.target.value)} rows={2} className="bg-zinc-900 border-zinc-700" /></Field>
        {canViewClinical && <Field label="Nota médica privada"><Textarea value={form.private_note} onChange={(e)=>set("private_note",e.target.value)} rows={3} className="bg-zinc-900 border-zinc-700" /></Field>}
      </>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} className="border-zinc-700">Cancelar</Button><Button type="submit" disabled={saving} className={clearance ? "bg-emerald-600 hover:bg-emerald-500" : "bg-white text-zinc-950 hover:bg-zinc-200"}>{saving ? "Guardando…" : clearance ? "Confirmar alta médica" : "Agregar seguimiento"}</Button></div>
    </form>
  </DialogContent></Dialog>;
}
function Field({label,children}) { return <div><label className="text-xs text-zinc-400 mb-1.5 block">{label}</label>{children}</div>; }
