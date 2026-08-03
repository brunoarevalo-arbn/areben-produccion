import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAlguno, getPermisos, can } from '@/lib/auth';
import { MuestraSchema } from '@/lib/validators/produccion';
import { Prisma } from '@prisma/client';
import {
  MuestraError, ajustarPesoRollo, conceptoMuestra, kgDesdeMetros, responderMuestraError,
} from '@/lib/produccion/muestras';

// Quién puede registrar un retiro de tela para muestra. `muestras` es el permiso
// chico (la diseñadora): no abre Producción ni Inventario, solo esto.
const PUEDE_RETIRAR = ['muestras', 'produccion'] as const;

// Ventana del aviso de posible duplicado. Que la misma persona retire el mismo
// metraje del mismo rollo dos veces en 10 minutos es rarísimo; que reenvíe el
// formulario, no. El aviso no bloquea: pide confirmar.
const VENTANA_DUPLICADO_MIN = 10;
const EPS_DUP = new Prisma.Decimal('0.0001');

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
      rolloId: true,
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

  // Quién puede editar/eliminar cada fila lo decide el servidor, no el cliente:
  // así el gating de la UI y el del API salen de la misma fuente.
  const editable = (usuarioId: string) => session.rol === 'admin' || usuarioId === session.id;

  if (!veCosto) {
    return NextResponse.json({
      veCosto,
      retiros: muestras.map((m) => ({ ...m, editable: editable(m.usuarioId) })),
    });
  }

  // El costo se calcula acá y el costoUnitario del rollo NO viaja al cliente:
  // que la lista muestre plata no significa exponer el precio de compra.
  const retiros = muestras.map((m) => {
    const { costoUnitario, ...rollo } = m.rollo ?? {};
    return {
      ...m,
      rollo: m.rollo ? rollo : null,
      editable: editable(m.usuarioId),
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

  const { rolloId, cantidad, marca, proyectoId, descripcion, confirmarDuplicado } = parsed.data;

  try {
    if (!confirmarDuplicado) await avisarSiParecePorDuplicado(rolloId, cantidad, session.id);

    // Todo dentro de una transacción interactiva: el rollo se lee acá adentro y
    // se descuenta de forma atómica, y el gasto necesita el id del movimiento.
    const movimiento = await prisma.$transaction(async (tx) => {
      const rollo = await tx.rollo.findUnique({
        where: { id: rolloId },
        include: { insumo: { select: { nombre: true, rinde: true } } },
      });
      if (!rollo) throw new MuestraError('Rollo no encontrado', 404);
      if (rollo.estado === 'DESCARTADO') {
        throw new MuestraError(`El rollo ${rollo.codigo} está descartado: no se puede retirar tela de ahí`);
      }

      const rinde = Number(rollo.insumo.rinde);
      if (!rinde || rinde <= 0) {
        throw new MuestraError(
          `El insumo "${rollo.insumo.nombre}" no tiene rinde cargado: no se puede convertir metros a kg`,
        );
      }

      // La cantidad se ingresa en METROS; se convierte a kg con el rinde.
      const kg = kgDesdeMetros(cantidad, rinde);

      let proyectoNombre: string | null = null;
      if (proyectoId) {
        const p = await tx.proyectoDiseno.findUnique({ where: { id: proyectoId }, select: { nombre: true } });
        if (!p) throw new MuestraError('Proyecto no encontrado');
        proyectoNombre = p.nombre;
      }

      await ajustarPesoRollo(tx, rolloId, kg, {
        falta: (disp) =>
          `No alcanza: el rollo ${rollo.codigo} tiene ~${(Number(disp) * rinde).toFixed(2)} m `
          + `y querés retirar ${cantidad} m`,
        sobra: (peso, inicial) =>
          `El rollo ${rollo.codigo} quedaría en ${peso.toFixed(2)} kg, sobre su peso inicial `
          + `(${inicial.toFixed(2)} kg)`,
      });

      const mov = await tx.movimientoInsumo.create({
        data: {
          tipo: 'MUESTRA',
          rolloId,
          proyectoId: proyectoId || null,
          cantidad: kg.neg(),
          motivo: descripcion?.trim() || 'Muestra',
          marca,
          usuarioId: session.id,
        },
      });

      await tx.gasto.create({
        data: {
          categoria: 'desarrollo',
          tipo:      'tela',
          marca,
          monto:     Number(rollo.costoUnitario) * Number(kg),
          concepto:  conceptoMuestra({ insumo: rollo.insumo.nombre, metros: cantidad, descripcion, proyecto: proyectoNombre }),
          fecha:     new Date().toISOString().split('T')[0],
          creadoPor: session.nombre,
          // El vínculo que permite después editar o borrar el gasto junto con el retiro.
          movimientoId: mov.id,
        },
      });

      return mov;
    });

    return NextResponse.json(movimiento, { status: 201 });
  } catch (e) {
    return responderMuestraError(e);
  }
}

/**
 * Si esta misma persona ya registró el mismo metraje del mismo rollo hace pocos
 * minutos, corta con un 409 que la UI usa para preguntar. Es lectura pura y va
 * fuera de la transacción para no alargarla.
 */
async function avisarSiParecePorDuplicado(rolloId: string, metros: number, usuarioId: string) {
  const rollo = await prisma.rollo.findUnique({
    where: { id: rolloId },
    select: { codigo: true, insumo: { select: { rinde: true } } },
  });
  const rinde = Number(rollo?.insumo.rinde);
  if (!rollo || !rinde || rinde <= 0) return; // el POST se encarga de estos casos

  // La cantidad se guarda NEGATIVA. El epsilon absorbe redondeos del rinde.
  const kg = kgDesdeMetros(metros, rinde).neg();
  const previo = await prisma.movimientoInsumo.findFirst({
    where: {
      tipo: 'MUESTRA',
      rolloId,
      usuarioId,
      fecha: { gte: new Date(Date.now() - VENTANA_DUPLICADO_MIN * 60_000) },
      cantidad: { gte: kg.sub(EPS_DUP), lte: kg.add(EPS_DUP) },
    },
    orderBy: { fecha: 'desc' },
    select: { id: true, fecha: true },
  });
  if (!previo) return;

  const hace = Math.max(1, Math.round((Date.now() - previo.fecha.getTime()) / 60_000));
  throw new MuestraError(
    `Hace ${hace} min ya registraste ${metros} m del rollo ${rollo.codigo}. `
    + '¿Es un retiro nuevo o se envió dos veces?',
    409,
    {
      code: 'POSIBLE_DUPLICADO',
      duplicado: { id: previo.id, fecha: previo.fecha, metros, rolloCodigo: rollo.codigo },
    },
  );
}
