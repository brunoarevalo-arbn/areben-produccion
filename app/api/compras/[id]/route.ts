import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAlguno, requireInsumos } from '@/lib/auth';
import { CompraSchema } from '@/lib/validators/insumos';
import { nextCodigoRollo, nextCodigoLote } from '@/lib/insumos/codigos';
import { Prisma } from '@prisma/client';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await requireAlguno(req, ['insumos', 'gastos']);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const compra = await prisma.compra.findUnique({
    where: { id },
    include: {
      proveedor: true,
      lineas: {
        include: { insumo: { select: { nombre: true, categoria: true, tipoTrazabilidad: true } } },
      },
      rollos: {
        include: { insumo: { select: { nombre: true } } },
      },
      lotes: {
        include: { insumo: { select: { nombre: true } } },
      },
    },
  });

  if (!compra) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });
  return NextResponse.json(compra);
}

// Editar compra. Solo si NINGÚN rollo/lote fue consumido (corte/muestra/etc.):
// se reemplaza limpio. Si ya hay consumos, se bloquea (revertir + recargar).
export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await requireInsumos(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const parsed = CompraSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const data = parsed.data;

  const compra = await prisma.compra.findUnique({
    where: { id },
    include: { rollos: { select: { id: true } }, lotes: { select: { id: true } } },
  });
  if (!compra) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });
  if (compra.revertida) return NextResponse.json({ error: 'La compra está revertida, no se puede editar' }, { status: 400 });

  const rolloIds = compra.rollos.map((r) => r.id);
  const loteIds  = compra.lotes.map((l) => l.id);
  const consumos = await prisma.movimientoInsumo.count({
    where: { tipo: { not: 'INGRESO' }, OR: [{ rolloId: { in: rolloIds } }, { loteId: { in: loteIds } }] },
  });
  if (consumos > 0) {
    return NextResponse.json(
      { error: 'Esta compra ya tiene rollos/lotes consumidos (cortes, muestras, etc.). Para corregirla, revertila y volvé a cargarla.' },
      { status: 400 },
    );
  }

  const totalBruto = new Prisma.Decimal(data.totalBruto);
  const totalNeto  = data.conIva ? totalBruto.div(new Prisma.Decimal('1.21')) : totalBruto;
  const sumaSubtotales = data.lineas.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0);
  const tolerancia = Math.max(50, Number(totalNeto) * 0.005);
  if (Math.abs(sumaSubtotales - Number(totalNeto)) > tolerancia) {
    return NextResponse.json({ error: `La suma de subtotales ($${sumaSubtotales.toFixed(2)}) difiere demasiado del total neto ($${Number(totalNeto).toFixed(2)})` }, { status: 400 });
  }

  // Flete: en pesos (monto) o como % sobre el valor neto de la compra.
  const costoEnvioPesos = data.fleteModo === 'porcentaje'
    ? sumaSubtotales * (data.fletePorcentaje || 0) / 100
    : (data.costoEnvio || 0);

  const insumoIds = data.lineas.map((l) => l.insumoId);
  const insumos = await prisma.insumo.findMany({ where: { id: { in: insumoIds } } });
  const insumosMap = new Map(insumos.map((i) => [i.id, i]));
  let rolloCounter = 0, loteCounter = 0;
  for (const linea of data.lineas) {
    const insumo = insumosMap.get(linea.insumoId);
    if (!insumo) return NextResponse.json({ error: `Insumo ${linea.insumoId} no encontrado` }, { status: 400 });
    if (insumo.tipoTrazabilidad === 'rollo') {
      if (!linea.rollos || linea.rollos.length === 0) return NextResponse.json({ error: `El insumo "${insumo.nombre}" requiere desglose por rollos` }, { status: 400 });
      const sumaPesos = linea.rollos.reduce((s, r) => s + r.pesoInicial, 0);
      if (Math.abs(sumaPesos - linea.cantidad) > 0.01) return NextResponse.json({ error: `La suma de rollos no coincide con la cantidad para "${insumo.nombre}"` }, { status: 400 });
      rolloCounter += linea.rollos.length;
    } else {
      loteCounter += 1;
    }
  }

  let nextRollo = await nextCodigoRollo();
  let nextLote  = await nextCodigoLote();
  const rolloCodigos: string[] = [];
  const loteCodigos: string[] = [];
  for (let i = 0; i < rolloCounter; i++) { rolloCodigos.push(nextRollo); const n = parseInt(nextRollo.replace('R-', ''), 10) + 1; nextRollo = `R-${String(n).padStart(4, '0')}`; }
  for (let i = 0; i < loteCounter; i++)  { loteCodigos.push(nextLote);  const n = parseInt(nextLote.replace('L-', ''), 10) + 1;  nextLote = `L-${String(n).padStart(4, '0')}`; }

  await prisma.$transaction(async (tx) => {
    await tx.movimientoInsumo.deleteMany({ where: { OR: [{ rolloId: { in: rolloIds } }, { loteId: { in: loteIds } }] } });
    await tx.rollo.deleteMany({ where: { compraId: id } });
    await tx.lote.deleteMany({ where: { compraId: id } });
    await tx.compraLinea.deleteMany({ where: { compraId: id } });

    await tx.compra.update({
      where: { id },
      data: {
        proveedorId:   data.proveedorId,
        fecha:         new Date(data.fecha),
        numeroFactura: data.numeroFactura || null,
        conIva:        data.conIva,
        totalBruto, totalNeto,
        costoEnvio:    new Prisma.Decimal(costoEnvioPesos),
        fleteModo:     data.fleteModo,
        fletePorcentaje: data.fleteModo === 'porcentaje' ? new Prisma.Decimal(data.fletePorcentaje || 0) : null,
        formaPago:     data.formaPago || null,
        estadoPago:    data.estadoPago,
        montoPagado:   new Prisma.Decimal(data.montoPagado),
        fechaPago:     data.fechaPago ? new Date(data.fechaPago) : null,
        notas:         data.notas || null,
      },
    });

    let rolloIdx = 0, loteIdx = 0;
    for (const linea of data.lineas) {
      const subtotal     = new Prisma.Decimal(linea.cantidad * linea.precioUnitario);
      const lineaSub     = linea.cantidad * linea.precioUnitario;
      const lineaEnvio   = sumaSubtotales > 0 ? costoEnvioPesos * (lineaSub / sumaSubtotales) : 0;
      const recargoEnvio = linea.cantidad > 0 ? lineaEnvio / linea.cantidad : 0;
      const costoUnitarioNeto = new Prisma.Decimal(linea.precioUnitario + recargoEnvio);

      await tx.compraLinea.create({ data: { compraId: id, insumoId: linea.insumoId, cantidad: new Prisma.Decimal(linea.cantidad), unidad: linea.unidad, precioUnitario: new Prisma.Decimal(linea.precioUnitario), subtotal } });

      const insumo = insumosMap.get(linea.insumoId)!;
      if (insumo.tipoTrazabilidad === 'rollo' && linea.rollos) {
        for (const r of linea.rollos) {
          const codigo = rolloCodigos[rolloIdx++];
          const peso = new Prisma.Decimal(r.pesoInicial);
          const rollo = await tx.rollo.create({ data: { codigo, insumoId: linea.insumoId, colorId: linea.colorId || null, colorProveedor: linea.colorProveedor || null, compraId: id, pesoInicial: peso, pesoActual: peso, costoUnitario: costoUnitarioNeto, ubicacion: r.ubicacion || null } });
          await tx.movimientoInsumo.create({ data: { tipo: 'INGRESO', rolloId: rollo.id, cantidad: peso, motivo: `Compra ${id} (editada)`, usuarioId: session.id } });
        }
      } else if (insumo.tipoTrazabilidad === 'lote') {
        const codigo = loteCodigos[loteIdx++];
        const cant = new Prisma.Decimal(linea.cantidad);
        const lote = await tx.lote.create({ data: { codigo, insumoId: linea.insumoId, colorId: linea.colorId || null, colorProveedor: linea.colorProveedor || null, compraId: id, cantidadInicial: cant, cantidadActual: cant, costoUnitario: costoUnitarioNeto } });
        await tx.movimientoInsumo.create({ data: { tipo: 'INGRESO', loteId: lote.id, cantidad: cant, motivo: `Compra ${id} (editada)`, usuarioId: session.id } });
      }
    }
  });

  // Invalidar la caché de las páginas que leen esta compra (si no, al reabrir
  // el formulario Next sirve la versión vieja del Router Cache del cliente).
  revalidatePath(`/inventario/compras/${id}`);
  revalidatePath(`/inventario/compras/${id}/editar`);
  revalidatePath('/inventario/rollos');

  return NextResponse.json({ ok: true });
}

