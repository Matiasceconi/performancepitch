// Modelos de cancha y estilos disponibles para la pizarra.

export const PITCH_MODELS = [
  { id: "full_horizontal", label: "Cancha completa horizontal", width: 1600, height: 900 },
  { id: "full_vertical", label: "Cancha completa vertical", width: 900, height: 1600 },
  { id: "half_horizontal", label: "Media cancha horizontal", width: 1600, height: 900 },
  { id: "half_vertical", label: "Media cancha vertical", width: 900, height: 1600 },
  { id: "third_attacking", label: "Tercio ofensivo", width: 1600, height: 900 },
  { id: "third_defensive", label: "Tercio defensivo", width: 1600, height: 900 },
  { id: "final_third_area", label: "Área de definición", width: 1600, height: 900 },
  { id: "no_areas", label: "Cancha sin áreas", width: 1600, height: 900 },
  { id: "futsal", label: "Futsal", width: 1200, height: 800 },
  { id: "blank", label: "Fondo en blanco", width: 1600, height: 900 },
];

export const PITCH_STYLES = [
  { id: "realistic", label: "Césped realista" },
  { id: "flat_green", label: "Verde plano" },
  { id: "stripes", label: "Césped con franjas" },
  { id: "bw", label: "Blanco y negro" },
  { id: "light", label: "Fondo claro" },
  { id: "transparent", label: "Fondo transparente" },
  { id: "custom", label: "Colores personalizados" },
];

export const PITCH_OVERLAYS = [
  { id: "lanes5", label: "Cinco carriles verticales" },
  { id: "zones3", label: "Tres zonas horizontales" },
  { id: "grid", label: "Cuadrícula configurable" },
  { id: "halves", label: "Mitades" },
  { id: "thirds", label: "Tercios" },
  { id: "defensive_line", label: "Línea defensiva" },
  { id: "blocks", label: "Bloques tácticos" },
  { id: "colored_zones", label: "Zonas coloreadas" },
  { id: "measurements", label: "Medidas del espacio" },
];

export const DEFAULT_PITCH_CONFIG = {
  model: "full_horizontal",
  style: "stripes",
  orientation: "horizontal", // horizontal | vertical
  overlays: [],
  customColor1: "#16a34a",
  customColor2: "#15803d",
  lineColor: "rgba(255,255,255,0.85)",
  showGrid: false,
  gridSize: 80,
};

export function getPitchDimensions(config) {
  const model = PITCH_MODELS.find((m) => m.id === config?.model) || PITCH_MODELS[0];
  return { width: model.width, height: model.height };
}

export function resolvePitchConfig(config) {
  return { ...DEFAULT_PITCH_CONFIG, ...(config || {}) };
}