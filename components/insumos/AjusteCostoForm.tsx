'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NumInput } from '@/components/ui/NumInput';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { fmtMoney } from '@/lib/format';

interface Opt { id: string; codigo: string; costoUnitario: string; insumo: { nombre: string } }

// Ajuste manual de COSTO de un rollo de tela, sin pasar por una compra
// (ej. revaluar stock por aumento del proveedor).
export function AjusteCostoForm() {
  const router = useRouter();
  const [rollos, setRollos] = useState<Opt[]>([]);
  const [targetId, setTargetId] = useState('');
  const [nuevoCosto, setNuevoCosto] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch('/api/insumos/rollos?estado=DISPONIBLE').then((r) => r.ok ? r.json() : []).then(setRollos).catch(() => {});
  }, []);

  const sel = rollos.find((o) => o.id === targetId);
  const costoActual = sel ? Number(sel.costoUnitario) : 0;

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!targetId) { setError('Elegí un rollo'); return; }
    if (!nuevoCosto || nuevoCosto <= 0) { setError('Cargá el nuevo costo'); return; }

    setSaving(true);
    const r = await fetch(`/api/insumos/rollos/${targetId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ costoUnitario: nuevoCosto }),
    });
    if (r.ok) {
      setSuccess(`Costo actualizado a ${fmtMoney(nuevoCosto, 2)}`);
      setRollos((arr) => arr.map((o) => o.id === targetId ? { ...o, costoUnitario: String(nuevoCosto) } : o));
      setTargetId(''); setNuevoCosto(0);
      router.refresh();
    } else {
      const d = await r.json().catch(() => ({}));
      setError(typeof d.error === 'string' ? d.error : 'No se pudo actualizar el costo');
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-6 max-w-lg">
      <h3 className="text-sm font-bold text-stone-800 mb-1">Ajustar costo (sin compra)</h3>
      <p className="text-xs text-stone-500 mb-4">Cambiá el costo unitario de un rollo, ej. por aumento del proveedor.</p>
      <form onSubmit={guardar} className="space-y-4">
        <Select label="Rollo *" value={targetId} onChange={(e) => { setTargetId(e.target.value); }} fullWidth>
          <option value="">-- Seleccionar --</option>
          {rollos.map((o) => (
            <option key={o.id} value={o.id}>{o.codigo} · {o.insumo.nombre} (costo: {fmtMoney(Number(o.costoUnitario), 2)})</option>
          ))}
        </Select>

        {sel && (
          <p className="text-xs text-stone-500">Costo actual: <strong className="text-stone-800 tabular-nums">{fmtMoney(costoActual, 2)}</strong></p>
        )}

        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Nuevo costo unitario *</label>
          <NumInput value={nuevoCosto} onChange={setNuevoCosto} min="0" step="0.01"
            className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-amber-400" />
        </div>

        {error && <p className="text-red-600 text-xs font-semibold">{error}</p>}
        {success && <p className="text-emerald-600 text-xs font-semibold">✓ {success}</p>}

        <Button type="submit" isLoading={saving} disabled={saving}>Actualizar costo</Button>
      </form>
    </div>
  );
}
