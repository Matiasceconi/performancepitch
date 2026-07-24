// Validaciones funcionales de la pizarra.

// Cuenta jugadores propios (no rivales) en un array de elementos
export function countOwnPlayers(elements) {
  return (elements || []).filter(
    (el) =>
      ["player", "goalkeeper", "coach"].includes(el.type) &&
      !el.data?.isRival
  ).length;
}

export function countRivalPlayers(elements) {
  return (elements || []).filter(
    (el) =>
      ["player", "generic_player", "goalkeeper"].includes(el.type) &&
      el.data?.isRival
  ).length;
}

// Valida que una formación oficial tenga máximo 11 jugadores propios
export function validateOfficialFormation(elements) {
  const own = countOwnPlayers(elements);
  if (own > 11) {
    return {
      valid: false,
      message: `Hay ${own} jugadores propios. Una formación oficial puede tener máximo 11.`,
    };
  }
  if (own < 11) {
    return {
      valid: true,
      warning: `Hay ${own} jugadores propios. Una formación oficial suele tener 11.`,
    };
  }
  return { valid: true };
}

// Verifica que un elemento tenga los campos mínimos
export function isValidElement(el) {
  return el && el.id && el.type && typeof el.x === "number" && typeof el.y === "number";
}

// Limpia elementos inválidos
export function sanitizeElements(elements) {
  return (elements || []).filter(isValidElement);
}