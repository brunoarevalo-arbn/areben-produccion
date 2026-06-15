import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { requirePermiso } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySession(token))) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const [costureras, usuarios] = await Promise.all([
    prisma.costoCosturera.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.usuario.findMany({
      where: { rol: 'costurera', activo: true },
      select: { id: true, nombre: true },
    }),
  ]);

  return NextResponse.json({ costureras, usuarios });
}

export async function POST(req: NextRequest) {
  if (!await requirePermiso(req, 'costos')) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { usuarioId, sueldoBruto, cargasSociales, horasMes } = await req.json();
  if (!usuarioId) return NextResponse.json({ error: 'Usuario requerido' }, { status: 400 });
  const costo = await prisma.costoCosturera.upsert({
    where: { usuarioId },
    create: {
      usuarioId,
      sueldoBruto:    parseFloat(sueldoBruto)    || 0,
      cargasSociales: parseFloat(cargasSociales) || 0,
      horasMes:       parseFloat(horasMes)        || 160,
    },
    update: {
      sueldoBruto:    parseFloat(sueldoBruto)    || 0,
      cargasSociales: parseFloat(cargasSociales) || 0,
      horasMes:       parseFloat(horasMes)        || 160,
    },
  });
  return NextResponse.json(costo);
}
