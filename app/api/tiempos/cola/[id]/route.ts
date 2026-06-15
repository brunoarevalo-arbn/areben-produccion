import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

// Acción acotada para la tablet de costura: marcar la costura terminada.
// Avanza COSTURA -> TERMINADO_SIN_ESTAMPA (única transición permitida desde acá)
// y la saca de la cola de la tablet. El flujo completo de estados sigue
// gestionándose en /api/produccion/cola/[id]/estado (admin/diseñadora).
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const orden = await prisma.ordenProduccion.findUnique({ where: { id } });
  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });

  if (orden.estado !== 'COSTURA') {
    return NextResponse.json(
      { error: `La orden ya no está en costura (estado: ${orden.estado})` },
      { status: 400 },
    );
  }

  const [updated] = await prisma.$transaction([
    prisma.ordenProduccion.update({
      where: { id },
      data: { estado: 'TERMINADO_SIN_ESTAMPA' },
    }),
    prisma.estadoTransicion.create({
      data: {
        ordenId: id,
        estadoAnterior: 'COSTURA',
        estadoNuevo: 'TERMINADO_SIN_ESTAMPA',
        usuarioId: session.id,
        notas: 'Costura terminada desde la tablet',
      },
    }),
  ]);

  return NextResponse.json(updated);
}
