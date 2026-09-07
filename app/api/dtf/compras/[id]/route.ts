import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

// Borrar una compra cambia el precio vigente hacia atrás (pasa a mandar la anterior), así
// que es de admin. Las órdenes ya creadas NO se tocan: tienen su snapshot.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
  const { id } = await params;
  await prisma.compraDtf.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
