import React, { useEffect, useMemo, useState } from "react";
import { X, Heart, AlertCircle, Activity, CheckCircle, Clock, FileText, ShieldCheck } from "lucide-react";
import { getPlayerMedicalHistory } from "@/lib/medicalApi";

const AVAILABILITY_LABEL = {
  unavailable: "No disponible",
  physiotherapy: "Kinesiología",
  individual_field: "Campo individual",
  modified_training: "Trabajo modificado",
  partial_integration: "Integración parcial",
  full_training: "Entrenamiento completo",
  available_to_compete: "Disponible para competir",
};
const PHASE_LABEL = {
  clinical: "Fase clínica",
  rehabilitation: "Rehabilitación",
  individual_field: "Campo individual",
  partial_integration: "Integración parcial",
  full_training: "Entrenamiento completo",
  available: "Disponible",
};
const TYPE_LABEL = {
  injury: "Lesión", illness: "Enfermedad", consultation: "Consulta", discomfort_followup: "Molestia / seguimiento",
  control: "Control", rehabilitation: "Rehabilitación", return_to_training: "Retorno",
};

function fmtDate(value) {
  if (!value) return "—";
  const [y, m, d] = String(value).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}
function playerName(player) {
  return player?.full_name || [player?.first_name, player?.last_name].filter(Boolean).join(" ") || player?.name || "Jugador";
}

