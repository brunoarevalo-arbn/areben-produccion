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
