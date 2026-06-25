import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAlguno, requireInsumos } from '@/lib/auth';
import { CompraSchema } from '@/lib/validators/insumos';
import { nextCodigoRollo, nextCodigoLote } from '@/lib/insumos/codigos';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await requireAlguno(req, ['insumos', 'gastos']);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const compras = await prisma.compra.findMany({
    include: {
      proveedor: { select: { nombre: true } },
      lineas: { select: { id: true, insumoId: true, cantidad: true, subtotal: true } },
    },
    orderBy: { creadoAt: 'desc' },
  });

  return NextResponse.json(compras);
}

export async function POST(req: NextRequest) {
  const session = await requireInsumos(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const body = await req.json();
  const parsed = CompraSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const data = parsed.data;
  const totalBruto = new Prisma.Decimal(data.totalBruto);
  const totalNeto = data.conIva
    ? totalBruto.div(new Prisma.Decimal('1.21'))
    : totalBruto;

  // Validar suma de subtotales (precios ya son netos) contra totalNeto.
  // Tolerancia 0,5% (piso $50): absorbe el redondeo de compras en USD a tipo de cambio,
  // pero sigue cazando errores reales (ej. una línea olvidada).
  const sumaSubtotales = data.lineas.reduce(
    (sum, l) => sum + l.cantidad * l.precioUnitario,
    0
  );
  const tolerancia = Math.max(50, Number(totalNeto) * 0.005);
  if (Math.abs(sumaSubtotales - Number(totalNeto)) > tolerancia) {
    return NextResponse.json(
      { error: `La suma de subtotales ($${sumaSubtotales.toFixed(2)}) difiere demasiado del total neto ($${Number(totalNeto).toFixed(2)})` },
      { status: 400 }
    );
  }

  // Flete: en pesos (monto) o como % sobre el valor neto de la compra.
  const costoEnvioPesos = data.fleteModo === 'porcentaje'
    ? sumaSubtotales * (data.fletePorcentaje || 0) / 100
    : (data.costoEnvio || 0);

  // Precargar insumos para validar trazabilidad y rollos
  const insumoIds = data.lineas.map((l) => l.insumoId);
  const insumos = await prisma.insumo.findMany({ where: { id: { in: insumoIds } } });
  const insumosMap = new Map(insumos.map((i) => [i.id, i]));

  for (const linea of data.lineas) {
    const insumo = insumosMap.get(linea.insumoId);
    if (!insumo) {
      return NextResponse.json({ error: `Insumo ${linea.insumoId} no encontrado` }, { status: 400 });
    }
    // Fase 2 TODO: al asignar rollo a OP, inferir color del componente COLOR del SKU de la OP
    // matcheando contra SkuCatalogo.abreviatura
    if (insumo.tipoTrazabilidad === 'rollo') {
      if (!linea.rollos || linea.rollos.length === 0) {
        return NextResponse.json({ error: `El insumo "${insumo.nombre}" requiere desglose por rollos` }, { status: 400 });
      }
      const sumaPesos = linea.rollos.reduce((s, r) => s + r.pesoInicial, 0);
      if (Math.abs(sumaPesos - linea.cantidad) > 0.01) {
        return NextResponse.json(
          { error: `La suma de rollos (${sumaPesos}) no coincide con la cantidad de la línea (${linea.cantidad}) para "${insumo.nombre}"` },
          { status: 400 }
        );
      }
    }
  }

  // Precalcular códigos de rollos y lotes necesarios
  let rolloCounter = 0;
  let loteCounter = 0;
  for (const linea of data.lineas) {
    const insumo = insumosMap.get(linea.insumoId)!;
    if (insumo.tipoTrazabilidad === 'rollo' && linea.rollos) {
      rolloCounter += linea.rollos.length;
    } else if (insumo.tipoTrazabilidad === 'lote') {
      loteCounter += 1;
    }
  }

  let nextRollo = await nextCodigoRollo();
  let nextLote = await nextCodigoLote();
  const rolloCodigos: string[] = [];
  const loteCodigos: string[] = [];
  for (let i = 0; i < rolloCounter; i++) {
    rolloCodigos.push(nextRollo);
    const num = parseInt(nextRollo.replace('R-', ''), 10) + 1;
    nextRollo = `R-${String(num).padStart(4, '0')}`;
  }
  for (let i = 0; i < loteCounter; i++) {
    loteCodigos.push(nextLote);
    const num = parseInt(nextLote.replace('L-', ''), 10) + 1;
    nextLote = `L-${String(num).padStart(4, '0')}`;
  }

  // Transacción atómica
  const compra = await prisma.$transaction(async (tx) => {
    const c = await tx.compra.create({
      data: {
        proveedorId:   data.proveedorId,
        fecha:         new Date(data.fecha),
        numeroFactura: data.numeroFactura || null,
        conIva:        data.conIva,
        totalBruto,
        totalNeto,
        costoEnvio:    new Prisma.Decimal(costoEnvioPesos),
        fleteModo:     data.fleteModo,
        fletePorcentaje: data.fleteModo === 'porcentaje' ? new Prisma.Decimal(data.fletePorcentaje || 0) : null,
        formaPago:     data.formaPago || null,
        estadoPago:    data.estadoPago,
        montoPagado:   new Prisma.Decimal(data.montoPagado),
        fechaPago:     data.fechaPago ? new Date(data.fechaPago) : null,
        notas:         data.notas || null,
        creadoPor:     session.nombre,
      },
    });

    let rolloIdx = 0;
    let loteIdx = 0;

    for (const linea of data.lineas) {
      const subtotal = new Prisma.Decimal(linea.cantidad * linea.precioUnitario);
      // Prorrateo del envío por valor de línea → sumado al costo por unidad del rollo/lote.
      const lineaSub     = linea.cantidad * linea.precioUnitario;
      const lineaEnvio   = sumaSubtotales > 0 ? costoEnvioPesos * (lineaSub / sumaSubtotales) : 0;
      const recargoEnvio = linea.cantidad > 0 ? lineaEnvio / linea.cantidad : 0;
      const costoUnitarioNeto = new Prisma.Decimal(linea.precioUnitario + recargoEnvio);

      const compraLinea = await tx.compraLinea.create({
        data: {
          compraId:       c.id,
          insumoId:       linea.insumoId,
          cantidad:       new Prisma.Decimal(linea.cantidad),
          unidad:         linea.unidad,
          precioUnitario: new Prisma.Decimal(linea.precioUnitario),
          subtotal,
        },
      });

      const insumo = insumosMap.get(linea.insumoId)!;

      if (insumo.tipoTrazabilidad === 'rollo' && linea.rollos) {
        for (const r of linea.rollos) {
          const codigo = rolloCodigos[rolloIdx++];
          const peso = new Prisma.Decimal(r.pesoInicial);
          const rollo = await tx.rollo.create({
            data: {
              codigo,
              insumoId:      linea.insumoId,
              colorId: linea.colorId || null,
              colorProveedor: linea.colorProveedor || null,
              compraId:      c.id,
              compraLineaId: compraLinea.id,
              pesoInicial:   peso,
              pesoActual:    peso,
              costoUnitario: costoUnitarioNeto,
              ubicacion:     r.ubicacion || null,
            },
          });
          await tx.movimientoInsumo.create({
            data: {
              tipo:      'INGRESO',
              rolloId:   rollo.id,
              cantidad:  peso,
              motivo:    `Compra ${c.id}`,
              usuarioId: session.id,
            },
          });
        }
      } else if (insumo.tipoTrazabilidad === 'lote') {
        const codigo = loteCodigos[loteIdx++];
        const cant = new Prisma.Decimal(linea.cantidad);
        const lote = await tx.lote.create({
          data: {
            codigo,
            insumoId:        linea.insumoId,
            colorId:         linea.colorId || null,
            colorProveedor:  linea.colorProveedor || null,
            compraId:        c.id,
            compraLineaId:   compraLinea.id,
            cantidadInicial: cant,
            cantidadActual:  cant,
            costoUnitario:   costoUnitarioNeto,
          },
        });
        await tx.movimientoInsumo.create({
          data: {
            tipo:      'INGRESO',
            loteId:    lote.id,
            cantidad:  cant,
            motivo:    `Compra ${c.id}`,
            usuarioId: session.id,
          },
        });
      }
    }

    return tx.compra.findUnique({
      where: { id: c.id },
      include: {
        proveedor: { select: { nombre: true } },
        lineas:    true,
        rollos:    true,
        lotes:     true,
      },
    });
  });

  return NextResponse.json(compra, { status: 201 });
}
