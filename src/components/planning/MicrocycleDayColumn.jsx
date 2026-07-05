import React from "react";
import moment from "moment";
import { Copy, ExternalLink, GripVertical, Trash2 } from "lucide-react";
import { Droppable, Draggable } from "@hello-pangea/dnd";

const TYPE_LABELS = {
  "Objetivo físico": "Objetivo físico",
  "Objetivo táctico": "Táctico / DT",
  Campo: "Campo",
  Gimnasio: "Gimnasio",
  Compensatorio: "Preventivo",
  "Vuelta a la calma": "Vuelta a la calma",
  Recuperación: "Preventivo",
  Partido: "Partido",
  Observaciones: "Observaciones",
  Personalizado: "Bloque",
};

const SOFT_BG = {
  Campo: "bg-blue-50 border-blue-100 text-blue-900",
  Gimnasio: "bg-emerald-50 border-emerald-100 text-emerald-900",
  "Objetivo táctico": "bg-orange-50 border-orange-100 text-orange-900",
  Compensatorio: "bg-violet-50 border-violet-100 text-violet-900",
  Recuperación: "bg-violet-50 border-violet-100 text-violet-900",
  "Vuelta a la calma": "bg-cyan-50 border-cyan-100 text-cyan-900",
  Observaciones: "bg-zinc-50 border-zinc-100 text-zinc-700",
  Partido: "bg-red-600 border-red-600 text-white",
};

function BlockCard({ block, dayIdx, index, updateBlock, duplicateBlock, deleteBlock, sessionLibrary, selectSession, shownSession, details }) {
  const soft = SOFT_BG[block.type] || "bg-zinc-50 border-zinc-100 text-zinc-800";
  const isMatch = block.type === "Partido";
  return (
    <Draggable draggableId={block.id} index={index}>
      {(dragProvided) => (
        <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} className={`rounded-lg border p-2.5 ${soft} shadow-sm`}>
          <div className="flex items-start gap-1.5">
            <button {...dragProvided.dragHandleProps} className={isMatch ? "text-white/70" : "text-zinc-400"}><GripVertical size={13} /></button>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-wide opacity-75">{TYPE_LABELS[block.type] || block.type}</p>
              <input value={block.title} onChange={e => updateBlock(dayIdx, block.id, { title: e.target.value })} className={`w-full bg-transparent text-xs font-black focus:outline-none ${isMatch ? "text-white" : "text-zinc-950"}`} />
              <textarea value={block.content || ""} onChange={e => updateBlock(dayIdx, block.id, { content: e.target.value })} rows={2} placeholder="Detalle..." className={`w-full mt-1 bg-transparent text-[11px] resize-none focus:outline-none ${isMatch ? "text-white/90 placeholder-white/60" : "text-zinc-600 placeholder-zinc-400"}`} />
              <select value={block.session_id || ""} onChange={e => selectSession(dayIdx, block.id, e.target.value)} className={`w-full mt-1.5 rounded-md border px-2 py-1 text-[10px] ${isMatch ? "bg-white/15 border-white/20 text-white" : "bg-white border-zinc-200 text-zinc-600"}`}>
                <option value="">Vincular sesión...</option>
                {sessionLibrary.map(s => <option key={s.id} value={s.id}>{s.date ? `${moment(s.date).format("DD/MM")} · ` : ""}{s.title}</option>)}
              </select>
              {shownSession && <div className={`mt-1.5 rounded-md px-2 py-1 text-[10px] ${isMatch ? "bg-white/15" : "bg-white/70"}`}><b>{shownSession.title}</b> · {shownSession.duration_minutes || "—"}'<label className="mt-1 flex items-center gap-1"><input type="checkbox" checked={block.auto_sync !== false} onChange={e => updateBlock(dayIdx, block.id, { auto_sync: e.target.checked })} /> Actualizar</label>{(details?.exercises || []).slice(0, 2).map(ex => <p key={ex.id} className="truncate">• {ex.name}</p>)}</div>}
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => duplicateBlock(dayIdx, block)} className={isMatch ? "text-white/70 hover:text-white" : "text-zinc-400 hover:text-zinc-800"}><Copy size={12} /></button>
              <button onClick={() => deleteBlock(dayIdx, block.id)} className={isMatch ? "text-white/70 hover:text-white" : "text-zinc-400 hover:text-red-600"}><Trash2 size={12} /></button>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

export default function MicrocycleDayColumn({ day, dayIdx, dayLoad, mdOptions, blockTypes, sessionLibrary, sessionDetails, blockSession, sessionsById, updateDay, updateBlock, duplicateBlock, deleteBlock, selectSession, addBlock }) {
  const mdColor = day.md === "MD" ? "text-red-600" : day.md?.includes("-") ? "text-red-500" : "text-blue-600";
  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden min-w-0 flex flex-col">
      <div className="px-3 py-2 border-b border-zinc-100 bg-white">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-black text-zinc-500 uppercase">{moment(day.date).format("dddd")}</p>
            <input type="date" value={day.date} onChange={e => updateDay(dayIdx, { date: e.target.value })} className="bg-transparent text-[10px] text-zinc-500 focus:outline-none" />
          </div>
          <select value={day.md} onChange={e => updateDay(dayIdx, { md: e.target.value })} className={`bg-transparent text-xs font-black focus:outline-none ${mdColor}`}>{mdOptions.map(o => <option key={o}>{o}</option>)}</select>
        </div>
      </div>
      <Droppable droppableId={String(dayIdx)}>
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="p-2 space-y-2 flex-1 min-h-[310px]">
            {(day.blocks || []).map((block, index) => <BlockCard key={block.id} block={block} dayIdx={dayIdx} index={index} updateBlock={updateBlock} duplicateBlock={duplicateBlock} deleteBlock={deleteBlock} sessionLibrary={sessionLibrary} selectSession={selectSession} shownSession={block.session_id ? blockSession(block, sessionsById) : null} details={sessionDetails[block.session_id]} />)}
            {provided.placeholder}
            <select onChange={e => { if (e.target.value) addBlock(dayIdx, e.target.value); e.target.value = ""; }} defaultValue="" className="w-full rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-2 py-2 text-[11px] text-zinc-500"><option value="" disabled>+ Agregar bloque</option>{blockTypes.map(t => <option key={t}>{t}</option>)}</select>
          </div>
        )}
      </Droppable>
      <button className="m-2 mt-0 rounded-lg border border-zinc-200 py-2 text-[11px] font-bold text-zinc-500 hover:bg-zinc-50 flex items-center justify-center gap-1"><ExternalLink size={12} /> Ver sesión</button>
      <div className="border-t border-zinc-100 p-2 space-y-1">
        {[dayLoad.total_distance, dayLoad.distance_19_8, dayLoad.distance_25, dayLoad.acc_3, dayLoad.dec_3, dayLoad.player_load].map((v, i) => <div key={i} className="flex items-center gap-2"><span className="w-8 text-[9px] font-bold text-zinc-500">{Math.round(v || 0)}</span><span className="h-1.5 rounded-full flex-1 bg-zinc-100 overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, ((v || 0) / ([10000, 1200, 650, 100, 80, 700][i])) * 100)}%`, backgroundColor: ["#2563eb", "#2563eb", "#ef4444", "#ef4444", "#22c55e", "#f97316"][i] }} /></span></div>)}
      </div>
    </div>
  );
}