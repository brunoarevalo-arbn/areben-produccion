import { z } from 'zod';

export const ESTADOS_OP = [
  'PENDIENTE', 'CORTE', 'COSTURA', 'TERMINADO_SIN_ESTAMPA',
  'ESTAMPA', 'CONTROL_CALIDAD', 'CERRADA',
] as const;

// Flujo de PRODUCCIÓN (corte + costura). Termina en TERMINADO_SIN_ESTAMPA ("liso terminado").
// ESTAMPA / CONTROL_CALIDAD / CERRADA quedan reservados para el módulo de Estampa (Fase 2).
export const ESTADO_SIGUIENTE: Record<string, string[]> = {
  PENDIENTE:             ['CORTE', 'COSTURA'],     // se puede saltar a costura si el corte ya está listo
  CORTE:                 ['COSTURA', 'PENDIENTE'],
  COSTURA:               ['TERMINADO_SIN_ESTAMPA', 'CORTE'],
  TERMINADO_SIN_ESTAMPA: ['COSTURA'],              // fin de producción (se puede reabrir a costura)
  ESTAMPA:               ['CONTROL_CALIDAD', 'TERMINADO_SIN_ESTAMPA'],
  CONTROL_CALIDAD:       ['CERRADA', 'ESTAMPA'],
  CERRADA:               [],
};

export const TALLES_DEFAULT = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'UNICO'] as const;

export const CambioEstadoSchema = z.object({
  estado: z.enum(ESTADOS_OP),
  notas:  z.string().optional(),
});

// Terminar costura: conteo de lo que salió por talle → ingresa al stock de terminados.
export const TerminarCosturaSchema = z.object({
  talles: z.array(z.object({
    talle:    z.string().min(1),
    cantidad: z.number().int().nonnegative(),
  })).min(1, 'Cargá al menos un talle'),
});

// Ajuste manual de stock de producto terminado (carga inicial, merma, corrección).
export const AjusteTerminadoSchema = z.object({
  sku:      z.string().min(1, 'SKU requerido').transform((s) => s.trim().toUpperCase()),
  talle:    z.string().min(1, 'Talle requerido'),
  tipo:     z.enum(['liso', 'estampado']).default('liso'),
  cantidad: z.number().int().refine((n) => n !== 0, 'La cantidad no puede ser 0'),
  motivo:   z.string().optional(),
});

// Consumo de tela para una muestra (retiro chico de un rollo, opcionalmente ligado a un proyecto).
export const MuestraSchema = z.object({
  rolloId:     z.string().min(1, 'Elegí un rollo'),
  cantidad:    z.number().positive('La cantidad debe ser positiva'),
  proyectoId:  z.string().optional(),
  descripcion: z.string().optional(),
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

// Avíos del catálogo que lleva la prenda (cantidad POR PRENDA). Se descuentan al terminar.
const AvioCorteSchema = z.object({
  etiquetaId: z.string().min(1),
  cantidad:   z.number().int().positive(),
});

export const RegistrarCorteSchema = z.object({
  consumoRollos:  z.array(ConsumoRolloSchema).min(1, 'Debe asignar al menos un rollo'),
  consumoLotes:   z.array(ConsumoLoteSchema).optional(),
  cortesPorTalle: z.array(TalleSchema).min(1, 'Debe cargar al menos un talle'),
  avios:          z.array(AvioCorteSchema).optional(),
  cortadorId:     z.string().optional(),
  costoCorte:     z.number().min(0).optional(),
  fichaFotoUrl:   z.string().optional(),
  notas:          z.string().optional(),
});

export const CortadorSchema = z.object({
  nombre:        z.string().min(1, 'Nombre obligatorio'),
  contacto:      z.string().optional(),
  tarifaDefault: z.number().min(0).optional(),
  tarifaModo:    z.enum(['total', 'unidad']).optional(),
  notas:         z.string().optional(),
  activo:        z.boolean().optional(),
});

export const MotivoDescarteSchema = z.object({
  nombre:    z.string().min(1, 'Nombre obligatorio'),
  categoria: z.enum(['proveedor', 'corte', 'costura', 'estampa', 'otro']),
  activo:    z.boolean().optional(),
});

export const PagoCorteSchema = z.object({
  fecha:          z.string().min(1, 'Fecha obligatoria'),
  beneficiario:   z.string().min(1, 'Beneficiario obligatorio'),
  ordenIds:       z.array(z.string().min(1)).min(1, 'Selecciona al menos una OP'),
  notas:          z.string().optional(),
  comprobanteUrl: z.string().optional(),
});
