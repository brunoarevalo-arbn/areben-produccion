import { prisma } from '@/lib/prisma';
import { estadoDeLotes } from '@/lib/produccion/lotesPlanificados';
import { tallesCortados } from '@/lib/produccion/cantidades';
import { DESPUES_DE_LOTE_1, ordenarTalles } from '@/lib/constants/lotes';

export interface DatosEtiquetaLote {
  ordenId: string;
  marca: string;
  sku: string | null;
  descripcion: string | null;
  geometral: string | null;
  numero: number;
  total: number;
  talles: { talle: string; cantidad: number }[];
  unidades: number;
  despuesDe: string | null;
  fecha: Date;
}

// Lo que va en la etiqueta de la bolsa de un lote. Una orden sin separar tiene una sola:
// "Lote 1 de 1", con todo el corte. `null` si la orden o el lote no existen.
export async function datosEtiquetaLote(id: string, numero: number): Promise<DatosEtiquetaLote | null> {
  if (!Number.isInteger(numero) || numero < 1) return null;
  const orden = await prisma.ordenProduccion.findUnique({ where: { id }, include: { cortesPorTalle: true, lote: { select: { geometralUrl: true } } } });
  if (!orden) return null;

  const lotes = await estadoDeLotes(prisma, orden);
  let talles: { talle: string; cantidad: number }[];
  let despuesDe: string | null = null;
  let fecha: Date;
  if (lotes.length > 0) {
    const lote = lotes.find((l) => l.numero === numero);
    if (!lote) return null;
    talles = lote.talles;
    despuesDe = lote.despuesDe === DESPUES_DE_LOTE_1 ? null : lote.despuesDe;
    fecha = lote.separadoAt;
  } else {
    if (numero !== 1) return null;
    talles = ordenarTalles(tallesCortados(orden) ?? []);
    fecha = orden.fechaCorte ?? orden.createdAt;
  }

  return {
    ordenId: orden.id,
    marca: orden.marca,
    sku: orden.sku,
    descripcion: orden.descripcion,
    geometral: orden.geometralUrl ?? orden.lote?.geometralUrl ?? null,
    numero,
    total: Math.max(lotes.length, 1),
    talles,
    unidades: talles.reduce((s, t) => s + t.cantidad, 0),
    despuesDe,
    fecha,
  };
}
