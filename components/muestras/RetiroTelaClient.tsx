'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { RetiroTelaForm, fmt, colorRollo } from './RetiroTelaForm';
import { MARCAS } from '@/lib/marcas';

interface Retiro {
  id: string;
  cantidad: string;
  motivo: string | null;
  marca: string | null;
  fecha: string;
  rollo: { codigo: string; colorProveedor: string | null; insumo: { nombre: string; rinde: string | null } | null; color: { nombre: string } | null } | null;
  proyecto: { id: string; nombre: string } | null;
  // Solo viene si la sesión tiene el permiso `gastos`: quien registra no ve plata.
  costo?: number | null;
}

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
const pesos = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

// El movimiento se guarda en kg (negativo); el rinde lo devuelve a metros.
const metros = (m: Retiro) => {
  const rinde = Number(m.rollo?.insumo?.rinde);
  const kg = Math.abs(Number(m.cantidad));
  return rinde > 0 ? `${fmt(kg * rinde)} m` : `${fmt(kg)} kg`;
};

const mismoMes = (iso: string) => {
  const d = new Date(iso), hoy = new Date();
  return d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
};

export function RetiroTelaClient() {
  const [retiros, setRetiros] = useState<Retiro[]>([]);
  // Lo decide el backend (permiso `gastos`), no el cliente: quien registra no ve plata.
  const [veCosto, setVeCosto] = useState(false);
  const [filtroMarca, setFiltroMarca] = useState('');

  const cargar = useCallback(() => {
    fetch('/api/produccion/muestras')
      .then((r) => r.ok ? r.json() : { veCosto: false, retiros: [] })
      .then((d: { veCosto: boolean; retiros: Retiro[] }) => { setVeCosto(d.veCosto); setRetiros(d.retiros ?? []); })
      .catch(() => {});
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const visibles = filtroMarca ? retiros.filter((r) => r.marca === filtroMarca) : retiros;

  const delMes = useMemo(() => {
    const mes = retiros.filter((r) => mismoMes(r.fecha));
    return { total: mes.reduce((a, r) => a + (r.costo ?? 0), 0), cantidad: mes.length };
  }, [retiros]);

  const nombreMes = new Date().toLocaleDateString('es-AR', { month: 'long' });

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <h3 className="text-sm font-bold text-stone-800">Registrar un retiro</h3>
        <RetiroTelaForm onRegistrado={cargar} />
      </Card>

      {veCosto && (
        <Card className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Retiros de {nombreMes}</p>
            <p className="text-xs text-stone-400 mt-1">
              {delMes.cantidad === 1 ? '1 retiro' : `${delMes.cantidad} retiros`} · va a Gastos como desarrollo / tela
            </p>
          </div>
          <p className="text-2xl font-black text-stone-800 tabular-nums">{pesos(delMes.total)}</p>
        </Card>
      )}

      <div className="flex gap-2 items-center flex-wrap">
        {[{ v: '', l: 'Todas' }, ...MARCAS.map((m) => ({ v: m as string, l: m as string }))].map(({ v, l }) => (
          <button key={v} onClick={() => setFiltroMarca(v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              filtroMarca === v ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'
            }`}>
            {l}
          </button>
        ))}
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto"><div className={veCosto ? 'min-w-[720px]' : 'min-w-[620px]'}>
          <div className={`px-5 py-3 bg-stone-50 border-b border-stone-100 grid gap-4 text-xs font-bold uppercase tracking-widest text-stone-400 ${
            veCosto ? 'grid-cols-[auto_1fr_auto_auto_1fr_auto_auto]' : 'grid-cols-[auto_1fr_auto_auto_1fr_auto]'}`}>
            <span>Fecha</span>
            <span>Tela / color</span>
            <span className="text-right">Metros</span>
            <span>Marca</span>
            <span>Proyecto / nota</span>
            {veCosto && <span className="text-right">Costo</span>}
            <span>Rollo</span>
          </div>

          {visibles.length === 0 ? (
            <EmptyState message="Sin retiros registrados todavía." />
          ) : visibles.map((m, i) => (
            <div key={m.id} className={`px-5 py-3 grid gap-4 items-center ${i > 0 ? 'border-t border-stone-100' : ''} ${
              veCosto ? 'grid-cols-[auto_1fr_auto_auto_1fr_auto_auto]' : 'grid-cols-[auto_1fr_auto_auto_1fr_auto]'}`}>
              <span className="text-xs text-stone-500 whitespace-nowrap">{fechaCorta(m.fecha)}</span>
              <span className="text-sm text-stone-800 truncate">
                {m.rollo?.insumo?.nombre ?? '—'}
                {m.rollo && <span className="text-stone-400"> · {colorRollo(m.rollo)}</span>}
              </span>
              <span className="text-sm tabular-nums text-right text-stone-700 whitespace-nowrap">{metros(m)}</span>
              <span className="text-xs text-stone-600 whitespace-nowrap">{m.marca ?? <span className="text-stone-300">—</span>}</span>
              <span className="text-sm text-stone-600 truncate">
                {m.proyecto?.nombre ?? m.motivo ?? <span className="text-stone-300">—</span>}
              </span>
              {veCosto && (
                <span className="text-sm tabular-nums text-right text-stone-700 whitespace-nowrap">
                  {m.costo == null ? '—' : pesos(m.costo)}
                </span>
              )}
              <span className="font-mono text-xs text-stone-500">{m.rollo?.codigo ?? '—'}</span>
            </div>
          ))}
        </div></div>
      </Card>
    </div>
  );
}
