import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

async function requireProduccionAccess(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return null;
  if (session.rol === 'admin') return session;
  if (session.rol === 'costurera') return null;
  const user = await prisma.usuario.findUnique({ where: { id: session.id }, select: { permisos: true } });
  if (!user?.permisos.includes('produccion')) return session;
  return null;
}

const BodySchema = z.object({
  marca:  z.string().min(1),
  prenda: z.string().min(1),
  color:  z.string().min(1),
});

const PAD = 3;

export async function POST(req: NextRequest) {
  const session = await requireProduccionAccess(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const prefijo = `${parsed.data.marca}-${parsed.data.prenda}-${parsed.data.color}-`;
  const existentes = await prisma.ordenProduccion.findMany({
    where:  { sku: { startsWith: prefijo } },
    select: { sku: true },
  });

  let maxN = 0;
  for (const { sku } of existentes) {
    const tail = sku.slice(prefijo.length);
    const n = parseInt(tail, 10);
    if (!isNaN(n) && n > maxN) maxN = n;
  }

  const proximo = String(maxN + 1).padStart(Math.max(PAD, String(maxN + 1).length), '0');
  return NextResponse.json({ sku: prefijo + proximo, prefijo, numero: maxN + 1 });
}
