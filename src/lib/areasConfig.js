// Configuración estática de Áreas de Trabajo y catálogo de páginas del sistema.
// Los ROLES ahora son dinámicos (entidad AppRole, gestionados desde Administración → Roles, Áreas y Permisos).
// Cada AppRole define: areas[] + allowed_pages[] + permisos por acción.

export const AREAS = [
  { id: "cuerpo_tecnico",       name: "Cuerpo Técnico",       description: "Sesiones, partidos, plantel y táctica",        icon: "Users" },
  { id: "rendimiento_fisico",   name: "Rendimiento Físico",   description: "Carga externa, GPS y evaluaciones físicas",    icon: "Gauge" },
  { id: "area_medica",          name: "Área Médica",          description: "Seguimiento médico de los jugadores",         icon: "Heart" },
  { id: "kinesiologia",         name: "Kinesiología",         description: "Readaptación y trabajo kinésico",             icon: "HeartPulse" },
  { id: "nutricion",            name: "Nutrición",            description: "Seguimiento nutricional del plantel",         icon: "Apple" },
  { id: "psicologia",           name: "Psicología",           description: "Seguimiento psicológico del plantel",         icon: "Brain" },
  { id: "coordinacion_general", name: "Coordinación General", description: "Visión global de todas las áreas",            icon: "ClipboardList" },
  { id: "administracion",       name: "Administración",       description: "Usuarios, roles, planteles y configuración",  icon: "Settings2" },
];

// Catálogo de páginas del sistema (path + etiqueta) usado para armar roles y validar accesos.
export const PAGES = [
  { path: "/",                              label: "Dashboard" },
  { path: "/daily-squad",                   label: "Estado del Plantel" },
  { path: "/sessions",                      label: "Sesiones" },
  { path: "/field-library",                 label: "Biblioteca Campo" },
  { path: "/strength-library",              label: "Biblioteca Fuerza" },
  { path: "/matches",                       label: "Partidos" },
  { path: "/tactical",                      label: "Mapa táctico" },
  { path: "/performance/external-load",     label: "Carga Externa (GPS)" },
  { path: "/performance/internal-load",     label: "Carga Interna" },
  { path: "/performance/medical",           label: "Área Médica" },
  { path: "/performance/nutrition",         label: "Nutrición" },
  { path: "/performance/minutes",           label: "Minutos Jugados" },
  { path: "/schedule",                      label: "Calendario" },
  { path: "/team",                          label: "Cuerpo Técnico (Staff)" },
  { path: "/weekly-planner",                label: "Plan Semanal" },
  { path: "/squad-manager",                 label: "Planteles" },
  { path: "/admin",                         label: "Administración" },
];