import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySession(token))) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const marca = searchParams.get('marca');

  const where: Record<string, unknown> = { estado: 'guardado' };
  if (desde || hasta) {
    where.fecha = {
      ...(desde ? { gte: desde } : {}),
      ...(hasta ? { lte: hasta } : {}),
    };
  }
  if (marca) where.marca = marca;

  const registros = await prisma.tiemposProduccion.findMany({
    where,
    orderBy: { fecha: 'desc' },
  });

  // ─── Totales generales ───────────────────────────────────────────────────────
  const totalMinutos  = registros.reduce((s, r) => s + r.minutosNetos, 0);
  const totalUnidades = registros.reduce((s, r) => s + r.cantidad, 0);
  const totalDefectos = registros.reduce((s, r) => s + r.defectos, 0);

  // ─── Por máquina ─────────────────────────────────────────────────────────────
  const porMaquina: Record<string, { minutos: number; unidades: number }> = {};
  for (const r of registros) {
    const key = r.maquina || 'Sin máquina';
    if (!porMaquina[key]) porMaquina[key] = { minutos: 0, unidades: 0 };
    porMaquina[key].minutos  += r.minutosNetos;
    porMaquina[key].unidades += r.cantidad;
  }

  // ─── Por actividad ───────────────────────────────────────────────────────────
  const porActividad: Record<string, number> = {};
  for (const r of registros) {
    if (!porActividad[r.actividad]) porActividad[r.actividad] = 0;
    porActividad[r.actividad] += r.minutosNetos;
  }

  // ─── Por costurera ───────────────────────────────────────────────────────────
  const porCosturera: Record<string, { minutos: number; unidades: number; defectos: number }> = {};
  for (const r of registros) {
    if (!porCosturera[r.usuario]) porCosturera[r.usuario] = { minutos: 0, unidades: 0, defectos: 0 };
    porCosturera[r.usuario].minutos  += r.minutosNetos;
    porCosturera[r.usuario].unidades += r.cantidad;
    porCosturera[r.usuario].defectos += r.defectos;
  }

  // ─── Por SKU ─────────────────────────────────────────────────────────────────
  const porSku: Record<string, {
    sku: string; marca: string;
    minutosNetos: number; minutosTotal: number;
    unidades: number; defectos: number;
    porMaquina: Record<string, number>;
  }> = {};

  for (const r of registros) {
    if (!r.sku) continue;
    const key = r.sku;
    if (!porSku[key]) {
      porSku[key] = {
        sku: r.sku, marca: r.marca || '',
        minutosNetos: 0, minutosTotal: 0,
        unidades: 0, defectos: 0, porMaquina: {},
      };
    }
    porSku[key].minutosTotal  += r.minutosNetos;
    porSku[key].unidades      += r.cantidad;
    porSku[key].defectos      += r.defectos;
    if (r.actividad === 'Proceso Completado') {
      porSku[key].minutosNetos += r.minutosNetos;
      const maq = r.maquina || 'Sin máquina';
      if (!porSku[key].porMaquina[maq]) porSku[key].porMaquina[maq] = 0;
      porSku[key].porMaquina[maq] += r.minutosNetos;
    }
  }

  return NextResponse.json({
    totalMinutos,
    totalUnidades,
    totalDefectos,
    porMaquina,
    porActividad,
    porCosturera,
    porSku: Object.values(porSku).sort((a, b) => b.minutosNetos - a.minutosNetos),
  });
}
