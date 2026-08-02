import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAlguno, getPermisos, can } from '@/lib/auth';
import { MuestraSchema } from '@/lib/validators/produccion';
import { Prisma } from '@prisma/client';

// Quién puede registrar un retiro de tela para muestra. `muestras` es el permiso
// chico (la diseñadora): no abre Producción ni Inventario, solo esto.
const PUEDE_RETIRAR = ['muestras', 'produccion'] as const;

// Lista de retiros registrados (consumos de tela tipo MUESTRA). El costo se agrega
// SOLO si la sesión tiene el permiso `gastos`: quien registra no ve la plata.
export async function GET(req: NextRequest) {
  const session = await requireAlguno(req, [...PUEDE_RETIRAR]);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const veCosto = can(await getPermisos(session), 'gastos');

  const muestras = await prisma.movimientoInsumo.findMany({
    where: { tipo: 'MUESTRA' },
    orderBy: { fecha: 'desc' },
    select: {
      id: true,
      cantidad: true,
      motivo: true,
      marca: true,
      fecha: true,
      usuarioId: true,
      rollo: {
        select: {
          codigo: true,
          colorProveedor: true,
          costoUnitario: veCosto,
          insumo: { select: { nombre: true, rinde: true } },
          color: { select: { nombre: true } },
        },
      },
      proyecto: { select: { id: true, nombre: true } },
    },
  });

  if (!veCosto) return NextResponse.json({ veCosto, retiros: muestras });

  // El costo se calcula acá y el costoUnitario del rollo NO viaja al cliente:
  // que la lista muestre plata no significa exponer el precio de compra.
  const retiros = muestras.map((m) => {
    const { costoUnitario, ...rollo } = m.rollo ?? {};
    return {
      ...m,
      rollo: m.rollo ? rollo : null,
      // La cantidad está en kg (negativa) y el costo unitario es por kg.
      costo: costoUnitario == null ? null : Number(costoUnitario) * Math.abs(Number(m.cantidad)),
    };
  });

  return NextResponse.json({ veCosto, retiros });
}

export async function POST(req: NextRequest) {
  const session = await requireAlguno(req, [...PUEDE_RETIRAR]);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const parsed = MuestraSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { rolloId, cantidad, marca, proyectoId, descripcion } = parsed.data;

  const rollo = await prisma.rollo.findUnique({
    where: { id: rolloId },
    include: { insumo: { select: { nombre: true, rinde: true } } },
  });
  if (!rollo) return NextResponse.json({ error: 'Rollo no encontrado' }, { status: 404 });

  const rinde = Number(rollo.insumo.rinde);
  if (!rinde || rinde <= 0) {
    return NextResponse.json(
      { error: `El insumo "${rollo.insumo.nombre}" no tiene rinde cargado: no se puede convertir metros a kg` },
      { status: 400 },
    );
  }

  // La cantidad se ingresa en METROS; se convierte a kg con el rinde (metros por kg).
  const kg = cantidad / rinde;
  const cant = new Prisma.Decimal(kg);
  const nuevoPeso = rollo.pesoActual.sub(cant);
  if (nuevoPeso.lessThan(0)) {
    const metrosDisp = Number(rollo.pesoActual) * rinde;
    return NextResponse.json(
      { error: `No alcanza: el rollo ${rollo.codigo} tiene ~${metrosDisp.toFixed(2)} m y querés retirar ${cantidad} m` },
      { status: 400 },
    );
  }

  let proyectoNombre: string | null = null;
  if (proyectoId) {
    const p = await prisma.proyectoDiseno.findUnique({ where: { id: proyectoId }, select: { nombre: true } });
    if (!p) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 400 });
    proyectoNombre = p.nombre;
  }

  const nuevoEstado = nuevoPeso.lte(new Prisma.Decimal('0.01')) ? 'AGOTADO' as const
    : nuevoPeso.lt(rollo.pesoInicial) ? 'EN_USO_PARCIAL' as const
    : 'DISPONIBLE' as const;

  const costo = Number(rollo.costoUnitario) * kg; // para el Gasto (no lo ve quien registra)
  const concepto = `Muestra — ${rollo.insumo.nombre} · ${cantidad} m${descripcion ? ` (${descripcion})` : ''}${proyectoNombre ? ` · ${proyectoNombre}` : ''}`;

  const [movimiento] = await prisma.$transaction([
    prisma.movimientoInsumo.create({
      data: {
        tipo: 'MUESTRA',
        rolloId,
        proyectoId: proyectoId || null,
        cantidad: cant.neg(),
        motivo: descripcion?.trim() || 'Muestra',
        marca,
        usuarioId: session.id,
      },
    }),
    prisma.rollo.update({
      where: { id: rolloId },
      data: { pesoActual: nuevoPeso, estado: nuevoEstado },
    }),
    prisma.gasto.create({
      data: {
        categoria: 'desarrollo',
        tipo:      'tela',
        marca,
        monto:     costo,
        concepto,
        fecha:     new Date().toISOString().split('T')[0],
        creadoPor: session.nombre,
      },
    }),
  ]);

  return NextResponse.json(movimiento, { status: 201 });
}
