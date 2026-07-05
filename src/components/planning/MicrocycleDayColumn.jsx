import React from "react";
import moment from "moment";
import { CheckCircle2, Clock, Home, Link2, Moon, Pencil, Plane, Trophy } from "lucide-react";
import { MD_OPTIONS, WORK_BLOCKS, dayNameEs, getBlockAutoContent, inferSessionForBlock, isFreeDay, objectiveStyle } from "@/components/planning/microcyclePlanUtils";

function upsertBlock(day, type, patch, updateDay, dayIdx) {
  const blocks = day.blocks || [];
  const existing = blocks.find((block) => block.type === type);
  if (existing) {
    updateDay(dayIdx, { blocks: blocks.map((block) => block.id === existing.id ? { ...block, ...patch } : block) });
  } else {
    updateDay(dayIdx, { blocks: [...blocks, { id: `${type}-${dayIdx}`, type, title: type, content: "", session_id: "", auto_sync: true, ...patch }] });
  }
}

function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isMatchEvent(ev) {
  return normalizeText(`${ev?.title || ""} ${ev?.event_type || ""} ${ev?.type || ""}`).includes("partido");
}

function isTravelEvent(ev) {
  const text = normalizeText(`${ev?.title || ""} ${ev?.event_type || ""} ${ev?.type || ""}`);
  return text.includes("viaje") || text.includes("traslado") || text.includes("salida");
}

function eventTime(ev) {
  return ev?.time || ev?.start_time || "Horario sin definir";
}

function eventCompetition(ev) {
  const notes = String(ev?.notes || "");
  return ev?.competition || ev?.competencia || notes.match(/competencia\s*:?\s*([^\n·|]+)/i)?.[1] || "Competencia sin definir";
}

function EventFocusCard({ event, type }) {
  const isMatch = type === "match";
  return (
    <div className={`flex-1 m-3 rounded-2xl border p-4 flex flex-col items-center justify-center text-center ${isMatch ? "bg-emerald-950 text-white border-emerald-800" : "bg-indigo-950 text-white border-indigo-800"}`}>
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isMatch ? "bg-white" : "bg-indigo-800"}`}>
        {isMatch && event?.rival_logo_url ? <img src={event.rival_logo_url} alt="Escudo rival" className="w-14 h-14 object-contain" /> : isMatch ? <Trophy size={30} className="text-emerald-700" /> : <Plane size={30} className="text-white" />}
      </div>
      <p className={`text-[10px] font-black uppercase tracking-[0.25em] ${isMatch ? "text-emerald-300" : "text-indigo-300"}`}>{isMatch ? "Partido" : "Viaje"}</p>
      <h3 className="mt-2 text-xl font-black leading-tight">{isMatch ? `vs ${event?.rival || event?.title || "Rival"}` : event?.title || "Viaje"}</h3>
      <div className="mt-4 space-y-2 text-xs font-semibold text-white/80">
        {isMatch && <p className="flex items-center justify-center gap-2"><Trophy size={14} /> {eventCompetition(event)}</p>}
        {isMatch && <p className="flex items-center justify-center gap-2"><Home size={14} /> {event?.home_away || "Condición sin definir"}</p>}
        <p className="flex items-center justify-center gap-2"><Clock size={14} /> {eventTime(event)}</p>
      </div>
      {event?.location && <p className="mt-3 text-[11px] text-white/60">{event.location}</p>}
    </div>
  );
}

function WorkCard({ config, block, sessionLibrary, session, details, onChange }) {
  const selectedSessionId = block?.auto_sync === false ? "" : block?.session_id || session?.id || "";
  const autoContent = getBlockAutoContent({ ...block, content: "" }, session, details);
  const fullContent = getBlockAutoContent(block, session, details);
  const hasManual = Boolean(String(block?.content || "").trim());
  const hasSync = Boolean(session && autoContent);
  const source = hasManual ? "Editado" : hasSync ? "Sincronizado" : "Sin datos";
  const SourceIcon = hasManual ? Pencil : CheckCircle2;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-7 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
          <p className="text-[10px] font-black uppercase tracking-wide text-zinc-800 truncate">{config.label}</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black ${hasManual ? "bg-amber-50 text-amber-700" : hasSync ? "bg-blue-50 text-blue-700" : "bg-zinc-100 text-zinc-400"}`}>
          <SourceIcon size={10} /> {source}
        </span>
      </div>
      <select value={selectedSessionId} onChange={(e) => onChange({ session_id: e.target.value, auto_sync: true })} className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[10px] font-semibold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-200">
        <option value="">Completar desde sesión...</option>
        {sessionLibrary.map((item) => <option key={item.id} value={item.id}>{item.date ? `${moment(item.date).format("DD/MM")} · ` : ""}{item.title}</option>)}
      </select>
      {hasSync && <div className="mt-2 rounded-lg bg-blue-50 border border-blue-100 px-2 py-2 text-[10px] leading-relaxed text-blue-900 whitespace-pre-wrap"><Link2 size={11} className="inline mr-1" />{autoContent}</div>}
      {hasSync && <button type="button" onClick={() => onChange({ session_id: "", auto_sync: false })} className="mt-1 text-[10px] font-black text-zinc-500 hover:text-blue-700">Usar solo edición manual</button>}
      <textarea
        value={block?.content || ""}
        onChange={(e) => onChange({ content: e.target.value, manual_edited: Boolean(e.target.value.trim()) })}
        placeholder="Escribir manualmente o complementar la sesión..."
        className="mt-2 w-full min-h-[54px] rounded-lg border border-zinc-200 bg-white px-2 py-2 text-[10px] leading-relaxed text-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-200 resize-none"
      />
      {!fullContent && <p className="mt-1 text-[10px] text-zinc-400">Sin tareas vinculadas</p>}
    </div>
  );
}

