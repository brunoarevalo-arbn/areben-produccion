import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySession(token))) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const sku = req.nextUrl.searchParams.get('sku')?.trim();
  if (!sku) return NextResponse.json({ error: 'SKU requerido' }, { status: 400 });

  const registros = await prisma.tiemposProduccion.findMany({
    where: {
      sku:          { equals: sku, mode: 'insensitive' },
      cantidad:     { gt: 0 },
      minutosNetos: { gt: 0 },
    },
    select: { minutosNetos: true, cantidad: true },
  });

  // OPs del SKU (para el lote y la cantidad producida). Se busca SIEMPRE, aunque el
  // SKU no tenga tiempos propios: si está en un lote con tiempos de otros colores,
  // igual devolvemos el promedio del lote.
  const ops = await prisma.ordenProduccion.findMany({
    where:  { sku: { equals: sku, mode: 'insensitive' }, cantidad: { gt: 0 } },
    select: { cantidad: true, loteId: true },
  });

  // Individual del SKU (solo si tiene tiempos propios).
  let minutosPromedio = 0;
  let cantidadProducida = 0;
  if (registros.length > 0) {
    const minutosTotales = registros.reduce((s, r) => s + r.minutosNetos, 0);
    cantidadProducida = ops.reduce((s, o) => s + o.cantidad, 0);
    if (cantidadProducida === 0) cantidadProducida = Math.max(...registros.map((r) => r.cantidad));
    minutosPromedio = cantidadProducida > 0 ? minutosTotales / cantidadProducida : 0;
  }

  // Tiempo unificado del lote: si el SKU pertenece a un lote con ≥2 colores, el
  // min/prenda ponderado = Σ minutos de todos los SKUs del lote ÷ Σ unidades del lote.
  let lote: { minutosPromedio: number; cantidadTotal: number; colores: number; registros: number } | undefined;
  const loteId = ops.find((o) => o.loteId)?.loteId ?? null;
  if (loteId) {
    const loteOps = await prisma.ordenProduccion.findMany({
      where: { loteId, cantidad: { gt: 0 } },
      select: { sku: true, cantidad: true },
    });
    const loteSkus = [...new Set(loteOps.map((o) => o.sku).filter(Boolean))] as string[];
    if (loteSkus.length >= 2) {
      const regsLote = await prisma.tiemposProduccion.findMany({
        where: { sku: { in: loteSkus }, cantidad: { gt: 0 }, minutosNetos: { gt: 0 } },
        select: { sku: true, minutosNetos: true },
      });
      if (regsLote.length > 0) {
        // El promedio se divide por las prendas CRONOMETRADAS (los colores que sí
        // tienen tiempos), no por todo el lote — si no, los colores sin cronometrar
        // diluyen el promedio hacia abajo.
        const skusConTiempo = new Set(regsLote.map((r) => r.sku).filter(Boolean));
        const cantidadCronometrada = loteOps.filter((o) => o.sku && skusConTiempo.has(o.sku)).reduce((s, o) => s + o.cantidad, 0);
        const minLote = regsLote.reduce((s, r) => s + r.minutosNetos, 0);
        if (cantidadCronometrada > 0) {
          lote = {
            minutosPromedio: Math.round((minLote / cantidadCronometrada) * 10) / 10,
            cantidadTotal:   cantidadCronometrada,
            colores:         skusConTiempo.size,
            registros:       regsLote.length,
          };
        }
      }
    }
  }

  // Sin tiempos propios NI de lote → no hay dato.
  if (registros.length === 0 && !lote) return NextResponse.json({ encontrado: false });

  return NextResponse.json({
    encontrado:      true,
    minutosPromedio: Math.round(minutosPromedio * 10) / 10, // 0 si el SKU no tiene tiempos propios
    cantidadTotal:   cantidadProducida,
    registros:       registros.length,
    lote,
  });
}
