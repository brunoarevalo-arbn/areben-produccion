'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TALLES_DEFAULT } from '@/lib/validators/produccion';

interface RolloDisp {
  id: string; codigo: string; pesoActual: string; costoUnitario: string;
  insumo: { nombre: string; rinde: string | null }; color: { nombre: string } | null;
}
interface LoteDisp {
  id: string; codigo: string; cantidadActual: string; costoUnitario: string;
  insumo: { nombre: string }; color: { nombre: string } | null;
}

interface ConsumoRollo { rolloId: string; metros: string; codigo: string; pesoActual: number; costoUnitario: number; rinde: number; nombre: string; }
interface ConsumoLote { loteId: string; cantidad: string; codigo: string; cantActual: number; costoUnitario: number; nombre: string; }

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const inpSm = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';
const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

export function RegistrarCorteForm({ ordenId, sku, cantidadPlanificada }: { ordenId: string; sku: string; cantidadPlanificada: number }) {
  const router = useRouter();
  const [rollosDisp, setRollosDisp] = useState<RolloDisp[]>([]);
  const [lotesDisp, setLotesDisp] = useState<LoteDisp[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [consumoRollos, setConsumoRollos] = useState<ConsumoRollo[]>([]);
  const [consumoLotes, setConsumoLotes] = useState<ConsumoLote[]>([]);
  const [talles, setTalles] = useState<Record<string, string>>({});
  const [cortador, setCortador] = useState('');
  const [costoCorte, setCostoCorte] = useState('');
  const [modoCosto, setModoCosto] = useState<'total' | 'unidad'>('total');
  const [notas, setNotas] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/insumos/rollos?estado=DISPONIBLE').then((r) => r.ok ? r.json() : []),
      fetch('/api/insumos/rollos?estado=EN_USO_PARCIAL').then((r) => r.ok ? r.json() : []),
      fetch('/api/insumos/lotes?estado=DISPONIBLE').then((r) => r.ok ? r.json() : []),
      fetch('/api/insumos/lotes?estado=EN_USO_PARCIAL').then((r) => r.ok ? r.json() : []),
    ]).then(([r1, r2, l1, l2]) => {
      const allRollos = [...r1, ...r2] as RolloDisp[];
      setRollosDisp(allRollos.filter((r) => r.insumo.rinde && Number(r.insumo.rinde) > 0).sort((a, b) => a.codigo.localeCompare(b.codigo)));
      setLotesDisp([...l1, ...l2]);
    });
  }, []);

  // Rollos
  const toggleRollo = (r: RolloDisp) => {
    setConsumoRollos((prev) => {
      const exists = prev.find((c) => c.rolloId === r.id);
      if (exists) return prev.filter((c) => c.rolloId !== r.id);
      return [...prev, {
        rolloId: r.id, metros: '', codigo: r.codigo,
        pesoActual: Number(r.pesoActual), costoUnitario: Number(r.costoUnitario),
        rinde: Number(r.insumo.rinde), nombre: `${r.insumo.nombre}${r.color ? ` · ${r.color.nombre}` : ''}`,
      }];
    });
  };
  const updateRolloMetros = (rolloId: string, val: string) =>
    setConsumoRollos((prev) => prev.map((c) => c.rolloId === rolloId ? { ...c, metros: val } : c));

  // Lotes
  const addLote = (l: LoteDisp) => {
    if (consumoLotes.find((c) => c.loteId === l.id)) return;
    setConsumoLotes((prev) => [...prev, {
      loteId: l.id, cantidad: '', codigo: l.codigo,
      cantActual: Number(l.cantidadActual), costoUnitario: Number(l.costoUnitario),
      nombre: `${l.insumo.nombre}${l.color ? ` · ${l.color.nombre}` : ''}`,
    }]);
  };
  const removeLote = (loteId: string) => setConsumoLotes((prev) => prev.filter((c) => c.loteId !== loteId));
  const updateLoteCant = (loteId: string, val: string) =>
    setConsumoLotes((prev) => prev.map((c) => c.loteId === loteId ? { ...c, cantidad: val } : c));

  // Talles
  const updateTalle = (talle: string, val: string) => setTalles((prev) => ({ ...prev, [talle]: val }));

  // Calculos
  const totalMetros = consumoRollos.reduce((s, c) => s + (parseFloat(c.metros) || 0), 0);
  const totalKg = consumoRollos.reduce((s, c) => s + (parseFloat(c.metros) || 0) / c.rinde, 0);
  const costoTela = consumoRollos.reduce((s, c) => {
    const kg = (parseFloat(c.metros) || 0) / c.rinde;
    return s + kg * c.costoUnitario;
  }, 0);
  const costoInsSec = consumoLotes.reduce((s, c) => s + (parseFloat(c.cantidad) || 0) * c.costoUnitario, 0);
  const totalUnidades = Object.values(talles).reduce((s, v) => s + (parseInt(v) || 0), 0);
  const costoCorteInput = parseFloat(costoCorte) || 0;
  const costoCorteNum = modoCosto === 'unidad' ? costoCorteInput * totalUnidades : costoCorteInput;
  const costoTotalAcum = costoTela + costoInsSec + costoCorteNum;
  const costoUnitario = totalUnidades > 0 ? costoTotalAcum / totalUnidades : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (consumoRollos.length === 0) { setError('Selecciona al menos un rollo'); return; }

    for (const cr of consumoRollos) {
      const m = parseFloat(cr.metros);
      if (!m || m <= 0) { setError(`Metros invalidos para rollo ${cr.codigo}`); return; }
      if (m / cr.rinde > cr.pesoActual) { setError(`Rollo ${cr.codigo}: excede stock`); return; }
    }

    for (const cl of consumoLotes) {
      const c = parseFloat(cl.cantidad);
      if (!c || c <= 0) { setError(`Cantidad invalida en lote ${cl.codigo}`); return; }
      if (c > cl.cantActual) { setError(`Lote ${cl.codigo}: excede stock`); return; }
    }

    const cortesArr = Object.entries(talles)
      .map(([talle, val]) => ({ talle, cantidad: parseInt(val) || 0 }))
      .filter((t) => t.cantidad > 0);

    if (cortesArr.length === 0) { setError('Carga al menos un talle con cantidad'); return; }

    setSaving(true);
    const r = await fetch(`/api/produccion/cola/${ordenId}/corte`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consumoRollos: consumoRollos.map((c) => ({ rolloId: c.rolloId, metrosUsados: parseFloat(c.metros) })),
        consumoLotes: consumoLotes.length > 0 ? consumoLotes.map((c) => ({ loteId: c.loteId, cantidad: parseFloat(c.cantidad) })) : undefined,
        cortesPorTalle: cortesArr,
        cortador: cortador.trim() || undefined,
        costoCorte: costoCorteNum > 0 ? costoCorteNum : undefined,
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Consumo de tela */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-1">1. Consumo de tela</h3>
        <p className="text-xs text-stone-400 mb-4">Selecciona los rollos y cuantos metros se usaron. Se convierte a kg con el rinde del insumo.</p>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {rollosDisp.length === 0 ? (
            <p className="text-sm text-stone-400 py-4">No hay rollos con rinde disponibles. Carga el rinde en configuracion.</p>
          ) : (
            rollosDisp.map((r) => {
              const selected = consumoRollos.find((c) => c.rolloId === r.id);
              const rinde = Number(r.insumo.rinde);
              const metrosDisp = Number(r.pesoActual) * rinde;
              return (
                <div key={r.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${selected ? 'border-blue-300 bg-blue-50' : 'border-stone-100'}`}>
                  <input type="checkbox" checked={!!selected} onChange={() => toggleRollo(r)} className="rounded border-stone-300" />
                  <span className="font-mono text-xs text-stone-700 w-16">{r.codigo}</span>
                  <span className="text-xs text-stone-600 flex-1 truncate">{r.insumo.nombre}{r.color ? ` · ${r.color.nombre}` : ''}</span>
                  <span className="text-xs text-stone-400 tabular-nums">{Number(r.pesoActual).toFixed(1)}kg · ~{metrosDisp.toFixed(0)}m</span>
                  {selected && (
                    <div className="flex items-center gap-1">
                      <input type="number" value={selected.metros} onChange={(e) => updateRolloMetros(r.id, e.target.value)}
                        min="0.01" step="0.01" placeholder="Metros" className={`w-24 ${inpSm}`} />
                      <span className="text-xs text-stone-400">m</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {consumoRollos.length > 0 && (
          <div className="mt-3 pt-3 border-t border-stone-100 grid grid-cols-3 gap-3 text-sm">
            <div><span className="text-stone-500">Total: </span><strong>{fmt(totalMetros)} m</strong></div>
            <div><span className="text-stone-500">Equiv: </span><strong>{fmt(totalKg)} kg</strong></div>
            <div className="text-right"><span className="text-stone-500">Costo tela: </span><strong>${fmt(costoTela)}</strong></div>
          </div>
        )}
      </div>

      {/* Insumos secundarios */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-1">2. Insumos secundarios</h3>
        <p className="text-xs text-stone-400 mb-4">Etiquetas, badanas, hilos. Cantidades estimadas para el corte.</p>

        {consumoLotes.map((cl) => (
          <div key={cl.loteId} className="flex items-center gap-3 mb-2 px-3 py-2 rounded-lg border border-stone-100">
            <span className="font-mono text-xs text-stone-700 w-16">{cl.codigo}</span>
            <span className="text-xs text-stone-600 flex-1 truncate">{cl.nombre}</span>
            <span className="text-xs text-stone-400 tabular-nums">{cl.cantActual} disp.</span>
            <input type="number" value={cl.cantidad} onChange={(e) => updateLoteCant(cl.loteId, e.target.value)}
              min="1" max={cl.cantActual} placeholder="Cant." className={`w-20 ${inpSm}`} />
            <button type="button" onClick={() => removeLote(cl.loteId)} className="text-red-400 hover:text-red-600 text-sm px-1">x</button>
          </div>
        ))}

        <select value="" onChange={(e) => { const l = lotesDisp.find((l) => l.id === e.target.value); if (l) addLote(l); }} className={inpSm}>
          <option value="">+ Agregar lote...</option>
          {lotesDisp.filter((l) => !consumoLotes.find((c) => c.loteId === l.id)).map((l) => (
            <option key={l.id} value={l.id}>
              {l.codigo} · {l.insumo.nombre}{l.color ? ` · ${l.color.nombre}` : ''} ({Number(l.cantidadActual)} disp.)
            </option>
          ))}
        </select>

        {consumoLotes.length > 0 && (
          <div className="mt-3 pt-3 border-t border-stone-100 text-sm text-right">
            <span className="text-stone-500">Costo insumos sec.: </span><strong>${fmt(costoInsSec)}</strong>
          </div>
        )}
      </div>

      {/* Desglose por talles */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-1">3. Desglose por talle</h3>
        <p className="text-xs text-stone-400 mb-4">
          Cuantas prendas se cortaron de cada talle. El total reemplaza la cantidad planificada ({cantidadPlanificada}).
        </p>

        <div className="grid grid-cols-7 gap-2">
          {TALLES_DEFAULT.map((t) => (
            <div key={t}>
              <label className="text-xs font-semibold text-stone-600 mb-1 block text-center">{t}</label>
              <input type="number" value={talles[t] || ''} onChange={(e) => updateTalle(t, e.target.value)}
                min="0" placeholder="0" className={`w-full text-center ${inpSm}`} />
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between text-sm">
          <span className="text-stone-500">
            Total cortadas: <strong className="text-stone-900 text-lg ml-1">{totalUnidades}</strong>
            {cantidadPlanificada > 0 && totalUnidades !== cantidadPlanificada && (
              <span className="ml-2 text-amber-600">(planificadas: {cantidadPlanificada})</span>
            )}
          </span>
          {totalUnidades > 0 && (
            <span className="text-stone-500">
              Costo unitario: <strong className="text-stone-900">${fmt(costoUnitario)}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Cortador + Costo */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-1">4. Servicio de corte</h3>
        <p className="text-xs text-stone-400 mb-4">Quien corto la tela y cuanto se le paga. El estado de pago arranca como PENDIENTE.</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Cortador</label>
            <input type="text" value={cortador} onChange={(e) => setCortador(e.target.value)}
              placeholder="Nombre del cortador" className={inp} />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Modo de pago</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setModoCosto('total')}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold border transition ${modoCosto === 'total' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600'}`}>
                Total
              </button>
              <button type="button" onClick={() => setModoCosto('unidad')}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold border transition ${modoCosto === 'unidad' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600'}`}>
                Por unidad
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">
              {modoCosto === 'unidad' ? 'Costo por unidad' : 'Costo total del corte'}
            </label>
            <input type="number" value={costoCorte} onChange={(e) => setCostoCorte(e.target.value)}
              min="0" step="0.01" placeholder="0" className={inp} />
            {modoCosto === 'unidad' && costoCorteInput > 0 && totalUnidades > 0 && (
              <p className="text-xs text-stone-500 mt-1">
                ${fmt(costoCorteInput)}/u × {totalUnidades} = <strong>${fmt(costoCorteNum)}</strong>
              </p>
            )}
            {modoCosto === 'unidad' && costoCorteInput > 0 && totalUnidades === 0 && (
              <p className="text-xs text-amber-600 mt-1">Cargá los talles para calcular el total</p>
            )}
          </div>
        </div>
      </div>

      {/* Notas */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-3">Notas</h3>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2}
          placeholder="Observaciones, merma esperada, etc." className={`${inp} resize-none`} />
      </div>

      {/* Resumen total */}
      <div className="bg-stone-50 rounded-2xl border border-stone-200 p-6">
        <div className="grid grid-cols-5 gap-4 text-sm">
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Tela</p>
            <p className="text-stone-800 tabular-nums">${fmt(costoTela)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Insumos sec.</p>
            <p className="text-stone-800 tabular-nums">${fmt(costoInsSec)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Corte</p>
            <p className="text-stone-800 tabular-nums">${fmt(costoCorteNum)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Costo total</p>
            <p className="text-stone-900 font-bold text-lg tabular-nums">${fmt(costoTotalAcum)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Unidades</p>
            <p className="text-stone-900 font-bold text-lg">{totalUnidades}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={saving || consumoRollos.length === 0 || totalUnidades === 0}
          className="bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-semibold transition">
          {saving ? 'Registrando...' : 'Registrar corte'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-4 py-3 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition">
          Cancelar
        </button>
      </div>
    </form>
  );
}
