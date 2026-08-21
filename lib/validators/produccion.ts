import { z } from 'zod';
import { MARCAS } from '@/lib/marcas';

export const ESTADOS_OP = [
  'PENDIENTE', 'CORTE', 'COSTURA', 'TERMINADO_SIN_ESTAMPA',
  'ESTAMPA', 'CONTROL_CALIDAD', 'CERRADA',
] as const;

// Flujo de PRODUCCIÓN: Pendiente → (Corte) → Costura → "Listo" (TERMINADO_SIN_ESTAMPA) → Cerrada.
// "Listo" se puede cerrar (archiva) o reabrir a costura. La estampa se terceriza: ESTAMPA /
// CONTROL_CALIDAD quedan en el enum pero fuera del flujo activo.
export const ESTADO_SIGUIENTE: Record<string, string[]> = {
  PENDIENTE:             ['CORTE', 'COSTURA'],     // se puede saltar a costura si el corte ya está listo
  CORTE:                 ['COSTURA', 'PENDIENTE'],
  COSTURA:               ['TERMINADO_SIN_ESTAMPA', 'CORTE'],
  TERMINADO_SIN_ESTAMPA: ['CERRADA', 'COSTURA'],   // "Listo" → cerrar (archivar) o reabrir a costura
  ESTAMPA:               ['CONTROL_CALIDAD', 'TERMINADO_SIN_ESTAMPA'],
  CONTROL_CALIDAD:       ['CERRADA', 'ESTAMPA'],
  CERRADA:               [],
};

export const TALLES_DEFAULT = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'UNICO'] as const;
// Talles que se muestran SIEMPRE por defecto en las grillas (S/M/L/XL + Único);
// el resto (XS, XXL) se agrega bajo demanda con "+ talle".
export const TALLES_COMUNES = ['S', 'M', 'L', 'XL', 'UNICO'] as const;

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
  // origen: para etiquetar el movimiento. 'inicial' = artículo nuevo o de producción
  // vieja que no entró por el sistema.
  origen:   z.enum(['ajuste', 'inicial', 'merma', 'venta']).default('ajuste'),
  motivo:   z.string().optional(),
});

// Consumo de tela para una muestra (retiro chico de un rollo, opcionalmente ligado a un proyecto).
// La marca es obligatoria: es lo que hace que el gasto de desarrollo caiga en Zattia o Stunned.
export const MuestraSchema = z.object({
  rolloId:     z.string().min(1, 'Elegí un rollo'),
  cantidad:    z.number().positive('La cantidad debe ser positiva'),
  marca:       z.enum(MARCAS, 'Elegí la marca'),
  proyectoId:  z.string().optional(),
  descripcion: z.string().optional(),
  // Reintento explícito después del aviso de posible duplicado. El servidor
  // avisa, no bloquea: con este flag el mismo retiro pasa igual.
  confirmarDuplicado: z.boolean().optional(),
});

// Edición de un retiro ya cargado. El ROLLO no se puede cambiar: mover un retiro
// de un rollo a otro no es una edición, son dos operaciones (eliminar y cargar).
// `undefined` = no tocar el campo; `null` o vacío = limpiarlo.
export const MuestraPatchSchema = z.object({
  cantidad:    z.number().positive('La cantidad debe ser positiva').optional(),
  marca:       z.enum(MARCAS, 'Elegí la marca').optional(),
  proyectoId:  z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
}).refine((d) => Object.values(d).some((v) => v !== undefined), 'No hay nada para cambiar');

// Registrar corte: unifica ficha + consumo de tela + desglose por talle
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
  cortesPorTalle: z.array(TalleSchema).min(1, 'Debe cargar al menos un talle'),
  avios:          z.array(AvioCorteSchema).optional(),
  cortadorId:     z.string().optional(),
  costoCorte:     z.number().min(0).optional(),
  // Metros de tela mandados a sublimar (suma de las tizadas que se subliman). El $/m lo
  // pone el server desde ConfigCostos: acá solo viajan los metros.
  metrosSublimados: z.number().min(0).optional(),
  fichaFotoUrl:   z.string().optional(),
  notas:          z.string().optional(),
  fichaData:      z.any().optional(), // estado del form (tizadas/talles/avíos/…) para ver-editar idéntico
  fechaCorte:     z.string().optional(), // YYYY-MM-DD, fecha en que se cortó
});

