import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { cantidadCortada, ingresadasPorOrden } from '@/lib/produccion/cantidades';

export const dynamic = 'force-dynamic';

interface Breakdown {
  minutos: number;
  registros: number;
}
interface BreakdownCosturera extends Breakdown {
  prendas: number;
}

export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'produccion'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  try {
    const ordenes = await prisma.ordenProduccion.findMany({
      where: { estado: 'CERRADA' },
      orderBy: { terminadoAt: 'desc' },
    });

    // Las unidades del reporte son las que REALMENTE entraron: `cantidad` es lo
    // planificado y dividir minutos por ahí infla o desinfla el min/prenda.
    const ingresadas = await ingresadasPorOrden(prisma, ordenes.map((o) => o.id));

    const skus = [...new Set(ordenes.map((o) => o.sku).filter((s): s is string => !!s))];
    const tiempos = await prisma.tiemposProduccion.findMany({
      where: { sku: { in: skus } },
    });

    const tiemposBySku = new Map<string, typeof tiempos>();
    for (const t of tiempos) {
      if (!t.sku) continue;
      const arr = tiemposBySku.get(t.sku) ?? [];
      arr.push(t);
      tiemposBySku.set(t.sku, arr);
    }

    const result = ordenes.map((orden) => {
      const ts = (orden.sku ? tiemposBySku.get(orden.sku) : undefined) ?? [];
      const totalMinutos = ts.reduce((s, t) => s + t.minutosNetos, 0);

      const porMaquina:   Record<string, Breakdown> = {};
      const porCosturera: Record<string, BreakdownCosturera> = {};
      const porActividad: Record<string, Breakdown> = {};

      for (const t of ts) {
        if (t.maquina) {
          porMaquina[t.maquina] ??= { minutos: 0, registros: 0 };
          porMaquina[t.maquina].minutos += t.minutosNetos;
          porMaquina[t.maquina].registros += 1;
        }
        porCosturera[t.usuario] ??= { minutos: 0, registros: 0, prendas: 0 };
        porCosturera[t.usuario].minutos   += t.minutosNetos;
        porCosturera[t.usuario].registros += 1;
        // "prendas" = la tanda que trabajó, NO la suma de procesos: la misma tanda
        // de 38 pasa por N procesos y sumar daría 38×N. Tomamos el máximo (la tanda).
        porCosturera[t.usuario].prendas = Math.max(porCosturera[t.usuario].prendas, t.cantidad);

        porActividad[t.actividad] ??= { minutos: 0, registros: 0 };
        porActividad[t.actividad].minutos   += t.minutosNetos;
        porActividad[t.actividad].registros += 1;
      }

      const unidades = ingresadas.get(orden.id) || cantidadCortada(orden);

      return {
        id: orden.id,
        sku: orden.sku,
        descripcion: orden.descripcion,
        marca: orden.marca,
        cantidad: unidades,
        terminadoAt: orden.terminadoAt,
        creadoPor: orden.creadoPor,
        totalMinutos,
        minutosPorPrenda: unidades > 0 ? totalMinutos / unidades : 0,
        registros: ts.length,
        porMaquina,
        porCosturera,
        porActividad,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[reportes/sku GET]', err);
    return NextResponse.json({ error: 'Error generando reporte' }, { status: 500 });
  }
}
