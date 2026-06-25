'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { TALLES_DEFAULT } from '@/lib/validators/produccion';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';

interface RolloDisp {
  id: string; codigo: string; pesoActual: string; costoUnitario: string;
  insumo: { nombre: string; rinde: string | null }; color: { nombre: string } | null;
}
interface CortadorOpt {
  id: string; nombre: string; tarifaDefault: string | null; tarifaModo: string | null; activo: boolean;
}

interface ConsumoRollo { rolloId: string; metros: string; codigo: string; pesoActual: number; costoUnitario: number; rinde: number; nombre: string; }
interface AvioOpt { id: string; nombre: string; tipo: string | null; precio: number; stock: number | null; marca: string | null; frecuencia: string | null; }
interface AvioSel { etiquetaId: string; cantidad: string; }

// Una ficha puede tener varias tizadas (cuerpo, puño, manga, complementos...).
// Cada tizada tiene su propia tela/rollos y su propio rinde. Las unidades cortadas
// son las mismas para todas (se cargan una vez en los talles).
interface Tizada {
  id: string;
  nombre: string;
  modo: 'tizada' | 'manual';
  metros: string;
  unidades: string;
  rollos: ConsumoRollo[];
}

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const inpSm = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';
const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

// Reparto de metros de una tizada entre sus rollos. Manual: lo cargado. Tizada:
// llena rollo por rollo (hasta agotar cada uno) hasta cubrir lo necesario.
function calcTizada(t: Tizada, totalUnidades: number) {
  const metrosNum   = parseFloat(t.metros) || 0;
  const unidadesNum = parseInt(t.unidades) || 0;
  const metrosPorUnidad  = unidadesNum > 0 ? metrosNum / unidadesNum : 0;
  const metrosNecesarios = metrosPorUnidad * totalUnidades;
  const rollosCalc = t.rollos.map((c, i) => {
    if (t.modo === 'manual') return { ...c, metrosEf: parseFloat(c.metros) || 0 };
    const dispAntes = t.rollos.slice(0, i).reduce((s, x) => s + x.pesoActual * x.rinde, 0);
    const disp = c.pesoActual * c.rinde;
    return { ...c, metrosEf: Math.max(0, Math.min(metrosNecesarios - dispAntes, disp)) };
  });
  const totalDisp = t.rollos.reduce((s, x) => s + x.pesoActual * x.rinde, 0);
  const faltante  = t.modo === 'tizada' ? Math.max(0, metrosNecesarios - totalDisp) : 0;
  const metros = rollosCalc.reduce((s, c) => s + c.metrosEf, 0);
  const kg     = rollosCalc.reduce((s, c) => s + c.metrosEf / c.rinde, 0);
  const costo  = rollosCalc.reduce((s, c) => s + (c.metrosEf / c.rinde) * c.costoUnitario, 0);
  return { metrosPorUnidad, metrosNecesarios, rollosCalc, faltante, metros, kg, costo };
}

