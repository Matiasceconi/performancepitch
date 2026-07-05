import React from "react";
import moment from "moment";
import { Moon, Link2 } from "lucide-react";
import { MD_OPTIONS, PHYSICAL_OBJECTIVES, WORK_BLOCKS, dayNameEs, getBlockAutoContent, isFreeDay, objectiveStyle } from "@/components/planning/microcyclePlanUtils";

function upsertBlock(day, type, patch, updateDay, dayIdx) {
  const blocks = day.blocks || [];
  const existing = blocks.find((block) => block.type === type);
  if (existing) {
    updateDay(dayIdx, { blocks: blocks.map((block) => block.id === existing.id ? { ...block, ...patch } : block) });
  } else {
    updateDay(dayIdx, { blocks: [...blocks, { id: `${type}-${dayIdx}`, type, title: type, content: "", auto_sync: true, ...patch }] });
  }
}

function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function inferSession(day, type, sessionLibrary) {
  const sameDay = sessionLibrary.filter((session) => session.date === day.date);
  const has = (session, words) => words.some((word) => normalizeText(`${session.title} ${session.session_type} ${session.objective} ${session.session_objective}`).includes(word));
  if (type === "Gimnasio") return sameDay.find((session) => has(session, ["gimnasio", "fuerza", "gym"]));
  if (type === "Campo") return sameDay.find((session) => has(session, ["campo", "cancha", "entrenamiento"]) && !has(session, ["gimnasio", "fuerza", "gym"]));
  if (type === "Compensatorio") return sameDay.find((session) => has(session, ["compens", "prevent", "readapt"]));
  if (type === "Vuelta a la calma") return sameDay.find((session) => has(session, ["vuelta", "calma", "regener", "recuper"]));
  return sameDay[0];
}

function WorkCard({ config, block, sessionLibrary, session, details, onChange }) {
  const autoContent = getBlockAutoContent(block, session, details);
  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-2 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-7 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
          <p className="text-[10px] font-black uppercase tracking-wide text-zinc-700 truncate">{config.label}</p>
        </div>
        <Link2 size={12} className={session ? "text-blue-500" : "text-zinc-300"} />
      </div>
      <select value={block?.session_id || session?.id || ""} onChange={(e) => onChange({ session_id: e.target.value, auto_sync: true })} className="w-full rounded-lg border border-zinc-100 bg-zinc-50 px-2 py-1.5 text-[10px] font-semibold text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-200">
        <option value="">Completar desde sesión...</option>
        {sessionLibrary.map((item) => <option key={item.id} value={item.id}>{item.date ? `${moment(item.date).format("DD/MM")} · ` : ""}{item.title}</option>)}
      </select>
      <div className="mt-2 min-h-[44px] rounded-lg bg-zinc-50 px-2 py-2 text-[10px] leading-relaxed text-zinc-600 whitespace-pre-wrap">
        {autoContent || "Sin tareas vinculadas"}
      </div>
    </div>
  );
}

export default function MicrocycleDayColumn({ day, dayIdx, sessionLibrary, sessionDetails, blockSession, sessionsById, updateDay }) {
  const free = isFreeDay(day);
  const objective = day.physical_objective || "Mixto";
  const objStyle = objectiveStyle(objective);
  const blocks = day.blocks || [];

  if (free) {
    return (
      <div className="min-w-0 rounded-2xl border border-blue-100 bg-blue-50/80 p-4 shadow-sm flex flex-col items-center justify-center min-h-[520px] text-center">
        <Moon size={42} className="text-blue-400 mb-4" />
        <p className="text-[11px] font-black text-blue-500 tracking-[0.25em]">{dayNameEs(day.date)}</p>
        <input type="date" value={day.date} onChange={(e) => updateDay(dayIdx, { date: e.target.value })} className="bg-transparent text-center text-xs font-bold text-blue-500 focus:outline-none mt-1" />
        <select value="Libre" onChange={(e) => updateDay(dayIdx, { md: e.target.value, auto_free: e.target.value === "Libre", blocks: e.target.value === "Libre" ? [] : WORK_BLOCKS.map((item) => ({ id: `${item.type}-${dayIdx}`, type: item.type, title: item.label, content: "", session_id: "", auto_sync: true })) })} className="mt-8 bg-transparent text-3xl font-black text-blue-700 text-center focus:outline-none">
          {MD_OPTIONS.map((item) => <option key={item}>{item}</option>)}
        </select>
        <p className="mt-3 text-xl font-black text-blue-700">DÍA LIBRE</p>
        <p className="mt-2 text-xs font-semibold text-blue-500">Sin entrenamiento ni tareas planificadas</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden min-w-0 flex flex-col min-h-[520px]">
      <div className="px-3 pt-3 pb-2 text-center border-b border-zinc-50">
        <p className="text-[11px] font-black text-zinc-500 tracking-[0.22em]">{dayNameEs(day.date)}</p>
        <input type="date" value={day.date} onChange={(e) => updateDay(dayIdx, { date: e.target.value })} className="bg-transparent text-center text-[11px] font-semibold text-zinc-400 focus:outline-none mt-1" />
        <select value={day.md || "MD-5"} onChange={(e) => updateDay(dayIdx, { md: e.target.value, auto_free: e.target.value === "Libre", blocks: e.target.value === "Libre" ? [] : blocks })} className="mt-2 w-full bg-transparent text-center text-2xl font-black text-slate-950 focus:outline-none">
          {MD_OPTIONS.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={objective} onChange={(e) => updateDay(dayIdx, { physical_objective: e.target.value })} className="mt-2 w-full rounded-xl border px-2 py-2 text-[11px] font-black text-center focus:outline-none" style={{ backgroundColor: objStyle.bg, color: objStyle.text, borderColor: objStyle.border }}>
          {PHYSICAL_OBJECTIVES.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>
      <div className="flex-1 p-2.5 space-y-2 bg-zinc-50/40">
        {WORK_BLOCKS.map((config) => {
          const block = blocks.find((item) => item.type === config.type) || { type: config.type, title: config.label, content: "" };
          const session = block.session_id ? blockSession(block, sessionsById) : inferSession(day, config.type, sessionLibrary);
          return <WorkCard key={config.type} config={config} block={block} sessionLibrary={sessionLibrary} session={session} details={sessionDetails[block.session_id || session?.id]} onChange={(patch) => upsertBlock(day, config.type, patch, updateDay, dayIdx)} />;
        })}
      </div>
    </div>
  );
}