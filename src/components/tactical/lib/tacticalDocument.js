// Helpers para crear y normalizar documentos de pizarra.

import { DEFAULT_PITCH_CONFIG, getPitchDimensions } from "./tacticalPitchModels";

export const EDITOR_VERSION = "1";

export function createBoardPayload(projectId, overrides = {}) {
  const pitchConfig = overrides.pitch_config || { ...DEFAULT_PITCH_CONFIG };
  const dims = getPitchDimensions(pitchConfig);
  return {
    project_id: projectId,
    name: overrides.name || "Nueva pizarra",
    order: overrides.order ?? 0,
    mode: overrides.mode || "tactical",
    pitch_config: pitchConfig,
    document_width: dims.width,
    document_height: dims.height,
    elements: overrides.elements || [],
    objective: overrides.objective || "",
    notes: overrides.notes || "",
    editor_version: EDITOR_VERSION,
    revision: 1,
    ...overrides,
  };
}

export function createProjectPayload(overrides = {}) {
  return {
    name: overrides.name || "Nuevo proyecto",
    description: overrides.description || "",
    default_mode: overrides.default_mode || "tactical",
    status: "active",
    is_template: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_opened_at: new Date().toISOString(),
    ...overrides,
  };
}

// Normaliza un board cargado desde la DB para asegurar campos
export function normalizeBoard(board) {
  if (!board) return null;
  const pitchConfig = board.pitch_config || { ...DEFAULT_PITCH_CONFIG };
  const dims = getPitchDimensions(pitchConfig);
  return {
    ...board,
    pitch_config: pitchConfig,
    document_width: board.document_width || dims.width,
    document_height: board.document_height || dims.height,
    elements: Array.isArray(board.elements) ? board.elements : [],
    editor_version: board.editor_version || EDITOR_VERSION,
    revision: board.revision || 1,
  };
}

// Normaliza un elemento cargado para asegurar todos los campos
export function normalizeElement(el) {
  return {
    id: el.id,
    type: el.type,
    x: el.x || 0,
    y: el.y || 0,
    width: el.width || 60,
    height: el.height || 60,
    rotation: el.rotation || 0,
    scaleX: el.scaleX ?? 1,
    scaleY: el.scaleY ?? 1,
    opacity: el.opacity ?? 1,
    zIndex: el.zIndex || 0,
    locked: el.locked || false,
    visible: el.visible !== false,
    groupId: el.groupId || null,
    data: el.data || {},
  };
}