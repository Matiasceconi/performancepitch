// Utilidades compartidas para la prescripción serie por serie de fuerza.

export const LOAD_TYPES = [
  { value: "kg", label: "Kilogramos", short: "kg" },
  { value: "pct_1rm", label: "% del 1RM", short: "% 1RM" },
  { value: "pct_bodyweight", label: "% peso corporal", short: "% PC" },
  { value: "none", label: "Sin carga", short: "—" },
];

export function formatLoad(serie) {
  if (!serie) return "—";
  const { load_type, load_value } = serie;
  if (!load_type || load_type === "none") return "Sin carga";
  const val = String(load_value || "").trim();
  if (load_type === "kg") return val ? `${val} kg` : "—";
  if (load_type === "pct_1rm") return val ? `${val}% del 1RM` : "—";
  if (load_type === "pct_bodyweight") return val ? `${val}% del peso corporal` : "—";
  return "—";
}

export function generateSeries(count, template = {}) {
  const n = Math.max(1, Math.min(20, Number(count) || 1));
  return Array.from({ length: n }, () => ({
    reps: template.reps || "",
    time: template.time || "",
    load_type: template.load_type || "none",
    load_value: template.load_value || "",
  }));
}

export function summarizeSeries(series) {
  if (!series || !series.length) return "Sin series";
  const reps = series.map((s) => s.reps).filter(Boolean);
  const times = series.map((s) => s.time).filter(Boolean);
  const parts = [];
  if (reps.length) {
    const unique = [...new Set(reps)];
    parts.push(unique.length === 1 ? `${series.length} × ${unique[0]} reps` : `${series.length} series`);
  }
  if (times.length) {
    const unique = [...new Set(times)];
    parts.push(unique.length === 1 ? `${series.length} × ${unique[0]}s` : `${times.length} con tiempo`);
  }
  if (!reps.length && !times.length) parts.push(`${series.length} series`);
  return parts.join(" · ");
}

export function summarizeLoads(series) {
  if (!series || !series.length) return "Sin carga";
  const loads = series.map(formatLoad).filter((l) => l !== "Sin carga" && l !== "—");
  if (!loads.length) return "Sin carga";
  return [...new Set(loads)].join(", ");
}

// Migración lazy (no destructiva): genera series desde campos planos legados
// si el ejercicio no tiene el campo series. No persiste nada; solo se usa en memoria.
// Es idempotente: si series ya existe, lo devuelve tal cual.
export function migrateSeries(station) {
  if (station.series && station.series.length) return station.series;
  const sets = parseInt(station.sets, 10) || 0;
  if (!sets) return [];
  return Array.from({ length: sets }, () => ({
    reps: station.reps || "",
    time: station.time || "",
    load_type: "none",
    load_value: "",
  }));
}

export function getYouTubeId(url = "") {
  const match = String(url).match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return match?.[1] || null;
}

export function getVideoThumbnail(url = "") {
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
}