// Configuración estática de Áreas de Trabajo y su relación con los roles de UserAccess.
// No se crean entidades nuevas: se reutiliza el campo "role" de UserAccess.

export const AREAS = [
  { id: "cuerpo_tecnico",       name: "Cuerpo Técnico",       description: "Sesiones, partidos, plantel y táctica",        icon: "Users" },
  { id: "rendimiento_fisico",   name: "Rendimiento Físico",   description: "Carga externa, GPS y evaluaciones físicas",    icon: "Gauge" },
  { id: "area_medica",          name: "Área Médica",          description: "Seguimiento médico de los jugadores",         icon: "Heart" },
  { id: "kinesiologia",         name: "Kinesiología",         description: "Readaptación y trabajo kinésico",             icon: "HeartPulse" },
  { id: "nutricion",            name: "Nutrición",            description: "Seguimiento nutricional del plantel",         icon: "Apple" },
  { id: "psicologia",           name: "Psicología",           description: "Seguimiento psicológico del plantel",         icon: "Brain" },
  { id: "coordinacion_general", name: "Coordinación General", description: "Visión global de todas las áreas",            icon: "ClipboardList" },
  { id: "administracion",       name: "Administración",       description: "Usuarios, planteles y configuración",         icon: "Settings2" },
];

// Rol de negocio (UserAccess.role) → áreas a las que puede ingresar
export const ROLE_AREAS = {
  "Administrador":           ["administracion", "coordinacion_general", "cuerpo_tecnico", "rendimiento_fisico", "area_medica", "kinesiologia", "nutricion", "psicologia"],
  "Coordinador":             ["coordinacion_general", "cuerpo_tecnico", "rendimiento_fisico", "area_medica", "kinesiologia", "nutricion", "psicologia"],
  "Director Deportivo":      ["coordinacion_general", "cuerpo_tecnico"],
  "Entrenador":              ["cuerpo_tecnico"],
  "Preparador Físico":       ["cuerpo_tecnico", "rendimiento_fisico"],
  "Analista de Rendimiento": ["rendimiento_fisico"],
  "Médico":                  ["area_medica", "kinesiologia"],
  "Kinesiólogo":             ["kinesiologia", "area_medica"],
  "Nutricionista":           ["nutricion"],
  "Videoanalista":           ["cuerpo_tecnico"],
  "Utilero":                 ["cuerpo_tecnico"],
  "Solo lectura":            ["cuerpo_tecnico"],
};

// Dentro de Cuerpo Técnico, el menú/páginas permitidas dependen del rol.
// null = todas las páginas del área.
export const CUERPO_TECNICO_ROLE_PAGES = {
  "Administrador":      null,
  "Coordinador":        null,
  "Director Deportivo": null,
  "Entrenador":         ["/", "/daily-squad", "/sessions", "/matches", "/tactical", "/schedule", "/weekly-planner", "/performance/minutes"],
  "Preparador Físico":  ["/", "/daily-squad", "/sessions", "/performance/external-load", "/schedule", "/weekly-planner"],
  "Videoanalista":      ["/matches", "/tactical", "/sessions", "/schedule"],
  "Utilero":            ["/", "/daily-squad", "/schedule"],
  "Solo lectura":       ["/", "/daily-squad", "/sessions", "/matches", "/tactical"],
};

// Páginas permitidas por área (fuera de Cuerpo Técnico). null = todas.
export const AREA_PAGES = {
  rendimiento_fisico:   ["/", "/performance/external-load", "/performance/internal-load", "/performance/minutes", "/schedule"],
  area_medica:          ["/", "/performance/medical", "/schedule"],
  kinesiologia:         ["/", "/performance/medical", "/schedule"],
  nutricion:            ["/", "/performance/nutrition", "/schedule"],
  psicologia:           ["/", "/schedule"],
  coordinacion_general: null,
  administracion:       ["/", "/admin"],
};