import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { NuevaCompraForm } from '@/components/insumos/NuevaCompraForm';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

const dec = (v: unknown) => { const n = Number(v); return n === 0 ? '' : String(n); };

export default async function EditarCompraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const compra = await prisma.compra.findUnique({
    where: { id },
    include: { lineas: true, rollos: true, lotes: true },
  });
  if (!compra) notFound();

  const bloqueo =
    compra.revertida
      ? 'Esta compra está revertida, no se puede editar.'
      : (await prisma.movimientoInsumo.count({
          where: {
            tipo: { not: 'INGRESO' },
            OR: [
              { rolloId: { in: compra.rollos.map((r) => r.id) } },
              { loteId:  { in: compra.lotes.map((l) => l.id) } },
            ],
          },
        })) > 0
      ? 'Esta compra ya tiene rollos/lotes consumidos (cortes, muestras, etc.). Para corregirla, revertila desde el detalle y volvé a cargarla.'
      : null;

  if (bloqueo) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 mb-4">{bloqueo}</div>
        <Link href={`/inventario/compras/${id}`} className="text-sm text-stone-500 hover:text-stone-800">← Volver al detalle</Link>
      </div>
    );
  }

  const inicial = {
    id: compra.id,
    proveedorId:   compra.proveedorId,
    fecha:         compra.fecha.toISOString().slice(0, 10),
    numeroFactura: compra.numeroFactura ?? '',
    conIva:        compra.conIva,
    totalBruto:    String(Number(compra.totalBruto)),
    costoEnvio:    dec(compra.costoEnvio),
    fleteModo:     compra.fleteModo,
    fletePorcentaje: dec(compra.fletePorcentaje),
    formaPago:     compra.formaPago ?? '',
    estadoPago:    compra.estadoPago,
    montoPagado:   dec(compra.montoPagado),
    fechaPago:     compra.fechaPago ? compra.fechaPago.toISOString().slice(0, 10) : '',
    notas:         compra.notas ?? '',
    lineas: compra.lineas.map((l) => {
      const rollosDeLinea = compra.rollos.filter((r) => r.insumoId === l.insumoId);
      const loteDeLinea   = compra.lotes.find((lo) => lo.insumoId === l.insumoId);
      return {
        insumoId:       l.insumoId,
        colorId:        rollosDeLinea[0]?.colorId ?? loteDeLinea?.colorId ?? '',
        colorProveedor: rollosDeLinea[0]?.colorProveedor ?? loteDeLinea?.colorProveedor ?? '',
        unidad:         l.unidad,
        cantidad:       String(Number(l.cantidad)),
        precioUnitario: String(Number(l.precioUnitario)),
        rollos:         rollosDeLinea.map((r) => ({ pesoInicial: String(Number(r.pesoInicial)), ubicacion: r.ubicacion ?? '' })),
      };
    }),
  };

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        eyebrow="Inventario / Compras"
        title="Editar compra"
        subtitle="Se rehace la compra con los datos corregidos (los rollos se recrean)."
      />
      <NuevaCompraForm inicial={inicial} />
    </div>
  );
}
