import { z } from 'zod';
import { PROCESOS_DE_FALLA } from '@/lib/constants/lotes';

// Una falla: piezas perdidas en un proceso (lib/produccion/lotesPlanificados.ts). La usan
// Órdenes / la OP y la tablet: el mismo pedido por los dos lados.
// ⚠️ Archivo aparte a propósito: `constants/lotes` importa de `validators/produccion`, y
// ponerla ahí armaba un import circular que deja `PROCESOS_DE_FALLA` sin definir al cargar.
export const FallaSchema = z.object({
  numero:   z.number().int().min(1).nullable(),
  parte:    z.string().min(1).max(40).nullable(),
  talle:    z.string().min(1).max(10),
  cantidad: z.number().int().positive('La cantidad tiene que ser mayor a 0'),
  proceso:  z.enum(PROCESOS_DE_FALLA),
  motivo:   z.string().max(200).nullable().optional(),
});
