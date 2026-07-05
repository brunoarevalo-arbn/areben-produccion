'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { toast } from '@/components/ui/Toaster';

interface Corte { id: string; sku: string | null; costoCorte: number; fecha: string | null }
interface Muestra { id: string; descripcion: string; valor: number; fecha: string }

const inp = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';
const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' });

// Registrar pago de todo lo pendiente de un cortador (pre-selecciona cortes + muestras;
// se pueden deseleccionar). Reusa el POST de pagos-cortes.
export function RegistrarPagoCortador({ cortadorNombre, cortes, muestras }: { cortadorNombre: string; cortes: Corte[]; muestras: Muestra[] }) {
  const router = useRouter();
  const [selCortes, setSelCortes] = useState<Set<string>>(new Set(cortes.map((c) => c.id)));
  const [selMuestras, setSelMuestras] = useState<Set<string>>(new Set(muestras.map((m) => m.id)));
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    set((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const total = cortes.filter((c) => selCortes.has(c.id)).reduce((s, c) => s + c.costoCorte, 0)
    + muestras.filter((m) => selMuestras.has(m.id)).reduce((s, m) => s + m.valor, 0);
  const n = selCortes.size + selMuestras.size;

  const pagar = async () => {
    if (n === 0) { toast.error('Seleccioná al menos un ítem'); return; }
    setSaving(true);
    const r = await fetch('/api/produccion/pagos-cortes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, beneficiario: cortadorNombre, ordenIds: [...selCortes], muestraIds: [...selMuestras], notas: notas || undefined }),
    });
    if (r.ok) { toast.success(`Pago registrado (${fmt$(total)})`); router.refresh(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo registrar el pago'); }
    setSaving(false);
  };

  if (cortes.length === 0 && muestras.length === 0) {
    return <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-sm text-emerald-800">Sin saldo pendiente. ✓</div>;
  }

  return (
    <Card padding="none" className="p-5 space-y-4">
      <div className="space-y-1.5">
        {cortes.map((c) => (
          <label key={c.id} className="flex items-center gap-3 text-sm cursor-pointer">
            <input type="checkbox" checked={selCortes.has(c.id)} onChange={() => toggle(setSelCortes, c.id)} className="rounded border-stone-300 accent-amber-500" />
            <span className="font-mono text-xs bg-stone-100 px-2 py-0.5 rounded text-stone-700">{c.sku ?? 'S/SKU'}</span>
            <span className="text-xs text-stone-400 flex-1">corte{c.fecha ? ` · ${fechaCorta(c.fecha)}` : ''}</span>
            <span className="tabular-nums font-semibold text-stone-700">{fmt$(c.costoCorte)}</span>
          </label>
        ))}
        {muestras.map((m) => (
          <label key={m.id} className="flex items-center gap-3 text-sm cursor-pointer">
            <input type="checkbox" checked={selMuestras.has(m.id)} onChange={() => toggle(setSelMuestras, m.id)} className="rounded border-stone-300 accent-amber-500" />
            <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded">muestra</span>
            <span className="text-xs text-stone-500 flex-1 truncate">{m.descripcion} · {fechaCorta(m.fecha)}</span>
            <span className="tabular-nums font-semibold text-stone-700">{fmt$(m.valor)}</span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 border-t border-stone-100 pt-4">
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1 block">Fecha del pago</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inp} />
        </div>
        <div className="flex-1 min-w-[10rem]">
          <label className="text-xs font-semibold text-stone-600 mb-1 block">Nota (opcional)</label>
          <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Comprobante, referencia…" className={`${inp} w-full`} />
        </div>
        <Button variant="primary" onClick={pagar} isLoading={saving} disabled={n === 0}>Registrar pago de {fmt$(total)}</Button>
      </div>
    </Card>
  );
}
