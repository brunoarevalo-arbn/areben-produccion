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
  { key: 'insumos',       label: 'Inventario',    desc: 'Telas, avíos, compras, rollos, lotes, movimientos y producto terminado' },
  { key: 'produccion',    label: 'Producción',    desc: 'Órdenes, cortes, reportes y pagos de corte' },
  { key: 'gastos',        label: 'Gastos',        desc: 'Gastos del taller' },
  { key: 'costos',        label: 'Costos',        desc: 'Escandallos, costos de costura y productividad' },
  { key: 'precios',       label: 'Precios',       desc: 'Lista de precios, márgenes, comisiones y descuentos' },
  { key: 'proveedores',   label: 'Proveedores',   desc: 'Alta y edición de proveedores (en Compras)' },
  { key: 'cortadores',    label: 'Cortadores',    desc: 'Alta y edición de cortadores y tarifas (en Producción)' },
  { key: 'motivos',       label: 'Motivos de descarte', desc: 'Catálogo de motivos de descarte/merma (en Producción)' },
  { key: 'configuracion', label: 'Configuración', desc: 'Ajustes generales y catálogos' },
  { key: 'usuarios',      label: 'Usuarios',      desc: 'Gestión de usuarios y permisos' },
  { key: 'reposicion',    label: 'Reposición',    desc: 'Vínculos con Gestión Nube y reporte de qué producir' },
  { key: 'cortador',      label: 'Cortador (panel)', desc: 'Panel propio del cortador: cargar sus cortes, tizadas, precios y muestras' },
  { key: 'estamperia',    label: 'Estampería',    desc: 'Catálogo de estampas DTF (diseñadora)' },
] as const;

export type PermisoKey = typeof PERMISOS[number]['key'];

export const PERMISO_KEYS: PermisoKey[] = PERMISOS.map((p) => p.key);
