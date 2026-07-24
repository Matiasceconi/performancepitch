import React from "react";

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "formation", label: "Formación" },
  { id: "tactical", label: "Táctica" },
  { id: "exercise", label: "Ejercicio" },
  { id: "templates", label: "Plantillas" },
  { id: "archived", label: "Archivados" },
];

export default function TacticalProjectFilters({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 overflow-x-auto">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          onClick={() => onChange(f.id)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
            value === f.id ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}