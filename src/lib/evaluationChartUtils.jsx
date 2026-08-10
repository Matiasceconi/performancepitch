// Constantes de color y utilidades para gráficos de Evaluaciones

export const TEST_COLORS = {
  cmj: "#3b82f6",   // azul
  sj: "#a855f7",    // violeta
  cmrj: "#f59e0b",  // ámbar
  nordic: "#ef4444",
  isopush: "#10b981",
  default: "#6b7280",
};

export function testColor(testKey) {
  return TEST_COLORS[testKey?.toLowerCase()] || TEST_COLORS.default;
}

export const SIGNAL_COLORS = {
  expected: { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30", hex: "#10b981" },
  moderate: { bg: "bg-yellow-500/15", text: "text-yellow-300", border: "border-yellow-500/30", hex: "#eab308" },
  important: { bg: "bg-red-500/15", text: "text-red-300", border: "border-red-500/30", hex: "#ef4444" },
  insufficient: { bg: "bg-zinc-700/30", text: "text-zinc-500", border: "border-zinc-700", hex: "#71717a" },
};

export function signalColor(signal) {
  return SIGNAL_COLORS[signal] || SIGNAL_COLORS.insufficient;
}

export const SIGNAL_LABELS = {
  expected: "Esperado",
  moderate: "Moderada",
  important: "Importante",
  insufficient: "Sin base",
};

export function fmtVal(v, digits = 1) {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  return Number(v).toFixed(digits);
}

export function fmtPct(v, withSign = true) {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  const s = withSign && v > 0 ? "+" : "";
  return `${s}${Number(v).toFixed(1)}%`;
}

export function fmtDate(iso, short = false) {
  if (!iso) return "—";
  try {
    const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
    return d.toLocaleDateString("es-AR", short
      ? { day: "2-digit", month: "short" }
      : { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}

// Tooltip custom para Recharts
export function ChartTooltip({ active, payload, label, unit, metricLabel }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-xs shadow-xl">
      {label && <p className="text-zinc-400 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.stroke }} />
          <span className="text-zinc-300">{p.name}:</span>
          <span className="text-white font-semibold tabular-nums">
            {typeof p.value === "number" ? p.value.toFixed(p.payload?.digits || 1) : p.value}
            {unit ? ` ${unit}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

// Formateador de eje Y: muestra valor + unidad
export function yAxisFormatter(unit) {
  return (v) => `${Number(v).toFixed(0)}${unit ? "" : ""}`;
}