import { z } from 'zod';

// ─── Proveedor ──────────────────────────────────────────────────────

export const ProveedorSchema = z.object({
  nombre:       z.string().min(1, 'Nombre obligatorio'),
  cuit:         z.string().optional(),
  condicionIva: z.string().optional(),
  contacto:     z.string().optional(),
  notas:        z.string().optional(),
  activo:       z.boolean().optional(),
});

// ─── Insumo (catálogo) ─────────────────────────────────────────────

export const InsumoCatalogoSchema = z.object({
  nombre:           z.string().min(1, 'Nombre obligatorio'),
  nombreInterno:    z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().nullable().optional()),
  categoria:        z.enum(['tela', 'vinilo', 'etiqueta', 'badana', 'hilo', 'aviso', 'packaging', 'otro']),
  tipoTrazabilidad: z.enum(['rollo', 'lote']),
  unidadDefault:    z.enum(['kg', 'metro', 'unidad']),
  stockMinimo:      z.number().min(0).optional(),
  manejaColor:      z.boolean().optional(),
  rinde:            z.number().positive().optional(),
  activo:           z.boolean().optional(),
});

// ─── Compra ─────────────────────────────────────────────────────────

const CompraRolloSchema = z.object({
  pesoInicial: z.number().positive('Peso debe ser positivo'),
  ubicacion:   z.string().optional(),
});

const CompraLineaSchema = z.object({
  insumoId:       z.string().min(1),
  colorId:        z.string().optional(),
  colorProveedor: z.string().optional(),
  cantidad:       z.number().positive('Cantidad debe ser positiva'),
  unidad:         z.enum(['kg', 'metro', 'unidad']),
  precioUnitario: z.number().min(0, 'Precio no puede ser negativo'),
  rollos:         z.array(CompraRolloSchema).optional(),
});

export const CompraSchema = z.object({
  proveedorId:   z.string().min(1, 'Proveedor obligatorio'),
  fecha:         z.string().min(1, 'Fecha obligatoria'),
  numeroFactura: z.string().optional(),
  conIva:        z.boolean().default(true),
  totalBruto:    z.number().positive('Total debe ser positivo'),
  costoEnvio:    z.number().min(0).default(0),
  fleteModo:     z.enum(['monto', 'porcentaje']).default('monto'),
  fletePorcentaje: z.number().min(0).optional(),
  formaPago:     z.string().optional(),
  estadoPago:    z.enum(['PENDIENTE', 'PARCIAL', 'PAGADA']).default('PENDIENTE'),
  montoPagado:   z.number().min(0).default(0),
  fechaPago:     z.string().optional(),
  notas:         z.string().optional(),
  lineas:        z.array(CompraLineaSchema).min(1, 'Debe tener al menos una línea'),
});

// ─── Pago ───────────────────────────────────────────────────────────

export const PagoSchema = z.object({
  estadoPago:  z.enum(['PENDIENTE', 'PARCIAL', 'PAGADA']),
  montoPagado: z.number().min(0),
  fechaPago:   z.string().optional(),
});

// ─── Gasto (registro contable / compra sin stock) ───────────────────
// Si trae proveedorId es una "compra a proveedor" (aparece en el módulo Compras).
// Sin proveedorId es un gasto interno/automático (solo en el reporte de Gastos).
export const GastoSchema = z.object({
  categoria:     z.enum(['desarrollo', 'produccion']),
  tipo:          z.enum(['tela', 'insumos', 'periodo']),
  marca:         z.string().nullish(),
  sku:           z.string().nullish(),
  ordenId:       z.string().nullish(),
  minutos:       z.number().int().nullish(),
  monto:         z.number().min(0),
  concepto:      z.string().nullish(),
  fecha:         z.string().min(1, 'Fecha obligatoria'),
  tiempoId:      z.string().nullish(),
  // Compra a proveedor (opcionales)
  proveedorId:   z.string().nullish(),
  numeroFactura: z.string().nullish(),
  formaPago:     z.string().nullish(),
  estadoPago:    z.enum(['PENDIENTE', 'PARCIAL', 'PAGADA']).nullish(),
  montoPagado:   z.number().min(0).nullish(),
  fechaPago:     z.string().nullish(),
});

// ─── Ajuste físico ──────────────────────────────────────────────────

export const AjusteSchema = z.object({
  tipo:             z.enum(['rollo', 'lote']),
  targetId:         z.string().min(1, 'ID obligatorio'),
  cantidad:         z.number().refine((n) => n !== 0, 'Cantidad no puede ser 0'),
  motivo:           z.string().min(1, 'Motivo obligatorio'),
  motivoDescarteId: z.string().optional(),
});
