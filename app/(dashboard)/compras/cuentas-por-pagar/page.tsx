import { CuentasPorPagarClient } from '@/components/compras/CuentasPorPagarClient';

export const dynamic = 'force-dynamic';

export default function CuentasPorPagarPage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Compras</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Cuentas por pagar</h1>
        <p className="text-stone-500 text-sm mt-1">Lo que le debés a cada proveedor (compras de insumos + gastos pendientes/parciales).</p>
      </div>
      <CuentasPorPagarClient />
    </div>
  );
}