export default function PlayerMedicalHistory({ player, squadId, onClose }) {
  const [data, setData] = useState({ episodes: [], follow_ups: [], current_status: null, can_view_clinical: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!player?.id || !squadId) { setLoading(false); return; }
      setLoading(true); setError("");
      try {
        const result = await getPlayerMedicalHistory(squadId, player.id);
        if (!cancelled) setData(result || {});
      } catch (e) {
        if (!cancelled) setError(e?.message || "No se pudo cargar el historial médico");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [player?.id, squadId]);

  const episodes = data.episodes || [];
  const followUps = data.follow_ups || [];
  const activeEpisodes = episodes.filter((e) => e.episode_state !== "closed" && !e.medical_clearance_date);
  const closedEpisodes = episodes.filter((e) => e.episode_state === "closed" || e.medical_clearance_date);
  const filteredEpisodes = filter === "active" ? activeEpisodes : filter === "closed" ? closedEpisodes : episodes;
  const totalDaysLost = episodes.reduce((sum, e) => sum + (Number(e.perdida_dias) || 0), 0);

  const timeline = useMemo(() => {
    const rows = [];
    for (const e of episodes) {
      rows.push({
        key: `episode:${e.id}`,
        date: e.event_date || e.fecha_inicio_tto,
        time: e.event_time || "",
        kind: "episode",
        title: TYPE_LABEL[e.record_type] || "Registro médico",
        subtitle: data.can_view_clinical ? (e.confirmed_diagnosis || e.preliminary_diagnosis || e.lesion_consulta) : (e.operational_note || e.lesion_consulta || "Registro"),
        availability: e.availability,
        phase: e.rehab_phase,
      });
      if (e.medical_clearance_date) {
        rows.push({
          key: `clearance:${e.id}`,
          date: e.medical_clearance_date,
          time: String(e.medical_clearance_at || "").slice(11, 16),
          kind: "clearance",
          title: "Alta médica",
          subtitle: e.medical_clearance_by_name || "Profesional autorizado",
          availability: "available_to_compete",
          phase: "available",
        });
      }
    }
    for (const f of followUps) {
      rows.push({
        key: `follow:${f.id}`,
        date: f.follow_up_date,
        time: f.follow_up_time || "",
        kind: "followup",
        title: f.decision === "medical_clearance" ? "Alta médica" : "Seguimiento",
        subtitle: data.can_view_clinical ? (f.note || f.operational_note || "Seguimiento") : (f.operational_note || "Actualización operativa"),
        availability: f.availability,
        phase: f.rehab_phase,
        professional: f.professional_name,
      });
    }
    return rows.sort((a, b) => `${b.date || ""}T${b.time || ""}`.localeCompare(`${a.date || ""}T${a.time || ""}`));
  }, [episodes, followUps, data.can_view_clinical]);

  const status = data.current_status;
  const displayPlayer = data.player || player;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800 p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {displayPlayer?.photo_url ? <img src={displayPlayer.photo_url} alt={playerName(displayPlayer)} className="w-12 h-12 rounded-full object-cover border border-zinc-700" /> : <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 font-bold">{playerName(displayPlayer)[0]}</div>}
            <div className="min-w-0"><h2 className="text-lg font-bold text-white truncate">{playerName(displayPlayer)}</h2><p className="text-xs text-zinc-500">{displayPlayer?.position || "Sin posición"} · Historial médico longitudinal</p></div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-5">
          {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
          {loading ? <div className="py-14 flex justify-center"><div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div> : <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Estado actual" value={status ? (AVAILABILITY_LABEL[status.availability] || status.current_status || "—") : "Sin restricción"} />
              <Stat label="Episodios activos" value={activeEpisodes.length} />
              <Stat label="Episodios históricos" value={closedEpisodes.length} />
              <Stat label="Días perdidos" value={totalDaysLost} />
            </section>

            {status && <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-400"/><h3 className="text-sm font-semibold text-white">Situación operativa actual</h3></div><div className="grid sm:grid-cols-3 gap-3 mt-3 text-xs"><Info label="Disponibilidad" value={AVAILABILITY_LABEL[status.availability] || status.availability} /><Info label="Fase" value={PHASE_LABEL[status.rehab_phase] || status.rehab_phase} /><Info label="Próximo control" value={fmtDate(status.next_control_date)} /></div>{status.restriction_summary && <p className="mt-3 text-sm text-zinc-300">{status.restriction_summary}</p>}</section>}

            <section>
              <div className="flex items-center justify-between gap-3 mb-3"><h3 className="text-sm font-semibold text-white">Timeline</h3><span className="text-xs text-zinc-500">{timeline.length} eventos</span></div>
              {timeline.length === 0 ? <Empty /> : <div className="space-y-2">{timeline.map((item) => <div key={item.key} className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3"><div className="mt-0.5">{item.kind === "clearance" ? <CheckCircle size={15} className="text-emerald-400"/> : item.kind === "followup" ? <Activity size={15} className="text-blue-400"/> : <FileText size={15} className="text-zinc-400"/>}</div><div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-white">{item.title}</p><span className="text-[10px] text-zinc-500">{fmtDate(item.date)} {item.time ? `· ${item.time}` : ""}</span></div><p className="text-xs text-zinc-400 mt-1">{item.subtitle || "Sin detalle"}</p><div className="flex flex-wrap gap-2 mt-2 text-[10px] text-zinc-500">{item.availability && <span>{AVAILABILITY_LABEL[item.availability] || item.availability}</span>}{item.phase && <span>· {PHASE_LABEL[item.phase] || item.phase}</span>}{item.professional && <span>· {item.professional}</span>}</div></div></div>)}</div>}
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3"><h3 className="text-sm font-semibold text-white">Episodios</h3><div className="flex gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-lg">{[["all","Todos"],["active","Activos"],["closed","Cerrados"]].map(([id,label]) => <button key={id} onClick={() => setFilter(id)} className={`px-3 py-1 rounded text-xs ${filter===id?"bg-white text-zinc-950 font-semibold":"text-zinc-500"}`}>{label}</button>)}</div></div>
              {filteredEpisodes.length === 0 ? <Empty /> : <div className="space-y-2">{filteredEpisodes.map((e) => <div key={e.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 flex-wrap"><p className="text-sm font-semibold text-white">{data.can_view_clinical ? (e.confirmed_diagnosis || e.preliminary_diagnosis || e.lesion_consulta) : (e.operational_note || e.lesion_consulta || "Registro")}</p><span className="text-[10px] rounded border border-zinc-700 px-2 py-0.5 text-zinc-400">{TYPE_LABEL[e.record_type] || e.record_type}</span></div><p className="text-xs text-zinc-500 mt-1">{fmtDate(e.event_date || e.fecha_inicio_tto)} · {e.body_area || e.body_region || "Sin zona"}</p></div><span className={`text-[10px] px-2 py-1 rounded border ${e.episode_state === "closed" || e.medical_clearance_date ? "border-emerald-500/30 text-emerald-300" : "border-amber-500/30 text-amber-300"}`}>{e.episode_state === "closed" || e.medical_clearance_date ? "Cerrado" : "Activo"}</span></div><div className="grid sm:grid-cols-3 gap-2 mt-3 text-xs"><Info label="Disponibilidad" value={AVAILABILITY_LABEL[e.availability] || e.availability} /><Info label="Fase" value={PHASE_LABEL[e.rehab_phase] || e.rehab_phase} /><Info label="Retorno estimado" value={fmtDate(e.expected_return_date)} /></div></div>)}</div>}
            </section>
          </>}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) { return <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"><p className="text-[11px] text-zinc-500">{label}</p><p className="text-lg font-bold text-white mt-1">{value ?? "—"}</p></div>; }
function Info({ label, value }) { return <div><p className="text-[10px] uppercase tracking-wide text-zinc-600">{label}</p><p className="text-xs text-zinc-300 mt-0.5">{value || "—"}</p></div>; }
function Empty() { return <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center"><Heart size={24} className="text-zinc-700 mx-auto mb-2"/><p className="text-sm text-zinc-600">Sin registros</p></div>; }
