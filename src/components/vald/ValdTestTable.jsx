import React from "react";
import ValdProductBadge from "./ValdProductBadge";

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}

function fmtMetric(metrics) {
  if (!metrics || Object.keys(metrics).length === 0) return "—";
  const entries = Object.entries(metrics).slice(0, 3);
  return entries.map(([k, v]) => `${k}: ${typeof v === "number" ? v.toFixed(2) : v}`).join(" · ");
}

export default function ValdTestTable({ tests, limit = 20, showPlayer = true }) {
  const rows = (tests || []).slice(0, limit);
  if (!rows.length) {
    return <p className="text-zinc-500 text-sm text-center py-8">No hay tests registrados.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-zinc-500 text-xs uppercase border-b border-zinc-800">
            {showPlayer && <th className="text-left py-2 px-2">Jugador</th>}
            <th className="text-left py-2 px-2">Producto</th>
            <th className="text-left py-2 px-2">Tipo</th>
            <th className="text-left py-2 px-2">Lado</th>
            <th className="text-left py-2 px-2">Fecha</th>
            <th className="text-left py-2 px-2">Métricas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
              {showPlayer && <td className="py-2 px-2 text-white font-medium">{t.player_name || "—"}</td>}
              <td className="py-2 px-2"><ValdProductBadge product={t.product} /></td>
              <td className="py-2 px-2 text-zinc-300">{t.test_type || "—"}</td>
              <td className="py-2 px-2 text-zinc-400">{t.test_side || "—"}</td>
              <td className="py-2 px-2 text-zinc-400">{fmtDate(t.test_date)}</td>
              <td className="py-2 px-2 text-zinc-300 text-xs">{fmtMetric(t.metrics)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}