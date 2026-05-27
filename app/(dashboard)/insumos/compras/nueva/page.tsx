import { NuevaCompraForm } from '@/components/insumos/NuevaCompraForm';

export const dynamic = 'force-dynamic';

export default function NuevaCompraPage() {
  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Insumos</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Nueva Compra</h1>
        <p className="text-stone-500 text-sm mt-1">Registra una compra con lineas, rollos y lotes.</p>
      </div>
      <NuevaCompraForm />
    </div>
  );
}
