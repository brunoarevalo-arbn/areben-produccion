import { z } from 'zod';

export const MovimientoSchema = z.object({
  productoId: z.string().min(1),
  tipo:       z.enum(['entrada_deposito', 'salida_deposito', 'entrada_local', 'venta']),
  cantidad:   z.number().int().positive(),
  nota:       z.string().optional(),
  creadoPor:  z.string().default('sistema'),
});

export const StockMinimoSchema = z.object({
  productoId:  z.string().min(1),
  stockMinimo: z.number().int().min(0),
  precioVenta: z.number().min(0),
});