// Corte por lote: una receta/avíos/cortador compartidos + rollos y talles por color.
// Cada color se registra como una ficha individual (reusa RegistrarCorteSchema por OP).
export const CortarLoteSchema = z.object({
  colores: z.array(z.object({
    ordenId:        z.string().min(1),
    consumoRollos:  z.array(ConsumoRolloSchema).min(1),
    cortesPorTalle: z.array(TalleSchema).min(1),
  })).min(1, 'Cargá al menos un color con rollos y talles'),
  avios:      z.array(AvioCorteSchema).optional(),
  cortadorId: z.string().optional(),
  costoCorte: z.number().min(0).optional(),         // total o por unidad según modoCosto
  modoCosto:  z.enum(['total', 'unidad']).default('total'),
  notas:      z.string().optional(),
});

// Terminar costura por lote: conteo por talle de cada color (OP). Parcial permitido
// (los colores que no se mandan quedan en COSTURA). Cada color reusa el terminar por OP.
export const TerminarLoteSchema = z.object({
  colores: z.array(z.object({
    ordenId: z.string().min(1),
    talles:  z.array(z.object({
      talle:    z.string().min(1),
      cantidad: z.number().int().nonnegative(),
    })).min(1),
  })).min(1, 'Cargá al menos un color con su conteo'),
});

// Cambio de estado por lote (avanzar todos los colores elegibles): mandar a costura o cerrar.
export const CambioEstadoLoteSchema = z.object({
  estado: z.enum(['COSTURA', 'CERRADA']),
  notas:  z.string().optional(),
});

export const CortadorSchema = z.object({
  nombre:        z.string().min(1, 'Nombre obligatorio'),
  contacto:      z.string().optional(),
  notas:         z.string().optional(),
  activo:        z.boolean().optional(),
  usuarioId:     z.string().nullable().optional(), // usuario de login del cortador (panel)
  predeterminado: z.boolean().optional(),          // se asigna solo a cada OP nueva; hay uno solo
  // Tarifa de corte pactada. No cobra sola: prellena el precio de la carga interna de
  // tizada (CargaTizadaBtn), que siempre queda editable a mano.
  tarifaDefault: z.number().min(0).nullable().optional(),
  tarifaModo:    z.enum(['total', 'unidad']).nullable().optional(),
});

export const MotivoDescarteSchema = z.object({
  nombre:    z.string().min(1, 'Nombre obligatorio'),
  categoria: z.enum(['proveedor', 'corte', 'costura', 'estampa', 'otro']),
  activo:    z.boolean().optional(),
});

// Un pago de corte tiene UNA sola forma: cortador + monto. Los cortes y muestras que
// vengan son TRAZABILIDAD —qué cubrió ese pago— y no cambian ningún número: en la cuenta
// corriente la deuda son todos los cortes y el haber son todos los pagos.
// Antes había dos formas y la imputada DERIVABA el monto de los ítems: por ahí entraba la
// misma plata dos veces (el adelanto ya cargado, más el pago que inventaba la imputación).
export const PagoCorteSchema = z.object({
  fecha:          z.string().min(1, 'Fecha obligatoria'),
  beneficiario:   z.string().min(1, 'Beneficiario obligatorio'),
  ordenIds:       z.array(z.string().min(1)).default([]),
  muestraIds:     z.array(z.string().min(1)).default([]),
  cortadorId:     z.string({ error: 'Decí a qué cortador se le paga' }).min(1, 'Decí a qué cortador se le paga'),
  monto:          z.coerce.number({ error: 'Poné el monto del pago' }).positive('El monto tiene que ser mayor a 0'),
  notas:          z.string().optional(),
  comprobanteUrl: z.string().optional(),
});
