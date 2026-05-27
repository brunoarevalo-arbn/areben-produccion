import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface Breakdown {
  minutos: number;
  registros: number;
}
interface BreakdownCosturera extends Breakdown {
  prendas: number;
}

export async function GET() {
  try {
    const ordenes = await prisma.ordenProduccion.findMany({
      where: { estado: 'CERRADA' },
      orderBy: { terminadoAt: 'desc' },
    });

    const skus = [...new Set(ordenes.map((o) => o.sku))];
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
      const ts = tiemposBySku.get(orden.sku) ?? [];
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
        porCosturera[t.usuario].prendas   += t.cantidad;

        porActividad[t.actividad] ??= { minutos: 0, registros: 0 };
        porActividad[t.actividad].minutos   += t.minutosNetos;
        porActividad[t.actividad].registros += 1;
      }

      return {
        id: orden.id,
        sku: orden.sku,
        descripcion: orden.descripcion,
        marca: orden.marca,
        cantidad: orden.cantidad,
        terminadoAt: orden.terminadoAt,
        creadoPor: orden.creadoPor,
        totalMinutos,
        minutosPorPrenda: orden.cantidad > 0 ? totalMinutos / orden.cantidad : 0,
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
