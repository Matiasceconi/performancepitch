export const PIPELINE_STAGES = [
  { id: "discovered", label: "Descubierto" },
  { id: "longlist", label: "Longlist" },
  { id: "watching", label: "Seguimiento" },
  { id: "shortlist", label: "Shortlist" },
  { id: "priority", label: "Prioridad" },
  { id: "due_diligence", label: "Due diligence" },
  { id: "negotiation", label: "Negociación" },
  { id: "signed", label: "Incorporado" },
  { id: "discarded", label: "Descartado" },
];

export const STAGE_LABEL = Object.fromEntries(PIPELINE_STAGES.map((x) => [x.id, x.label]));
export const RECOMMENDATION_LABEL = {
  strong_recommend: "Recomendar fuerte",
  recommend: "Recomendar",
  monitor: "Seguir observando",
  doubt: "Dudas",
  do_not_recommend: "No recomendar",
};
export const PRIORITY_LABEL = { low: "Baja", medium: "Media", high: "Alta", critical: "Crítica" };
export const HORIZON_LABEL = { current_window: "Mercado actual", next_window: "Próximo mercado", "6_months": "6 meses", "12_months": "12 meses", "24_months": "24 meses" };
export const ASSIGNMENT_LABEL = { video: "Video", live_match: "En vivo", data_review: "Datos", background_check: "Background", follow_up: "Seguimiento" };

export function fmtMoney(value, currency = "USD") {
  if (value === null || value === undefined || value === "") return "—";
  try { return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value)); }
  catch { return `${currency} ${Number(value).toLocaleString("es-AR")}`; }
}
export function fmtDate(value) {
  if (!value) return "—";
  const iso = String(value).slice(0, 10);
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}
export function prospectAge(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T12:00:00`);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const md = now.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age -= 1;
  return Number.isFinite(age) ? age : null;
}
