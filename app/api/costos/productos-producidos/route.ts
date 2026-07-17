import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { telaUnit, corteUnit, sublimacionUnit } from '@/lib/costos/fichaCostos';

// SKUs que ya se produjeron (tienen OP), con el costo de tela por unidad sacado
// de la ficha de corte, y si ya tienen escandallo (para listar pendientes).
export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'costos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const ops = await prisma.ordenProduccion.findMany({
    where:  { sku: { not: null } },
    select: {
      sku: true, marca: true, descripcion: true, fichaCorteCargada: true,
      costoTela: true, costoInsumosSecundarios: true, costoCorte: true, costoSublimacion: true, cantidad: true, loteId: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const escandallos = await prisma.escandallo.findMany({ where: { sku: { not: null } }, select: { sku: true } });
  const conEscandallo = new Set(escandallos.map((e) => e.sku));

  const descartados = await prisma.costoSkuDescartado.findMany({ select: { sku: true } });
  const descartadoSet = new Set(descartados.map((d) => d.sku));

  const bySku = new Map<string, {
    sku: string; marca: string; descripcion: string | null;
    costoTelaUnit: number | null; costoCorteUnit: number | null; costoSublimacionUnit: number | null;
    loteId: string | null;
    tieneFicha: boolean; tieneEscandallo: boolean; descartado: boolean;
  }>();

  for (const op of ops) {
    const sku = op.sku!;
    if (!bySku.has(sku)) {
      bySku.set(sku, {
        sku, marca: op.marca, descripcion: op.descripcion,
        costoTelaUnit: telaUnit(op), costoCorteUnit: corteUnit(op), costoSublimacionUnit: sublimacionUnit(op),
        loteId: op.loteId,
        tieneFicha: op.fichaCorteCargada,
        tieneEscandallo: conEscandallo.has(sku),
        descartado: descartadoSet.has(sku),
      });
    } else {
      const e = bySku.get(sku)!;
      if (!e.loteId && op.loteId) e.loteId = op.loteId;
      if (!e.tieneFicha && op.fichaCorteCargada) {
        e.costoTelaUnit = telaUnit(op); e.costoCorteUnit = corteUnit(op); e.costoSublimacionUnit = sublimacionUnit(op);
        e.tieneFicha = true;
      }
    }
  }

  return NextResponse.json([...bySku.values()]);
}
