import { z } from 'zod';

// Schema para el modelo `Producto` (catálogo de productos), separado de
// `ProyectoDiseno`. Si en el futuro se unifican, se ajusta acá.
export const ProductoSchema = z.object({
  nombre:      z.string().min(1, 'Nombre requerido'),
  descripcion: z.string().optional(),
  molderia:    z.string().optional(),
  tela:        z.string().optional(),
  colores:     z.string().optional(),
  costoTela:   z.number().default(0),
  costoMO:     z.number().default(0),
  costoTotal:  z.number().default(0),
  estado:      z.enum(['borrador', 'activo', 'archivado']).default('borrador'),
  marca:       z.string().optional(),
  temporada:   z.string().optional(),
});

export type ProductoInput = z.infer<typeof ProductoSchema>;
