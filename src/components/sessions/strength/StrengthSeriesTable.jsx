import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import StrengthLoadSelector from "./StrengthLoadSelector";
import { generateSeries } from "./strengthSeries";

// Tabla compacta de series. Cada fila: #, Reps, Tiempo, Carga, Eliminar.
// La pausa es general del ejercicio (se edita fuera de esta tabla).
export default function StrengthSeriesTable({ series = [], onChange }) {
  const [genCount, setGenCount] = useState("");
  const [genReps, setGenReps] = useState("");
  const [genTime, setGenTime] = useState("");

  function updateRow(index, patch) {
    const next = series.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange(next);
  }

  function deleteRow(index) {
    onChange(series.filter((_, i) => i !== index));
  }

  function generate() {
    const count = parseInt(genCount, 10) || 0;
    if (count < 1) return;
    const template = {
      reps: genReps || "",
      time: genTime || "",
      load_type: "none",
      load_value: "",
    };
    onChange(generateSeries(count, template));
    setGenCount("");
    setGenReps("");
    setGenTime("");
  }

  return (
    <div className="space-y-2">
      {/* Generador de series iguales */}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-700 bg-zinc-950/40 p-2.5">
        <div>
          <label className="block text-[10px] text-zinc-500 mb-0.5">Series</label>
          <input
            type="number"
            min="1"
            max="20"
            value={genCount}
            onChange={(e) => setGenCount(e.target.value)}
            placeholder="3"
            className="w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500"
          />
        </div>
        <div>
          <label className="block text-[10px] text-zinc-500 mb-0.5">Reps</label>
          <input
            value={genReps}
            onChange={(e) => setGenReps(e.target.value)}
            placeholder="8"
            className="w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500"
          />
        </div>
        <div>
          <label className="block text-[10px] text-zinc-500 mb-0.5">Tiempo (s)</label>
          <input
            value={genTime}
            onChange={(e) => setGenTime(e.target.value)}
            placeholder="30"
            className="w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500"
          />
        </div>
        <button
          onClick={generate}
          disabled={!genCount}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-40 transition-colors"
        >
          <Plus size={13} /> Generar
        </button>
        <p className="text-[10px] text-zinc-500 ml-1">Genera filas iguales; después editá individualmente.</p>
      </div>

      {/* Tabla de series */}
      {series.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-zinc-900 border-b border-zinc-800 text-zinc-500">
                <th className="text-center py-2 px-2 font-medium w-10">#</th>
                <th className="text-left py-2 px-2 font-medium">Repeticiones</th>
                <th className="text-left py-2 px-2 font-medium">Tiempo (s)</th>
                <th className="text-left py-2 px-2 font-medium">Carga</th>
                <th className="text-center py-2 px-2 font-medium w-16"></th>
              </tr>
            </thead>
            <tbody>
              {series.map((serie, index) => (
                <tr key={index} className="border-b border-zinc-800/60 hover:bg-zinc-800/20">
                  <td className="text-center py-1.5 px-2 text-zinc-400 font-semibold">{index + 1}</td>
                  <td className="py-1.5 px-2">
                    <input
                      value={serie.reps || ""}
                      onChange={(e) => updateRow(index, { reps: e.target.value })}
                      placeholder="—"
                      className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-zinc-500"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      value={serie.time || ""}
                      onChange={(e) => updateRow(index, { time: e.target.value })}
                      placeholder="—"
                      className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-zinc-500"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <StrengthLoadSelector
                      value={serie}
                      onChange={(val) => updateRow(index, val)}
                      compact
                    />
                  </td>
                  <td className="text-center py-1.5 px-2">
                    <button
                      onClick={() => deleteRow(index)}
                      title="Eliminar serie"
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {series.length === 0 && (
        <p className="text-center text-zinc-600 text-xs py-4 border border-dashed border-zinc-800 rounded-lg">
          Sin series. Generá series iguales arriba o agregá una individual.
        </p>
      )}

      {series.length > 0 && (
        <button
          onClick={() => onChange([...series, { reps: "", time: "", load_type: "none", load_value: "" }])}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700 transition-colors"
        >
          <Plus size={13} /> Agregar serie
        </button>
      )}
    </div>
  );
}