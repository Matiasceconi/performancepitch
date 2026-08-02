import React from "react";

const CATEGORIES = [
  { id: "4ta", label: "4ª" },
  { id: "5ta", label: "5ª" },
  { id: "6ta", label: "6ª" },
  { id: "7ma", label: "7ª" },
  { id: "8va", label: "8ª" },
  { id: "9na", label: "9ª" },
];

export default function YouthCategorySelector({ activeCategory, onCategory }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wide hidden sm:inline">Categoría</span>
      {CATEGORIES.map((c) => (
        <button
          key={c.id}
          onClick={() => onCategory(c.id)}
          className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            activeCategory === c.id
              ? "bg-emerald-500 text-zinc-950"
              : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}