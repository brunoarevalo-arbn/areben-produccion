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

// Ficha de corte: declara insumo de tela + insumos secundarios
const ConsumoLoteSchema = z.object({
  loteId:   z.string().min(1),
  cantidad: z.number().positive(),
});

export const FichaCorteSchema = z.object({
  insumoTelaId:   z.string().min(1, 'Insumo de tela obligatorio'),
  consumoLotes:   z.array(ConsumoLoteSchema).optional(),
  fichaFotoUrl:   z.string().optional(),
  notas:          z.string().optional(),
});

// Consumo de tela (paso separado, durante CORTE)
const ConsumoRolloSchema = z.object({
  rolloId:        z.string().min(1),
  metrosUsados:   z.number().positive(),
});

export const ConsumoTelaSchema = z.object({
  consumoRollos:  z.array(ConsumoRolloSchema).min(1, 'Debe asignar al menos un rollo'),
  notas:          z.string().optional(),
});
