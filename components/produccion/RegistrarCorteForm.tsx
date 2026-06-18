'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TALLES_DEFAULT } from '@/lib/validators/produccion';
import { NumInput } from '@/components/ui/NumInput';

interface RolloDisp {
  id: string; codigo: string; pesoActual: string; costoUnitario: string;
  insumo: { nombre: string; rinde: string | null }; color: { nombre: string } | null;
}
interface LoteDisp {
  id: string; codigo: string; cantidadActual: string; costoUnitario: string;
  insumo: { nombre: string }; color: { nombre: string } | null;
}
interface CortadorOpt {
  id: string; nombre: string; tarifaDefault: string | null; tarifaModo: string | null; activo: boolean;
}

interface ConsumoRollo { rolloId: string; metros: string; codigo: string; pesoActual: number; costoUnitario: number; rinde: number; nombre: string; }
interface ConsumoLote { loteId: string; cantidad: string; codigo: string; cantActual: number; costoUnitario: number; nombre: string; }
interface AvioOpt { id: string; nombre: string; tipo: string | null; precio: number; stock: number | null; }
interface AvioSel { etiquetaId: string; cantidad: string; }

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const inpSm = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';
const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

export function RegistrarCorteForm({ ordenId, sku, cantidadPlanificada }: { ordenId: string; sku: string; cantidadPlanificada: number }) {
  const router = useRouter();
  const [rollosDisp, setRollosDisp] = useState<RolloDisp[]>([]);
  const [lotesDisp, setLotesDisp] = useState<LoteDisp[]>([]);
  const [cortadores, setCortadores] = useState<CortadorOpt[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [consumoRollos, setConsumoRollos] = useState<ConsumoRollo[]>([]);
  const [consumoLotes, setConsumoLotes] = useState<ConsumoLote[]>([]);
  const [aviosCatalogo, setAviosCatalogo] = useState<AvioOpt[]>([]);
  const [aviosSel, setAviosSel] = useState<AvioSel[]>([]);
  const [talles, setTalles] = useState<Record<string, string>>({});
  const [cortadorId, setCortadorId] = useState('');
  const [costoCorte, setCostoCorte] = useState('');
  const [modoCosto, setModoCosto] = useState<'total' | 'unidad'>('total');

  // Modo de carga de tela: 'tizada' calcula los metros desde el rinde de la tizada,
  // 'manual' usa los metros cargados rollo por rollo.
  const [modoTela, setModoTela] = useState<'tizada' | 'manual'>('tizada');
  const [metrosTizada, setMetrosTizada] = useState('');
  const [unidadesTizada, setUnidadesTizada] = useState('1');

  // Autocompletar tarifa al elegir cortador
  const onCortadorChange = (id: string) => {
    setCortadorId(id);
    const c = cortadores.find((x) => x.id === id);
    if (c && c.tarifaDefault) {
      setCostoCorte(String(Number(c.tarifaDefault)));
      if (c.tarifaModo === 'total' || c.tarifaModo === 'unidad') setModoCosto(c.tarifaModo);
    }
  };
  const [notas, setNotas] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/insumos/rollos?estado=DISPONIBLE').then((r) => r.ok ? r.json() : []),
      fetch('/api/insumos/rollos?estado=EN_USO_PARCIAL').then((r) => r.ok ? r.json() : []),
      fetch('/api/insumos/lotes?estado=DISPONIBLE').then((r) => r.ok ? r.json() : []),
      fetch('/api/insumos/lotes?estado=EN_USO_PARCIAL').then((r) => r.ok ? r.json() : []),
      fetch('/api/cortadores').then((r) => r.ok ? r.json() : []),
    ]).then(([r1, r2, l1, l2, ct]) => {
      const allRollos = [...r1, ...r2] as RolloDisp[];
      setRollosDisp(allRollos.filter((r) => r.insumo.rinde && Number(r.insumo.rinde) > 0).sort((a, b) => a.codigo.localeCompare(b.codigo)));
      setLotesDisp([...l1, ...l2]);
      setCortadores((ct as CortadorOpt[]).filter((c) => c.activo));
    });

    fetch('/api/costos/etiquetas')
      .then((r) => r.ok ? r.json() : [])
      .then((a) => { if (Array.isArray(a)) setAviosCatalogo(a.map((x) => ({ ...x, precio: Number(x.precio) }))); })
      .catch(() => {});
  }, []);

  // Avíos
  const toggleAvio = (etiquetaId: string) =>
    setAviosSel((prev) => prev.find((a) => a.etiquetaId === etiquetaId)
      ? prev.filter((a) => a.etiquetaId !== etiquetaId)
      : [...prev, { etiquetaId, cantidad: '1' }]);
  const updateAvioCant = (etiquetaId: string, val: string) =>
    setAviosSel((prev) => prev.map((a) => a.etiquetaId === etiquetaId ? { ...a, cantidad: val } : a));

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
  const totalUnidades = Object.values(talles).reduce((s, v) => s + (parseInt(v) || 0), 0);

  // Tizada -> metros por unidad -> metros totales necesarios
  const metrosTizadaNum   = parseFloat(metrosTizada) || 0;
  const unidadesTizadaNum = parseInt(unidadesTizada) || 0;
  const metrosPorUnidad   = unidadesTizadaNum > 0 ? metrosTizadaNum / unidadesTizadaNum : 0;
  const metrosNecesarios  = metrosPorUnidad * totalUnidades;

  // Metros efectivos por rollo. Manual: lo cargado. Tizada: reparto automatico
  // llenando rollo por rollo (hasta agotar cada uno) en el orden seleccionado.
  const consumoCalc = consumoRollos.map((c, i) => {
    if (modoTela === 'manual') return { ...c, metrosEf: parseFloat(c.metros) || 0 };
    const dispAntes = consumoRollos.slice(0, i).reduce((s, x) => s + x.pesoActual * x.rinde, 0);
    const disp = c.pesoActual * c.rinde;
    const metrosEf = Math.max(0, Math.min(metrosNecesarios - dispAntes, disp));
    return { ...c, metrosEf };
  });
  const metrosEfMap = new Map(consumoCalc.map((c) => [c.rolloId, c.metrosEf]));
  const totalDisp = consumoRollos.reduce((s, x) => s + x.pesoActual * x.rinde, 0);
  const faltanteTizada = modoTela === 'tizada' ? Math.max(0, metrosNecesarios - totalDisp) : 0;

  const totalMetros = consumoCalc.reduce((s, c) => s + c.metrosEf, 0);
  const totalKg = consumoCalc.reduce((s, c) => s + c.metrosEf / c.rinde, 0);
  const costoTela = consumoCalc.reduce((s, c) => s + (c.metrosEf / c.rinde) * c.costoUnitario, 0);
  const costoInsSec = consumoLotes.reduce((s, c) => s + (parseFloat(c.cantidad) || 0) * c.costoUnitario, 0);
  const costoCorteInput = parseFloat(costoCorte) || 0;
  const costoCorteNum = modoCosto === 'unidad' ? costoCorteInput * totalUnidades : costoCorteInput;
  const costoTotalAcum = costoTela + costoInsSec + costoCorteNum;
  const costoUnitario = totalUnidades > 0 ? costoTotalAcum / totalUnidades : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (consumoRollos.length === 0) { setError('Selecciona al menos un rollo'); return; }

    if (modoTela === 'tizada') {
      if (metrosPorUnidad <= 0) { setError('Cargá los metros y unidades de la tizada'); return; }
      if (totalUnidades === 0) { setError('Cargá los talles para calcular el consumo'); return; }
      if (faltanteTizada > 0.001) { setError(`Los rollos seleccionados no alcanzan: faltan ${fmt(faltanteTizada)} m`); return; }
    }

    // En tizada, los rollos sobrantes (consumo 0) no se consumen: se descartan del
    // payload en vez de bloquear el registro. En manual, un rollo sin metros es error.
    const rollosFinal = modoTela === 'tizada' ? consumoCalc.filter((c) => c.metrosEf > 0.001) : consumoCalc;
    if (rollosFinal.length === 0) { setError('Ningun rollo aporta metros al corte'); return; }

    for (const cr of rollosFinal) {
      if (!cr.metrosEf || cr.metrosEf <= 0) { setError(`Metros invalidos para rollo ${cr.codigo}`); return; }
      if (cr.metrosEf / cr.rinde > cr.pesoActual + 0.001) { setError(`Rollo ${cr.codigo}: excede stock`); return; }
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
        consumoRollos: rollosFinal.map((c) => ({ rolloId: c.rolloId, metrosUsados: c.metrosEf })),
        consumoLotes: consumoLotes.length > 0 ? consumoLotes.map((c) => ({ loteId: c.loteId, cantidad: parseFloat(c.cantidad) })) : undefined,
        avios: aviosSel.length > 0 ? aviosSel.map((a) => ({ etiquetaId: a.etiquetaId, cantidad: parseInt(a.cantidad) || 1 })) : undefined,
        cortesPorTalle: cortesArr,
        cortadorId: cortadorId || undefined,
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
        <p className="text-xs text-stone-400 mb-4">
          {modoTela === 'tizada'
            ? 'Cargá el rinde de la tizada y el sistema calcula los metros totales según las unidades cortadas.'
            : 'Cargá los metros usados rollo por rollo. Se convierte a kg con el rinde del insumo.'}
        </p>

        {/* Modo de carga */}
        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => setModoTela('tizada')}
            className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold border transition ${modoTela === 'tizada' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600'}`}>
            Por tizada
          </button>
          <button type="button" onClick={() => setModoTela('manual')}
            className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold border transition ${modoTela === 'manual' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600'}`}>
            Metros por rollo
          </button>
        </div>

        {/* Inputs de tizada */}
        {modoTela === 'tizada' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Metros de la tizada</label>
                <NumInput value={parseFloat(metrosTizada) || 0} onChange={(n) => setMetrosTizada(n ? String(n) : '')}
                  min="0" step="0.01" placeholder="Ej: 24.5" className={inpSm + ' w-full'} />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Unidades que rinde</label>
                <NumInput value={parseFloat(unidadesTizada) || 0} onChange={(n) => setUnidadesTizada(n ? String(n) : '')}
                  min="1" step="1" placeholder="Ej: 12" className={inpSm + ' w-full'} />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-amber-200 text-xs text-stone-600 flex flex-wrap gap-x-4 gap-y-1">
              {metrosPorUnidad > 0 && <span>Rinde: <strong>{fmt(metrosPorUnidad)} m/u</strong></span>}
              {totalUnidades === 0
                ? <span className="text-amber-600">Cargá los talles (sección 3) para calcular los metros</span>
                : metrosPorUnidad > 0 && <span>Necesario: <strong>{fmt(metrosPorUnidad)} m/u × {totalUnidades} u = {fmt(metrosNecesarios)} m</strong></span>}
            </div>
            {faltanteTizada > 0.001 && (
              <p className="text-xs text-red-600 mt-2">Los rollos seleccionados no alcanzan: faltan {fmt(faltanteTizada)} m. Seleccioná otro rollo.</p>
            )}
          </div>
        )}

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
                    modoTela === 'manual' ? (
                      <div className="flex items-center gap-1">
                        <NumInput value={parseFloat(selected.metros) || 0} onChange={(n) => updateRolloMetros(r.id, n ? String(n) : '')}
                          min="0.01" step="0.01" placeholder="Metros" className={`w-24 ${inpSm}`} />
                        <span className="text-xs text-stone-400">m</span>
                      </div>
                    ) : (
                      (metrosEfMap.get(r.id) ?? 0) > 0.001 ? (
                        <span className="text-xs font-semibold text-blue-700 tabular-nums w-24 text-right">
                          {fmt(metrosEfMap.get(r.id) ?? 0)} m
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400 italic w-24 text-right">no usado</span>
                      )
                    )
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
            <NumInput value={parseFloat(cl.cantidad) || 0} onChange={(n) => updateLoteCant(cl.loteId, n ? String(n) : '')}
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

      {/* Avíos de la prenda (catálogo) */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-1">Avíos de la prenda</h3>
        <p className="text-xs text-stone-400 mb-4">
          Qué etiquetas/avíos del catálogo lleva cada prenda. El stock se descuenta solo al terminar la producción.
        </p>
        {aviosCatalogo.length === 0 ? (
          <p className="text-sm text-stone-400 py-2">No hay avíos en el catálogo. Cargalos en Costos → Catálogos.</p>
        ) : (
          <div className="space-y-2">
            {aviosCatalogo.map((a) => {
              const sel = aviosSel.find((x) => x.etiquetaId === a.id);
              const cantNum = sel ? (parseInt(sel.cantidad) || 0) : 0;
              return (
                <div key={a.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${sel ? 'border-blue-300 bg-blue-50' : 'border-stone-100'}`}>
                  <input type="checkbox" checked={!!sel} onChange={() => toggleAvio(a.id)} className="rounded border-stone-300" />
                  <span className="text-xs text-stone-700 flex-1 truncate">{a.nombre}{a.tipo ? ` · ${a.tipo}` : ''}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full tabular-nums ${a.stock == null ? 'text-stone-400' : a.stock > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {a.stock == null ? '∞' : `${a.stock} en stock`}
                  </span>
                  {sel && (
                    <div className="flex items-center gap-1">
                      <NumInput value={parseFloat(sel.cantidad) || 0} onChange={(n) => updateAvioCant(a.id, n ? String(n) : '')}
                        min="1" step="1" placeholder="x prenda" className={`w-20 ${inpSm}`} />
                      <span className="text-xs text-stone-400">/u</span>
                      {totalUnidades > 0 && cantNum > 0 && (
                        <span className="text-xs text-stone-400 ml-1 tabular-nums">= {cantNum * totalUnidades}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
              <NumInput value={parseFloat(talles[t]) || 0} onChange={(n) => updateTalle(t, n ? String(n) : '')}
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
            <select value={cortadorId} onChange={(e) => onCortadorChange(e.target.value)} className={inp}>
              <option value="">-- Seleccionar --</option>
              {cortadores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
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
            <NumInput value={parseFloat(costoCorte) || 0} onChange={(n) => setCostoCorte(n ? String(n) : '')}
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
