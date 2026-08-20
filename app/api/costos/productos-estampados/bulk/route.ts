import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAlguno } from '@/lib/auth';
import { z } from 'zod';
import { lisoRefValida, ERROR_LISO } from '@/lib/costos/lisoRef';

// Carga masiva de productos con estampa. La usan dos flujos:
//  - Vincular desde el catálogo de Estampería (1 producto por estampa tildada).
//  - Carga masiva desde Costos (grilla, cada fila 1 producto con N estampas).
const Schema = z.object({
  productos: z.array(z.object({
    nombre:           z.string().min(1),
    sku:              z.string().nullish(),
    marca:            z.string().nullish(),
    lisoEscandalloId: z.string().nullish(),
    lisoSku:          z.string().nullish(),
    estampas: z.array(z.object({
      estampaId:        z.string().min(1),
      tamano:           z.number().optional(),
      minutosEstampado: z.number().min(0).optional(),
    })).default([]),
    notas:            z.string().nullish(),
  })).min(1, 'Cargá al menos un producto'),
}).superRefine((b, ctx) => {
  b.productos.forEach((p, idx) => {
    if (!lisoRefValida({ lisoEscandalloId: p.lisoEscandalloId ?? null, lisoSku: p.lisoSku ?? null })) {
      ctx.addIssue({ code: 'custom', path: ['productos', idx], message: ERROR_LISO });
    }
  });
});

export async function POST(req: NextRequest) {
  const session = await requireAlguno(req, ['costos', 'estamperia']);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const res = await prisma.productoEstampado.createMany({
    data: parsed.data.productos.map((p) => ({
      nombre:           p.nombre.trim(),
      sku:              p.sku?.trim() || null,
      marca:            p.marca?.trim() || null,
      lisoEscandalloId: p.lisoEscandalloId || null,
      lisoSku:          p.lisoSku || null,
      estampas:         p.estampas.map((e) => ({ estampaId: e.estampaId, tamano: e.tamano ?? 1, minutosEstampado: e.minutosEstampado ?? 0 })),
      notas:            p.notas?.trim() || null,
    })),
  });
  return NextResponse.json({ creados: res.count }, { status: 201 });
}
