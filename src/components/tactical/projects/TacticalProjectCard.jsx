import React, { useState } from "react";
import moment from "moment";
import "moment/locale/es";
import { MoreVertical, Copy, Pencil, Archive, Save, FolderOpen, Users } from "lucide-react";

moment.locale("es");

const MODE_LABELS = { formation: "Formación", tactical: "Táctica", exercise: "Ejercicio" };
const MODE_COLORS = {
  formation: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  tactical: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  exercise: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

export default function TacticalProjectCard({ project, boards = [], onOpen, onDuplicate, onRename, onArchive, onSaveAsTemplate, canEdit, canDelete, canCreate }) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);

  const boardCount = boards.length;
  const thumb = project.thumbnail_url;

  function commitRename() {
    if (name.trim() && name !== project.name) onRename(name.trim());
    setEditing(false);
  }

  return (
    <div className="group relative bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-600 transition-colors">
      {/* Thumbnail */}
      <button onClick={onOpen} className="block w-full aspect-video bg-zinc-950 relative overflow-hidden">
        {thumb ? (
          <img src={thumb} alt={project.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-zinc-700 text-xs">
              {boardCount === 0 ? "Vacío" : `${boardCount} ${boardCount === 1 ? "pizarra" : "pizarras"}`}
            </div>
          </div>
        )}
        {project.is_template && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-400 text-zinc-950">Plantilla</span>
        )}
      </button>

      {/* Info */}
      <div className="p-3">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setEditing(false); setName(project.name); } }}
            className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-white focus:outline-none"
          />
        ) : (
          <button onClick={onOpen} className="block w-full text-left">
            <p className="text-sm font-semibold text-white truncate">{project.name}</p>
          </button>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${MODE_COLORS[project.default_mode] || MODE_COLORS.tactical}`}>
            {MODE_LABELS[project.default_mode] || "Táctica"}
          </span>
          <span className="text-[10px] text-zinc-600">{moment(project.updated_at || project.created_date).format("DD MMM")}</span>
        </div>
        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-zinc-600">
          <Users size={10} /> {project.squad_name || "—"}
        </div>
      </div>

      {/* Actions */}
      <div className="absolute top-2 right-2">
        <button onClick={(e) => { e.stopPropagation(); setMenu(!menu); }} className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
          <MoreVertical size={14} />
        </button>
        {menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenu(false); }} />
            <div className="absolute right-0 top-9 z-20 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[160px]">
              <button onClick={(e) => { e.stopPropagation(); setMenu(false); onOpen(); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white">
                <FolderOpen size={12} /> Abrir
              </button>
              {canCreate && (
                <button onClick={(e) => { e.stopPropagation(); setMenu(false); onDuplicate(); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white">
                  <Copy size={12} /> Duplicar
                </button>
              )}
              {canEdit && (
                <button onClick={(e) => { e.stopPropagation(); setMenu(false); setEditing(true); setMenu(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white">
                  <Pencil size={12} /> Renombrar
                </button>
              )}
              {canEdit && (
                <button onClick={(e) => { e.stopPropagation(); setMenu(false); onSaveAsTemplate(); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white">
                  <Save size={12} /> Guardar como plantilla
                </button>
              )}
              {canDelete && (
                <>
                  <div className="border-t border-zinc-700 my-1" />
                  <button onClick={(e) => { e.stopPropagation(); setMenu(false); onArchive(); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10">
                    <Archive size={12} /> Archivar
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}