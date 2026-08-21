import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { CargaCorteForm } from '@/components/produccion/cortador/CargaCorteForm';
import { prefillDeOrden, hermanasConTizadas } from '@/lib/produccion/cargaCorte';

export const dynamic = 'force-dynamic';

export default async function CortadorCargaPage({ params }: { params: Promise<{ ordenId: string }> }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect('/login');

  const { ordenId } = await params;
  const cortador = await prisma.cortador.findFirst({ where: { usuarioId: session.id } });
  if (!cortador) redirect('/cortador');

  const orden = await prisma.ordenProduccion.findUnique({
    where: { id: ordenId },
    select: { id: true, sku: true, descripcion: true, marca: true, cantidad: true, cortadorId: true, fichaCorteCargada: true, corteEstado: true, fichaCorteData: true, loteId: true },
  });
  if (!orden || orden.cortadorId !== cortador.id) notFound();

  // Al editar (corteEstado 'cargado'), reabrir lo ya guardado en fichaCorteData. El
  // cortador NO reabre lo que el taller ya validó: eso lo corrige el taller.
  const prefill = prefillDeOrden(orden, { estados: ['cargado'] });
  const hermanas = orden.fichaCorteCargada ? [] : await hermanasConTizadas(orden.loteId, orden.id);

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/cortador" className="text-sm text-stone-500 hover:text-stone-800 transition">← Mis cortes</Link>
      <PageHeader
        eyebrow="Cortador / Cargar corte"
        title={orden.sku ?? 'S/SKU'}
        subtitle={orden.descripcion || orden.marca}
      />
      {orden.fichaCorteCargada ? (
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 text-sm text-stone-500">Este corte ya fue procesado por el taller.</div>
      ) : (
        <>
          <p className="text-sm text-stone-500 mb-4">Cargá tizadas, talles y precio, y confirmá. La tela la asigna el taller.</p>
          <CargaCorteForm ordenId={orden.id} cantidadPlanificada={orden.cantidad} prefill={prefill} hermanas={hermanas} />
        </>
      )}
    </div>
  );
}
