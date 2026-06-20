import { RollosClient } from '@/components/insumos/RollosClient';

export const dynamic = 'force-dynamic';

export default function RollosPage() {
  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Inventario</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Rollos</h1>
        <p className="text-stone-500 text-sm mt-1">Vista plana de todos los rollos con su peso y costo.</p>
      </div>
      <RollosClient />
    </div>
  );
}
