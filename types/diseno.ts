export interface Foto {
  id: string;
  url: string;
  nombre?: string | null;
  productoId: string;
  createdAt: Date;
}

export interface HistorialDiseno {
  id: string;
  productoId: string;
  version: number;
  cambios?: string | null;
  snapshot: string;
  creadoPor: string;
  createdAt: Date;
}

export interface Producto {
  id: string;
  nombre: string;
  descripcion?: string | null;
  molderia?: string | null;
  tela?: string | null;
  colores?: string | null;
  costoTela: number;
  costoMO: number;
  costoTotal: number;
  estado: string;
  marca?: string | null;
  temporada?: string | null;
  fotos?: Foto[];
  historial?: HistorialDiseno[];
  createdAt: Date;
  updatedAt: Date;
}

export type ProductoInput = Omit<Producto, 'id' | 'fotos' | 'historial' | 'createdAt' | 'updatedAt'>;

// ─── Módulo de diseño iterativo ────────────────────────────────────────────────

export type EstadoProyecto =
  | 'inspiracion'
  | 'en_desarrollo'
  | 'muestra_lista'
  | 'ajustes'
  | 'produccion'
  | 'descontinuado';

export type EstadoCiclo = 'activo' | 'standby' | 'archivado';

export type EstadoIteracion = 'en_confeccion' | 'lista' | 'rechazada' | 'aprobada';

export type TipoIteracion = 'muestra' | 'contramuestra';

export type EstadoAjuste = 'pendiente' | 'realizado' | 'aprobado';

export interface InsumoMuestra {
  id: string;
  iteracionId: string;
  nombre: string;
  cantidad: number;
  unidad?: string | null;
  costo: number;
  notas?: string | null;
}

export interface AjusteMuestra {
  id: string;
  iteracionId: string;
  descripcion: string;
  estado: EstadoAjuste;
  fechaRealizado?: string | null;
  createdAt: string;
}

export interface IteracionMuestra {
  id: string;
  proyectoId: string;
  version: number;
  tipo: TipoIteracion;
  estado: EstadoIteracion;
  fotos: string[];
  notas?: string | null;
  ajustes: AjusteMuestra[];
  insumos: InsumoMuestra[];
  createdAt: string;
  updatedAt: string;
}

export interface IdeaDiseno {
  id: string;
  proyectoId: string;
  titulo?: string | null;
  descripcion: string;
  foto?: string | null;
  etiquetas: string[];
  createdAt: string;
}

export interface ProyectoInsumo {
  id: string;
  proyectoId: string;
  nombre: string;
  tipo?: string | null;
  proveedor?: string | null;
  unidad: string;
  cantidad: number;
  costoUnitario: number;
  notas?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SKUProyecto {
  id: string;
  proyectoId: string;
  codigo: string;
  talle?: string | null;
  color?: string | null;
  cantidad: number;
  notas?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PasoProyecto {
  id: string;
  numeroPaso: number;
  nombrePaso: string;
  estado: string;
  saltado: boolean;
  observaciones?: string | null;
  datos?: string | null;
  fechaInicio?: string | null;
  fechaCompletado?: string | null;
  responsableId?: string | null;
  esTercero?: boolean;
  terceroNombre?: string | null;
  responsableInternoId?: string | null;
  updatedAt: string;
}

export interface UsuarioSimple {
  id:     string;
  nombre: string;
}

export interface ProyectoDiseno {
  id: string;
  nombre: string;
  marca: string;
  estado: EstadoCiclo;
  estadoDiseno: EstadoProyecto;
  inspiracion?: string | null;
  moodboard: string[];
  molderia?: string | null;
  molderiaFormato?: string | null;
  tela?: string | null;
  costo: number;
  precioEstimado: number;
  estadoProduccion?: string | null;
  cantidad: number;
  fechaObjetivo?: string | null;
  pasos: PasoProyecto[];
  iteraciones: IteracionMuestra[];
  ideas: IdeaDiseno[];
  insumos: ProyectoInsumo[];
  skus: SKUProyecto[];
  createdAt: string;
  updatedAt: string;
}
