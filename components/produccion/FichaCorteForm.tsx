'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface RolloDisp {
  id: string; codigo: string; pesoActual: string; costoUnitario: string;
  estado: string; insumo: { nombre: string }; color: { nombre: string } | null;
}
interface LoteDisp {
  id: string; codigo: string; cantidadActual: string; costoUnitario: string;
  estado: string; insumo: { nombre: string }; color: { nombre: string } | null;
}
interface InsumoOpt { id: string; nombre: string; categoria: string; tipoTrazabilidad: string; }

interface ConsumoRollo { rolloId: string; cantidad: string; codigo: string; pesoActual: number; costoUnitario: number; nombre: string; }
interface ConsumoLote  { loteId: string; cantidad: string; codigo: string; cantActual: number; costoUnitario: number; nombre: string; }

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const inpSm = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';
const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

function parseColorFromSku(sku: string): string | null {
  const parts = sku.split('-');
  if (parts.length >= 3) return parts[2];
  return null;
}

export function FichaCorteForm({ ordenId, sku, fichaCargada }: { ordenId: string; sku: string; fichaCargada: boolean }) {
  const router = useRouter();
  const [rollosDisp, setRollosDisp] = useState<RolloDisp[]>([]);
  const [lotesDisp, setLotesDisp] = useState<LoteDisp[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [revertiendo, setRevertiendo] = useState(false);

  const [consumoRollos, setConsumoRollos] = useState<ConsumoRollo[]>([]);
  const [consumoLotes, setConsumoLotes] = useState<ConsumoLote[]>([]);
  const [notas, setNotas] = useState('');

  const colorAbrev = parseColorFromSku(sku);

  useEffect(() => {
    Promise.all([
      fetch('/api/insumos/rollos?estado=DISPONIBLE').then((r) => r.ok ? r.json() : []),
      fetch('/api/insumos/rollos?estado=EN_USO_PARCIAL').then((r) => r.ok ? r.json() : []),
      fetch('/api/insumos/lotes?estado=DISPONIBLE').then((r) => r.ok ? r.json() : []),
      fetch('/api/insumos/lotes?estado=EN_USO_PARCIAL').then((r) => r.ok ? r.json() : []),
    ]).then(([r1, r2, l1, l2]) => {
      const allRollos = [...r1, ...r2] as RolloDisp[];
      const allLotes = [...l1, ...l2] as LoteDisp[];

      // Filtrar por color del SKU si aplica
      // Fase 2 TODO: inferir color matcheando SkuCatalogo.abreviatura con colorAbrev
      const filteredRollos = colorAbrev
        ? allRollos.filter((r) => !r.color || r.color.nombre.toUpperCase().startsWith(colorAbrev.toUpperCase()) || true)
        : allRollos;

      setRollosDisp(filteredRollos.sort((a, b) => a.codigo.localeCompare(b.codigo)));
      setLotesDisp(allLotes.sort((a, b) => a.codigo.localeCompare(b.codigo)));
    });
  }, [colorAbrev]);

  const toggleRollo = (r: RolloDisp) => {
    setConsumoRollos((prev) => {
      const exists = prev.find((c) => c.rolloId === r.id);
      if (exists) return prev.filter((c) => c.rolloId !== r.id);
      return [...prev, {
        rolloId: r.id,
        cantidad: String(Number(r.pesoActual)),
        codigo: r.codigo,
        pesoActual: Number(r.pesoActual),
        costoUnitario: Number(r.costoUnitario),
        nombre: `${r.insumo.nombre}${r.color ? ` · ${r.color.nombre}` : ''}`,
      }];
    });
  };

  const updateRolloCant = (rolloId: string, val: string) => {
    setConsumoRollos((prev) => prev.map((c) => c.rolloId === rolloId ? { ...c, cantidad: val } : c));
  };

  const addLote = (l: LoteDisp) => {
    if (consumoLotes.find((c) => c.loteId === l.id)) return;
    setConsumoLotes((prev) => [...prev, {
      loteId: l.id,
      cantidad: '',
      codigo: l.codigo,
      cantActual: Number(l.cantidadActual),
      costoUnitario: Number(l.costoUnitario),
      nombre: `${l.insumo.nombre}${l.color ? ` · ${l.color.nombre}` : ''}`,
    }]);
  };

  const removeLote = (loteId: string) => {
    setConsumoLotes((prev) => prev.filter((c) => c.loteId !== loteId));
  };

  const updateLoteCant = (loteId: string, val: string) => {
    setConsumoLotes((prev) => prev.map((c) => c.loteId === loteId ? { ...c, cantidad: val } : c));
  };

  const costoTela = consumoRollos.reduce((s, c) => s + (parseFloat(c.cantidad) || 0) * c.costoUnitario, 0);
  const costoInsSec = consumoLotes.reduce((s, c) => s + (parseFloat(c.cantidad) || 0) * c.costoUnitario, 0);
  const costoBase = costoTela + costoInsSec;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (consumoRollos.length === 0) { setError('Selecciona al menos un rollo'); return; }

    for (const cr of consumoRollos) {
      const cant = parseFloat(cr.cantidad);
      if (!cant || cant <= 0) { setError(`Cantidad invalida para rollo ${cr.codigo}`); return; }
      if (cant > cr.pesoActual) { setError(`Rollo ${cr.codigo}: cantidad ${cant} excede stock ${cr.pesoActual}`); return; }
    }

    for (const cl of consumoLotes) {
      const cant = parseFloat(cl.cantidad);
      if (!cant || cant <= 0) { setError(`Cantidad invalida para lote ${cl.codigo}`); return; }
      if (cant > cl.cantActual) { setError(`Lote ${cl.codigo}: cantidad ${cant} excede stock ${cl.cantActual}`); return; }
    }

    setSaving(true);
    const r = await fetch(`/api/produccion/cola/${ordenId}/ficha`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consumoTela: consumoRollos.map((c) => ({ rolloId: c.rolloId, cantidad: parseFloat(c.cantidad) })),
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
    if (!confirm('Revertir la ficha de corte? Se devolveran los insumos al stock.')) return;
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
          Ficha de corte ya cargada
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
      {/* Tela - Rollos */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-1">Consumo de tela</h3>
        <p className="text-xs text-stone-400 mb-4">Selecciona rollos y la cantidad a usar de cada uno.</p>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {rollosDisp.length === 0 ? (
            <p className="text-sm text-stone-400 py-4">No hay rollos disponibles</p>
          ) : (
            rollosDisp.map((r) => {
              const selected = consumoRollos.find((c) => c.rolloId === r.id);
              return (
                <div key={r.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition ${selected ? 'border-blue-300 bg-blue-50' : 'border-stone-100'}`}>
                  <input type="checkbox" checked={!!selected} onChange={() => toggleRollo(r)} className="rounded border-stone-300" />
                  <span className="font-mono text-xs text-stone-700 w-16">{r.codigo}</span>
                  <span className="text-xs text-stone-600 flex-1 truncate">
                    {r.insumo.nombre}{r.color ? ` · ${r.color.nombre}` : ''}
                  </span>
                  <span className="text-xs text-stone-400 tabular-nums">{fmt(Number(r.pesoActual))} disp.</span>
                  <span className="text-xs text-stone-400 tabular-nums">${fmt(Number(r.costoUnitario))}/u</span>
                  {selected && (
                    <input type="number" value={selected.cantidad}
                      onChange={(e) => updateRolloCant(r.id, e.target.value)}
                      min="0.01" step="0.01" max={Number(r.pesoActual)}
                      className={`w-20 ${inpSm}`} />
                  )}
                </div>
              );
            })
          )}
        </div>

        {consumoRollos.length > 0 && (
          <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-sm">
            <span className="text-stone-500">Total tela: {fmt(consumoRollos.reduce((s, c) => s + (parseFloat(c.cantidad) || 0), 0))}</span>
            <span className="font-bold text-stone-800">Costo tela: ${fmt(costoTela)}</span>
          </div>
        )}
      </div>

      {/* Insumos secundarios - Lotes */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-1">Insumos secundarios</h3>
        <p className="text-xs text-stone-400 mb-4">Etiquetas, badanas, hilos, etc. Agrega los que necesites.</p>

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

        <div className="mt-2">
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
        </div>

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

      {/* Resumen */}
      <div className="bg-stone-50 rounded-2xl border border-stone-200 p-6">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Costo tela</p>
            <p className="text-stone-800 font-bold tabular-nums">${fmt(costoTela)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Insumos sec.</p>
            <p className="text-stone-800 font-bold tabular-nums">${fmt(costoInsSec)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Total base</p>
            <p className="text-stone-900 font-bold text-lg tabular-nums">${fmt(costoBase)}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={saving || consumoRollos.length === 0}
          className="bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-semibold transition">
          {saving ? 'Confirmando...' : 'Confirmar corte'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-4 py-3 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition">
          Cancelar
        </button>
      </div>
    </form>
  );
}
