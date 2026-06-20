import { SinColorClient } from '@/components/insumos/SinColorClient';

export const dynamic = 'force-dynamic';

export default function SinColorPage() {
  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Inventario</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Rollos y Lotes sin color</h1>
        <p className="text-stone-500 text-sm mt-1">
          Insumos que manejan color pero tienen rollos o lotes sin color asignado. Asignalos manualmente.
        </p>
      </div>
      <SinColorClient />
    </div>
  );
}
