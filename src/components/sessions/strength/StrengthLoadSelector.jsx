import React from "react";
import { LOAD_TYPES } from "./strengthSeries";

// Selector de carga comprensible. value = { load_type, load_value }
export default function StrengthLoadSelector({ value = {}, onChange, compact = false }) {
  const loadType = value.load_type || "none";
  const loadValue = value.load_value || "";

  function update(patch) {
    onChange({ load_type: loadType, load_value: loadValue, ...patch });
  }

  const showValue = loadType !== "none";

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <select
          value={loadType}
          onChange={(e) => update({ load_type: e.target.value, load_value: e.target.value === "none" ? "" : loadValue })}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
        >
          {LOAD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        {showValue && (
          <input
            type="number"
            value={loadValue}
            onChange={(e) => update({ load_value: e.target.value })}
            placeholder="0"
            className="w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500"
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={loadType}
        onChange={(e) => update({ load_type: e.target.value, load_value: e.target.value === "none" ? "" : loadValue })}
        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
      >
        {LOAD_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      {showValue && (
        <input
          type="number"
          value={loadValue}
          onChange={(e) => update({ load_value: e.target.value })}
          placeholder="Valor"
          className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
        />
      )}
    </div>
  );
}