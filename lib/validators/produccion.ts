import { z } from 'zod';

export const ESTADOS_OP = [
  'PENDIENTE', 'CORTE', 'COSTURA', 'TERMINADO_SIN_ESTAMPA',
  'ESTAMPA', 'CONTROL_CALIDAD', 'CERRADA',
] as const;

export const ESTADO_SIGUIENTE: Record<string, string[]> = {
  PENDIENTE:             ['CORTE'],
  CORTE:                 ['COSTURA', 'PENDIENTE'],
  COSTURA:               ['TERMINADO_SIN_ESTAMPA', 'CORTE'],
  TERMINADO_SIN_ESTAMPA: ['ESTAMPA', 'CONTROL_CALIDAD', 'COSTURA'],
  ESTAMPA:               ['CONTROL_CALIDAD', 'TERMINADO_SIN_ESTAMPA'],
  CONTROL_CALIDAD:       ['CERRADA', 'ESTAMPA'],
  CERRADA:               [],
};

export const CambioEstadoSchema = z.object({
  estado: z.enum(ESTADOS_OP),
  notas:  z.string().optional(),
});

const ConsumoRolloSchema = z.object({
  rolloId:  z.string().min(1),
  cantidad: z.number().positive(),
});

const ConsumoLoteSchema = z.object({
  loteId:   z.string().min(1),
  cantidad: z.number().positive(),
});

export const FichaCorteSchema = z.object({
  consumoTela:    z.array(ConsumoRolloSchema).min(1, 'Debe asignar al menos un rollo'),
  consumoLotes:   z.array(ConsumoLoteSchema).optional(),
  fichaFotoUrl:   z.string().optional(),
  notas:          z.string().optional(),
});
