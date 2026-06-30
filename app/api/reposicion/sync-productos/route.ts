import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { paginaProductos, esProductoPropio, GestionNubeError } from '@/lib/gestionnube/client';

export const maxDuration = 60;

const CHUNK = 6;          // páginas por tanda (chico para no exceder timeout)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Sincroniza el catálogo de productos propios (Zattia/Areben) a la copia local, por
// tandas. El cliente llama repetidamente pasando `desdePagina` hasta que done=true.
export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'reposicion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  let page = Math.max(1, Number(body.desdePagina) || 1);

  let total = 0;
  let propios = 0;
  try {
    for (let i = 0; i < CHUNK; i++) {
      const { data, total: t, hayMas } = await paginaProductos(page);
      total = t;
      for (const p of data) {
        if (!esProductoPropio(p)) continue;
        await prisma.gnProducto.upsert({
          where:  { code: p.code },
          create: { code: p.code, name: p.name, provider: p.provider, category: p.category || null },
          update: { name: p.name, provider: p.provider, category: p.category || null },
        });
        propios++;
      }
      if (!hayMas) {
        const totalCache = await prisma.gnProducto.count();
        return NextResponse.json({ done: true, total, hastaPagina: page, propiosTanda: propios, totalCache });
      }
      page++;
      await sleep(650);
    }
  } catch (e) {
    if (e instanceof GestionNubeError) {
      // Devolvemos progreso para reintentar desde la misma página (su API es frágil).
      return NextResponse.json({ error: e.message, reintentarDesde: page, total }, { status: 502 });
    }
    throw e;
  }

  return NextResponse.json({ done: false, total, siguientePagina: page, propiosTanda: propios });
}
