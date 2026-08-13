'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { NumInput } from '@/components/ui/NumInput';
import { toast } from '@/components/ui/Toaster';
import { RetiroTelaModal } from '@/components/muestras/RetiroTelaModal';

interface Movimiento {
  id: string;
  tipo: string;
  cantidad: string;
  motivo: string | null;
  usuarioId: string;
  fecha: string;
  reversionNota: string | null;
}

interface RolloFull {
  id: string;
  codigo: string;
  pesoInicial: string;
  pesoActual: string;
  anchoCm: string | null;
  costoUnitario: string;
  estado: string;
  ubicacion: string | null;
  createdAt: string;
  insumo: { nombre: string; categoria: string; unidadDefault: string; anchoCm: string | null; tubular: boolean | null };
  color: { nombre: string } | null;
  colorProveedor: string | null;
  compra: { id: string; fecha: string; numeroFactura: string | null; proveedor: { nombre: string } };
  movimientos: Movimiento[];
}

const TIPO_COLOR: Record<string, string> = {
  INGRESO:   'bg-emerald-100 text-emerald-700',
  CONSUMO:   'bg-blue-100 text-blue-700',
  AJUSTE:    'bg-amber-100 text-amber-700',
  DESCARTE:  'bg-red-100 text-red-600',
  REVERSION: 'bg-stone-100 text-stone-600',
  MUESTRA:   'bg-violet-100 text-violet-700',
};

const fmt = (n: string | number) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

const AGOTADO = ['AGOTADO', 'DESCARTADO'];

