import React, { useState } from "react";
import { AlertCircle, ArrowUp, ArrowDown, Minus, HelpCircle, User, AlertTriangle } from "lucide-react";
import PlayerPhoto from "@/components/player/PlayerPhoto";

function SignalIcon({ signal }) {
  if (signal === "important") return <ArrowDown size={14} className="text-red-400 shrink-0" />;
  if (signal === "moderate") return <ArrowUp size={14} className="text-yellow-400 shrink-0" />;
  if (signal === "insufficient") return <Minus size={14} className="text-zinc-500 shrink-0" />;
  return <Minus size={14} className="text-emerald-400 shrink-0" />;
}

function signalLabel(signal) {
  if (signal === "important") return "Importante";
  if (signal === "moderate") return "Moderada";
  if (signal === "insufficient") return "Sin base";
  return "Esperado";
}

function fmtVal(v, digits = 1) {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  return Number(v).toFixed(digits);
}

function fmtPct(v) {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  const s = v > 0 ? "+" : "";
  return `${s}${Number(v).toFixed(1)}%`;
}

export default function ReviewTray({ items, onSelectPlayer }) {
  const [expanded, setExpanded] = useState(null);

  if (!items?.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle size={16} className="text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Revisión de datos</h3>
        </div>
        <div className="py-6 text-center">
          <p className="text-emerald-400 text-sm font-medium">Sin datos que requieran revisión</p>
          <p className="text-zinc-500 text-xs mt-1">Todos los jugadores están vinculados y sin anomalías de calidad</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-orange-400" />
          <h3 className="text-sm font-bold text-white">Revisión de datos</h3>
          <span className="px-2 py-0.5 rounded bg-orange-500/15 text-orange-300 text-xs font-bold">{items.length}</span>
        </div>
        <p className="text-xs text-zinc-500 hidden sm:block">Identidades pendientes · colisiones · calidad · anomalías</p>
      </div>

      {/* Desktop: table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-zinc-950/50 text-zinc-500 border-b border-zinc-800">
              <th className="text-left p-2.5 font-semibold">Jugador</th>
              <th className="text-left p-2.5 font-semibold">Pos</th>
              <th className="text-left p-2.5 font-semibold">Prueba</th>
              <th className="text-left p-2.5 font-semibold">Métrica</th>
              <th className="text-right p-2.5 font-semibold">Actual</th>
              <th className="text-right p-2.5 font-semibold">Base</th>
              <th className="text-right p-2.5 font-semibold">Δ Abs</th>
              <th className="text-right p-2.5 font-semibold">Δ %</th>
              <th className="text-right p-2.5 font-semibold">Z ind.</th>
              <th className="text-left p-2.5 font-semibold">Señal</th>
              <th className="text-left p-2.5 font-semibold">Motivo</th>
              <th className="text-center p-2.5 font-semibold">Acción</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr
                key={i}
                className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer"
                onClick={() => { if (item.player_id && onSelectPlayer) onSelectPlayer(item.player_id); else setExpanded(expanded === i ? null : i); }}
              >
                <td className="p-2.5">
                  <div className="flex items-center gap-2">
                    <PlayerPhoto player={{ photo_url: item.player_photo_url, full_name: item.player_name }} className="w-7 h-7 rounded-full object-cover border border-zinc-700 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate max-w-[120px]">{item.player_name}</p>
                      {item.link_valid === false && item.linking_status === "linked" && (
                        <p className="text-[10px] text-red-400 flex items-center gap-0.5"><AlertTriangle size={9} /> Vínculo inconsistente</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-2.5 text-zinc-400">{item.position}</td>
                <td className="p-2.5"><span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 font-bold uppercase text-[10px]">{item.test_key}</span></td>
                <td className="p-2.5 text-zinc-300">{item.metric_key}</td>
                <td className="p-2.5 text-right text-white font-semibold tabular-nums">{fmtVal(item.current_value)}</td>
                <td className="p-2.5 text-right text-zinc-400 tabular-nums">{item.baseline_sufficient ? fmtVal(item.baseline_value) : "—"}</td>
                <td className="p-2.5 text-right tabular-nums">
                  {item.change_abs !== null ? (
                    <span className={item.change_abs > 0 ? "text-emerald-400" : item.change_abs < 0 ? "text-red-400" : "text-zinc-400"}>
                      {item.change_abs > 0 ? "+" : ""}{fmtVal(item.change_abs)}
                    </span>
                  ) : "—"}
                </td>
                <td className="p-2.5 text-right tabular-nums">
                  {item.change_pct !== null ? (
                    <span className={item.change_pct > 0 ? "text-emerald-400" : item.change_pct < 0 ? "text-red-400" : "text-zinc-400"}>
                      {fmtPct(item.change_pct)}
                    </span>
                  ) : "—"}
                </td>
                <td className="p-2.5 text-right text-zinc-400 tabular-nums">{item.z_score_individual !== null ? fmtVal(item.z_score_individual, 2) : "—"}</td>
                <td className="p-2.5">
                  <div className="flex items-center gap-1.5">
                    <SignalIcon signal={item.signal} />
                    <span className="text-zinc-300">{signalLabel(item.signal)}</span>
                  </div>
                </td>
                <td className="p-2.5 text-zinc-500 max-w-[200px] truncate" title={item.reason}>{item.reason}</td>
                <td className="p-2.5 text-center">
                  <button className="px-2 py-1 rounded bg-zinc-800 text-zinc-300 text-[10px] font-medium hover:bg-zinc-700">Ver perfil</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="lg:hidden divide-y divide-zinc-800/50">
        {items.map((item, i) => (
          <div key={i} className="p-3" onClick={() => { if (item.player_id && onSelectPlayer) onSelectPlayer(item.player_id); else setExpanded(expanded === i ? null : i); }}>
            <div className="flex items-center gap-2 mb-2">
              <PlayerPhoto player={{ photo_url: item.player_photo_url, full_name: item.player_name }} className="w-8 h-8 rounded-full object-cover border border-zinc-700 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{item.player_name}</p>
                <p className="text-xs text-zinc-500">{item.position} · {item.test_key} · {item.metric_key}</p>
              </div>
              <SignalIcon signal={item.signal} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-zinc-500">Actual</p>
                <p className="text-white font-semibold">{fmtVal(item.current_value)}</p>
              </div>
              <div>
                <p className="text-zinc-500">Base</p>
                <p className="text-zinc-400">{item.baseline_sufficient ? fmtVal(item.baseline_value) : "Sin base"}</p>
              </div>
              <div>
                <p className="text-zinc-500">Cambio</p>
                <p className={item.change_pct > 0 ? "text-emerald-400" : item.change_pct < 0 ? "text-red-400" : "text-zinc-400"}>
                  {fmtPct(item.change_pct)}
                </p>
              </div>
            </div>
            {expanded === i && (
              <div className="mt-2 pt-2 border-t border-zinc-800/50 space-y-1 text-xs">
                <p className="text-zinc-400"><span className="text-zinc-500">Z individual:</span> {item.z_score_individual !== null ? fmtVal(item.z_score_individual, 2) : "—"}</p>
                <p className="text-zinc-400"><span className="text-zinc-500">Motivo:</span> {item.reason}</p>
                <p className="text-zinc-400"><span className="text-zinc-500">Calidad:</span> {item.quality_status}</p>
                <p className="text-zinc-400"><span className="text-zinc-500">Vinculación:</span> {item.linking_status}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}