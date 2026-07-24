// Plantillas tácticas iniciales versionadas.
// Cada plantilla define un proyecto con pizarras y elementos pre-armados.

import { createElement } from "./tacticalElementFactory";
import { DEFAULT_PITCH_CONFIG } from "./tacticalPitchModels";

function placePlayers(system, isRival = false) {
  const lines = String(system).split("-").map(Number);
  const yValues = lines.length === 4 ? [620, 460, 300, 160] : [620, 430, 200];
  const elements = [];
  // Arquero
  elements.push(
    createElement("goalkeeper", {
      x: 800,
      y: 800,
      data: { number: "1", isRival, color: isRival ? "#ef4444" : "#facc15" },
    })
  );
  lines.forEach((count, lineIndex) => {
    for (let i = 0; i < count; i++) {
      const x = ((i + 1) * 1600) / (count + 1);
      elements.push(
        createElement("player", {
          x,
          y: yValues[lineIndex] || 200,
          data: { isRival, color: isRival ? "#ef4444" : "#3b82f6" },
        })
      );
    }
  });
  return elements;
}

export const TACTICAL_TEMPLATES = [
  {
    id: "tpl_salida_fondo",
    name: "Salida desde el fondo",
    category: "Salida",
    mode: "tactical",
    description: "Salida limpia desde el bloque defensivo con apoyos cortos.",
    boards: [
      {
        name: "Salida desde el fondo",
        mode: "tactical",
        objective: "Generar superioridad numérica en la primera línea.",
        elements: placePlayers("4-3-3"),
      },
    ],
  },
  {
    id: "tpl_presion_alta",
    name: "Presión alta",
    category: "Presión",
    mode: "tactical",
    description: "Presión coordinada en bloque alto sobre el portero rival.",
    boards: [
      {
        name: "Presión alta",
        mode: "tactical",
        objective: "Recuperar en campo rival tras saque largo.",
        elements: [
          ...placePlayers("4-3-3"),
          ...placePlayers("4-3-3", true).map((e) => ({ ...e, y: e.y - 200 })),
        ],
      },
    ],
  },
  {
    id: "tpl_bloque_medio",
    name: "Bloque medio",
    category: "Defensa",
    mode: "tactical",
    description: "Bloque medio compacto en campo propio.",
    boards: [
      {
        name: "Bloque medio",
        mode: "tactical",
        objective: "Compactar líneas y reducir espacios.",
        elements: placePlayers("4-4-2"),
      },
    ],
  },
  {
    id: "tpl_bloque_bajo",
    name: "Bloque bajo",
    category: "Defensa",
    mode: "tactical",
    description: "Bloque bajo cerca del área propia.",
    boards: [
      {
        name: "Bloque bajo",
        mode: "tactical",
        objective: "Defender la zona propia y salir al contraataque.",
        elements: placePlayers("5-3-2"),
      },
    ],
  },
  {
    id: "tpl_ataque_posicional",
    name: "Ataque posicional",
    category: "Ataque",
    mode: "tactical",
    description: "Circulación y amplitud en ataque posicional.",
    boards: [
      {
        name: "Ataque posicional",
        mode: "tactical",
        objective: "Generar ventajas por amplitud y profundidad.",
        elements: placePlayers("4-2-3-1"),
      },
    ],
  },
  {
    id: "tpl_transicion_ofensiva",
    name: "Transición ofensiva",
    category: "Transición",
    mode: "tactical",
    description: "Salida rápida tras recuperación.",
    boards: [
      {
        name: "Transición ofensiva",
        mode: "tactical",
        objective: "Verticalidad inmediata tras robo.",
        elements: placePlayers("4-3-3"),
      },
    ],
  },
  {
    id: "tpl_transicion_defensiva",
    name: "Transición defensiva",
    category: "Transición",
    mode: "tactical",
    description: "Repliegue rápido tras pérdida.",
    boards: [
      {
        name: "Transición defensiva",
        mode: "tactical",
        objective: "Replegar y compactar tras pérdida.",
        elements: placePlayers("4-3-3"),
      },
    ],
  },
  {
    id: "tpl_corner_ofensivo",
    name: "Córner ofensivo",
    category: "Pelota parada",
    mode: "tactical",
    description: "Rutina de córner ofensivo.",
    boards: [
      {
        name: "Córner ofensivo",
        mode: "tactical",
        objective: "Generar remate desde córner.",
        elements: placePlayers("4-3-3"),
      },
    ],
  },
  {
    id: "tpl_corner_defensivo",
    name: "Córner defensivo",
    category: "Pelota parada",
    mode: "tactical",
    description: "Marca en córner defensivo.",
    boards: [
      {
        name: "Córner defensivo",
        mode: "tactical",
        objective: "Anular remate rival en córner.",
        elements: placePlayers("4-4-2"),
      },
    ],
  },
  {
    id: "tpl_tiro_libre",
    name: "Tiro libre",
    category: "Pelota parada",
    mode: "tactical",
    description: "Rutina de tiro libre.",
    boards: [
      {
        name: "Tiro libre",
        mode: "tactical",
        objective: "Aprovechar tiro libre directo o indirecto.",
        elements: placePlayers("4-3-3"),
      },
    ],
  },
  {
    id: "tpl_saque_lateral",
    name: "Saque lateral",
    category: "Pelota parada",
    mode: "tactical",
    description: "Patrones de saque lateral.",
    boards: [
      {
        name: "Saque lateral",
        mode: "tactical",
        objective: "Recuperar posesión desde saque lateral.",
        elements: placePlayers("4-3-3"),
      },
    ],
  },
  {
    id: "tpl_rondo",
    name: "Rondo",
    category: "Entrenamiento",
    mode: "exercise",
    description: "Rondo 4v2 en cuadrado reducido.",
    boards: [
      {
        name: "Rondo 4v2",
        mode: "exercise",
        objective: "Mantenimiento y superioridad numérica.",
        pitchConfig: { ...DEFAULT_PITCH_CONFIG, model: "blank", style: "light" },
        elements: [
          createElement("rectangle", { x: 500, y: 300, width: 600, height: 400, data: { color: "#22c55e", fill: "rgba(34,197,94,0.1)" } }),
          createElement("player", { x: 560, y: 360, data: { color: "#3b82f6" } }),
          createElement("player", { x: 1040, y: 360, data: { color: "#3b82f6" } }),
          createElement("player", { x: 560, y: 640, data: { color: "#3b82f6" } }),
          createElement("player", { x: 1040, y: 640, data: { color: "#3b82f6" } }),
          createElement("generic_player", { x: 700, y: 500, data: { color: "#ef4444" } }),
          createElement("generic_player", { x: 900, y: 500, data: { color: "#ef4444" } }),
        ],
      },
    ],
  },
  {
    id: "tpl_posesion",
    name: "Posesión",
    category: "Entrenamiento",
    mode: "exercise",
    description: "Posesión 6v3 en dos áreas.",
    boards: [
      {
        name: "Posesión 6v3",
        mode: "exercise",
        objective: "Circulación rápida y transiciones.",
        elements: placePlayers("4-2-3-1"),
      },
    ],
  },
  {
    id: "tpl_juego_reducido",
    name: "Juego reducido",
    category: "Entrenamiento",
    mode: "exercise",
    description: "Juego reducido 3v3 con porteros.",
    boards: [
      {
        name: "Juego reducido 3v3",
        mode: "exercise",
        objective: "Finalización en espacio reducido.",
        elements: placePlayers("3-3-2"),
      },
    ],
  },
  {
    id: "tpl_finalizacion",
    name: "Finalización",
    category: "Entrenamiento",
    mode: "exercise",
    description: "Circuito de finalización.",
    boards: [
      {
        name: "Finalización",
        mode: "exercise",
        objective: "Trabajo de definición.",
        elements: placePlayers("4-3-3"),
      },
    ],
  },
  {
    id: "tpl_circuito_fisico_tecnico",
    name: "Circuito físico-técnico",
    category: "Entrenamiento",
    mode: "exercise",
    description: "Circuito con conos, vallas y escalera.",
    boards: [
      {
        name: "Circuito físico-técnico",
        mode: "exercise",
        objective: "Coordinación y técnica con carga física.",
        pitchConfig: { ...DEFAULT_PITCH_CONFIG, model: "blank", style: "light" },
        elements: [
          createElement("ladder", { x: 300, y: 300 }),
          createElement("hurdle", { x: 300, y: 400 }),
          createElement("hurdle", { x: 360, y: 400 }),
          createElement("cone", { x: 600, y: 300 }),
          createElement("cone", { x: 600, y: 500 }),
          createElement("cone", { x: 700, y: 400 }),
          createElement("ball", { x: 900, y: 450 }),
          createElement("mini_goal", { x: 1200, y: 450 }),
        ],
      },
    ],
  },
];

export function getTemplateById(id) {
  return TACTICAL_TEMPLATES.find((t) => t.id === id);
}