import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAlguno } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { MuestraPatchSchema } from '@/lib/validators/produccion';
import {
  EPS_CERO, MuestraError, ajustarPesoRollo, conceptoMuestra, kgDesdeMetros,
  puedeTocar, responderMuestraError,
} from '@/lib/produccion/muestras';

type Ctx = { params: Promise<{ id: string }> };

const PUEDE_RETIRAR = ['muestras', 'produccion'] as const;

/**
 * Carga el retiro y valida que esta sesión pueda tocarlo. Devuelve además el
 * rollo con su rinde y el gasto asociado, que es lo que necesitan PATCH y DELETE.
 */
async function cargarRetiro(tx: Prisma.TransactionClient, id: string, session: { id: string; rol: string }) {
  const mov = await tx.movimientoInsumo.findUnique({ where: { id } });
  if (!mov || mov.tipo !== 'MUESTRA') throw new MuestraError('Retiro no encontrado', 404);
  if (!puedeTocar(mov, session)) {
    throw new MuestraError('Solo quien cargó el retiro (o un admin) puede modificarlo', 403);
  }
  if (!mov.rolloId) throw new MuestraError('El retiro no tiene rollo asociado');

  const rollo = await tx.rollo.findUnique({
    where: { id: mov.rolloId },
    include: { insumo: { select: { nombre: true, rinde: true } } },
  });
  if (!rollo) throw new MuestraError('Rollo no encontrado', 404);

  // El gasto se lee ANTES de escribir nada: si tiene seguimiento de pago o quedó
  // atado a un proveedor (alguien lo convirtió en compra), no le tocamos la plata.
  const gasto = await tx.gasto.findFirst({ where: { movimientoId: id } });
  if (gasto && (gasto.estadoPago !== null || gasto.proveedorId !== null)) {
    throw new MuestraError(
      'El gasto de este retiro ya tiene seguimiento de pago o proveedor. '
      + 'Resolvelo desde Gastos y después volvé acá.',
      409,
    );
  }

  return { mov, rollo, gasto };
}

