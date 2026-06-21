import { CuentasPorPagarClient } from '@/components/compras/CuentasPorPagarClient';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function CuentasPorPagarPage() {
  return (
    <div className="p-8 max-w-4xl">
      <PageHeader eyebrow="Compras" title="Cuentas por pagar" subtitle="Lo que le debés a cada proveedor (compras de insumos + gastos pendientes/parciales)." />
      <CuentasPorPagarClient />
    </div>
  );
}
