// Factory para crear elementos de la pizarra con valores por defecto.
// Cada elemento tiene la estructura normalizada:
// { id, type, x, y, width, height, rotation, scaleX, scaleY, opacity, zIndex, locked, visible, groupId, data }

let _counter = 0;
export function genId(prefix = "el") {
  _counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${_counter.toString(36)}`;
}

const BASE = {
  x: 800,
  y: 450,
  width: 60,
  height: 60,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  zIndex: 0,
  locked: false,
  visible: true,
  groupId: null,
};

export const ELEMENT_TYPES = [
  "player", "generic_player", "goalkeeper", "coach", "ball",
  "cone", "pole", "mannequin", "hurdle", "hoop", "ladder",
  "large_goal", "mini_goal", "marker",
  "text", "line", "arrow", "curved_arrow", "freehand",
  "rectangle", "ellipse", "polygon", "zone", "tactical_line",
];

export function createElement(type, overrides = {}) {
  const id = genId(type);
  const base = { ...BASE, id, type };
  switch (type) {
    case "player":
    case "generic_player":
    case "goalkeeper":
    case "coach":
      return {
        ...base,
        width: 56,
        height: 56,
        data: {
          label: "",
          number: "",
          position: "",
          photo_url: "",
          color: type === "goalkeeper" ? "#facc15" : "#3b82f6",
          borderColor: "#ffffff",
          shape: "circle", // circle | jersey | initials
          showPhoto: false,
          captain: false,
          isRival: type === "generic_player",
          player_id: null,
          snapshot: null,
          ...overrides.data,
        },
        ...overrides,
      };
    case "ball":
      return {
        ...base,
        width: 28,
        height: 28,
        data: { color: "#ffffff", ...overrides.data },
        ...overrides,
      };
    case "cone":
      return {
        ...base,
        width: 30,
        height: 36,
        data: { color: "#f97316", ...overrides.data },
        ...overrides,
      };
    case "pole":
      return {
        ...base,
        width: 8,
        height: 60,
        data: { color: "#ef4444", ...overrides.data },
        ...overrides,
      };
    case "mannequin":
      return {
        ...base,
        width: 24,
        height: 70,
        data: { color: "#64748b", ...overrides.data },
        ...overrides,
      };
    case "hurdle":
      return {
        ...base,
        width: 50,
        height: 18,
        data: { color: "#22c55e", ...overrides.data },
        ...overrides,
      };
    case "hoop":
      return {
        ...base,
        width: 60,
        height: 60,
        data: { color: "#a855f7", ...overrides.data },
        ...overrides,
      };
    case "ladder":
      return {
        ...base,
        width: 120,
        height: 30,
        data: { color: "#eab308", ...overrides.data },
        ...overrides,
      };
    case "large_goal":
      return {
        ...base,
        width: 160,
        height: 60,
        data: { color: "#ffffff", ...overrides.data },
        ...overrides,
      };
    case "mini_goal":
      return {
        ...base,
        width: 80,
        height: 40,
        data: { color: "#ffffff", ...overrides.data },
        ...overrides,
      };
    case "marker":
      return {
        ...base,
        width: 40,
        height: 40,
        data: { color: "#facc15", label: "", ...overrides.data },
        ...overrides,
      };
    case "text":
      return {
        ...base,
        width: 200,
        height: 40,
        data: {
          text: "Texto",
          fontSize: 28,
          fontFamily: "sans-serif",
          align: "left",
          color: "#ffffff",
          fontWeight: "bold",
          ...overrides.data,
        },
        ...overrides,
      };
    case "line":
    case "arrow":
    case "tactical_line":
      return {
        ...base,
        width: 200,
        height: 0,
        data: {
          points: [0, 0, 200, 0],
          color: "#facc15",
          strokeWidth: 4,
          dash: [],
          arrowStart: false,
          arrowEnd: type === "arrow",
          ...overrides.data,
        },
        ...overrides,
      };
    case "curved_arrow":
      return {
        ...base,
        width: 200,
        height: 0,
        data: {
          points: [0, 0, 200, 0],
          control: [100, -80],
          color: "#f97316",
          strokeWidth: 4,
          dash: [],
          arrowStart: false,
          arrowEnd: true,
          ...overrides.data,
        },
        ...overrides,
      };
    case "freehand":
      return {
        ...base,
        width: 0,
        height: 0,
        data: {
          points: [[0, 0]],
          color: "#22c55e",
          strokeWidth: 4,
          ...overrides.data,
        },
        ...overrides,
      };
    case "rectangle":
      return {
        ...base,
        width: 200,
        height: 120,
        data: {
          color: "#3b82f6",
          fill: "rgba(59,130,246,0.15)",
          strokeWidth: 3,
          cornerRadius: 8,
          ...overrides.data,
        },
        ...overrides,
      };
    case "zone":
      return {
        ...base,
        width: 240,
        height: 160,
        data: {
          color: "#22c55e",
          fill: "rgba(34,197,94,0.18)",
          strokeWidth: 2,
          cornerRadius: 0,
          label: "",
          ...overrides.data,
        },
        ...overrides,
      };
    case "ellipse":
      return {
        ...base,
        width: 160,
        height: 120,
        data: {
          color: "#a855f7",
          fill: "rgba(168,85,247,0.15)",
          strokeWidth: 3,
          ...overrides.data,
        },
        ...overrides,
      };
    case "polygon":
      return {
        ...base,
        width: 200,
        height: 200,
        data: {
          points: [[0, 0], [200, 0], [100, 200]],
          color: "#ef4444",
          fill: "rgba(239,68,68,0.15)",
          strokeWidth: 3,
          ...overrides.data,
        },
        ...overrides,
      };
    default:
      return { ...base, data: { ...overrides.data }, ...overrides };
  }
}

// Clona un elemento con nuevo ID
export function cloneElement(el) {
  return {
    ...el,
    id: genId(el.type),
    x: el.x + 24,
    y: el.y + 24,
    data: el.data ? JSON.parse(JSON.stringify(el.data)) : el.data,
  };
}

// Serializa elementos a JSON plano (sin funciones ni refs circulares)
export function serializeElements(elements) {
  return elements.map((el) => ({
    id: el.id,
    type: el.type,
    x: Math.round(el.x * 100) / 100,
    y: Math.round(el.y * 100) / 100,
    width: el.width,
    height: el.height,
    rotation: el.rotation,
    scaleX: el.scaleX,
    scaleY: el.scaleY,
    opacity: el.opacity,
    zIndex: el.zIndex,
    locked: el.locked,
    visible: el.visible,
    groupId: el.groupId,
    data: el.data ? JSON.parse(JSON.stringify(el.data)) : {},
  }));
}