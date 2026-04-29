'use client';

import { useState, useEffect } from 'react';
import { Productividad } from '@/components/costos/Productividad';
import { Parametros }    from '@/components/costos/Parametros';
import { Escandallos }   from '@/components/costos/Escandallos';

type Tab = 'productividad' | 'parametros' | 'escandallos';

const TABS: { id: Tab; label: string }[] = [
  { id: 'productividad', label: 'Productividad' },
  { id: 'parametros',    label: 'Parámetros de costo' },
  { id: 'escandallos',   label: 'Escandallos' },
];

export default function CostosPage() {
  const [tab, setTab] = useState<Tab>('productividad');
  const [costoMinuto, setCostoMinuto] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch('/api/costos/gastos').then((r) => r.json()),
      fetch('/api/costos/costureras').then((r) => r.json()),
    ]).then(([gastos, { costureras }]) => {
      const totalGastos   = gastos.filter((g: { activo: boolean; monto: number }) => g.activo).reduce((s: number, g: { monto: number }) => s + g.monto, 0);
      const totalCosturas = costureras.reduce((s: number, c: { sueldoBruto: number; cargasSociales: number }) => s + c.sueldoBruto + c.cargasSociales, 0);
      const totalHoras    = costureras.reduce((s: number, c: { horasMes: number }) => s + c.horasMes, 0);
      const valorHora     = totalHoras > 0 ? (totalGastos + totalCosturas) / totalHoras : 0;
      setCostoMinuto(valorHora / 60);
    }).catch(() => {});
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">Módulo 3</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Costos de Producción</h1>
        <p className="text-stone-500 text-sm mt-1">Productividad, parámetros y escandallos del taller.</p>
      </div>

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

      {tab === 'productividad' && <Productividad />}
      {tab === 'parametros'    && <Parametros />}
      {tab === 'escandallos'   && <Escandallos costoMinuto={costoMinuto} />}
    </div>
  );
}
