// Helpers de color para la escala de wellness (v2: 1-10, mayor es peor)
// y para RPE (0-10) y horas de sueño.

export function scaleColor(n) {
  if (n == null || n === 0) return 'gray';
  if (n <= 3) return 'green';
  if (n <= 6) return 'yellow';
  if (n <= 8) return 'orange';
  return 'red';
}

// Dolor: 0 = sin dolor (verde), 1-10 igual que scaleColor
export function painColor(n) {
  if (n == null) return 'gray';
  if (n === 0) return 'green';
  if (n <= 3) return 'green';
  if (n <= 6) return 'yellow';
  if (n <= 8) return 'orange';
  return 'red';
}

// Horas de sueño: <6 rojo, 6-<8 amarillo, >=8 verde
export function sleepColor(h) {
  if (h == null || h <= 0) return 'gray';
  if (h >= 8) return 'green';
  if (h >= 6) return 'yellow';
  return 'red';
}

// RPE 0-10: intensidad del esfuerzo (no estado del jugador)
export function rpeColor(n) {
  if (n == null) return 'gray';
  if (n <= 2) return 'green';
  if (n <= 4) return 'green';
  if (n <= 6) return 'yellow';
  if (n <= 8) return 'orange';
  return 'red';
}

export const PILL_CLASSES = {
  green: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  yellow: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
  orange: 'bg-orange-500/20 text-orange-300 border border-orange-500/40',
  red: 'bg-red-500/20 text-red-300 border border-red-500/40',
  gray: 'bg-zinc-800/60 text-zinc-500 border border-zinc-700',
};

export const LEGEND = [
  { color: 'green', label: 'Favorable' },
  { color: 'yellow', label: 'Atención' },
  { color: 'orange', label: 'Alerta' },
  { color: 'red', label: 'Alerta alta' },
  { color: 'gray', label: 'Pendiente' },
];