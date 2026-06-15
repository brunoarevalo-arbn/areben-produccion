// lib/permisos.ts
//
// Registro central de permisos del sistema (granularidad por sección/módulo).
// ÚNICA fuente de verdad: lo consumen el sidebar, la gestión de usuarios,
// la autorización de las APIs y los guards de páginas.
//
// Bajada de línea: todo lo que se agregue al sistema debe gatearse contra un
// permiso de este registro (no hardcodear acceso por rol). Para sumar un módulo
// o sector nuevo, agregar su key acá y usar requirePermiso()/can() en su API y UI.

export const PERMISOS = [
  { key: 'dashboard',     label: 'Dashboard',     desc: 'Panel general e indicadores' },
  { key: 'diseno',        label: 'Diseño',        desc: 'Proyectos de diseño, molderías y telas' },
  { key: 'insumos',       label: 'Insumos',       desc: 'Stock, compras, rollos, lotes y movimientos' },
  { key: 'produccion',    label: 'Producción',    desc: 'Órdenes, cortes, reportes y pagos de corte' },
  { key: 'gastos',        label: 'Gastos',        desc: 'Gastos del taller' },
  { key: 'costos',        label: 'Costos',        desc: 'Escandallos, costos de costura y productividad' },
  { key: 'configuracion', label: 'Configuración', desc: 'Cortadores, proveedores y catálogos' },
  { key: 'usuarios',      label: 'Usuarios',      desc: 'Gestión de usuarios y permisos' },
] as const;

export type PermisoKey = typeof PERMISOS[number]['key'];

export const PERMISO_KEYS: PermisoKey[] = PERMISOS.map((p) => p.key);
