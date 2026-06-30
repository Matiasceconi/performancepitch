import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Shield } from "lucide-react";
import { useWorkspace } from "@/lib/WorkspaceContext";

export default function SquadSelector() {
  const { mySquads, activeSquad, setActiveSquad } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  if (mySquads.length === 0) return null;

  // Single squad — show static label, no dropdown
  if (mySquads.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700">
        <Shield size={13} className="text-yellow-400 shrink-0" />
        <span className="text-xs font-semibold text-white">{activeSquad?.name || "—"}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700 hover:bg-zinc-700/60 transition-colors w-full">
        <Shield size={13} className="text-yellow-400 shrink-0" />
        <span className="text-xs font-semibold text-white flex-1 text-left truncate">
          {activeSquad?.name || "Seleccionar plantel"}
        </span>
        <ChevronDown size={12} className={`text-zinc-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-full min-w-[180px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold px-3 pt-2.5 pb-1">Plantel activo</p>
          {mySquads.map(squad => (
            <button
              key={squad.id}
              onClick={() => { setActiveSquad(squad); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-zinc-800 transition-colors">
              <Check
                size={12}
                className={`shrink-0 ${activeSquad?.id === squad.id ? "text-yellow-400" : "text-transparent"}`}
              />
              <span className={`text-xs font-medium ${activeSquad?.id === squad.id ? "text-white" : "text-zinc-400"}`}>
                {squad.name}
              </span>
              {squad.category && <span className="text-[10px] text-zinc-600 ml-auto">{squad.category}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}