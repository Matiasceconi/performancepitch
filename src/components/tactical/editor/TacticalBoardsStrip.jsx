import React, { useState } from "react";
import { Plus, Copy, Trash2, MoreVertical } from "lucide-react";

export default function TacticalBoardsStrip({ boards, currentBoardId, onSelect, onAdd, onDuplicate, onRename, onDelete, onReorder: _onReorder, canEdit, canDelete }) {
  const [menu, setMenu] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState("");

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-t border-zinc-800 overflow-x-auto shrink-0">
      {boards.map((b) => {
        const active = b.id === currentBoardId;
        return (
          <div key={b.id} className={`relative shrink-0 w-32 group ${active ? "ring-2 ring-yellow-400 rounded-lg" : ""}`}>
            <button onClick={() => onSelect(b.id)} className="block w-full h-16 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-600 overflow-hidden relative">
              {b.thumbnail_url ? (
                <img src={b.thumbnail_url} alt={b.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-700">{b.name}</div>
              )}
            </button>
            <div className="flex items-center justify-between mt-1 px-1">
              {editing === b.id ? (
                <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onBlur={() => { if (editName.trim()) onRename(b.id, editName.trim()); setEditing(null); }} onKeyDown={(e) => { if (e.key === "Enter") { if (editName.trim()) onRename(b.id, editName.trim()); setEditing(null); } if (e.key === "Escape") setEditing(null); }} className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-[10px] text-white focus:outline-none" />
              ) : (
                <span className="text-[10px] text-zinc-400 truncate flex-1">{b.name}</span>
              )}
              {canEdit && (
                <button onClick={(e) => { e.stopPropagation(); setMenu(menu === b.id ? null : b.id); }} className="p-0.5 rounded hover:bg-zinc-800 text-zinc-500">
                  <MoreVertical size={11} />
                </button>
              )}
            </div>
            {menu === b.id && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                <div className="absolute right-0 top-12 z-20 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[120px]">
                  <button onClick={() => { setEditing(b.id); setEditName(b.name); setMenu(null); }} className="w-full text-left px-3 py-1 text-[11px] text-zinc-300 hover:bg-zinc-700">Renombrar</button>
                  <button onClick={() => { onDuplicate(b); setMenu(null); }} className="w-full text-left px-3 py-1 text-[11px] text-zinc-300 hover:bg-zinc-700 flex items-center gap-1"><Copy size={10} /> Duplicar</button>
                  {canDelete && (
                    <>
                      <div className="border-t border-zinc-700 my-1" />
                      <button onClick={() => { if (confirm("¿Eliminar esta pizarra?")) onDelete(b.id); setMenu(null); }} className="w-full text-left px-3 py-1 text-[11px] text-red-400 hover:bg-red-500/10 flex items-center gap-1"><Trash2 size={10} /> Eliminar</button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
      {canEdit && (
        <button onClick={onAdd} className="shrink-0 w-32 h-16 rounded-lg border-2 border-dashed border-zinc-700 hover:border-zinc-500 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
          <Plus size={20} />
        </button>
      )}
    </div>
  );
}