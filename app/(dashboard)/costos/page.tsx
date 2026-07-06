'use client';

import { useState } from 'react';
import { Parametros }  from '@/components/costos/Parametros';
import { Escandallos } from '@/components/costos/Escandallos';
import { CatalogosCosto } from '@/components/costos/CatalogosCosto';
import { PageHeader } from '@/components/ui/PageHeader';

type Tab = 'parametros' | 'escandallos' | 'catalogos';

const TABS: { id: Tab; label: string }[] = [
  { id: 'parametros',  label: 'Parámetros de costo' },
  { id: 'escandallos', label: 'Escandallos' },
  { id: 'catalogos',   label: 'Catálogos' },
];

export default function CostosPage() {
  const [tab, setTab] = useState<Tab>('escandallos');

  return (
    <div className="p-8">
      <PageHeader eyebrow="Costos" title="Costos de Producción" subtitle="Parámetros y escandallos del taller." />

      {/* Tabs */}
      <div className="flex gap-2 mb-7 border-b border-stone-200 pb-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === t.id
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-400 hover:text-stone-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'parametros'  && <Parametros />}
      {tab === 'escandallos' && <Escandallos />}
      {tab === 'catalogos'   && <CatalogosCosto />}
    </div>
  );
}
