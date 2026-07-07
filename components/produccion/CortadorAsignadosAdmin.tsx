'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SkuChip } from '@/components/ui/SkuChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { toast } from '@/components/ui/Toaster';

export interface OpAsignada {
  id: string;
  sku: string | null;
  descripcion: string | null;
  marca: string;
  cantidad: number;
  estado: string;
  fichaCorteCargada: boolean;
  corteEstado: string | null;
  fechaCorte: string | null;
  costoCorte: number;
  precioTotal?: number;
  precioUnidad?: number;
}

const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

// Panel admin de lo asignado a un cortador: asignado (sin cargar), corte listo (a
// validar) y hecho (validado). Reasignar/quitar reusa /asignar-cortador (no toca stock).
export function CortadorAsignadosAdmin({ cortadorId, asignados, listos, hechos, cortadores }: {
  cortadorId: string;
  asignados: OpAsignada[];
  listos: OpAsignada[];
  hechos: OpAsignada[];
  cortadores: { id: string; nombre: string }[];
}) {
  const router = useRouter();

  const cambiar = async (ordenId: string, sku: string, nuevoId: string) => {
    if (nuevoId === cortadorId) return;
    if (!nuevoId && !(await confirmAsync({ message: `¿Quitar ${sku} de este cortador? El corte queda sin cortador asignado.`, danger: true, confirmLabel: 'Quitar' }))) return;
    const r = await fetch(`/api/produccion/cola/${ordenId}/asignar-cortador`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cortadorId: nuevoId || null }),
    });
    if (r.ok) { toast.success(nuevoId ? 'Reasignado' : 'Quitado'); router.refresh(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo'); }
  };

  const validar = async (o: OpAsignada) => {
    const total = o.precioTotal ?? 0;
    const unidad = o.precioUnidad ?? 0;
    if (!(await confirmAsync({
      title: `Validar corte ${o.sku ?? 'S/SKU'}`,
      message: `Cantidad: ${o.cantidad} u\nPrecio: ${fmt$(unidad)}/u  ·  Total: ${fmt$(total)}\n\nQueda cobrable para el cortador. La ficha de tela se puede hacer después.`,
      confirmLabel: 'Validar',
    }))) return;
    const r = await fetch(`/api/produccion/cola/${o.id}/validar-corte`, { method: 'POST' });
    if (r.ok) { toast.success('Corte validado — ya es cobrable'); router.refresh(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo validar'); }
  };

  const selectCortador = (o: OpAsignada) => (
    <select value={cortadorId} onChange={(e) => cambiar(o.id, o.sku ?? 'S/SKU', e.target.value)} title="Reasignar cortador"
      className="text-xs px-1.5 py-1 rounded-lg border border-stone-200 text-stone-600 bg-white cursor-pointer focus:outline-none focus:border-amber-400 max-w-[8rem]">
      {cortadores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      <option value="">— Quitar —</option>
    </select>
  );

  const seccion = (titulo: string, ops: OpAsignada[], render: (o: OpAsignada) => React.ReactNode) => (
    <section>
      <h2 className="text-sm font-bold text-stone-800 mb-3">{titulo} {ops.length > 0 && <span className="text-stone-400">({ops.length})</span>}</h2>
      {ops.length === 0
        ? <EmptyState title="Nada por acá" />
        : <Card padding="none" className="divide-y divide-stone-100">{ops.map(render)}</Card>}
    </section>
  );

  const fila = (o: OpAsignada, right: React.ReactNode, badge?: React.ReactNode) => (
    <div key={o.id} className="flex items-center gap-3 px-5 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/produccion/${o.id}`}><SkuChip sku={o.sku ?? 'S/SKU'} className="text-stone-700 hover:text-amber-600" /></Link>
          <span className="text-xs text-stone-400">{o.marca}</span>
          {badge}
        </div>
        {o.descripcion && <p className="text-sm text-stone-600 mt-1 truncate">{o.descripcion}</p>}
      </div>
      <span className="text-xs text-stone-400 tabular-nums shrink-0">{o.cantidad} u</span>
      {right}
    </div>
  );

  return (
    <div className="space-y-8">
      {seccion('Corte listo — a validar', listos, (o) => fila(o,
        <div className="flex items-center gap-2 shrink-0">
          {selectCortador(o)}
          <button onClick={() => validar(o)} className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold transition">Validar</button>
        </div>,
        <Badge variant="success" size="sm">Corte listo</Badge>,
      ))}

      {seccion('Asignados — sin cargar', asignados, (o) => fila(o,
        <div className="shrink-0">{selectCortador(o)}</div>,
        <Badge variant="info" size="sm">Esperando carga</Badge>,
      ))}

      {seccion('Hechos', hechos, (o) => fila(o,
        <div className="flex items-center gap-3 shrink-0">
          {o.fechaCorte && <span className="text-xs text-stone-400">{new Date(o.fechaCorte).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' })}</span>}
          <span className="text-xs font-semibold text-stone-700 tabular-nums w-20 text-right">{fmt$(o.costoCorte)}</span>
        </div>,
        o.fichaCorteCargada ? undefined : <Badge variant="blue" size="sm">Validado</Badge>,
      ))}
    </div>
  );
}
