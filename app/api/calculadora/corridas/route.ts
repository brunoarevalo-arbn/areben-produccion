import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { CORRIDA_INCLUDE, serializar } from '@/lib/calculadora/corridaDb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'calculadora'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const [corridas, costureras, procesos, escandallos] = await Promise.all([
    prisma.corridaMuestra.findMany({ orderBy: { createdAt: 'desc' }, take: 60, include: CORRIDA_INCLUDE }),
    prisma.usuario.findMany({ where: { activo: true, rol: 'costurera' }, select: { nombre: true }, orderBy: { nombre: 'asc' } }),
    prisma.procesoPrenda.findMany({ where: { vigente: true }, include: { pasos: { orderBy: { orden: 'asc' } } } }),
    prisma.escandallo.findMany({ select: { id: true, nombre: true, sku: true, marca: true, tipoPrenda: true }, orderBy: { nombre: 'asc' } }),
  ]);

  return NextResponse.json({
    corridas: corridas.map(serializar),
    costureras: costureras.map((c) => c.nombre),
    procesos: procesos.map((p) => ({
      id: p.id, tipoPrenda: p.tipoPrenda, version: p.version,
      pasos: p.pasos.map((x) => ({ orden: x.orden, nombre: x.nombre, maquina: x.maquina })),
    })),
    escandallos,
  });
}

const NuevaSchema = z.object({
  nombre: z.string().trim().min(1, 'Ponele nombre a la prenda').max(120),
  tipoPrenda: z.string().trim().min(1, 'Falta el tipo de prenda').max(60),
  marca: z.string().trim().min(1, 'Falta la marca').max(60),
  talle: z.string().trim().min(1, 'Falta el talle').max(20),
  costurera: z.string().trim().min(1, 'Elegí la costurera').max(80),
  unidadesObjetivo: z.number().int().min(1).max(20),
  escandalloId: z.string().trim().optional().nullable(),
  sku: z.string().trim().max(60).optional().nullable(),
  notas: z.string().trim().max(500).optional().nullable(),
  // Los ribetes de la prenda los define DISEÑO al encender la corrida: el ancho
  // sale de la cortacollaretas y no es de la costurera. Ella sólo mide largos.
  ribetes: z
    .array(z.object({
      nombre: z.string().trim().min(1, 'Ponele nombre al ribete').max(60),
      anchoCm: z.number().min(0).max(100),
    }))
    .max(12)
    .default([]),
});

// El MODO no se pregunta, se deduce: sin proceso vigente para ese tipo de prenda
// la corrida nace en relevamiento y descubre los pasos cosiendo. La lista de
// pasos no se inventa antes de haber mirado una prenda hacerse.
export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'calculadora');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const parsed = NuevaSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  const proceso = await prisma.procesoPrenda.findFirst({
    where: { tipoPrenda: d.tipoPrenda, vigente: true },
    include: { pasos: { orderBy: { orden: 'asc' } } },
  });

  const corrida = await prisma.$transaction(async (tx) => {
    const c = await tx.corridaMuestra.create({
      data: {
        nombre: d.nombre,
        tipoPrenda: d.tipoPrenda,
        marca: d.marca,
        talle: d.talle,
        costurera: d.costurera,
        unidadesObjetivo: d.unidadesObjetivo,
        escandalloId: d.escandalloId || null,
        sku: d.sku || null,
        notas: d.notas || null,
        modo: proceso ? 'medicion' : 'relevamiento',
        procesoId: proceso?.id ?? null,
        creadoPor: session.nombre,
      },
    });

    // Los pasos se COPIAN, no se referencian: aprobar una versión nueva del
    // proceso no puede reescribir lo que esta corrida ya midió.
    if (proceso && proceso.pasos.length > 0) {
      await tx.corridaPaso.createMany({
        data: proceso.pasos.map((p) => ({
          corridaId: c.id, orden: p.orden, nombre: p.nombre, maquina: p.maquina,
        })),
      });
    }

    if (d.ribetes.length > 0) {
      await tx.corridaRibete.createMany({
        data: d.ribetes.map((r, i) => ({ corridaId: c.id, orden: i, nombre: r.nombre, anchoCm: r.anchoCm })),
      });
    }

    return tx.corridaMuestra.findUnique({ where: { id: c.id }, include: CORRIDA_INCLUDE });
  });

  return NextResponse.json(serializar(corrida!), { status: 201 });
}
