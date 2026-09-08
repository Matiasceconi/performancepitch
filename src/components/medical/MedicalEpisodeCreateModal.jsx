import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createMedicalEpisode } from "@/lib/medicalApi";
import { useToast } from "@/components/ui/use-toast";

const RECORD_TYPES = [
  ["injury", "Lesión"], ["illness", "Enfermedad"], ["consultation", "Consulta"],
  ["discomfort_followup", "Molestia / seguimiento"], ["control", "Control"],
  ["rehabilitation", "Rehabilitación"], ["return_to_training", "Retorno al entrenamiento"],
];
const AVAILABILITY = [
  ["unavailable", "No disponible"], ["physiotherapy", "Kinesiología"], ["individual_field", "Campo individual"],
  ["modified_training", "Trabajo modificado"], ["partial_integration", "Integración parcial"],
  ["full_training", "Entrenamiento completo"], ["available_to_compete", "Disponible para competir"],
];
const BODY_REGIONS = ["Cabeza", "Cuello", "Hombro", "Brazo", "Mano", "Columna", "Pelvis", "Aductor", "Cadera", "Muslo", "Rodilla", "Pierna", "Tobillo", "Pie", "Enfermedad", "Otro"];

export default function MedicalEpisodeCreateModal({ open, onClose, onSaved, players = [], squadId, seasonId, organizationId, canViewClinical = true }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ player_id: "", record_type: "injury", event_date: today, event_time: "", context_type: "training", training_session_id: "", match_report_id: "", lesion_consulta: "", body_region: "", body_area: "", laterality: "unknown", onset: "unknown", contact_type: "unknown", mechanism: "", preliminary_diagnosis: "", confirmed_diagnosis: "", description: "", treatment: "", studies: "", private_note: "", operational_note: "", availability: "unavailable", rehab_phase: "clinical", expected_return_date: "", next_control_date: "" });
  const [sessions, setSessions] = useState([]);
  const [matches, setMatches] = useState([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !squadId) return;
    Promise.all([
      base44.entities.TrainingSession.filter({ squad_id: squadId }, "-date", 100).catch(() => []),
      base44.entities.MatchReport.filter({ squad_id: squadId }, "-date", 100).catch(() => []),
    ]).then(([s, m]) => { setSessions(s); setMatches(m); });
  }, [open, squadId]);

  const sortedPlayers = useMemo(() => [...players].sort((a, b) => String(a.full_name || "").localeCompare(String(b.full_name || ""))), [players]);
  const isInjury = form.record_type === "injury";
  const isRehab = ["rehabilitation", "return_to_training"].includes(form.record_type);

  function set(key, value) { setForm((f) => ({ ...f, [key]: value })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.player_id || !form.lesion_consulta.trim()) {
      toast({ title: "Seleccioná jugador y completá el motivo", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await createMedicalEpisode(squadId, { ...form, season_id: seasonId || "", organization_id: organizationId || "" });
      toast({ title: "Registro médico creado" });
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast({ title: err?.message || "No se pudo crear el registro", variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nuevo registro médico</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Datos generales</p>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Jugador *"><Select value={form.player_id} onValueChange={(v) => set("player_id", v)}><SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue placeholder="Seleccionar jugador" /></SelectTrigger><SelectContent className="bg-zinc-900 border-zinc-700 max-h-72">{sortedPlayers.map((p) => <SelectItem key={p.id} value={p.id} className="text-white">{p.full_name || p.name}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Tipo de registro"><Select value={form.record_type} onValueChange={(v) => { set("record_type", v); if (["consultation","control"].includes(v)) set("availability", "full_training"); }}><SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger><SelectContent className="bg-zinc-900 border-zinc-700">{RECORD_TYPES.map(([v,l]) => <SelectItem key={v} value={v} className="text-white">{l}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Fecha"><Input type="date" value={form.event_date} onChange={(e) => set("event_date", e.target.value)} className="bg-zinc-900 border-zinc-700" /></Field>
              <Field label="Hora"><Input type="time" value={form.event_time} onChange={(e) => set("event_time", e.target.value)} className="bg-zinc-900 border-zinc-700" /></Field>
            </div>
            <Field label="Motivo / resumen *"><Input value={form.lesion_consulta} onChange={(e) => set("lesion_consulta", e.target.value)} placeholder={isInjury ? "Ej. Esguince de tobillo" : "Ej. Consulta por dolor lumbar"} className="bg-zinc-900 border-zinc-700" /></Field>
          </section>

          <section className="space-y-3 border-t border-zinc-800 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Contexto</p>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="¿Dónde ocurrió?"><Select value={form.context_type} onValueChange={(v) => set("context_type", v)}><SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger><SelectContent className="bg-zinc-900 border-zinc-700"><SelectItem value="training" className="text-white">Entrenamiento</SelectItem><SelectItem value="match" className="text-white">Partido</SelectItem><SelectItem value="gym" className="text-white">Gimnasio</SelectItem><SelectItem value="outside_club" className="text-white">Fuera del club</SelectItem><SelectItem value="other" className="text-white">Otro</SelectItem></SelectContent></Select></Field>
              {form.context_type === "training" && <Field label="Sesión vinculada"><Select value={form.training_session_id || "none"} onValueChange={(v) => set("training_session_id", v === "none" ? "" : v)}><SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue placeholder="Sin vincular" /></SelectTrigger><SelectContent className="bg-zinc-900 border-zinc-700"><SelectItem value="none" className="text-white">Sin vincular</SelectItem>{sessions.map((s) => <SelectItem key={s.id} value={s.id} className="text-white">{s.date} · {s.name || s.objective || "Sesión"}</SelectItem>)}</SelectContent></Select></Field>}
              {form.context_type === "match" && <Field label="Partido vinculado"><Select value={form.match_report_id || "none"} onValueChange={(v) => set("match_report_id", v === "none" ? "" : v)}><SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue placeholder="Sin vincular" /></SelectTrigger><SelectContent className="bg-zinc-900 border-zinc-700"><SelectItem value="none" className="text-white">Sin vincular</SelectItem>{matches.map((m) => <SelectItem key={m.id} value={m.id} className="text-white">{m.date} · {m.opponent || m.rival || "Partido"}</SelectItem>)}</SelectContent></Select></Field>}
            </div>
          </section>

          {(isInjury || form.record_type === "discomfort_followup") && <section className="space-y-3 border-t border-zinc-800 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Localización y mecanismo</p>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Región corporal"><Select value={form.body_region || "none"} onValueChange={(v) => set("body_region", v === "none" ? "" : v)}><SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue placeholder="Sin definir" /></SelectTrigger><SelectContent className="bg-zinc-900 border-zinc-700"><SelectItem value="none" className="text-white">Sin definir</SelectItem>{BODY_REGIONS.map((r) => <SelectItem key={r} value={r.toLowerCase()} className="text-white">{r}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Zona específica"><Input value={form.body_area} onChange={(e) => set("body_area", e.target.value)} className="bg-zinc-900 border-zinc-700" /></Field>
              <Field label="Lado"><Select value={form.laterality} onValueChange={(v) => set("laterality", v)}><SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger><SelectContent className="bg-zinc-900 border-zinc-700"><SelectItem value="left" className="text-white">Izquierdo</SelectItem><SelectItem value="right" className="text-white">Derecho</SelectItem><SelectItem value="bilateral" className="text-white">Bilateral</SelectItem><SelectItem value="midline" className="text-white">Línea media</SelectItem><SelectItem value="not_applicable" className="text-white">No corresponde</SelectItem><SelectItem value="unknown" className="text-white">Sin definir</SelectItem></SelectContent></Select></Field>
              <Field label="Inicio"><Select value={form.onset} onValueChange={(v) => set("onset", v)}><SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger><SelectContent className="bg-zinc-900 border-zinc-700"><SelectItem value="acute" className="text-white">Agudo</SelectItem><SelectItem value="gradual" className="text-white">Gradual</SelectItem><SelectItem value="unknown" className="text-white">Sin definir</SelectItem></SelectContent></Select></Field>
              <Field label="Contacto"><Select value={form.contact_type} onValueChange={(v) => set("contact_type", v)}><SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger><SelectContent className="bg-zinc-900 border-zinc-700"><SelectItem value="contact" className="text-white">Contacto</SelectItem><SelectItem value="non_contact" className="text-white">Sin contacto</SelectItem><SelectItem value="unknown" className="text-white">Sin definir</SelectItem><SelectItem value="not_applicable" className="text-white">No corresponde</SelectItem></SelectContent></Select></Field>
              <Field label="Mecanismo"><Input value={form.mechanism} onChange={(e) => set("mechanism", e.target.value)} className="bg-zinc-900 border-zinc-700" /></Field>
            </div>
          </section>}

          <section className="space-y-3 border-t border-zinc-800 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Disponibilidad y planificación</p>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Disponibilidad deportiva"><Select value={form.availability} onValueChange={(v) => set("availability", v)}><SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger><SelectContent className="bg-zinc-900 border-zinc-700">{AVAILABILITY.map(([v,l]) => <SelectItem key={v} value={v} className="text-white">{l}</SelectItem>)}</SelectContent></Select></Field>
              {(isRehab || form.availability !== "available_to_compete") && <Field label="Fase RTP"><Select value={form.rehab_phase} onValueChange={(v) => set("rehab_phase", v)}><SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger><SelectContent className="bg-zinc-900 border-zinc-700"><SelectItem value="clinical" className="text-white">Fase clínica</SelectItem><SelectItem value="rehabilitation" className="text-white">Rehabilitación</SelectItem><SelectItem value="individual_field" className="text-white">Campo individual</SelectItem><SelectItem value="partial_integration" className="text-white">Integración parcial</SelectItem><SelectItem value="full_training" className="text-white">Entrenamiento completo</SelectItem><SelectItem value="available" className="text-white">Disponible</SelectItem></SelectContent></Select></Field>}
              <Field label="Retorno estimado"><Input type="date" value={form.expected_return_date} onChange={(e) => set("expected_return_date", e.target.value)} className="bg-zinc-900 border-zinc-700" /><p className="text-[10px] text-zinc-600 mt-1">Es planificación. No otorga alta.</p></Field>
              <Field label="Próximo control"><Input type="date" value={form.next_control_date} onChange={(e) => set("next_control_date", e.target.value)} className="bg-zinc-900 border-zinc-700" /></Field>
            </div>
            <Field label="Información operativa para staff"><Textarea value={form.operational_note} onChange={(e) => set("operational_note", e.target.value)} rows={2} className="bg-zinc-900 border-zinc-700" placeholder="Ej. Campo individual, sin cambios de dirección" /></Field>
          </section>

          {canViewClinical && <section className="space-y-3 border-t border-zinc-800 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Información clínica</p>
            <div className="grid md:grid-cols-2 gap-3"><Field label="Diagnóstico preliminar"><Textarea value={form.preliminary_diagnosis} onChange={(e) => set("preliminary_diagnosis", e.target.value)} rows={2} className="bg-zinc-900 border-zinc-700" /></Field><Field label="Diagnóstico confirmado"><Textarea value={form.confirmed_diagnosis} onChange={(e) => set("confirmed_diagnosis", e.target.value)} rows={2} className="bg-zinc-900 border-zinc-700" /></Field></div>
            <div className="grid md:grid-cols-2 gap-3"><Field label="Tratamiento"><Textarea value={form.treatment} onChange={(e) => set("treatment", e.target.value)} rows={2} className="bg-zinc-900 border-zinc-700" /></Field><Field label="Estudios"><Textarea value={form.studies} onChange={(e) => set("studies", e.target.value)} rows={2} className="bg-zinc-900 border-zinc-700" /></Field></div>
            <Field label="Nota médica privada"><Textarea value={form.private_note} onChange={(e) => set("private_note", e.target.value)} rows={3} className="bg-zinc-900 border-zinc-700" placeholder="Sólo personal médico autorizado" /></Field>
          </section>}

          <div className="flex justify-end gap-2 border-t border-zinc-800 pt-4"><Button type="button" variant="outline" onClick={onClose} className="border-zinc-700">Cancelar</Button><Button type="submit" disabled={saving} className="bg-white text-zinc-950 hover:bg-zinc-200">{saving ? "Guardando…" : "Crear registro"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }) { return <div><label className="text-xs text-zinc-400 mb-1.5 block">{label}</label>{children}</div>; }
