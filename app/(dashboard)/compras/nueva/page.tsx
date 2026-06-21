'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { NuevaCompraForm } from '@/components/insumos/NuevaCompraForm';
import { GastoCompraForm } from '@/components/compras/GastoCompraForm';
import { PageHeader } from '@/components/ui/PageHeader';

export default function NuevaCompraPage() {
  const router = useRouter();
  const [tipo, setTipo] = useState<'insumos' | 'gasto'>('insumos');

  return (
    <div className="p-8 max-w-5xl">
      <PageHeader eyebrow="Compras" title="Nueva compra" subtitle="Elegí qué tipo de compra estás registrando." />

      <div className="flex gap-2 mb-6 max-w-lg">
        <button type="button" onClick={() => setTipo('insumos')}
          className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold border transition text-left ${tipo === 'insumos' ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'}`}>
          Compra de insumos
          <span className={`block text-xs font-normal mt-0.5 ${tipo === 'insumos' ? 'text-stone-300' : 'text-stone-400'}`}>Genera stock (rollos/lotes)</span>
        </button>
        <button type="button" onClick={() => setTipo('gasto')}
          className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold border transition text-left ${tipo === 'gasto' ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'}`}>
          Gasto / compra sin stock
          <span className={`block text-xs font-normal mt-0.5 ${tipo === 'gasto' ? 'text-stone-300' : 'text-stone-400'}`}>Desarrollo, servicios, otros</span>
        </button>
      </div>

      {tipo === 'insumos'
        ? <NuevaCompraForm />
        : <GastoCompraForm onCreado={() => router.push('/compras')} />}
    </div>
  );
}
