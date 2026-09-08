import React from "react";
import moment from "moment";
import { AlertCircle, CheckCircle2, Clock3 } from "lucide-react";

function fmtDate(d) { return d ? moment(d).format("DD/MM/YYYY") : "—"; }
const AVAILABILITY = {
  unavailable: "No disponible",
  physiotherapy: "Kinesiología",
  individual_field: "Campo individual",
  modified_training: "Trabajo modificado",
  partial_integration: "Integración parcial",
  full_training: "Entrenamiento completo",
  available_to_compete: "Disponible para competir",
};

export default function PlayerMedicalTab({ medical = [] }) {
  if (!medical.length) return <div className="text-center py-10 text-zinc-600 text-sm">Sin registros médicos visibles</div>;

  const active = medical.filter((m) => m.episode_state !== "closed" && !m.medical_clearance_date);
  const history = medical.filter((m) => m.episode_state === "closed" || m.medical_clearance_date);

  return (
    <div className="space-y-5">
      {active.length > 0 && <section>
        <p className="text-xs text-amber-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5"><AlertCircle size={11}/> Episodios activos ({active.length})</p>
        <div className="space-y-2">{active.map((m) => <div key={m.id} className="bg-zinc-900 border border-amber-500/20 rounded-xl p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">{m.confirmed_diagnosis || m.preliminary_diagnosis || m.lesion_consulta || m.operational_note || "Registro médico"}</p><p className="text-xs text-zinc-500 mt-1">{fmtDate(m.event_date || m.fecha_inicio_tto)}{m.body_area || m.body_region ? ` · ${m.body_area || m.body_region}` : ""}</p></div><span className="text-[10px] px-2 py-1 rounded border border-amber-500/30 text-amber-300">{AVAILABILITY[m.availability] || m.availability || "Activo"}</span></div>{m.operational_note && <p className="text-xs text-zinc-400 mt-3">{m.operational_note}</p>}{m.expected_return_date && <p className="text-[10px] text-zinc-600 mt-2 flex items-center gap-1"><Clock3 size={10}/> Retorno estimado: {fmtDate(m.expected_return_date)} · no implica alta</p>}</div>)}</div>
      </section>}

      {history.length > 0 && <section>
        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2">Historial</p>
        <div className="space-y-2">{history.map((m) => <div key={m.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-sm text-white">{m.confirmed_diagnosis || m.preliminary_diagnosis || m.lesion_consulta || m.operational_note || "Registro médico"}</p><p className="text-xs text-zinc-500 mt-1">{fmtDate(m.event_date || m.fecha_inicio_tto)}{m.medical_clearance_date ? ` → alta ${fmtDate(m.medical_clearance_date)}` : ""}</p></div><CheckCircle2 size={14} className="text-emerald-400 shrink-0"/></div></div>)}</div>
      </section>}
    </div>
  );
}