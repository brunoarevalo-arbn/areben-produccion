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

// Dos formas de pagarle a un cortador, contra el mismo POST de pagos-cortes:
//   · IMPUTADO  → se eligen cortes/muestras (pre-seleccionados) y el monto lo calcula
//                 el servidor sumándolos.
//   · A CUENTA  → monto libre sin elegir nada. Es el adelanto o el pago suelto que no
//                 cierra con ningún corte; baja el saldo sin marcar ítems.
// El bloque "a cuenta" se dibuja SIEMPRE, también con saldo en cero (por eso no hay
// return temprano cuando no hay pendientes: era imposible cargar un adelanto).
export function RegistrarPagoCortador({ cortadorId, cortadorNombre, cortes, muestras }: {
  cortadorId: string; cortadorNombre: string; cortes: Corte[]; muestras: Muestra[];
}) {
  const router = useRouter();
  const [selCortes, setSelCortes] = useState<Set<string>>(new Set(cortes.map((c) => c.id)));
  const [selMuestras, setSelMuestras] = useState<Set<string>>(new Set(muestras.map((m) => m.id)));
  const [fecha, setFecha] = useState(hoyISO());
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  const [montoACuenta, setMontoACuenta] = useState(0);
  const [fechaACuenta, setFechaACuenta] = useState(hoyISO());
  const [notasACuenta, setNotasACuenta] = useState('');
  const [savingACuenta, setSavingACuenta] = useState(false);

  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    set((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const total = cortes.filter((c) => selCortes.has(c.id)).reduce((s, c) => s + c.costoCorte, 0)
    + muestras.filter((m) => selMuestras.has(m.id)).reduce((s, m) => s + m.valor, 0);
  const n = selCortes.size + selMuestras.size;
  const hayPendientes = cortes.length > 0 || muestras.length > 0;

  const postear = async (body: Record<string, unknown>, exito: string) => {
    const r = await fetch('/api/produccion/pagos-cortes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (r.ok) { toast.success(exito); router.refresh(); return true; }
    const d = await r.json().catch(() => ({}));
    toast.error(d.error || 'No se pudo registrar el pago');
    return false;
  };

  const pagar = async () => {
    if (n === 0) { toast.error('Seleccioná al menos un ítem'); return; }
    setSaving(true);
    await postear(
      { fecha, beneficiario: cortadorNombre, ordenIds: [...selCortes], muestraIds: [...selMuestras], notas: notas || undefined },
      `Pago registrado (${fmt$(total)})`,
    );
    setSaving(false);
  };

  const pagarACuenta = async () => {
    if (montoACuenta <= 0) { toast.error('Poné el monto del pago'); return; }
    setSavingACuenta(true);
    const ok = await postear(
      { fecha: fechaACuenta, beneficiario: cortadorNombre, cortadorId, monto: montoACuenta, notas: notasACuenta || undefined },
      `Pago a cuenta registrado (${fmt$(montoACuenta)})`,
    );
    if (ok) { setMontoACuenta(0); setNotasACuenta(''); }
    setSavingACuenta(false);
  };

  return (
    <div className="space-y-4">
      {hayPendientes ? (
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
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-sm text-emerald-800">Sin cortes ni muestras pendientes. ✓</div>
      )}

      <Card padding="none" className="p-5 space-y-3">
        <div>
          <p className="text-sm font-bold text-stone-800">Pago a cuenta</p>
          <p className="text-xs text-stone-400">Un monto suelto, sin imputar a ningún corte: adelanto o pago parcial. Baja el saldo igual.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1 block">Monto</label>
            <NumInput value={montoACuenta} onChange={setMontoACuenta} placeholder="0" className={`${inp} w-32`} />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1 block">Fecha</label>
            <input type="date" value={fechaACuenta} onChange={(e) => setFechaACuenta(e.target.value)} className={inp} />
          </div>
          <div className="flex-1 min-w-[10rem]">
            <label className="text-xs font-semibold text-stone-600 mb-1 block">Nota (opcional)</label>
            <input type="text" value={notasACuenta} onChange={(e) => setNotasACuenta(e.target.value)} placeholder="Comprobante, referencia…" className={`${inp} w-full`} />
          </div>
          <Button variant="secondary" onClick={pagarACuenta} isLoading={savingACuenta} disabled={montoACuenta <= 0}>
            Registrar pago a cuenta
          </Button>
        </div>
      </Card>
    </div>
  );
}
