'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParamState, useVolverA } from '@/lib/hooks/useParamState';
import Link from 'next/link';
import { LoadingState } from '@/components/ui/LoadingState';
import { NumInput } from '@/components/ui/NumInput';
import { toast } from '@/components/ui/Toaster';
import { Card } from '@/components/ui/Card';
import { PopoverMenu } from '@/components/ui/PopoverMenu';
import { RetiroTelaModal } from '@/components/muestras/RetiroTelaModal';

interface Rollo {
  id: string;
  codigo: string;
  pesoInicial: string;
  pesoActual: string;
  costoUnitario: string;
  estado: string;
  ubicacion: string | null;
  createdAt: string;
  insumo: { nombre: string; categoria: string; unidadDefault: string };
  color: { id: string; nombre: string } | null;
  colorProveedor: string | null;
  moneda: string;
  compra: { id: string; fecha: string; proveedor: { nombre: string } };
}

const colorSelect = 'text-sm text-stone-700 bg-transparent border border-transparent hover:border-stone-200 rounded-lg px-1.5 py-1 -ml-1.5 focus:outline-none focus:border-amber-400 cursor-pointer max-w-[9rem]';

const ESTADO_COLOR: Record<string, string> = {
  DISPONIBLE:      'bg-emerald-100 text-emerald-700',
  EN_USO_PARCIAL:  'bg-amber-100 text-amber-700',
  AGOTADO:         'bg-stone-100 text-stone-500',
  DESCARTADO:      'bg-red-100 text-red-600',
};

const ESTADO_LABEL: Record<string, string> = {
  '': 'Activos', DISPONIBLE: 'Disponible', EN_USO_PARCIAL: 'En uso parcial',
  AGOTADO: 'Agotado', DESCARTADO: 'Descartados (revertidos)',
};

const fmt = (n: string | number) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

// Solo tiene sentido retirar de un rollo que todavía tiene tela.
const puedeRetirar = (r: Rollo) =>
  r.estado !== 'AGOTADO' && r.estado !== 'DESCARTADO' && Number(r.pesoActual) > 0;

