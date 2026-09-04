// lib/validators/tiempos.ts

import { z } from 'zod';

export const TiempoSchema = z.object({
  usuario: z.string().min(1, 'Usuario requerido'),
  actividad: z.string().min(1, 'Actividad requerida'),
  detalle: z.string().max(200).optional(),
  fecha: z.string(),
  marca: z.string().optional(),
  maquina: z.string().optional(),
  sku: z.string().optional(),
  cantidad: z.number().default(0),
  defectos: z.number().default(0),
  horaInicio: z.string().optional(),
  horaFin: z.string().optional(),
  minutosNetos: z.number().default(0),
  estado: z.string().default('pendiente'),
  inconveniente:      z.string().optional(),
  inconvenienteNotas: z.string().optional(),
});

export type TiempoInput = z.infer<typeof TiempoSchema>;