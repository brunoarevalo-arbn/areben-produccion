'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TALLES_DEFAULT } from '@/lib/validators/produccion';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';

interface OrdenLite {
  id: string; sku: string | null; descripcion: string | null; cantidad: number;
  cortes: { talle: string; cantidad: number }[];
}
interface Fila { talle: string; cantidad: string; }

const inpSm = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';

// Prellena las filas de cada color desde su ficha de corte (talles cortados), editable.
function filasIniciales(o: OrdenLite): Fila[] {
  if (o.cortes.length > 0) return o.cortes.map((c) => ({ talle: c.talle, cantidad: String(c.cantidad) }));
  return [{ talle: '', cantidad: '' }];
}

export function TerminarLoteForm({ loteId, ordenes }: { loteId: string; ordenes: OrdenLite[] }) {
  const router = useRouter();
  const [conteo, setConteo] = useState<Record<string, Fila[]>>(
    () => Object.fromEntries(ordenes.map((o) => [o.id, filasIniciales(o)])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setFila = (ordenId: string, i: number, field: 'talle' | 'cantidad', val: string) =>
    setConteo((p) => ({ ...p, [ordenId]: p[ordenId].map((f, idx) => idx === i ? { ...f, [field]: val } : f) }));
  const addFila = (ordenId: string) =>
    setConteo((p) => ({ ...p, [ordenId]: [...p[ordenId], { talle: '', cantidad: '' }] }));
  const rmFila = (ordenId: string, i: number) =>
    setConteo((p) => ({ ...p, [ordenId]: p[ordenId].filter((_, idx) => idx !== i) }));

  const totalColor = (ordenId: string) =>
    (conteo[ordenId] || []).reduce((s, f) => s + (parseInt(f.cantidad) || 0), 0);

  const colores = ordenes.map((o) => ({ orden: o, total: totalColor(o.id) }));
  const completos = colores.filter((c) => c.total > 0);
  const totalGeneral = completos.reduce((s, c) => s + c.total, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (completos.length === 0) { setError('Cargá la cantidad que salió de al menos un color'); return; }

    const payload = completos.map(({ orden }) => ({
      ordenId: orden.id,
      talles: (conteo[orden.id] || [])
        .filter((f) => f.talle.trim() && (parseInt(f.cantidad) || 0) > 0)
        .map((f) => ({ talle: f.talle.trim().toUpperCase(), cantidad: parseInt(f.cantidad) })),
    }));
    // Un color marcado como "completo" pero sin talle nombrado no debe pasar
    if (payload.some((c) => c.talles.length === 0)) { setError('Cada color cargado necesita talle y cantidad'); return; }

    setSaving(true);
    const r = await fetch(`/api/produccion/lote/${loteId}/terminar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colores: payload }),
    });
    if (r.ok) {
      router.back(); // volver al contexto anterior (no saltar a la portada)
    } else {
      const d = await r.json().catch(() => ({}));
      setError(d.error || 'Error al terminar');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-sm text-stone-500">
        Cargá lo que realmente salió de costura por color y talle (prellenado desde el corte). Ingresa al stock de
        terminados y descuenta los avíos. Los colores sin conteo se saltan y siguen en costura.
      </p>

      {colores.map(({ orden, total }) => {
        const filas = conteo[orden.id] || [];
        return (
          <div key={orden.id} className={`bg-white rounded-2xl border p-6 ${total > 0 ? 'border-emerald-200' : 'border-stone-200'}`}>
            <div className="flex items-center gap-2 mb-4">
              <span className="font-mono font-bold text-sm px-2 py-1 rounded-lg bg-stone-100 text-stone-700">{orden.sku ?? 'S/SKU'}</span>
              {orden.descripcion && <span className="text-sm text-stone-500 truncate">{orden.descripcion}</span>}
              <span className="ml-auto text-xs text-stone-400">Cortadas: {orden.cantidad}</span>
            </div>

            <div className="space-y-2">
              {filas.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={f.talle} onChange={(e) => setFila(orden.id, i, 'talle', e.target.value)} className={`${inpSm} w-32`}>
                    <option value="">Talle…</option>
                    {TALLES_DEFAULT.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <NumInput value={parseFloat(f.cantidad) || 0} onChange={(n) => setFila(orden.id, i, 'cantidad', n ? String(n) : '')}
                    min="0" placeholder="Cantidad" className={`${inpSm} w-28`} />
                  {filas.length > 1 && (
                    <button type="button" aria-label="Quitar talle" onClick={() => rmFila(orden.id, i)}
                      className="text-stone-400 hover:text-red-500 px-1 text-lg leading-none">×</button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button type="button" onClick={() => addFila(orden.id)} className="text-xs text-amber-600 hover:text-amber-700 font-semibold">+ Agregar talle</button>
              <span className="text-xs">
                <span className="text-stone-500">Total: </span><strong className="text-stone-800">{total}</strong>
                {total === 0 && <span className="text-stone-400 ml-2">· se salta</span>}
              </span>
            </div>
          </div>
        );
      })}

      <div className="bg-stone-50 rounded-2xl border border-stone-200 p-6 flex items-center gap-8 text-sm">
        <div><p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Colores</p><p className="text-stone-900 font-bold text-lg">{completos.length} / {ordenes.length}</p></div>
        <div><p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Unidades a stock</p><p className="text-stone-900 font-bold text-lg">{totalGeneral}</p></div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex gap-3">
        <Button type="submit" variant="primary" size="lg" isLoading={saving} disabled={completos.length === 0}>
          {saving ? 'Terminando...' : `Terminar ${completos.length} ${completos.length === 1 ? 'color' : 'colores'}`}
        </Button>
        <Button type="button" variant="secondary" size="lg" onClick={() => router.back()}>Cancelar</Button>
      </div>
    </form>
  );
}
