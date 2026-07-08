import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { SolicitudesCambioClient } from '@/components/produccion/SolicitudesCambioClient';

export const dynamic = 'force-dynamic';

export default async function SolicitudesCambioPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect('/login');
  if (session.rol !== 'admin') redirect('/dashboard');

  const raw = await prisma.solicitudCambioTiempo.findMany({
    where: { estado: 'pendiente' },
    include: { tiempo: { select: { usuario: true, actividad: true, fecha: true, minutosNetos: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const solicitudes = raw.map((s) => ({
    id: s.id,
    solicitadaPor: s.solicitadaPor,
    skuAnterior: s.skuAnterior, maquinaAnterior: s.maquinaAnterior,
    skuNuevo: s.skuNuevo, maquinaNueva: s.maquinaNueva,
    usuario: s.tiempo.usuario, actividad: s.tiempo.actividad, fecha: s.tiempo.fecha, minutos: s.tiempo.minutosNetos,
  }));

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <PageHeader eyebrow="Producción" title="Solicitudes de cambio" subtitle="Correcciones de SKU/máquina que piden las costureras. Aprobalas o rechazalas." />
      <SolicitudesCambioClient inicial={solicitudes} />
    </div>
  );
}
