import React, { useState } from "react";
import { HelpCircle } from "lucide-react";
import PlayerPhoto from "@/components/player/PlayerPhoto";

function cellStyle(signal) {
  if (signal === "important") return "bg-red-500/20 text-red-300 border-red-500/40";
  if (signal === "moderate") return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
  if (signal === "insufficient") return "bg-zinc-700/30 text-zinc-500 border-zinc-700";
  return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
}

function fmtVal(v, digits = 1) {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  return Number(v).toFixed(digits);
}

export default function ChangeMap({ players, metricKey, allMetrics, onSelectPlayer }) {
  const [hovered, setHovered] = useState(null);

  if (!players?.length || !metricKey) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
        <p className="text-zinc-500 text-sm">Seleccioná una métrica para ver el mapa de cambios</p>
      </div>
    );
  }

  // Filter to only entries matching selected metric
  const rows = players.map((p) => {
    const entry = Object.values(p.metrics).find((m) => `${m.test_key}|${m.metric_key}` === metricKey || m.metric_key === metricKey);
    return { ...p, entry };
  }).filter((r) => r.entry);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white">Mapa de cambios del plantel</h3>
          <span className="text-xs text-zinc-500">· {metricKey}</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/40" /> Esperado</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500/30 border border-yellow-500/40" /> Moderado</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/30 border border-red-500/40" /> Importante</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-zinc-700/40 border border-zinc-700" /> Sin base</span>
        </div>
      </div>

      {/* Desktop: matrix */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-zinc-950/50 border-b border-zinc-800">
              <th className="text-left p-2.5 font-semibold text-zinc-500 sticky left-0 bg-zinc-950/50">Jugador</th>
              <th className="text-left p-2.5 font-semibold text-zinc-500">Pos</th>
              <th className="text-right p-2.5 font-semibold text-zinc-500">Actual</th>
              <th className="text-right p-2.5 font-semibold text-zinc-500">Base</th>
              <th className="text-right p-2.5 font-semibold text-zinc-500">Δ Abs</th>
              <th className="text-right p-2.5 font-semibold text-zinc-500">Δ %</th>
              <th className="text-right p-2.5 font-semibold text-zinc-500">Z ind.</th>
              <th className="text-right p-2.5 font-semibold text-zinc-500">Z squad</th>
              <th className="text-left p-2.5 font-semibold text-zinc-500">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const e = r.entry;
              return (
                <tr
                  key={i}
                  className="border-b border-zinc-800/40 hover:bg-zinc-800/20 cursor-pointer"
                  onClick={() => { if (r.player_id && onSelectPlayer) onSelectPlayer(r.player_id); }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <td className="p-2.5 sticky left-0 bg-zinc-900">
                    <div className="flex items-center gap-2">
                      <PlayerPhoto player={{ photo_url: r.player_photo_url, full_name: r.player_name }} className="w-6 h-6 rounded-full object-cover border border-zinc-700 shrink-0" />
                      <span className="text-white font-medium truncate">{r.player_name}</span>
                    </div>
                  </td>
                  <td className="p-2.5 text-zinc-400">{r.position}</td>
                  <td className="p-2.5 text-right text-white tabular-nums">{fmtVal(e.current_value)}</td>
                  <td className="p-2.5 text-right text-zinc-400 tabular-nums">{e.baseline_sufficient ? fmtVal(e.baseline_value) : "—"}</td>
                  <td className="p-2.5 text-right tabular-nums">
                    {e.change_abs !== null ? (
                      <span className={e.change_abs > 0 ? "text-emerald-400" : e.change_abs < 0 ? "text-red-400" : "text-zinc-400"}>
                        {e.change_abs > 0 ? "+" : ""}{fmtVal(e.change_abs)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="p-2.5 text-right tabular-nums">
                    {e.change_pct !== null ? (
                      <span className={e.change_pct > 0 ? "text-emerald-400" : e.change_pct < 0 ? "text-red-400" : "text-zinc-400"}>
                        {e.change_pct > 0 ? "+" : ""}{fmtVal(e.change_pct)}%
                      </span>
                    ) : "—"}
                  </td>
                  <td className="p-2.5 text-right text-zinc-400 tabular-nums">{e.z_score_individual !== null ? fmtVal(e.z_score_individual, 2) : "—"}</td>
                  <td className="p-2.5 text-right text-zinc-400 tabular-nums">{e.z_score_squad !== null ? fmtVal(e.z_score_squad, 2) : "—"}</td>
                  <td className="p-2.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${cellStyle(e.signal)}`}>
                      {e.signal === "important" ? "Importante" : e.signal === "moderate" ? "Moderado" : e.signal === "insufficient" ? "Sin base" : "Esperado"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="sm:hidden divide-y divide-zinc-800/50">
        {rows.map((r, i) => {
          const e = r.entry;
          return (
            <div key={i} className="p-3 cursor-pointer" onClick={() => { if (r.player_id && onSelectPlayer) onSelectPlayer(r.player_id); }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <PlayerPhoto player={{ photo_url: r.player_photo_url, full_name: r.player_name }} className="w-8 h-8 rounded-full object-cover border border-zinc-700 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-white">{r.player_name}</p>
                    <p className="text-xs text-zinc-500">{r.position}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${cellStyle(e.signal)}`}>
                  {e.signal === "important" ? "Importante" : e.signal === "moderate" ? "Moderado" : e.signal === "insufficient" ? "Sin base" : "Esperado"}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div><p className="text-zinc-500">Actual</p><p className="text-white font-semibold">{fmtVal(e.current_value)}</p></div>
                <div><p className="text-zinc-500">Base</p><p className="text-zinc-400">{e.baseline_sufficient ? fmtVal(e.baseline_value) : "—"}</p></div>
                <div><p className="text-zinc-500">Δ %</p><p className={e.change_pct > 0 ? "text-emerald-400" : "text-red-400"}>{e.change_pct !== null ? fmtVal(e.change_pct) + "%" : "—"}</p></div>
                <div><p className="text-zinc-500">Z ind.</p><p className="text-zinc-400">{e.z_score_individual !== null ? fmtVal(e.z_score_individual, 2) : "—"}</p></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}