import React from "react";

// Color thresholds for each metric (based on typical Catapult OpenField ranges)
const THRESHOLDS = {
  total_distance:         { green: 9000, yellow: 6000 },
  distance_hsr:           { green: 1200, yellow: 700 },
  sprint_distance:        { green: 400,  yellow: 150 },
  sprint_efforts:         { green: 20,   yellow: 10 },
  accelerations:          { green: 30,   yellow: 15 },
  decelerations:          { green: 30,   yellow: 15 },
  player_load:            { green: 700,  yellow: 400 },
  max_velocity:           { green: 30,   yellow: 25 },
  max_velocity_percentage:{ green: 85,   yellow: 70 },
  meters_per_minute:      { green: 100,  yellow: 75 },
};

function colorCell(key, value) {
  const t = THRESHOLDS[key];
  if (!t || value == null || value === "") return "";
  const n = parseFloat(value);
  if (isNaN(n)) return "";
  if (n >= t.green) return "bg-green-900/50 text-green-300";
  if (n >= t.yellow) return "bg-yellow-900/50 text-yellow-300";
  return "bg-red-900/50 text-red-300";
}

const COLS = [
  { key: "player_name",            label: "Jugador",              numeric: false },
  { key: "total_duration",         label: "Duración",             numeric: true  },
  { key: "total_distance",         label: "Dist. Total (m)",      numeric: true  },
  { key: "distance_hsr",           label: "19.8-25 km/h (m)",     numeric: true  },
  { key: "sprint_distance",        label: "+25 km/h (m)",         numeric: true  },
  { key: "sprint_efforts",         label: "Sprint Effs",          numeric: true  },
  { key: "accelerations",          label: "Acel +3 m/s²",         numeric: true  },
  { key: "decelerations",          label: "Decel +3 m/s²",        numeric: true  },
  { key: "player_load",            label: "Player Load",          numeric: true  },
  { key: "max_velocity",           label: "Vel. Máx (km/h)",      numeric: true  },
  { key: "max_velocity_percentage",label: "% Vel. Máx",           numeric: true  },
  { key: "meters_per_minute",      label: "m/min",                numeric: true  },
];

export default function CsvPreviewTable({ rows }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-700">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-zinc-800 text-zinc-400">
            {COLS.map((c) => (
              <th key={c.key} className={`px-3 py-2 font-semibold whitespace-nowrap border-b border-zinc-700 ${c.numeric ? "text-right" : "text-left"}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-zinc-800/60 hover:bg-zinc-800/20 transition-colors">
              {COLS.map((c) => {
                const val = row[c.key];
                const color = c.numeric ? colorCell(c.key, val) : "";
                const display = val != null && val !== "" ? (c.numeric ? (isNaN(parseFloat(val)) ? val : parseFloat(val).toFixed(c.key === "player_load" || c.key === "meters_per_minute" ? 1 : 0)) : val) : "—";
                return (
                  <td key={c.key} className={`px-3 py-2 ${c.numeric ? "text-right" : "text-left font-medium text-white"} ${color || "text-zinc-300"}`}>
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}