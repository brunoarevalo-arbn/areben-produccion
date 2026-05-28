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

export const TALLES_DEFAULT = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'UNICO'] as const;

export const CambioEstadoSchema = z.object({
  estado: z.enum(ESTADOS_OP),
  notas:  z.string().optional(),
});

// Registrar corte: unifica ficha + consumo de tela + desglose por talle
const ConsumoLoteSchema = z.object({
  loteId:   z.string().min(1),
  cantidad: z.number().positive(),
});

const ConsumoRolloSchema = z.object({
  rolloId:      z.string().min(1),
  metrosUsados: z.number().positive(),
});

const TalleSchema = z.object({
  talle:    z.string().min(1),
  cantidad: z.number().int().positive(),
});

export const RegistrarCorteSchema = z.object({
  consumoRollos:  z.array(ConsumoRolloSchema).min(1, 'Debe asignar al menos un rollo'),
  consumoLotes:   z.array(ConsumoLoteSchema).optional(),
  cortesPorTalle: z.array(TalleSchema).min(1, 'Debe cargar al menos un talle'),
  fichaFotoUrl:   z.string().optional(),
  notas:          z.string().optional(),
});
