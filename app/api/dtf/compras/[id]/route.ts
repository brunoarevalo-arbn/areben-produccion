import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

// Borrar una compra cambia el precio vigente hacia atrás (pasa a mandar la anterior), así
// que es de admin. Las órdenes ya creadas NO se tocan: tienen su snapshot.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
  const { id } = await params;
  const compra = await prisma.compraDtf.findUnique({ where: { id } });
  if (!compra) return NextResponse.json({ ok: true });
  // El Gasto se va CON la compra. Si sólo se borrara la compra, la plata quedaría en
  // cuentas por pagar sin nada que la explique — un gasto huérfano que nadie va a
  // reconocer después. Es el mismo motivo por el que el retiro de tela borra su gasto.
  await prisma.$transaction(async (tx) => {
    await tx.compraDtf.delete({ where: { id } });
    if (compra.gastoId) await tx.gasto.delete({ where: { id: compra.gastoId } }).catch(() => null);
  });
  return NextResponse.json({ ok: true, gastoBorrado: !!compra.gastoId });
}
