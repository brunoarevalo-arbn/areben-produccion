'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface InsumoOpt { id: string; nombre: string; categoria: string; tipoTrazabilidad: string; rinde: string | null; }
interface LoteDisp {
  id: string; codigo: string; cantidadActual: string; costoUnitario: string;
  insumo: { nombre: string }; color: { nombre: string } | null;
}

interface ConsumoLote { loteId: string; cantidad: string; codigo: string; cantActual: number; costoUnitario: number; nombre: string; }

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const inpSm = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';
const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

export function FichaCorteForm({ ordenId, sku, fichaCargada }: { ordenId: string; sku: string; fichaCargada: boolean }) {
  const router = useRouter();
  const [insumos, setInsumos] = useState<InsumoOpt[]>([]);
  const [lotesDisp, setLotesDisp] = useState<LoteDisp[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [revertiendo, setRevertiendo] = useState(false);

  const [insumoTelaId, setInsumoTelaId] = useState('');
  const [consumoLotes, setConsumoLotes] = useState<ConsumoLote[]>([]);
  const [notas, setNotas] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/insumos').then((r) => r.ok ? r.json() : []),
      fetch('/api/insumos/lotes?estado=DISPONIBLE').then((r) => r.ok ? r.json() : []),
      fetch('/api/insumos/lotes?estado=EN_USO_PARCIAL').then((r) => r.ok ? r.json() : []),
    ]).then(([ins, l1, l2]) => {
      setInsumos(ins.filter((i: InsumoOpt) => i.tipoTrazabilidad === 'rollo'));
      setLotesDisp([...l1, ...l2]);
    });
  }, []);

  const addLote = (l: LoteDisp) => {
    if (consumoLotes.find((c) => c.loteId === l.id)) return;
    setConsumoLotes((prev) => [...prev, {
      loteId: l.id, cantidad: '', codigo: l.codigo,
      cantActual: Number(l.cantidadActual), costoUnitario: Number(l.costoUnitario),
      nombre: `${l.insumo.nombre}${l.color ? ` · ${l.color.nombre}` : ''}`,
    }]);
  };

  const removeLote = (loteId: string) => setConsumoLotes((prev) => prev.filter((c) => c.loteId !== loteId));
  const updateLoteCant = (loteId: string, val: string) => setConsumoLotes((prev) => prev.map((c) => c.loteId === loteId ? { ...c, cantidad: val } : c));

  const costoInsSec = consumoLotes.reduce((s, c) => s + (parseFloat(c.cantidad) || 0) * c.costoUnitario, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!insumoTelaId) { setError('Selecciona el insumo de tela'); return; }

    for (const cl of consumoLotes) {
      const cant = parseFloat(cl.cantidad);
      if (!cant || cant <= 0) { setError(`Cantidad invalida para lote ${cl.codigo}`); return; }
      if (cant > cl.cantActual) { setError(`Lote ${cl.codigo}: cantidad excede stock`); return; }
    }

    setSaving(true);
    const r = await fetch(`/api/produccion/cola/${ordenId}/ficha`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        insumoTelaId,
        consumoLotes: consumoLotes.length > 0
          ? consumoLotes.map((c) => ({ loteId: c.loteId, cantidad: parseFloat(c.cantidad) }))
          : undefined,
        notas: notas || undefined,
      }),
    });

    if (r.ok) {
      router.push(`/produccion/${ordenId}`);
    } else {
      const d = await r.json();
      setError(d.error || 'Error al guardar');
    }
    setSaving(false);
  };

  const revertir = async () => {
    if (!confirm('Revertir la ficha de corte? Se devolveran los insumos secundarios al stock.')) return;
    setRevertiendo(true);
    const r = await fetch(`/api/produccion/cola/${ordenId}/ficha/revertir`, { method: 'POST' });
    if (r.ok) {
      router.push(`/produccion/${ordenId}`);
      router.refresh();
    } else {
      const d = await r.json();
      alert(d.error || 'Error al revertir');
    }
    setRevertiendo(false);
  };

  if (fichaCargada) {
    return (
      <div className="space-y-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 font-semibold">
          Ficha de corte ya cargada. La OP esta en CORTE.
        </div>
        <button onClick={revertir} disabled={revertiendo}
          className="text-xs px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition">
          {revertiendo ? 'Revirtiendo...' : 'Revertir ficha (admin)'}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Insumo de tela */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-1">Tela a cortar</h3>
        <p className="text-xs text-stone-400 mb-4">Que insumo de tela se usa para este corte. El consumo real de rollos se carga despues.</p>
        <select value={insumoTelaId} onChange={(e) => setInsumoTelaId(e.target.value)} className={inp}>
          <option value="">-- Seleccionar tela --</option>
          {insumos.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nombre} {i.rinde ? `(rinde: ${Number(i.rinde)} m/kg)` : '(sin rinde)'}
            </option>
          ))}
        </select>
      </div>

      {/* Insumos secundarios */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-1">Insumos secundarios</h3>
        <p className="text-xs text-stone-400 mb-4">Etiquetas, badanas, hilos y otros. Se descuentan al confirmar la ficha.</p>

        {consumoLotes.map((cl) => (
          <div key={cl.loteId} className="flex items-center gap-3 mb-2 px-3 py-2 rounded-lg border border-stone-100">
            <span className="font-mono text-xs text-stone-700 w-16">{cl.codigo}</span>
            <span className="text-xs text-stone-600 flex-1 truncate">{cl.nombre}</span>
            <span className="text-xs text-stone-400 tabular-nums">{cl.cantActual} disp.</span>
            <input type="number" value={cl.cantidad}
              onChange={(e) => updateLoteCant(cl.loteId, e.target.value)}
              min="1" max={cl.cantActual} placeholder="Cant."
              className={`w-20 ${inpSm}`} />
            <button type="button" onClick={() => removeLote(cl.loteId)}
              className="text-red-400 hover:text-red-600 text-sm px-1">x</button>
          </div>
        ))}

        <select value="" onChange={(e) => {
          const l = lotesDisp.find((l) => l.id === e.target.value);
          if (l) addLote(l);
        }} className={inpSm}>
          <option value="">+ Agregar lote...</option>
          {lotesDisp.filter((l) => !consumoLotes.find((c) => c.loteId === l.id)).map((l) => (
            <option key={l.id} value={l.id}>
              {l.codigo} · {l.insumo.nombre}{l.color ? ` · ${l.color.nombre}` : ''} ({Number(l.cantidadActual)} disp.)
            </option>
          ))}
        </select>

        {consumoLotes.length > 0 && (
          <div className="mt-3 pt-3 border-t border-stone-100 text-sm text-right">
            <span className="font-bold text-stone-800">Costo insumos sec.: ${fmt(costoInsSec)}</span>
          </div>
        )}
      </div>

      {/* Notas */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-3">Notas</h3>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Observaciones del corte..." className={`${inp} resize-none`} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={saving || !insumoTelaId}
          className="bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-semibold transition">
          {saving ? 'Confirmando...' : 'Confirmar ficha de corte'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-4 py-3 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition">
          Cancelar
        </button>
      </div>
    </form>
  );
}
