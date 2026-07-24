import React, { useState } from "react";
import { ArrowLeft, Undo2, Redo2, Copy, Download, Play, Check, Loader2, AlertCircle } from "lucide-react";

const MODES = [
  { id: "formation", label: "Formación" },
  { id: "tactical", label: "Táctica" },
  { id: "exercise", label: "Ejercicio" },
];

const STATUS = {
  saved: { icon: Check, text: "Guardado", color: "text-emerald-400" },
  saving: { icon: Loader2, text: "Guardando…", color: "text-yellow-400", spin: true },
  error: { icon: AlertCircle, text: "Error al guardar", color: "text-red-400" },
};

export default function TacticalTopBar({ project, board, mode, onModeChange, saveStatus, onUndo, onRedo, canUndo, canRedo, onDuplicateBoard, onExport, onPresent, onBack, onRenameProject, onRenameBoard, canEdit, canExport, brand }) {
  const [editingProject, setEditingProject] = useState(false);
  const [editingBoard, setEditingBoard] = useState(false);
  const [projName, setProjName] = useState(project?.name || "");
  const [boardName, setBoardName] = useState(board?.name || "");

  const st = STATUS[saveStatus] || STATUS.saved;

  function commitProject() {
    if (projName.trim() && projName !== project?.name) onRenameProject(projName.trim());
    setEditingProject(false);
  }
  function commitBoard() {
    if (boardName.trim() && boardName !== board?.name) onRenameBoard(boardName.trim());
    setEditingBoard(false);
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
      <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors" title="Volver a proyectos">
        <ArrowLeft size={18} />
      </button>

      <div className="flex items-center gap-2 min-w-0">
        {editingProject ? (
          <input autoFocus value={projName} onChange={(e) => setProjName(e.target.value)} onBlur={commitProject} onKeyDown={(e) => { if (e.key === "Enter") commitProject(); if (e.key === "Escape") setEditingProject(false); }} className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-white focus:outline-none w-40" />
        ) : (
          <button onClick={() => canEdit && (setEditingProject(true), setProjName(project?.name || ""))} className="text-sm font-semibold text-white truncate hover:bg-zinc-800 px-2 py-1 rounded transition-colors">
            {project?.name || "Proyecto"}
          </button>
        )}
        <span className="text-zinc-600">/</span>
        {editingBoard ? (
          <input autoFocus value={boardName} onChange={(e) => setBoardName(e.target.value)} onBlur={commitBoard} onKeyDown={(e) => { if (e.key === "Enter") commitBoard(); if (e.key === "Escape") setEditingBoard(false); }} className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-white focus:outline-none w-40" />
        ) : (
          <button onClick={() => canEdit && (setEditingBoard(true), setBoardName(board?.name || ""))} className="text-sm text-zinc-400 truncate hover:bg-zinc-800 px-2 py-1 rounded transition-colors">
            {board?.name || "Pizarra"}
          </button>
        )}
      </div>

      {/* Mode selector */}
      <div className="flex items-center bg-zinc-800 rounded-lg p-0.5 gap-0.5">
        {MODES.map((m) => (
          <button key={m.id} onClick={() => onModeChange(m.id)} disabled={!canEdit} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${mode === m.id ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"} disabled:opacity-50`}>{m.label}</button>
        ))}
      </div>

      {/* Save status */}
      <div className={`flex items-center gap-1 text-xs ${st.color}`}>
        <st.icon size={13} className={st.spin ? "animate-spin" : ""} /> {st.text}
      </div>

      <div className="flex items-center gap-1 ml-auto">
        <button onClick={onUndo} disabled={!canUndo || !canEdit} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors" title="Deshacer (Ctrl+Z)"><Undo2 size={16} /></button>
        <button onClick={onRedo} disabled={!canRedo || !canEdit} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors" title="Rehacer (Ctrl+Shift+Z)"><Redo2 size={16} /></button>
        {canEdit && (
          <button onClick={onDuplicateBoard} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors" title="Duplicar pizarra"><Copy size={16} /></button>
        )}
        {canExport && (
          <button onClick={onExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-950 transition-colors" style={{ backgroundColor: brand.colors.accent, color: brand.colors.onAccent }}>
            <Download size={14} /> Exportar
          </button>
        )}
        <button onClick={onPresent} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">
          <Play size={14} /> Presentar
        </button>
      </div>
    </div>
  );
}