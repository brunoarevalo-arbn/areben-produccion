'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { NuevaCompraForm } from '@/components/insumos/NuevaCompraForm';
import { GastoCompraForm } from '@/components/compras/GastoCompraForm';

export default function NuevaCompraPage() {
  const router = useRouter();
  const [tipo, setTipo] = useState<'insumos' | 'gasto'>('insumos');

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Compras</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Nueva compra</h1>
        <p className="text-stone-500 text-sm mt-1">Elegí qué tipo de compra estás registrando.</p>
      </div>

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
