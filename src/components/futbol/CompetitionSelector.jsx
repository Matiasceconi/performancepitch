import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Trophy } from "lucide-react";

export default function CompetitionSelector({ competitions, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = competitions.find((c) => c.id === value) || competitions[0];

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-left hover:border-zinc-700 transition-colors"
      >
        {selected?.logo ? (
          <img src={selected.logo} alt="" className="w-7 h-7 object-contain shrink-0" onError={(e) => { e.target.style.display = "none"; }} />
        ) : (
          <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
            <Trophy size={15} className="text-yellow-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{selected?.name || "Seleccionar torneo"}</p>
          {selected?.season && <p className="text-xs text-zinc-500 truncate">{selected.season}</p>}
        </div>
        <ChevronDown size={16} className={`text-zinc-500 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden">
          {competitions.map((c) => (
            <button
              key={c.id}
              onClick={() => { onChange(c.id); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-800 transition-colors ${c.id === value ? "bg-zinc-800/60" : ""}`}
            >
              {c.logo ? (
                <img src={c.logo} alt="" className="w-6 h-6 object-contain shrink-0" onError={(e) => { e.target.style.display = "none"; }} />
              ) : (
                <div className="w-6 h-6 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                  <Trophy size={13} className="text-yellow-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{c.name}</p>
                {c.season && <p className="text-xs text-zinc-500 truncate">{c.season}</p>}
              </div>
              {c.id === value && <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}