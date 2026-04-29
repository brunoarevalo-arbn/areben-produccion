import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fecha   = searchParams.get('fecha') ?? new Date().toISOString().split('T')[0];
    const usuario = searchParams.get('usuario') ?? undefined;

    const registros = await prisma.tiemposProduccion.findMany({
      where: { fecha, ...(usuario ? { usuario } : {}) },
      orderBy: { createdAt: 'asc' },
    });

    const porCosturera: Record<string, { minutos: number; registros: number; prendas: number }> = {};
    const porActividad: Record<string, { minutos: number; registros: number }> = {};
    const porMaquina:   Record<string, { minutos: number; registros: number }> = {};

    for (const r of registros) {
      // por costurera
      if (!porCosturera[r.usuario]) porCosturera[r.usuario] = { minutos: 0, registros: 0, prendas: 0 };
      porCosturera[r.usuario].minutos   += r.minutosNetos;
      porCosturera[r.usuario].registros += 1;
      porCosturera[r.usuario].prendas   += r.cantidad;

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
    }

    return NextResponse.json({
      fecha,
      totalRegistros: registros.length,
      totalMinutos:   registros.reduce((s, r) => s + r.minutosNetos, 0),
      totalPrendas:   registros.reduce((s, r) => s + r.cantidad, 0),
      porCosturera,
      porActividad,
      porMaquina,
      registros,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error generando reporte' }, { status: 500 });
  }
}
