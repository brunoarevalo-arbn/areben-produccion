'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NumInput } from '@/components/ui/NumInput';
import { toast } from '@/components/ui/Toaster';

interface Corte { id: string; sku: string | null; costoCorte: number; fecha: string | null }
interface Muestra { id: string; descripcion: string; valor: number; fecha: string }

const inp = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';
const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' });
const hoyISO = () => new Date().toISOString().slice(0, 10);

// UN solo formulario: el pago es el MONTO, y los cortes tildados son la traza de qué cubre.
// Antes había dos cajas —"pagar los cortes tildados" y "pago a cuenta"— y usar las dos para
// la misma plata la contaba dos veces, que es el descuadre que estamos sacando. Tildar
// cortes ya no puede inventar un pago: sólo sugiere el monto, que siempre es editable.
export function RegistrarPagoCortador({ cortadorId, cortadorNombre, cortes, muestras, saldo }: {
  cortadorId: string; cortadorNombre: string; cortes: Corte[]; muestras: Muestra[]; saldo: number;
}) {
  const router = useRouter();
  // Nada pre-tildado a propósito: el pre-tildado de todo convertía el botón en un
  // "saldar todo" con monto inventado.
  const [selCortes, setSelCortes] = useState<Set<string>>(new Set());
  const [selMuestras, setSelMuestras] = useState<Set<string>>(new Set());
  const [monto, setMonto] = useState(Math.max(0, Math.round(saldo)));
  const [fecha, setFecha] = useState(hoyISO());
  const [notas, setNotas] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggle = (
    set: React.Dispatch<React.SetStateAction<Set<string>>>,
    otros: number,
    sumaNueva: (sel: Set<string>) => number,
    id: string,
  ) => set((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    setMonto(Math.round(sumaNueva(n) + otros));
    return n;
  });

  const sumaCortes = (sel: Set<string>) => cortes.filter((c) => sel.has(c.id)).reduce((s, c) => s + c.costoCorte, 0);
  const sumaMuestras = (sel: Set<string>) => muestras.filter((m) => sel.has(m.id)).reduce((s, m) => s + m.valor, 0);
  const imputado = sumaCortes(selCortes) + sumaMuestras(selMuestras);
  const nSel = selCortes.size + selMuestras.size;
  const hayPendientes = cortes.length > 0 || muestras.length > 0;

  const pagar = async () => {
    if (monto <= 0) { toast.error('Poné el monto del pago'); return; }
    setSaving(true);
    const r = await fetch('/api/produccion/pagos-cortes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fecha, beneficiario: cortadorNombre, cortadorId, monto,
        ordenIds: [...selCortes], muestraIds: [...selMuestras], notas: notas || undefined,
      }),
    });
    if (r.ok) {
      const d = await r.json().catch(() => ({}));
      toast.success(d.cuenta ? `Pago de ${fmt$(monto)} — saldo: ${fmt$(d.cuenta.saldo)}` : `Pago registrado (${fmt$(monto)})`);
      setSelCortes(new Set()); setSelMuestras(new Set()); setNotas(''); setMonto(0);
      router.refresh();
    } else {
      const d = await r.json().catch(() => ({}));
      toast.error(d.error || 'No se pudo registrar el pago');
    }
    setSaving(false);
  };

  return (
    <Card padding="none" className="p-5 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1 block">Monto</label>
          <NumInput value={monto} onChange={setMonto} placeholder="0" className={`${inp} w-36`} />
        </div>
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1 block">Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inp} />
        </div>
        <div className="flex-1 min-w-[10rem]">
          <label className="text-xs font-semibold text-stone-600 mb-1 block">Nota (opcional)</label>
          <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Efectivo, transferencia, comprobante…" className={`${inp} w-full`} />
        </div>
        <Button variant="primary" onClick={pagar} isLoading={saving} disabled={monto <= 0}>Registrar pago de {fmt$(monto)}</Button>
      </div>

      <p className="text-xs text-stone-400">
        {saldo > 0 ? `Se le deben ${fmt$(saldo)}.` : saldo < 0 ? `Tiene ${fmt$(-saldo)} a favor.` : 'La cuenta está en cero.'}
        {' '}El pago baja el saldo por su monto, tilde cortes o no.
      </p>

      {hayPendientes && (
        <div className="border-t border-stone-100 pt-3">
          <button type="button" onClick={() => setAbierto((v) => !v)} className="text-xs font-semibold text-stone-600 hover:text-stone-900 transition">
            {abierto ? '▾' : '▸'} Imputar a cortes (opcional) {nSel > 0 && <span className="text-stone-400 font-normal">· {nSel} tildado(s) · {fmt$(imputado)}</span>}
          </button>
          <p className="text-xs text-stone-400 mt-1">Deja la traza de qué cubre este pago. No cambia el saldo — sólo sugiere el monto.</p>

          {abierto && (
            <div className="space-y-1.5 mt-3">
              {cortes.map((c) => (
                <label key={c.id} className="flex items-center gap-3 text-sm cursor-pointer">
                  <input type="checkbox" checked={selCortes.has(c.id)} onChange={() => toggle(setSelCortes, sumaMuestras(selMuestras), sumaCortes, c.id)} className="rounded border-stone-300 accent-amber-500" />
                  <span className="font-mono text-xs bg-stone-100 px-2 py-0.5 rounded text-stone-700">{c.sku ?? 'S/SKU'}</span>
                  <span className="text-xs text-stone-400 flex-1">corte{c.fecha ? ` · ${fechaCorta(c.fecha)}` : ''}</span>
                  <span className="tabular-nums font-semibold text-stone-700">{fmt$(c.costoCorte)}</span>
                </label>
              ))}
              {muestras.map((m) => (
                <label key={m.id} className="flex items-center gap-3 text-sm cursor-pointer">
                  <input type="checkbox" checked={selMuestras.has(m.id)} onChange={() => toggle(setSelMuestras, sumaCortes(selCortes), sumaMuestras, m.id)} className="rounded border-stone-300 accent-amber-500" />
                  <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded">muestra</span>
                  <span className="text-xs text-stone-500 flex-1 truncate">{m.descripcion} · {fechaCorta(m.fecha)}</span>
                  <span className="tabular-nums font-semibold text-stone-700">{fmt$(m.valor)}</span>
                </label>
              ))}
              {nSel > 0 && imputado !== monto && (
                <p className="text-xs text-amber-700 pt-1">Imputás {fmt$(imputado)} de {fmt$(monto)} pagados.</p>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
