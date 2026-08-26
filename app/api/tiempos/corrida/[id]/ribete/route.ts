import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { cargarCorrida, serializar } from '@/lib/calculadora/corridaDb';

// Los cm de ribete de ESTA muestra, en el talle de la corrida. Se reemplaza la
// lista entera: es una tabla de 2-3 filas que se edita a mano en la tablet.
const RibetesSchema = z.object({
  ribetes: z
    .array(
      z.object({
        nombre: z.string().trim().min(1, 'Ponele nombre al ribete').max(60),
        anchoCm: z.number().min(0).max(100),
        largoCm: z.number().min(0).max(2000),
      }),
    )
    .max(12),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const corrida = await cargarCorrida(id);
  if (!corrida) return NextResponse.json({ error: 'No existe' }, { status: 404 });
  if (corrida.costurera !== session.nombre && session.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const parsed = RibetesSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.corridaRibete.deleteMany({ where: { corridaId: id } });
    if (parsed.data.ribetes.length > 0) {
      await tx.corridaRibete.createMany({
        data: parsed.data.ribetes.map((r, i) => ({ corridaId: id, orden: i, ...r })),
      });
    }
  });

  const fresca = await cargarCorrida(id);
  return NextResponse.json(serializar(fresca!));
}