// Eliminar una compra de verdad: borra sus rollos/lotes, líneas y movimientos.
// Solo si ninguno de sus rollos/lotes fue consumido (cortes/muestras). Si ya se
// usó, no se borra (hay que revertirla para conservar la traza).
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await requireInsumos(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;

  const compra = await prisma.compra.findUnique({
    where: { id },
    include: { rollos: { select: { id: true } }, lotes: { select: { id: true } } },
  });
  if (!compra) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });

  const rolloIds = compra.rollos.map((r) => r.id);
  const loteIds = compra.lotes.map((l) => l.id);
  const consumos = await prisma.movimientoInsumo.count({
    where: { tipo: { notIn: ['INGRESO', 'REVERSION'] }, OR: [{ rolloId: { in: rolloIds } }, { loteId: { in: loteIds } }] },
  });
  if (consumos > 0) {
    return NextResponse.json(
      { error: 'Esta compra tiene rollos/lotes ya usados en producción. No se puede borrar; revertila para conservar la traza.' },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.movimientoInsumo.deleteMany({ where: { OR: [{ rolloId: { in: rolloIds } }, { loteId: { in: loteIds } }] } });
    await tx.rollo.deleteMany({ where: { compraId: id } });
    await tx.lote.deleteMany({ where: { compraId: id } });
    await tx.compraLinea.deleteMany({ where: { compraId: id } });
    await tx.compra.delete({ where: { id } });
  });

  revalidatePath('/inventario/compras');
  revalidatePath('/compras');
  revalidatePath('/inventario/rollos');
  return NextResponse.json({ deleted: true });
}