export default function MicrocycleDayColumn({ day, dayIdx, sessionLibrary, sessionDetails, blockSession, sessionsById, updateDay, physicalObjectives = [], calendarEvents = [] }) {
  const matchEvent = calendarEvents.find(isMatchEvent);
  const travelEvent = calendarEvents.find(isTravelEvent);
  const specialEvent = matchEvent || travelEvent;
  const free = !specialEvent && isFreeDay(day);
  const objective = day.physical_objective || "Mixto";
  const objStyle = objectiveStyle(objective, physicalObjectives);
  const blocks = day.blocks || [];
  const visibleObjectives = physicalObjectives.filter((item) => item.active !== false && !item.hidden).sort((a, b) => (a.order || 0) - (b.order || 0));
  const objectiveOptions = visibleObjectives.length ? visibleObjectives.map((item) => item.name) : ["Recuperación", "Readaptación", "Velocidad", "Duración metabólica", "Mixto", "Activación pre competencia"];

  if (specialEvent) {
    return (
      <div className={`bg-white border-2 rounded-2xl shadow-lg overflow-hidden min-w-0 flex flex-col min-h-[520px] ${matchEvent ? "border-emerald-700" : "border-indigo-700"}`}>
        <div className={`px-3 pt-3 pb-2 text-center border-b ${matchEvent ? "bg-emerald-50 border-emerald-100" : "bg-indigo-50 border-indigo-100"}`}>
          <p className="text-[11px] font-black text-zinc-600 tracking-[0.22em]">{dayNameEs(day.date)}</p>
          <input type="date" value={day.date} onChange={(e) => updateDay(dayIdx, { date: e.target.value })} className="bg-transparent text-center text-[11px] font-semibold text-zinc-500 focus:outline-none mt-1" />
          <p className={`mt-2 text-2xl font-black ${matchEvent ? "text-emerald-900" : "text-indigo-900"}`}>{day.md || "MD"}</p>
        </div>
        <EventFocusCard event={specialEvent} type={matchEvent ? "match" : "travel"} />
      </div>
    );
  }

  if (free) {
    return (
      <div className="min-w-0 rounded-2xl border-2 border-blue-200 bg-blue-50 p-4 shadow-md flex flex-col items-center justify-center min-h-[520px] text-center">
        <Moon size={44} className="text-blue-500 mb-4" />
        <p className="text-[11px] font-black text-blue-600 tracking-[0.25em]">{dayNameEs(day.date)}</p>
        <input type="date" value={day.date} onChange={(e) => updateDay(dayIdx, { date: e.target.value })} className="bg-transparent text-center text-xs font-bold text-blue-600 focus:outline-none mt-1" />
        <select value="Libre" onChange={(e) => updateDay(dayIdx, { md: e.target.value, auto_free: e.target.value === "Libre", blocks: e.target.value === "Libre" ? [] : WORK_BLOCKS.map((item) => ({ id: `${item.type}-${dayIdx}`, type: item.type, title: item.label, content: "", session_id: "", auto_sync: true })) })} className="mt-8 bg-transparent text-3xl font-black text-blue-800 text-center focus:outline-none">
          {MD_OPTIONS.map((item) => <option key={item}>{item}</option>)}
        </select>
        <p className="mt-3 text-2xl font-black text-blue-800">DÍA LIBRE</p>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-zinc-200 rounded-2xl shadow-md overflow-hidden min-w-0 flex flex-col min-h-[520px]">
      <div className="px-3 pt-3 pb-2 text-center border-b border-zinc-200 bg-zinc-50">
        <p className="text-[11px] font-black text-zinc-600 tracking-[0.22em]">{dayNameEs(day.date)}</p>
        <input type="date" value={day.date} onChange={(e) => updateDay(dayIdx, { date: e.target.value })} className="bg-transparent text-center text-[11px] font-semibold text-zinc-500 focus:outline-none mt-1" />
        <select value={day.md || "MD-5"} onChange={(e) => updateDay(dayIdx, { md: e.target.value, auto_free: e.target.value === "Libre", blocks: e.target.value === "Libre" ? [] : blocks })} className="mt-2 w-full bg-transparent text-center text-2xl font-black text-slate-950 focus:outline-none">
          {MD_OPTIONS.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={objectiveOptions.includes(objective) ? objective : objectiveOptions[0]} onChange={(e) => updateDay(dayIdx, { physical_objective: e.target.value })} className="mt-2 w-full rounded-xl border px-2 py-2 text-[11px] font-black text-center focus:outline-none" style={{ backgroundColor: objStyle.bg, color: objStyle.text, borderColor: objStyle.border }}>
          {objectiveOptions.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>
      <div className="flex-1 p-2.5 space-y-2 bg-slate-100">
        {WORK_BLOCKS.map((config) => {
          const block = blocks.find((item) => item.type === config.type) || { type: config.type, title: config.label, content: "" };
          const session = block.auto_sync === false ? null : block.session_id ? blockSession(block, sessionsById) : inferSessionForBlock(day, config.type, sessionLibrary);
          return <WorkCard key={config.type} config={config} block={block} sessionLibrary={sessionLibrary} session={session} details={sessionDetails[block.session_id || session?.id]} onChange={(patch) => upsertBlock(day, config.type, patch, updateDay, dayIdx)} />;
        })}
      </div>
    </div>
  );
}