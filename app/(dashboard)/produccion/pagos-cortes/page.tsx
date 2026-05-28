import { PagosCortesClient } from '@/components/produccion/PagosCortesClient';

export const dynamic = 'force-dynamic';

export default function PagosCortesPage() {
  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Produccion</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Pagos de cortes</h1>
        <p className="text-stone-500 text-sm mt-1">
          Registra pagos masivos a cortadores. Seleccioná los cortes pendientes y agrupalos en un solo pago.
        </p>
      </div>
      <PagosCortesClient />
    </div>
  );
}
