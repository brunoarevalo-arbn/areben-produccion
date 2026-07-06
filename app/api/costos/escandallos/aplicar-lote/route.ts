import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { parseDatos } from '@/lib/costos/escandallo';
import { telaUnit, corteUnit } from '@/lib/costos/fichaCostos';
import { aplicarDescuentoAviosDesdeEscandallo } from '@/lib/costos/aviosStock';
import { z } from 'zod';

const Schema = z.object({ escandalloId: z.string().min(1) });

// Aplica la parte COMÚN de un escandallo a los demás colores del mismo lote: mismo
// molde/receta/servicios/MO/avíos/márgenes, y a cada color su propia tela+corte (de su
// ficha). Actualiza los que ya tienen escandallo y crea los que faltan.
export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'costos');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'escandalloId requerido' }, { status: 400 });

  const fuente = await prisma.escandallo.findUnique({ where: { id: parsed.data.escandalloId } });
  if (!fuente || !fuente.sku) return NextResponse.json({ error: 'Escandallo sin SKU' }, { status: 400 });

  // Lote del SKU fuente.
  const opFuente = await prisma.ordenProduccion.findFirst({
    where: { sku: { equals: fuente.sku, mode: 'insensitive' }, loteId: { not: null } },
    select: { loteId: true },
  });
  const loteId = opFuente?.loteId;
  if (!loteId) return NextResponse.json({ error: 'El SKU no está en un lote' }, { status: 400 });

  // OPs del lote → costos de ficha por SKU hermano (≠ fuente).
  const loteOps = await prisma.ordenProduccion.findMany({
    where: { loteId, sku: { not: null } },
    select: { sku: true, marca: true, descripcion: true, fichaCorteCargada: true, costoTela: true, costoInsumosSecundarios: true, costoCorte: true, cantidad: true },
    orderBy: { createdAt: 'desc' },
  });

  // Por SKU hermano, quedarse con la OP que tiene ficha cargada (o la primera).
  type Herm = { sku: string; marca: string; descripcion: string | null; tela: number | null; corte: number | null; ficha: boolean };
  const hermanos = new Map<string, Herm>();
  for (const op of loteOps) {
    const sku = op.sku!;
    if (sku.toLowerCase() === fuente.sku!.toLowerCase()) continue;
    const prev = hermanos.get(sku);
    if (!prev || (!prev.ficha && op.fichaCorteCargada)) {
      hermanos.set(sku, { sku, marca: op.marca, descripcion: op.descripcion, tela: telaUnit(op), corte: corteUnit(op), ficha: op.fichaCorteCargada });
    }
  }
  if (hermanos.size === 0) return NextResponse.json({ error: 'El lote no tiene otros colores' }, { status: 400 });

  const baseDatos = parseDatos(fuente.datos);
  const existentes = await prisma.escandallo.findMany({ where: { sku: { in: [...hermanos.keys()] } }, select: { id: true, sku: true } });
  const existentePorSku = new Map(existentes.map((e) => [e.sku!, e.id]));

  let creados = 0, actualizados = 0;
  for (const h of hermanos.values()) {
    const datos = {
      ...baseDatos,
      costoTelaFicha:  h.tela ?? undefined,
      costoCorteFicha: h.corte ?? undefined,
      costoCorte:      h.corte ?? baseDatos.costoCorte,
    };
    const datosStr = JSON.stringify(datos);
    const id = existentePorSku.get(h.sku);
    if (id) {
      await prisma.escandallo.update({ where: { id }, data: { datos: datosStr, marca: fuente.marca, tipoPrenda: fuente.tipoPrenda } });
      actualizados++;
    } else {
      await prisma.escandallo.create({ data: { nombre: h.descripcion || h.sku, sku: h.sku, marca: fuente.marca, tipoPrenda: fuente.tipoPrenda, datos: datosStr } });
      creados++;
    }
    try { await aplicarDescuentoAviosDesdeEscandallo(h.sku, datos); } catch { /* no romper */ }
  }

  return NextResponse.json({ creados, actualizados });
}