export function RollosClient() {
  const [rollos, setRollos]   = useState<Rollo[]>([]);
  const [loading, setLoading] = useState(true);
  // En la URL: el filtro además dispara el fetch, así que al volver de un rollo la lista
  // se recargaba entera y sin filtrar.
  const [filtroEstado, setFiltroEstado] = useParamState('estado', '');
  const volverA = useVolverA();
  const [colores, setColores] = useState<{ id: string; nombre: string }[]>([]);
  const [savingColor, setSavingColor] = useState<Record<string, boolean>>({});
  const [revaluando, setRevaluando] = useState(false);
  const [tc, setTc] = useState('');
  const [revalSaving, setRevalSaving] = useState(false);
  const [retiro, setRetiro] = useState<Rollo | null>(null);

  const recargar = useCallback(() => {
    const params = filtroEstado ? `?estado=${filtroEstado}` : '';
    fetch(`/api/insumos/rollos${params}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setRollos)
      .finally(() => setLoading(false));
  }, [filtroEstado]);

  useEffect(() => { recargar(); }, [recargar]);

  useEffect(() => {
    fetch('/api/sku-catalogo?categoria=color').then((r) => r.ok ? r.json() : []).then(setColores).catch(() => {});
  }, []);

  // Cambiar (o asignar) el color interno de un rollo desde la misma lista.
  const cambiarColor = async (rolloId: string, colorId: string) => {
    setSavingColor((p) => ({ ...p, [rolloId]: true }));
    const r = await fetch(`/api/insumos/rollos/${rolloId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colorId: colorId || null }),
    });
    if (r.ok) {
      const col = colores.find((c) => c.id === colorId) || null;
      setRollos((prev) => prev.map((x) => x.id === rolloId ? { ...x, color: col } : x));
    } else {
      toast.error('No se pudo cambiar el color');
    }
    setSavingColor((p) => ({ ...p, [rolloId]: false }));
  };

  // Revaluar a un TC nuevo el costo en pesos de las telas en USD con stock.
  const hayUsd = rollos.some((r) => r.moneda === 'USD');
  const revaluar = async () => {
    const n = parseFloat(tc);
    if (!n || n <= 0) { toast.error('Ingresá un tipo de cambio válido'); return; }
    setRevalSaving(true);
    const r = await fetch('/api/insumos/rollos/revaluar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipoCambio: n }),
    });
    if (r.ok) {
      const d = await r.json();
      toast.success(`Revaluados ${d.rollos} rollo(s)${d.lotes ? ` y ${d.lotes} lote(s)` : ''} a TC ${n}`);
      setRevaluando(false); setTc('');
      recargar();
    } else {
      const d = await r.json().catch(() => ({}));
      toast.error(d.error || 'No se pudo revaluar');
    }
    setRevalSaving(false);
  };

  const sinColor = rollos.filter((r) => !r.color && r.estado !== 'DESCARTADO').length;
  // "Activos" (filtro vacío) esconde los descartados (de compras revertidas).
  // Para verlos está el botón "Descartados".
  const visibles = filtroEstado === '' ? rollos.filter((r) => r.estado !== 'DESCARTADO') : rollos;

  return (
    <div className="space-y-5">
      {retiro && (
        <RetiroTelaModal rolloId={retiro.id} codigo={retiro.codigo}
          onClose={() => setRetiro(null)} onRegistrado={recargar} />
      )}

      <div className="flex gap-2 items-center flex-wrap">
        {['', 'DISPONIBLE', 'EN_USO_PARCIAL', 'AGOTADO', 'DESCARTADO'].map((e) => (
          <button key={e} onClick={() => { setLoading(true); setFiltroEstado(e); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${filtroEstado === e ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'}`}>
            {ESTADO_LABEL[e] ?? e.replace(/_/g, ' ')}
          </button>
        ))}
        {hayUsd && (
          <div className="ml-auto flex items-center gap-2">
            {revaluando ? (
              <>
                <span className="text-xs text-stone-500">TC actual $</span>
                <NumInput value={parseFloat(tc) || 0} onChange={(n) => setTc(n ? String(n) : '')}
                  min="0" step="0.01" placeholder="1481.79"
                  className="w-28 px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400" />
                <button onClick={revaluar} disabled={revalSaving}
                  className="text-xs px-3 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-50 font-semibold transition">
                  {revalSaving ? '...' : 'Aplicar'}
                </button>
                <button onClick={() => { setRevaluando(false); setTc(''); }} className="text-xs text-stone-400 hover:text-stone-600">Cancelar</button>
              </>
            ) : (
              <button onClick={() => setRevaluando(true)}
                className="text-xs px-3 py-1.5 rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-semibold transition">
                💵 Revaluar dólar
              </button>
            )}
          </div>
        )}
      </div>

      {sinColor > 0 && (
        <Link href="/inventario/rollos/sin-color"
          className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800 hover:bg-amber-100 transition">
          🎨 {sinColor} {sinColor === 1 ? 'rollo' : 'rollos'} sin color interno asignado —
          <span className="font-semibold underline">asignar color</span>
        </Link>
      )}

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto"><div className="min-w-[840px]">
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto] gap-4 text-xs font-bold uppercase tracking-widest text-stone-400">
          <span>Codigo</span>
          <span>Insumo</span>
          <span>Color</span>
          <span>Proveedor</span>
          <span className="text-right">Peso</span>
          <span className="text-right">$/u</span>
          <span>Estado</span>
          <span />
        </div>

        {loading ? (
          <LoadingState />
        ) : visibles.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-10">Sin rollos</p>
        ) : (
          visibles.map((r, i) => (
            <div key={r.id}
              className={`px-5 py-3 grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto] gap-4 items-center ${i > 0 ? 'border-t border-stone-100' : ''}`}>
              <span className="font-mono font-semibold text-sm text-stone-700">{r.codigo}</span>
              <div className="min-w-0">
                <p className="text-sm text-stone-800 truncate">{r.insumo.nombre}</p>
                <p className="text-xs text-stone-400">{r.insumo.categoria}</p>
              </div>
              <select value={r.color?.id ?? ''} disabled={savingColor[r.id]}
                onChange={(e) => cambiarColor(r.id, e.target.value)}
                aria-label={`Color interno de ${r.codigo}`}
                className={`${colorSelect} ${r.color ? '' : 'text-amber-500 italic'}`}>
                <option value="">sin asignar</option>
                {colores.map((c) => <option key={c.id} value={c.id} className="text-stone-700 not-italic">{c.nombre}</option>)}
              </select>
              <span className="text-xs text-stone-500 whitespace-nowrap">{r.compra.proveedor.nombre}</span>
              <span className="text-sm tabular-nums text-right text-stone-700">
                {fmt(r.pesoActual)} / {fmt(r.pesoInicial)}
              </span>
              <span className="text-xs tabular-nums text-right text-stone-500">${fmt(r.costoUnitario)}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${ESTADO_COLOR[r.estado] || ''}`}>
                {r.estado.replace(/_/g, ' ')}
              </span>
              <div className="flex items-center gap-1.5">
                <Link href={`/inventario/rollos/${r.id}?volverA=${encodeURIComponent(volverA)}`}
                  className="text-xs px-2.5 py-1 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition">
                  Ver
                </Link>
                {puedeRetirar(r) && (
                  <PopoverMenu items={[{ label: '✂ Retirar para muestra', onClick: () => setRetiro(r) }]} />
                )}
              </div>
            </div>
          ))
        )}
        </div></div>
      </Card>
    </div>
  );
}