export function RegistrarCorteForm({ ordenId, sku, cantidadPlanificada, marca }: { ordenId: string; sku: string; cantidadPlanificada: number; marca: string | null }) {
  const router = useRouter();
  const [rollosDisp, setRollosDisp] = useState<RolloDisp[]>([]);
  const [cortadores, setCortadores] = useState<CortadorOpt[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const tizadaSeq = useRef(2);
  const [tizadas, setTizadas] = useState<Tizada[]>([{ id: 't1', nombre: '', modo: 'tizada', metros: '', unidades: '1', rollos: [] }]);
  const [aviosCatalogo, setAviosCatalogo] = useState<AvioOpt[]>([]);
  const [aviosSel, setAviosSel] = useState<AvioSel[]>([]);
  const [filtroTela, setFiltroTela] = useState<Record<string, string>>({}); // por tizada → nombre de tela
  const [talles, setTalles] = useState<Record<string, string>>({});
  const [cortadorId, setCortadorId] = useState('');
  const [costoCorte, setCostoCorte] = useState('');
  const [modoCosto, setModoCosto] = useState<'total' | 'unidad'>('total');

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
      fetch('/api/cortadores').then((r) => r.ok ? r.json() : []),
    ]).then(([r1, r2, ct]) => {
      const allRollos = [...r1, ...r2] as RolloDisp[];
      setRollosDisp(allRollos.filter((r) => r.insumo.rinde && Number(r.insumo.rinde) > 0).sort((a, b) => a.codigo.localeCompare(b.codigo)));
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
  // Slot fijo (principal/composición): reemplaza el avío de ese tipo por el elegido.
  const setSlotAvio = (tipoSlot: string, etiquetaId: string) =>
    setAviosSel((prev) => {
      const sinTipo = prev.filter((s) => (aviosCatalogo.find((a) => a.id === s.etiquetaId)?.tipo ?? '') !== tipoSlot);
      return etiquetaId ? [...sinTipo, { etiquetaId, cantidad: '1' }] : sinTipo;
    });
  const addOtroAvio = (etiquetaId: string) =>
    setAviosSel((prev) => prev.some((s) => s.etiquetaId === etiquetaId) ? prev : [...prev, { etiquetaId, cantidad: '1' }]);

  const renderAvio = (a: AvioOpt) => {
    const sel = aviosSel.find((x) => x.etiquetaId === a.id);
    const cantNum = sel ? (parseInt(sel.cantidad) || 0) : 0;
    return (
      <div key={a.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${sel ? 'border-blue-300 bg-blue-50' : 'border-stone-100'}`}>
        <input type="checkbox" checked={!!sel} onChange={() => toggleAvio(a.id)} className="rounded border-stone-300 accent-amber-500" />
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
  };

  // Tizadas
  const addTizada = () =>
    setTizadas((prev) => [...prev, { id: `t${tizadaSeq.current++}`, nombre: '', modo: 'tizada', metros: '', unidades: '1', rollos: [] }]);
  const removeTizada = (id: string) =>
    setTizadas((prev) => prev.length > 1 ? prev.filter((t) => t.id !== id) : prev);
  const updTizada = (id: string, field: 'nombre' | 'modo' | 'metros' | 'unidades', val: string) =>
    setTizadas((prev) => prev.map((t) => t.id === id ? { ...t, [field]: val } : t));
  const toggleRolloTizada = (tizadaId: string, r: RolloDisp) =>
    setTizadas((prev) => prev.map((t) => {
      if (t.id !== tizadaId) return t;
      const exists = t.rollos.find((c) => c.rolloId === r.id);
      if (exists) return { ...t, rollos: t.rollos.filter((c) => c.rolloId !== r.id) };
      return { ...t, rollos: [...t.rollos, {
        rolloId: r.id, metros: '', codigo: r.codigo,
        pesoActual: Number(r.pesoActual), costoUnitario: Number(r.costoUnitario),
        rinde: Number(r.insumo.rinde), nombre: `${r.insumo.nombre}${r.color ? ` · ${r.color.nombre}` : ''}`,
      }] };
    }));
  const updRolloMetrosTizada = (tizadaId: string, rolloId: string, val: string) =>
    setTizadas((prev) => prev.map((t) => t.id === tizadaId
      ? { ...t, rollos: t.rollos.map((c) => c.rolloId === rolloId ? { ...c, metros: val } : c) } : t));

  // Talles
  const updateTalle = (talle: string, val: string) => setTalles((prev) => ({ ...prev, [talle]: val }));

  // Calculos
  const totalUnidades = Object.values(talles).reduce((s, v) => s + (parseInt(v) || 0), 0);

  const tizadasCalc = tizadas.map((t) => ({ t, ...calcTizada(t, totalUnidades) }));
  const totalRollosSel = tizadas.reduce((s, t) => s + t.rollos.length, 0);

  // Consumo agregado por rollo (un mismo rollo puede usarse en más de una tizada)
  const rolloAgg = new Map<string, { rolloId: string; metrosEf: number; codigo: string; rinde: number; pesoActual: number }>();
  for (const tc of tizadasCalc) {
    for (const c of tc.rollosCalc) {
      const cur = rolloAgg.get(c.rolloId);
      if (cur) cur.metrosEf += c.metrosEf;
      else rolloAgg.set(c.rolloId, { rolloId: c.rolloId, metrosEf: c.metrosEf, codigo: c.codigo, rinde: c.rinde, pesoActual: c.pesoActual });
    }
  }
  const rollosAgg = [...rolloAgg.values()];

  const totalMetros = tizadasCalc.reduce((s, x) => s + x.metros, 0);
  const totalKg     = tizadasCalc.reduce((s, x) => s + x.kg, 0);
  const costoTela   = tizadasCalc.reduce((s, x) => s + x.costo, 0);
  const costoCorteInput = parseFloat(costoCorte) || 0;
  const costoCorteNum = modoCosto === 'unidad' ? costoCorteInput * totalUnidades : costoCorteInput;
  const costoTotalAcum = costoTela + costoCorteNum;
  const costoUnitario = totalUnidades > 0 ? costoTotalAcum / totalUnidades : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (totalRollosSel === 0) { setError('Selecciona al menos un rollo en alguna tizada'); return; }
    if (totalUnidades === 0) { setError('Cargá los talles para calcular el consumo'); return; }

    for (const tc of tizadasCalc) {
      if (tc.t.rollos.length === 0) continue;
      const etq = tc.t.nombre.trim() || 'sin nombre';
      if (tc.t.modo === 'tizada') {
        if (tc.metrosPorUnidad <= 0) { setError(`Tizada "${etq}": cargá los metros y unidades`); return; }
        if (tc.faltante > 0.001) { setError(`Tizada "${etq}": los rollos no alcanzan, faltan ${fmt(tc.faltante)} m`); return; }
      }
    }

    // Rollos que realmente aportan metros (descarta seleccionados con consumo 0)
    const rollosFinal = rollosAgg.filter((c) => c.metrosEf > 0.001);
    if (rollosFinal.length === 0) { setError('Ningún rollo aporta metros al corte'); return; }
    for (const cr of rollosFinal) {
      if (cr.metrosEf / cr.rinde > cr.pesoActual + 0.001) { setError(`Rollo ${cr.codigo}: excede stock`); return; }
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
      {/* Consumo de tela — una o más tizadas */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-1">1. Consumo de tela</h3>
        <p className="text-xs text-stone-400 mb-4">
          Una ficha puede tener varias tizadas (cuerpo, puño, manga, complementos). Cada una con su tela y su rinde.
          Las unidades cortadas se cargan una sola vez en los talles (sección 3).
        </p>

        {tizadas.map((t, ti) => {
          const tc = tizadasCalc[ti];
          const efMap = new Map(tc.rollosCalc.map((c) => [c.rolloId, c.metrosEf]));
          return (
            <div key={t.id} className="border border-stone-200 rounded-xl p-4 mb-3">
              {/* Nombre + quitar */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-stone-400 shrink-0">Tizada {ti + 1}</span>
                <input type="text" value={t.nombre} onChange={(e) => updTizada(t.id, 'nombre', e.target.value)}
                  placeholder="Nombre (ej: Cuerpo, Puño, Manga...)"
                  className="flex-1 text-sm font-semibold bg-transparent border-0 border-b border-stone-200 focus:outline-none focus:border-amber-400 pb-0.5 text-stone-800" />
                {tizadas.length > 1 && (
                  <button type="button" onClick={() => removeTizada(t.id)}
                    className="text-stone-300 hover:text-red-400 transition text-xl shrink-0 leading-none">×</button>
                )}
              </div>

              {/* Modo */}
              <div className="flex gap-2 mb-3">
                <button type="button" onClick={() => updTizada(t.id, 'modo', 'tizada')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition ${t.modo === 'tizada' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600'}`}>
                  Por tizada
                </button>
                <button type="button" onClick={() => updTizada(t.id, 'modo', 'manual')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition ${t.modo === 'manual' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600'}`}>
                  Metros por rollo
                </button>
              </div>

              {/* Inputs de tizada */}
              {t.modo === 'tizada' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-stone-600 mb-1 block">Metros de la tizada</label>
                      <NumInput value={parseFloat(t.metros) || 0} onChange={(n) => updTizada(t.id, 'metros', n ? String(n) : '')}
                        min="0" step="0.01" placeholder="Ej: 24.5" className={inpSm + ' w-full'} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-stone-600 mb-1 block">Unidades que rinde</label>
                      <NumInput value={parseFloat(t.unidades) || 0} onChange={(n) => updTizada(t.id, 'unidades', n ? String(n) : '')}
                        min="1" step="1" placeholder="Ej: 12" className={inpSm + ' w-full'} />
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-amber-200 text-xs text-stone-600 flex flex-wrap gap-x-4 gap-y-1">
                    {tc.metrosPorUnidad > 0 && <span>Rinde: <strong>{fmt(tc.metrosPorUnidad)} m/u</strong></span>}
                    {totalUnidades === 0
                      ? <span className="text-amber-600">Cargá los talles (sección 3) para calcular los metros</span>
                      : tc.metrosPorUnidad > 0 && <span>Necesario: <strong>{fmt(tc.metrosPorUnidad)} m/u × {totalUnidades} u = {fmt(tc.metrosNecesarios)} m</strong></span>}
                  </div>
                  {tc.faltante > 0.001 && (
                    <p className="text-xs text-red-600 mt-2">Los rollos no alcanzan: faltan {fmt(tc.faltante)} m. Sumá otro rollo a esta tizada.</p>
                  )}
                </div>
              )}

              {/* Filtro por tela: elegís la tela y ves solo sus rollos (en vez de todos). */}
              {(() => {
                const telas = [...new Set(rollosDisp.map((r) => r.insumo.nombre))].sort();
                return rollosDisp.length > 0 && telas.length > 1 ? (
                  <select value={filtroTela[t.id] || ''} onChange={(e) => setFiltroTela((prev) => ({ ...prev, [t.id]: e.target.value }))}
                    className={`${inpSm} w-full mb-2`}>
                    <option value="">Todas las telas ({rollosDisp.length} rollos)</option>
                    {telas.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                ) : null;
              })()}
              {/* Rollos de esta tizada */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {rollosDisp.length === 0 ? (
                  <p className="text-sm text-stone-400 py-2">No hay rollos con rinde disponibles. Cargá el rinde en configuración.</p>
                ) : (
                  (filtroTela[t.id] ? rollosDisp.filter((r) => r.insumo.nombre === filtroTela[t.id]) : rollosDisp).map((r) => {
                    const selected = t.rollos.find((c) => c.rolloId === r.id);
                    const metrosDisp = Number(r.pesoActual) * Number(r.insumo.rinde);
                    const ef = efMap.get(r.id) ?? 0;
                    return (
                      <div key={r.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${selected ? 'border-blue-300 bg-blue-50' : 'border-stone-100'}`}>
                        <input type="checkbox" checked={!!selected} onChange={() => toggleRolloTizada(t.id, r)} className="rounded border-stone-300 accent-amber-500" />
                        <span className="font-mono text-xs text-stone-700 w-16">{r.codigo}</span>
                        <span className="text-xs text-stone-600 flex-1 truncate">{r.insumo.nombre}{r.color ? ` · ${r.color.nombre}` : ''}</span>
                        <span className="text-xs text-stone-400 tabular-nums">{Number(r.pesoActual).toFixed(1)}kg · ~{metrosDisp.toFixed(0)}m</span>
                        {selected && (
                          t.modo === 'manual' ? (
                            <div className="flex items-center gap-1">
                              <NumInput value={parseFloat(selected.metros) || 0} onChange={(n) => updRolloMetrosTizada(t.id, r.id, n ? String(n) : '')}
                                min="0.01" step="0.01" placeholder="Metros" className={`w-24 ${inpSm}`} />
                              <span className="text-xs text-stone-400">m</span>
                            </div>
                          ) : (
                            ef > 0.001 ? (
                              <span className="text-xs font-semibold text-blue-700 tabular-nums w-24 text-right">{fmt(ef)} m</span>
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

              {/* Subtotal de la tizada */}
              {t.rollos.length > 0 && (
                <div className="mt-3 pt-3 border-t border-stone-100 grid grid-cols-3 gap-3 text-xs">
                  <div><span className="text-stone-500">Metros: </span><strong>{fmt(tc.metros)} m</strong></div>
                  <div><span className="text-stone-500">Equiv: </span><strong>{fmt(tc.kg)} kg</strong></div>
                  <div className="text-right"><span className="text-stone-500">Costo: </span><strong>${fmt(tc.costo)}</strong></div>
                </div>
              )}
            </div>
          );
        })}

        <button type="button" onClick={addTizada}
          className="text-xs px-3 py-1.5 border border-stone-200 rounded-lg text-stone-600 hover:border-stone-400 transition">
          + Agregar tizada
        </button>

        {totalRollosSel > 0 && (
          <div className="mt-4 pt-3 border-t border-stone-200 grid grid-cols-3 gap-3 text-sm">
            <div><span className="text-stone-500">Total tela: </span><strong>{fmt(totalMetros)} m</strong></div>
            <div><span className="text-stone-500">Equiv: </span><strong>{fmt(totalKg)} kg</strong></div>
            <div className="text-right"><span className="text-stone-500">Costo tela: </span><strong>${fmt(costoTela)}</strong></div>
          </div>
        )}
      </div>

      {/* Avíos de la prenda (catálogo) */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-1">2. Avíos de la prenda</h3>
        <p className="text-xs text-stone-400 mb-4">
          Qué etiquetas/avíos del catálogo lleva cada prenda. El stock se descuenta solo al terminar la producción.
        </p>
        {aviosCatalogo.length === 0 ? (
          <p className="text-sm text-stone-400 py-2">No hay avíos en el catálogo. Cargalos en Inventario → Catálogo → Avíos.</p>
        ) : (() => {
          const catById = (id: string) => aviosCatalogo.find((a) => a.id === id);
          // Principal = etiqueta de la marca de la prenda. Composición = genérica (va en todas).
          // Otros = el resto (badanas, botones, cierres, tachas) de la marca + genéricos.
          const principales   = aviosCatalogo.filter((a) => a.tipo === 'principal' && (!a.marca || a.marca === marca));
          const composiciones = aviosCatalogo.filter((a) => a.tipo === 'composicion');
          const otros         = aviosCatalogo.filter((a) => a.tipo !== 'principal' && a.tipo !== 'composicion' && (!a.marca || a.marca === marca));
          const principalSel   = aviosSel.find((s) => catById(s.etiquetaId)?.tipo === 'principal');
          const composicionSel = aviosSel.find((s) => catById(s.etiquetaId)?.tipo === 'composicion');
          const otrosSel       = aviosSel.filter((s) => { const t = catById(s.etiquetaId)?.tipo; return t !== 'principal' && t !== 'composicion'; });
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-stone-600 mb-1 block">Etiqueta principal</label>
                  <select value={principalSel?.etiquetaId ?? ''} onChange={(e) => setSlotAvio('principal', e.target.value)} className={`${inpSm} w-full`}>
                    <option value="">— Ninguna —</option>
                    {principales.map((a) => <option key={a.id} value={a.id}>{a.nombre}{a.stock != null ? ` (${a.stock})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-600 mb-1 block">Etiqueta composición <span className="font-normal text-stone-400">(todas)</span></label>
                  <select value={composicionSel?.etiquetaId ?? ''} onChange={(e) => setSlotAvio('composicion', e.target.value)} className={`${inpSm} w-full`}>
                    <option value="">— Ninguna —</option>
                    {composiciones.map((a) => <option key={a.id} value={a.id}>{a.nombre}{a.stock != null ? ` (${a.stock})` : ''}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-stone-600">Otros avíos <span className="font-normal text-stone-400">(cierres, tachas, badanas…)</span></span>
                  {otros.length > 0 && (
                    <select value="" onChange={(e) => { if (e.target.value) addOtroAvio(e.target.value); }} className={`${inpSm} max-w-[16rem]`}>
                      <option value="">+ Del catálogo</option>
                      {otros.map((a) => <option key={a.id} value={a.id}>{a.nombre}{a.stock != null ? ` (${a.stock})` : ''}</option>)}
                    </select>
                  )}
                </div>
                {otrosSel.length === 0
                  ? <p className="text-xs text-stone-400 italic">Sin otros avíos.</p>
                  : <div className="space-y-2">{otrosSel.map((s) => { const a = catById(s.etiquetaId); return a ? renderAvio(a) : null; })}</div>}
              </div>
            </div>
          );
        })()}
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
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Tela</p>
            <p className="text-stone-800 tabular-nums">${fmt(costoTela)}</p>
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
        <Button type="submit" variant="primary" size="lg" isLoading={saving} disabled={totalRollosSel === 0 || totalUnidades === 0}>
          {saving ? 'Registrando...' : 'Registrar corte'}
        </Button>
        <Button type="button" variant="secondary" size="lg" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
