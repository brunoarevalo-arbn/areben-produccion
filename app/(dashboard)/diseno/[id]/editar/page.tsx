import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { FormProducto } from '@/components/diseno/FormProducto';

export const dynamic = 'force-dynamic';

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const producto = await prisma.producto.findUnique({ where: { id } });
  if (!producto) notFound();

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href={`/diseno/${id}`} className="text-sm text-stone-400 hover:text-stone-600 transition">
          ← Volver al producto
        </Link>
        <h1 className="text-2xl font-bold text-stone-900 mt-3">Editar producto</h1>
        <p className="text-stone-500 text-sm mt-1">{producto.nombre}</p>
      </div>

      <FormProducto
        productoId={id}
        inicial={{
          nombre:      producto.nombre,
          descripcion: producto.descripcion ?? '',
          molderia:    producto.molderia    ?? '',
          tela:        producto.tela        ?? '',
          colores:     producto.colores     ?? '',
          costoTela:   producto.costoTela,
          costoMO:     producto.costoMO,
          costoTotal:  producto.costoTotal,
          estado:      producto.estado as 'borrador' | 'activo' | 'archivado',
          marca:       producto.marca       ?? '',
          temporada:   producto.temporada   ?? '',
        }}
      />
    </div>
  );
}
