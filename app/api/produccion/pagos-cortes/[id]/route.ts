import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { cuentaDe } from '@/lib/produccion/cuenta-cortador';

type Ctx = { params: Promise<{ id: string }> };

// Anular un pago. Hasta ahora un pago cargado con el monto equivocado sólo se arreglaba
// por SQL, y sin esto tampoco se podía reparar el doble conteo que dejó la cuenta vieja.
//
// Los ítems se desvinculan EN LA MISMA transacción: el `delete` explota por la FK si
// quedan colgados, y hacerlo en dos requests dejaría cortes apuntando a un pago que ya no
// existe. Bajo cuenta corriente no hace falta ningún otro guard: borrar un pago sube el
// saldo exactamente su `montoTotal` y no toca la deuda.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'produccion'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;

  const pago = await prisma.pagoCorte.findUnique({
    where: { id },
    select: { id: true, montoTotal: true, cortadorId: true, _count: { select: { ordenes: true, muestras: true } } },
  });
  if (!pago) return NextResponse.json({ error: 'El pago no existe' }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.ordenProduccion.updateMany({ where: { pagoCorteId: id }, data: { pagoCorteId: null } });
    await tx.corteMuestra.updateMany({ where: { pagoCorteId: id }, data: { pagoCorteId: null } });
    await tx.pagoCorte.delete({ where: { id } });
  });

  return NextResponse.json({
    ok: true,
    montoTotal: Number(pago.montoTotal),
    desvinculados: pago._count.ordenes + pago._count.muestras,
    cuenta: pago.cortadorId ? await cuentaDe(pago.cortadorId) : null,
  });
}
