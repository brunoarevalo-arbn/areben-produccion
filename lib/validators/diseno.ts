import { z } from 'zod';

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

export const ProyectoDisenoSchema = z.object({
  nombre:           z.string().min(1, 'Nombre requerido'),
  marca:            z.string().min(1, 'Marca requerida'),
  estado:           z.enum(['inspiracion','en_desarrollo','muestra_lista','ajustes','produccion','descontinuado']).optional(),
  inspiracion:      z.string().optional(),
  moodboard:        z.array(z.string()).optional(),
  molderia:         z.string().optional(),
  tela:             z.string().optional(),
  costo:            z.number().optional(),
  precioEstimado:   z.number().optional(),
  estadoProduccion: z.string().optional(),
  cantidad:         z.number().int().optional(),
});

export type ProyectoDisenoInput = z.infer<typeof ProyectoDisenoSchema>;