/** Editar un retiro: metros, marca, proyecto y nota. El rollo no se cambia. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await requireAlguno(req, [...PUEDE_RETIRAR]);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  // Explícito en vez de ignorado en silencio: mover un retiro de un rollo a otro
  // no es una edición, son dos operaciones.
  if (body && typeof body === 'object' && 'rolloId' in body) {
    return NextResponse.json(
      { error: 'No se puede cambiar el rollo de un retiro. Eliminalo y cargalo de nuevo.' },
      { status: 400 },
    );
  }

  const parsed = MuestraPatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { cantidad, marca, proyectoId, descripcion } = parsed.data;

  try {
    const actualizado = await prisma.$transaction(async (tx) => {
      const { mov, rollo, gasto } = await cargarRetiro(tx, id, session);

      const rinde = Number(rollo.insumo.rinde);
      if (!rinde || rinde <= 0) {
        throw new MuestraError(
          `El insumo "${rollo.insumo.nombre}" no tiene rinde cargado: no se puede convertir metros a kg`,
        );
      }

      const kgViejo = mov.cantidad.abs();
      const metrosViejo = Number(kgViejo) * rinde;
      const metros = cantidad ?? metrosViejo;
      const kgNuevo = cantidad != null ? kgDesdeMetros(cantidad, rinde) : kgViejo;
      // Positivo = se retira MÁS que antes, hay que descontar la diferencia.
      const delta = kgNuevo.sub(kgViejo);

      const proyectoIdFinal = proyectoId !== undefined ? (proyectoId || null) : mov.proyectoId;
      let proyectoNombre: string | null = null;
      if (proyectoIdFinal) {
        const p = await tx.proyectoDiseno.findUnique({ where: { id: proyectoIdFinal }, select: { nombre: true } });
        if (!p) throw new MuestraError('Proyecto no encontrado');
        proyectoNombre = p.nombre;
      }

      // El rollo se ajusta por la DIFERENCIA: entre medio pudo haber cortes u
      // otros retiros, y de ese peso solo somos dueños de nuestra parte.
      if (delta.abs().greaterThanOrEqualTo(EPS_CERO)) {
        await ajustarPesoRollo(tx, rollo.id, delta, {
          // Lo disponible incluye los metros que este mismo retiro ya había sacado.
          falta: (disp) =>
            `No alcanza: contando los ${metrosViejo.toFixed(2)} m ya retirados, el rollo ${rollo.codigo} `
            + `da para ${((Number(disp) + Number(kgViejo)) * rinde).toFixed(2)} m y querés dejarlo en ${metros} m`,
          sobra: (peso, inicial) =>
            `Bajar a ${metros} m devolvería kg de más: el rollo ${rollo.codigo} quedaría en `
            + `${peso.toFixed(2)} kg, sobre su peso inicial (${inicial.toFixed(2)} kg). `
            + 'Hubo ajustes posteriores sobre este rollo: corregilo con un ajuste de inventario.',
        });
      }

      const marcaFinal = marca ?? mov.marca;
      const motivoFinal = descripcion !== undefined ? (descripcion?.trim() || 'Muestra') : mov.motivo;

      const movActualizado = await tx.movimientoInsumo.update({
        where: { id },
        data: {
          cantidad:   kgNuevo.neg(),
          marca:      marcaFinal,
          proyectoId: proyectoIdFinal,
          motivo:     motivoFinal,
        },
      });

      if (gasto) {
        // El monto se PRORRATEA sobre el original en vez de recalcularse con el
        // costoUnitario de hoy: el gasto es la foto de la valuación del día en que
        // se retiró la tela, y un rollo en USD puede haberse revaluado desde
        // entonces. Corregir los metros no debe revaluar el retiro.
        const monto = Number(kgViejo) > 0
          ? gasto.monto * (Number(kgNuevo) / Number(kgViejo))
          : Number(rollo.costoUnitario) * Number(kgNuevo);
        await tx.gasto.update({
          where: { id: gasto.id },
          data: {
            monto:    Math.round(monto * 100) / 100,
            marca:    marcaFinal,
            concepto: conceptoMuestra({
              insumo:      rollo.insumo.nombre,
              metros,
              descripcion: motivoFinal === 'Muestra' ? null : motivoFinal,
              proyecto:    proyectoNombre,
            }),
            // fecha y creadoPor NO se tocan: el retiro pasó ese día y lo hizo esa
            // persona, aunque se corrija después.
          },
        });
      }

      return { ...movActualizado, gastoActualizado: !!gasto };
    });

    return NextResponse.json(actualizado);
  } catch (e) {
    return responderMuestraError(e);
  }
}

/** Eliminar un retiro: devuelve los kg al rollo y borra el gasto asociado. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await requireAlguno(req, [...PUEDE_RETIRAR]);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;

  try {
    const out = await prisma.$transaction(async (tx) => {
      const { mov, rollo, gasto } = await cargarRetiro(tx, id, session);

      const devolver = mov.cantidad.abs(); // la cantidad se guarda negativa
      await ajustarPesoRollo(tx, rollo.id, devolver.neg(), {
        falta: () => `No se puede devolver tela al rollo ${rollo.codigo}`,
        sobra: (peso, inicial) =>
          `Devolver ${devolver.toFixed(2)} kg dejaría al rollo ${rollo.codigo} en ${peso.toFixed(2)} kg, `
          + `sobre su peso inicial (${inicial.toFixed(2)} kg). Hubo ajustes posteriores sobre este rollo: `
          + 'corregilo con un ajuste de inventario.',
      });

      // El borrado es real y no deja rastro en la base: esto queda en los logs.
      console.log(JSON.stringify({
        evento: 'muestra_eliminada',
        movimientoId: id, gastoId: gasto?.id ?? null,
        rollo: rollo.codigo, kg: Number(devolver), marca: mov.marca,
        por: session.nombre,
      }));

      // deleteMany y no delete: si el gasto ya no está, no queremos explotar.
      const { count } = await tx.gasto.deleteMany({ where: { movimientoId: id } });
      await tx.movimientoInsumo.delete({ where: { id } });

      return { deleted: true, gastoBorrado: count > 0, kgDevueltos: Number(devolver) };
    });

    return NextResponse.json(out);
  } catch (e) {
    return responderMuestraError(e);
  }
}