export function RolloDetalle({ rollo }: { rollo: RolloFull }) {
  const router = useRouter();
  const [retirando, setRetirando] = useState(false);
  const fechaFmt = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const valorActual = Number(rollo.pesoActual) * Number(rollo.costoUnitario);
  const puedeRetirar = !AGOTADO.includes(rollo.estado) && Number(rollo.pesoActual) > 0;

  // Ancho: el del rollo pisa al del artículo. Se dice cuál de los dos se está
  // mostrando, porque el tizador corta contra este número.
  const [editandoAncho, setEditandoAncho] = useState(false);
  const [anchoBuf, setAnchoBuf] = useState(rollo.anchoCm != null ? Number(rollo.anchoCm) : 0);
  const [guardandoAncho, setGuardandoAncho] = useState(false);
  const anchoPropio = rollo.anchoCm != null ? Number(rollo.anchoCm) : null;
  const anchoArticulo = rollo.insumo.anchoCm != null ? Number(rollo.insumo.anchoCm) : null;
  const anchoEfectivo = anchoPropio ?? anchoArticulo;

  const guardarAncho = async (valor: number | null) => {
    setGuardandoAncho(true);
    const r = await fetch(`/api/insumos/rollos/${rollo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anchoCm: valor }),
    });
    setGuardandoAncho(false);
    if (r.ok) {
      setEditandoAncho(false);
      router.refresh();
    } else {
      const d = await r.json().catch(() => ({}));
      toast.error(d.error || 'No se pudo guardar el ancho');
    }
  };

  return (
    <div className="space-y-6">
      {puedeRetirar && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => setRetirando(true)}>
            ✂ Retirar para muestra
          </Button>
        </div>
      )}

      {retirando && (
        <RetiroTelaModal rolloId={rollo.id} codigo={rollo.codigo}
          onClose={() => setRetirando(false)} onRegistrado={() => router.refresh()} />
      )}

      <Card padding="none" className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-8 text-sm">
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Codigo</p>
            <p className="text-stone-800 font-mono font-bold text-lg">{rollo.codigo}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Insumo</p>
            <p className="text-stone-800 font-medium">{rollo.insumo.nombre}</p>
            <p className="text-xs text-stone-400">
              {rollo.insumo.categoria}
              {rollo.color
                ? ` · ${rollo.color.nombre}`
                : rollo.colorProveedor
                  ? <span className="italic"> · {rollo.colorProveedor} <span className="text-stone-300">(s/asignar)</span></span>
                  : ''}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Proveedor</p>
            <p className="text-stone-800">{rollo.compra.proveedor.nombre}</p>
            <p className="text-xs text-stone-400">{rollo.compra.numeroFactura || '--'}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Estado</p>
            <p className="text-stone-800">{rollo.estado.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Peso inicial</p>
            <p className="text-stone-800 tabular-nums">{fmt(rollo.pesoInicial)} {rollo.insumo.unidadDefault}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Peso actual</p>
            <p className="text-stone-800 tabular-nums font-bold">{fmt(rollo.pesoActual)} {rollo.insumo.unidadDefault}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Costo unitario</p>
            <p className="text-stone-800 tabular-nums">${fmt(rollo.costoUnitario)} / {rollo.insumo.unidadDefault}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Valor actual</p>
            <p className="text-stone-800 tabular-nums font-bold">${fmt(valorActual)}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-stone-100 grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-8">
          <div className="col-span-2">
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Ancho de tela</p>
            {editandoAncho ? (
              <div className="flex items-center gap-2">
                <NumInput value={anchoBuf} onChange={setAnchoBuf} min="0" step="0.1" placeholder="cm"
                  className="w-24 px-3 py-1.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400" />
                <span className="text-sm text-stone-500">cm</span>
                <Button size="sm" disabled={guardandoAncho} isLoading={guardandoAncho}
                  onClick={() => guardarAncho(anchoBuf > 0 ? anchoBuf : null)} className="px-2.5 py-1 rounded-lg">
                  Guardar
                </Button>
                <Button variant="secondary" size="sm" disabled={guardandoAncho}
                  onClick={() => { setAnchoBuf(anchoPropio ?? 0); setEditandoAncho(false); }} className="px-2.5 py-1 rounded-lg">
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-stone-800 tabular-nums font-medium">
                  {anchoEfectivo != null ? `${fmt(anchoEfectivo)} cm` : '--'}
                  {rollo.insumo.tubular != null && (
                    <span className="text-stone-500 font-normal"> · {rollo.insumo.tubular ? 'tubular' : 'abierta'}</span>
                  )}
                </p>
                <button onClick={() => { setAnchoBuf(anchoPropio ?? anchoArticulo ?? 0); setEditandoAncho(true); }}
                  className="text-xs px-2 py-0.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 transition">
                  {anchoPropio != null ? 'Corregir' : 'Medir este rollo'}
                </button>
              </div>
            )}
            <p className="text-xs text-stone-400 mt-1">
              {anchoPropio != null
                ? <>Medido en este rollo. Vaciá el campo para volver al del artículo{anchoArticulo != null ? ` (${fmt(anchoArticulo)} cm)` : ''}.</>
                : anchoArticulo != null
                  ? 'Del artículo. Si este rollo vino distinto, medilo acá.'
                  : 'Sin cargar, ni en el artículo ni en el rollo.'}
            </p>
          </div>
          {rollo.ubicacion && (
            <div className="col-span-2">
              <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Ubicacion</p>
              <p className="text-sm text-stone-600">{rollo.ubicacion}</p>
            </div>
          )}
        </div>
      </Card>

      <Card padding="none" className="p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-3">Historial de movimientos</h3>
        {rollo.movimientos.length === 0 ? (
          <p className="text-sm text-stone-400">Sin movimientos</p>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-stone-400 uppercase tracking-widest border-b border-stone-100">
                <th className="text-left py-2 font-bold">Fecha</th>
                <th className="text-left py-2 font-bold">Tipo</th>
                <th className="text-right py-2 font-bold">Cantidad</th>
                <th className="text-left py-2 font-bold">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {rollo.movimientos.map((m) => (
                <tr key={m.id} className="border-b border-stone-50">
                  <td className="py-3 text-xs text-stone-500 whitespace-nowrap">{fechaFmt(m.fecha)}</td>
                  <td className="py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TIPO_COLOR[m.tipo] || ''}`}>
                      {m.tipo}
                    </span>
                  </td>
                  <td className={`py-3 text-right tabular-nums font-semibold ${Number(m.cantidad) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {Number(m.cantidad) >= 0 ? '+' : ''}{fmt(m.cantidad)}
                  </td>
                  <td className="py-3 text-xs text-stone-600">{m.motivo || m.reversionNota || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}
