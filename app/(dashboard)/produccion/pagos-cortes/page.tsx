import { PagosCortesClient } from '@/components/produccion/PagosCortesClient';
import { PageHeader } from '@/components/ui/PageHeader';
import { prisma } from '@/lib/prisma';
import { cuentaPorCortador } from '@/lib/produccion/cuenta-cortador';

export const dynamic = 'force-dynamic';

export default async function PagosCortesPage() {
  // El saldo sale del núcleo, igual que en la cuenta corriente y en el panel del cortador:
  // un solo número con un solo nombre en las tres pantallas.
  const [cortadores, cuentas] = await Promise.all([
    prisma.cortador.findMany({ orderBy: { nombre: 'asc' }, select: { id: true, nombre: true, activo: true } }),
    cuentaPorCortador(),
  ]);
  const saldos = cortadores
    .map((c) => ({ id: c.id, nombre: c.nombre, saldo: cuentas.get(c.id)?.saldo ?? 0 }))
    .filter((s) => s.saldo !== 0 || cortadores.find((c) => c.id === s.id)?.activo);

  return (
    <div className="p-8 max-w-6xl">
      <PageHeader
        eyebrow="Producción"
        title="Pagos de cortes"
        subtitle="Registrá pagos a cortadores. Tildar cortes deja la traza de qué cubre el pago; el saldo lo mueve el monto."
      />
      <PagosCortesClient saldos={saldos} />
    </div>
  );
}
