export interface Stock {
  id: string;
  productoId: string;
  cantidadDeposito: number;
  cantidadLocal: number;
  stockMinimo: number;
  precioVenta: number;
  updatedAt: Date;
}

export interface MovimientoStock {
  id: string;
  productoId: string;
  tipo: 'entrada_deposito' | 'salida_deposito' | 'entrada_local' | 'venta';
  cantidad: number;
  nota?: string | null;
  creadoPor: string;
  createdAt: Date;
}

export type TipoMovimiento = MovimientoStock['tipo'];
