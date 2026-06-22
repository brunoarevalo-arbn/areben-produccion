'use client';

import { useState } from 'react';
import { GastoCompraForm } from '@/components/compras/GastoCompraForm';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { fmtMoney } from '@/lib/format';

interface Gasto {
  id:        string;
  categoria: string;
  tipo:      string;
  marca:     string | null;
  sku:       string | null;
  ordenId:   string | null;
  minutos:   number | null;
  monto:     number;
  concepto:  string | null;
  fecha:     string;
  creadoPor: string;
  tiempoId:  string | null;
  createdAt: string;
}

interface OrdenActiva {
  id:  string;
  sku: string | null;
  descripcion: string | null;
  marca: string;
}

interface Props {
  gastosDesarrollo: Gasto[];
  gastosProduccion: Gasto[];
  ordenes:          OrdenActiva[];
  costoMinuto:      number;
}

// Para gastos auto-derivados de un tiempo (muestras), el monto guardado puede
// estar desactualizado o ser 0 si los costos no estaban configurados al momento
// del registro. Calculamos al vuelo con la tarifa vigente.
function montoEfectivo(g: Gasto, costoMinuto: number): number {
  if (g.tiempoId && g.minutos && g.minutos > 0) {
    return Math.round(g.minutos * costoMinuto);
  }
  return g.monto;
}

type Tab = 'desarrollo' | 'produccion';
type Tipo = 'tela' | 'insumos' | 'periodo';
const TIPOS: Tipo[] = ['tela', 'insumos', 'periodo'];
const MARCAS = ['Zattia', 'Stunned'] as const;

function TotalCards({ gastos, costoMinuto }: { gastos: Gasto[]; costoMinuto: number }) {
  const porTipo = TIPOS.map((t) => ({
    tipo:  t,
    total: gastos.filter((g) => g.tipo === t).reduce((s, g) => s + montoEfectivo(g, costoMinuto), 0),
  }));
  const total = gastos.reduce((s, g) => s + montoEfectivo(g, costoMinuto), 0);

  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {porTipo.map(({ tipo, total: t }) => (
        <div key={tipo} className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs text-stone-400 capitalize mb-1">{tipo}</p>
          <p className="text-lg font-bold text-stone-900">{fmtMoney(t)}</p>
        </div>
      ))}
      <div className="bg-stone-900 rounded-xl p-4">
        <p className="text-xs text-stone-400 mb-1">Total</p>
        <p className="text-lg font-bold text-white">{fmtMoney(total)}</p>
      </div>
    </div>
  );
}

function GastoRow({ gasto, costoMinuto, onDelete }: { gasto: Gasto; costoMinuto: number; onDelete: (id: string) => void }) {
  const monto = montoEfectivo(gasto, costoMinuto);
  const [confirming, setConfirming] = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [error,      setError]      = useState(false);

  const handleDelete = async () => {
    setDeleting(true); setError(false);
    const r = await fetch(`/api/gastos/${gasto.id}`, { method: 'DELETE' });
    if (r.ok) {
      onDelete(gasto.id); // recién acá sacamos la fila de la UI
    } else {
      setError(true); setDeleting(false);
    }
  };

  return (
    <div className="px-4 py-3 flex items-center gap-3 border-t border-stone-100 first:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="default" className="font-bold uppercase tracking-wide">
            {gasto.tipo}
          </Badge>
          {gasto.marca && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${gasto.marca === 'Zattia' ? 'bg-violet-100 text-violet-700' : 'bg-pink-100 text-pink-700'}`}>
              {gasto.marca}
            </span>
          )}
          {gasto.sku && <span className="text-xs font-mono text-stone-600">{gasto.sku}</span>}
          {gasto.tiempoId && <span className="text-xs text-stone-400 italic">auto</span>}
        </div>
        {gasto.concepto && <p className="text-sm text-stone-700 mt-0.5">{gasto.concepto}</p>}
        <p className="text-xs text-stone-400 mt-0.5">{gasto.fecha} · {gasto.creadoPor}{gasto.minutos ? ` · ${gasto.minutos}min` : ''}</p>
      </div>
      <span className="font-bold text-stone-900 tabular-nums shrink-0">{fmtMoney(monto)}</span>
      {error && <span className="text-xs text-red-600 font-semibold shrink-0">No se pudo eliminar</span>}
      {!confirming ? (
        <button onClick={() => setConfirming(true)} className="text-stone-300 hover:text-red-400 text-sm transition shrink-0">×</button>
      ) : (
        <div className="flex gap-1 shrink-0">
          <Button onClick={handleDelete} variant="danger" size="sm" isLoading={deleting}>
            Sí
          </Button>
          <Button onClick={() => setConfirming(false)} variant="secondary" size="sm">No</Button>
        </div>
      )}
    </div>
  );
}

export function GastosClient({ gastosDesarrollo: gd0, gastosProduccion: gp0, costoMinuto }: Props) {
  const [tab,              setTab]              = useState<Tab>('desarrollo');
  const [gastosDesarrollo, setGastosDesarrollo] = useState<Gasto[]>(gd0);
  const [gastosProduccion, setGastosProduccion] = useState<Gasto[]>(gp0);
  const [filtroMarca,      setFiltroMarca]      = useState<string>('todas');

  const onCreado = (raw: unknown) => {
    const g = raw as Gasto;
    if (g.categoria === 'desarrollo') setGastosDesarrollo((prev) => [g, ...prev]);
    else setGastosProduccion((prev) => [g, ...prev]);
  };

  const gastosD = filtroMarca === 'todas'
    ? gastosDesarrollo
    : gastosDesarrollo.filter((g) => g.marca === filtroMarca);

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-7 border-b border-stone-200">
        {(['desarrollo', 'produccion'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition capitalize ${
              tab === t ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400 hover:text-stone-700'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'desarrollo' && (
        <div className="space-y-6">
          {/* Filtro marca */}
          <div className="flex flex-wrap gap-2">
            {['todas', ...MARCAS].map((m) => (
              <button key={m} onClick={() => setFiltroMarca(m)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition capitalize ${
                  filtroMarca === m ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'
                }`}>
                {m}
              </button>
            ))}
          </div>

          <TotalCards gastos={gastosD} costoMinuto={costoMinuto} />

          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            {gastosD.length === 0 && (
              <p className="px-4 py-10 text-center text-stone-400 text-sm">Sin gastos de desarrollo</p>
            )}
            {gastosD.map((g) => (
              <GastoRow key={g.id} gasto={g} costoMinuto={costoMinuto}
                onDelete={(id) => setGastosDesarrollo((prev) => prev.filter((x) => x.id !== id))} />
            ))}
          </div>

          <GastoCompraForm defaultCategoria="desarrollo" onCreado={onCreado} />
        </div>
      )}

      {tab === 'produccion' && (
        <div className="space-y-6">
          <TotalCards gastos={gastosProduccion} costoMinuto={costoMinuto} />

          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            {gastosProduccion.length === 0 && (
              <p className="px-4 py-10 text-center text-stone-400 text-sm">Sin gastos de producción</p>
            )}
            {gastosProduccion.map((g) => (
              <GastoRow key={g.id} gasto={g} costoMinuto={costoMinuto}
                onDelete={(id) => setGastosProduccion((prev) => prev.filter((x) => x.id !== id))} />
            ))}
          </div>

          <GastoCompraForm defaultCategoria="produccion" onCreado={onCreado} />
        </div>
      )}
    </div>
  );
}
