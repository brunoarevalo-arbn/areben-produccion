import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'produccion'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const fecha   = searchParams.get('fecha') ?? new Date().toISOString().split('T')[0];
    const usuario = searchParams.get('usuario') ?? undefined;

    const registros = await prisma.tiemposProduccion.findMany({
      where: { fecha, ...(usuario ? { usuario } : {}) },
      // Orden cronológico por hora de inicio (los que no tienen hora caen al final);
      // createdAt como desempate. Así un alta manual se ubica según su horario, no al final.
      orderBy: [{ horaInicio: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
    });

    const porCosturera: Record<string, { minutos: number; registros: number }> = {};
    const porActividad: Record<string, { minutos: number; registros: number }> = {};
    const porMaquina:   Record<string, { minutos: number; registros: number }> = {};
    const porInconveniente:     Record<string, { registros: number; minutos: number }>  = {};
    const inconvenientesPorSku: Record<string, { registros: number; minutos: number; categorias: Record<string, number> }> = {};

    for (const r of registros) {
      // por costurera
      if (!porCosturera[r.usuario]) porCosturera[r.usuario] = { minutos: 0, registros: 0 };
      porCosturera[r.usuario].minutos   += r.minutosNetos;
      porCosturera[r.usuario].registros += 1;

      // por actividad
      if (!porActividad[r.actividad]) porActividad[r.actividad] = { minutos: 0, registros: 0 };
      porActividad[r.actividad].minutos   += r.minutosNetos;
      porActividad[r.actividad].registros += 1;

      // por máquina
      if (r.maquina) {
        if (!porMaquina[r.maquina]) porMaquina[r.maquina] = { minutos: 0, registros: 0 };
        porMaquina[r.maquina].minutos   += r.minutosNetos;
        porMaquina[r.maquina].registros += 1;
      }

      // inconvenientes
      if (r.inconveniente) {
        if (!porInconveniente[r.inconveniente]) porInconveniente[r.inconveniente] = { registros: 0, minutos: 0 };
        porInconveniente[r.inconveniente].registros += 1;
        porInconveniente[r.inconveniente].minutos   += r.minutosNetos;

        const skuKey = r.sku ?? '(sin SKU)';
        if (!inconvenientesPorSku[skuKey]) inconvenientesPorSku[skuKey] = { registros: 0, minutos: 0, categorias: {} };
        inconvenientesPorSku[skuKey].registros += 1;
        inconvenientesPorSku[skuKey].minutos   += r.minutosNetos;
        inconvenientesPorSku[skuKey].categorias[r.inconveniente] =
          (inconvenientesPorSku[skuKey].categorias[r.inconveniente] ?? 0) + 1;
      }
    }

    return NextResponse.json({
      fecha,
      totalRegistros: registros.length,
      totalMinutos:   registros.reduce((s, r) => s + r.minutosNetos, 0),
      // ⛔ No hay "totalPrendas": era Σ `TiemposProduccion.cantidad`, y esa cantidad
      // la copiaba la tablet de lo PLANIFICADO de la OP en CADA registro ⇒ la misma
      // tanda se contaba una vez por proceso. 📊 El 18-sep daba 462 "prendas" en un
      // día en que entraron CERO. Lo producido se lee del ingreso al stock, ⛔ no de
      // los registros de tiempo. Devolverlo en 0 sería peor: el cero AFIRMA.
      porCosturera,
      porActividad,
      porMaquina,
      porInconveniente,
      inconvenientesPorSku,
      registros,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error generando reporte' }, { status: 500 });
  }
}
