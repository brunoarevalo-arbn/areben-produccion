'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Tela { nombre: string; precioKgNeto: number; fletePercent: number; rindeMetrosKg: number; consumoMetros: number; }
interface ItemExtra { nombre: string; costo: number; }
interface DatosEscandallo {
  telas: Tela[];
  costoCorte: number;
  costoTizada: number;
  costoLavadero: number;
  tiempoConfeccion: number;
  varios: ItemExtra[];
  avios: {
    etiquetaPrincipal: number;
    etiquetaComposicion: number;
    bolsaPolipropileno: number;
    tiempoEmbolsado: number;
    extras: ItemExtra[];
  };
  margenDesarrollo: number;
  margenFallas: number;
}
interface Escandallo {
  id: string; nombre: string; sku: string | null; marca: string | null;
  tipoPrenda: string | null; notas: string | null; datos: string | null;
  createdAt: string; updatedAt: string;
}

const MARCAS = ['Zattia', 'Stunned'];
const DEFAULT_DATOS: DatosEscandallo = {
  telas: [{ nombre: '', precioKgNeto: 0, fletePercent: 8, rindeMetrosKg: 0, consumoMetros: 0 }],
  costoCorte: 0, costoTizada: 0, costoLavadero: 0, tiempoConfeccion: 0,
  varios: [],
  avios: { etiquetaPrincipal: 0, etiquetaComposicion: 0, bolsaPolipropileno: 0, tiempoEmbolsado: 0, extras: [] },
  margenDesarrollo: 10, margenFallas: 5,
};

function pf(v: string) { return parseFloat(v) || 0; }
function fmt$(n: number) { return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function deepClone<T>(o: T): T { return JSON.parse(JSON.stringify(o)); }

function calcular(d: DatosEscandallo, costoMinuto: number) {
  const costoTelas = d.telas.reduce((s, t) => {
    const pConFlete = t.precioKgNeto * (1 + t.fletePercent / 100);
    const pMetro = t.rindeMetrosKg > 0 ? pConFlete / t.rindeMetrosKg : 0;
    return s + pMetro * t.consumoMetros;
  }, 0);
  const costoServicios  = d.costoCorte + d.costoTizada + d.costoLavadero;
  const costoMO         = d.tiempoConfeccion * costoMinuto;
  const costoVarios     = d.varios.reduce((s, v) => s + v.costo, 0);
  const costoEmbolsado  = d.avios.tiempoEmbolsado * costoMinuto;
  const costoAvios      = d.avios.etiquetaPrincipal + d.avios.etiquetaComposicion +
    d.avios.bolsaPolipropileno + costoEmbolsado +
    d.avios.extras.reduce((s, e) => s + e.costo, 0);
  const costoBase       = costoTelas + costoServicios + costoMO + costoVarios + costoAvios;
  const conDesarrollo   = costoBase * (1 + d.margenDesarrollo / 100);
  const costoTotal      = conDesarrollo * (1 + d.margenFallas / 100);
  return { costoTelas, costoServicios, costoMO, costoVarios, costoAvios, costoBase, conDesarrollo, costoTotal };
}

export function Escandallos({ costoMinuto = 0 }: { costoMinuto?: number }) {
  const router = useRouter();
  const [lista,    setLista]    = useState<Escandallo[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState<string | null>(null);

  const [nombre,     setNombre]     = useState('');
  const [sku,        setSku]        = useState('');
  const [marca,      setMarca]      = useState('');
  const [tipoPrenda, setTipoPrenda] = useState('');
  const [notas,      setNotas]      = useState('');
  const [datos,      setDatos]      = useState<DatosEscandallo>(deepClone(DEFAULT_DATOS));
  const [saving,     setSaving]     = useState(false);

  const [loadingTiempo,      setLoadingTiempo]      = useState(false);
  const [tiempoProduccion,   setTiempoProduccion]   = useState<{ minutos: number; registros: number; cantidadTotal: number } | null>(null);
  const [sinDatosProduccion, setSinDatosProduccion] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/costos/escandallos');
    if (r.ok) setLista(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setTiempoProduccion(null); setSinDatosProduccion(false); }, [sku]);

  const resetForm = () => {
    setNombre(''); setSku(''); setMarca(''); setTipoPrenda(''); setNotas('');
    setDatos(deepClone(DEFAULT_DATOS)); setEditId(null); setShowForm(false);
    setTiempoProduccion(null); setSinDatosProduccion(false);
  };

  const openEdit = (e: Escandallo) => {
    setEditId(e.id);
    setNombre(e.nombre); setSku(e.sku ?? ''); setMarca(e.marca ?? '');
    setTipoPrenda(e.tipoPrenda ?? ''); setNotas(e.notas ?? '');
    try { setDatos(e.datos ? (JSON.parse(e.datos) as DatosEscandallo) : deepClone(DEFAULT_DATOS)); }
    catch { setDatos(deepClone(DEFAULT_DATOS)); }
    setShowForm(true);
  };

  // Telas
  const addTela = () => setDatos(prev => ({ ...prev, telas: [...prev.telas, { nombre: '', precioKgNeto: 0, fletePercent: 8, rindeMetrosKg: 0, consumoMetros: 0 }] }));
  const updTela = (i: number, field: string, val: string) =>
    setDatos(prev => ({ ...prev, telas: prev.telas.map((t, idx) => idx !== i ? t : ({ ...t, [field]: field === 'nombre' ? val : pf(val) } as Tela)) }));
  const delTela = (i: number) => setDatos(prev => ({ ...prev, telas: prev.telas.filter((_, idx) => idx !== i) }));

  // Varios
  const addVario = () => setDatos(prev => ({ ...prev, varios: [...prev.varios, { nombre: '', costo: 0 }] }));
  const updVario = (i: number, field: string, val: string) =>
    setDatos(prev => ({ ...prev, varios: prev.varios.map((v, idx) => idx !== i ? v : ({ ...v, [field]: field === 'nombre' ? val : pf(val) } as ItemExtra)) }));
  const delVario = (i: number) => setDatos(prev => ({ ...prev, varios: prev.varios.filter((_, idx) => idx !== i) }));

  // Avíos extras
  const addAvioExtra = () => setDatos(prev => ({ ...prev, avios: { ...prev.avios, extras: [...prev.avios.extras, { nombre: '', costo: 0 }] } }));
  const updAvioExtra = (i: number, field: string, val: string) =>
    setDatos(prev => ({ ...prev, avios: { ...prev.avios, extras: prev.avios.extras.map((e, idx) => idx !== i ? e : ({ ...e, [field]: field === 'nombre' ? val : pf(val) } as ItemExtra)) } }));
  const delAvioExtra = (i: number) => setDatos(prev => ({ ...prev, avios: { ...prev.avios, extras: prev.avios.extras.filter((_, idx) => idx !== i) } }));

  const updDatos = (field: string, val: string) => setDatos(prev => ({ ...prev, [field]: pf(val) }));
  const updAvios = (field: string, val: string) => setDatos(prev => ({ ...prev, avios: { ...prev.avios, [field]: pf(val) } }));

  const fetchTiempoSku = async () => {
    if (!sku.trim()) return;
    setLoadingTiempo(true);
    setTiempoProduccion(null);
    setSinDatosProduccion(false);
    try {
      const r = await fetch(`/api/produccion/tiempo-sku?sku=${encodeURIComponent(sku)}`);
      if (r.ok) {
        const d = await r.json();
        if (d.encontrado) setTiempoProduccion({ minutos: d.minutosPromedio, registros: d.registros, cantidadTotal: d.cantidadTotal });
        else setSinDatosProduccion(true);
      }
    } catch { /* ignore */ }
    setLoadingTiempo(false);
  };

  const calc = calcular(datos, costoMinuto);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true);
    const body = { nombre, sku, marca, tipoPrenda, notas, datos };
    const url    = editId ? `/api/costos/escandallos/${editId}` : '/api/costos/escandallos';
    const method = editId ? 'PATCH' : 'POST';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) {
      const data = await r.json();
      setLista(prev => editId ? prev.map(x => x.id === editId ? data : x) : [data, ...prev]);
      resetForm();
    }
    setSaving(false);
  };

  const eliminar = async (id: string, nom: string) => {
    if (!confirm(`¿Eliminar el escandallo "${nom}"?`)) return;
    const r = await fetch(`/api/costos/escandallos/${id}`, { method: 'DELETE' });
    if (r.ok) setLista(prev => prev.filter(e => e.id !== id));
  };

  if (loading) return <div className="text-center py-16 text-stone-400 text-sm">Cargando...</div>;

  const inp = 'w-full px-2.5 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-violet-400';
  const lbl = 'text-xs text-stone-400 mb-1 block';
  const sec = 'text-xs font-bold uppercase tracking-widest text-stone-500';

  return (
    <div className="space-y-5 max-w-4xl">

      {/* ── Lista ── */}
      {!showForm && (
        <>
          <div className="space-y-3">
            {lista.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center">
                <p className="text-stone-400 text-sm">No hay escandallos creados todavía.</p>
              </div>
            )}
            {lista.map(e => {
              let c: ReturnType<typeof calcular> | null = null;
              try { if (e.datos) c = calcular(JSON.parse(e.datos) as DatosEscandallo, costoMinuto); } catch { /* ignore */ }
              return (
                <div key={e.id} className="bg-white rounded-2xl border border-stone-200 p-5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-bold text-stone-900">{e.nombre}</p>
                      {e.sku        && <span className="font-mono text-xs bg-stone-100 px-2 py-0.5 rounded text-stone-600">{e.sku}</span>}
                      {e.marca      && <span className="text-xs text-stone-400">{e.marca}</span>}
                      {e.tipoPrenda && <span className="text-xs text-stone-400 italic">{e.tipoPrenda}</span>}
                    </div>
                    {c && (
                      <p className="text-xs text-stone-400 mt-1">
                        Costo unitario: <span className="font-semibold text-stone-700">{fmt$(c.costoTotal)}</span>
                        {costoMinuto === 0 && <span className="text-amber-500 ml-2">(sin valor hora cargado)</span>}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => router.push(`/costos/escandallos/${e.id}`)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-50 transition">
                      Ver PDF
                    </button>
                    <button onClick={() => openEdit(e)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:border-stone-400 transition">
                      Editar
                    </button>
                    <button onClick={() => eliminar(e.id, e.nombre)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">×</button>
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={() => setShowForm(true)}
            className="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
            + Nuevo escandallo
          </button>
        </>
      )}

      {/* ── Formulario ── */}
      {showForm && (
        <form onSubmit={guardar} className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-800">{editId ? 'Editar' : 'Nuevo'} escandallo</h3>
            <button type="button" onClick={resetForm} className="text-xs text-stone-400 hover:text-stone-700 transition">✕ Cancelar</button>
          </div>

          {/* Identificación */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
            <p className={sec}>Identificación</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={lbl}>Nombre del producto <span className="text-red-400">*</span></label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Remera básica manga corta" className={inp} />
              </div>
              <div>
                <label className={lbl}>SKU</label>
                <input type="text" value={sku} onChange={e => setSku(e.target.value.toUpperCase())}
                  placeholder="ZATT-TOP-001" className={`${inp} font-mono`} />
              </div>
              <div>
                <label className={lbl}>Marca</label>
                <select value={marca} onChange={e => setMarca(e.target.value)} className={inp}>
                  <option value="">— Sin marca —</option>
                  {MARCAS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Tipo de prenda</label>
                <input type="text" value={tipoPrenda} onChange={e => setTipoPrenda(e.target.value)}
                  placeholder="Ej: Remera, Pantalón, Campera" className={inp} />
              </div>
              <div>
                <label className={lbl}>Notas</label>
                <input type="text" value={notas} onChange={e => setNotas(e.target.value)}
                  placeholder="Observaciones o referencias" className={inp} />
              </div>
            </div>
          </div>

          {/* Telas */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className={sec}>Telas</p>
              <button type="button" onClick={addTela}
                className="text-xs px-3 py-1 border border-stone-200 rounded-lg text-stone-600 hover:border-stone-400 transition">
                + Agregar tela
              </button>
            </div>
            <div className="space-y-4">
              {datos.telas.map((t, i) => {
                const pConFlete = t.precioKgNeto * (1 + t.fletePercent / 100);
                const pMetro    = t.rindeMetrosKg > 0 ? pConFlete / t.rindeMetrosKg : 0;
                const costoTela = pMetro * t.consumoMetros;
                return (
                  <div key={i} className={`rounded-xl border p-4 ${i === 0 ? 'bg-violet-50 border-violet-100' : 'bg-stone-50 border-stone-100'}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <input type="text" value={t.nombre} onChange={e => updTela(i, 'nombre', e.target.value)}
                        placeholder={`Nombre tela ${i + 1}`}
                        className="flex-1 text-sm font-semibold bg-transparent border-0 border-b border-stone-200 focus:outline-none focus:border-violet-400 pb-0.5 text-stone-800" />
                      {datos.telas.length > 1 && (
                        <button type="button" onClick={() => delTela(i)}
                          className="text-stone-300 hover:text-red-400 transition text-xl shrink-0 leading-none">×</button>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className={lbl}>Precio por kg $</label>
                        <p className="text-xs text-stone-300 -mt-0.5 mb-1">precio de lista sin flete</p>
                        <input type="number" value={t.precioKgNeto} onChange={e => updTela(i, 'precioKgNeto', e.target.value)}
                          onFocus={e => e.currentTarget.select()}
                          min="0" step="any" className={inp} />
                      </div>
                      <div>
                        <label className={lbl}>Flete %</label>
                        <p className="text-xs text-stone-300 -mt-0.5 mb-1">% adicional sobre kg</p>
                        <input type="number" value={t.fletePercent} onChange={e => updTela(i, 'fletePercent', e.target.value)}
                          onFocus={e => e.currentTarget.select()}
                          min="0" step="any" className={inp} />
                      </div>
                      <div>
                        <label className={lbl}>Metros por kg</label>
                        <p className="text-xs text-stone-300 -mt-0.5 mb-1">rendimiento de la tela</p>
                        <input type="number" value={t.rindeMetrosKg} onChange={e => updTela(i, 'rindeMetrosKg', e.target.value)}
                          onFocus={e => e.currentTarget.select()}
                          min="0" step="any" className={inp} />
                      </div>
                      <div>
                        <label className={lbl}>Metros por prenda</label>
                        <p className="text-xs text-stone-300 -mt-0.5 mb-1">consumo de esta tela</p>
                        <input type="number" value={t.consumoMetros} onChange={e => updTela(i, 'consumoMetros', e.target.value)}
                          onFocus={e => e.currentTarget.select()}
                          min="0" step="any" className={inp} />
                      </div>
                    </div>
                    {/* Resultado calculado */}
                    <div className="flex items-center gap-4 mt-3 rounded-xl bg-stone-100 border border-stone-200 px-4 py-2.5">
                      <span className="text-xs text-stone-400">Precio/metro:</span>
                      <span className="text-sm font-mono tabular-nums text-stone-700 font-semibold">{fmt$(pMetro)}</span>
                      <span className="text-stone-300">→</span>
                      <span className="text-xs text-stone-400">Costo esta tela:</span>
                      <span className={`text-base font-bold font-mono tabular-nums ml-auto ${costoTela > 0 ? 'text-violet-700' : 'text-stone-400'}`}>
                        {fmt$(costoTela)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Servicios fijos */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <p className={`${sec} mb-3`}>Servicios fijos</p>
            <div className="grid grid-cols-3 gap-4">
              {([
                { label: 'Corte $',    field: 'costoCorte',    val: datos.costoCorte },
                { label: 'Tizada $',   field: 'costoTizada',   val: datos.costoTizada },
                { label: 'Lavadero $', field: 'costoLavadero', val: datos.costoLavadero },
              ] as const).map(r => (
                <div key={r.field}>
                  <label className={lbl}>{r.label}</label>
                  <input type="number" value={r.val || ''} onChange={e => updDatos(r.field, e.target.value)}
                    placeholder="0" min="0" step="0.01" className={inp} />
                </div>
              ))}
            </div>
          </div>

          {/* MO Confección */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <p className={`${sec} mb-3`}>MO Confección</p>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className={lbl}>Tiempo de confección (minutos)</label>
                <input type="number" value={datos.tiempoConfeccion || ''} onChange={e => updDatos('tiempoConfeccion', e.target.value)}
                  placeholder="Ej: 45" min="0" step="0.5" className={inp} />
              </div>
              <div className="text-right pb-1">
                <p className="text-xs text-stone-400">Costo MO</p>
                <p className="text-base font-bold text-stone-800">{fmt$(calc.costoMO)}</p>
                {costoMinuto === 0 && <p className="text-xs text-amber-500 mt-0.5">Sin valor hora configurado</p>}
              </div>
            </div>

            {/* Obtener desde producción real */}
            {sku.trim() && (
              <div className="mt-4 border-t border-stone-100 pt-4">
                {!tiempoProduccion && !sinDatosProduccion && (
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs text-stone-400">
                      Calcular promedio real desde registros de producción del SKU{' '}
                      <span className="font-mono font-semibold text-stone-600">{sku}</span>
                    </p>
                    <button type="button" onClick={fetchTiempoSku} disabled={loadingTiempo}
                      className="shrink-0 text-xs px-3 py-1.5 border border-stone-200 rounded-lg text-stone-600 hover:border-violet-400 hover:text-violet-700 transition disabled:opacity-50">
                      {loadingTiempo ? 'Consultando...' : '↓ Obtener de producción'}
                    </button>
                  </div>
                )}
                {sinDatosProduccion && (
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs text-stone-400">
                      Sin registros de producción para <span className="font-mono">{sku}</span>
                    </p>
                    <button type="button" onClick={() => setSinDatosProduccion(false)}
                      className="text-xs text-stone-300 hover:text-stone-500 px-1">✕</button>
                  </div>
                )}
                {tiempoProduccion && (
                  <div className="flex items-center justify-between gap-4 bg-violet-50 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold text-violet-700">
                        Promedio real: {tiempoProduccion.minutos} min/prenda
                      </p>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {tiempoProduccion.registros} registros · {tiempoProduccion.cantidadTotal} prendas producidas
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button"
                        onClick={() => { updDatos('tiempoConfeccion', String(tiempoProduccion.minutos)); setTiempoProduccion(null); }}
                        className="text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold transition">
                        Usar {tiempoProduccion.minutos} min
                      </button>
                      <button type="button" onClick={() => setTiempoProduccion(null)}
                        className="text-xs text-stone-400 hover:text-stone-600 px-1">✕</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Varios */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className={sec}>Varios</p>
              <button type="button" onClick={addVario}
                className="text-xs px-3 py-1 border border-stone-200 rounded-lg text-stone-600 hover:border-stone-400 transition">
                + Agregar
              </button>
            </div>
            {datos.varios.length === 0 && <p className="text-xs text-stone-400 italic">Sin ítems varios</p>}
            <div className="space-y-2">
              {datos.varios.map((v, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                  <input type="text" value={v.nombre} onChange={e => updVario(i, 'nombre', e.target.value)}
                    placeholder="Descripción" className={inp} />
                  <input type="number" value={v.costo || ''} onChange={e => updVario(i, 'costo', e.target.value)}
                    placeholder="$" min="0" step="0.01" className={inp} />
                  <button type="button" onClick={() => delVario(i)}
                    className="text-stone-300 hover:text-red-400 transition text-xl leading-none">×</button>
                </div>
              ))}
            </div>
          </div>

          {/* Terminación y Avíos */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <p className={`${sec} mb-4`}>Terminación y Avíos</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className={lbl}>Etiqueta principal $</label>
                <input type="number" value={datos.avios.etiquetaPrincipal || ''} onChange={e => updAvios('etiquetaPrincipal', e.target.value)}
                  placeholder="0" min="0" step="0.01" className={inp} />
              </div>
              <div>
                <label className={lbl}>Etiqueta composición $</label>
                <input type="number" value={datos.avios.etiquetaComposicion || ''} onChange={e => updAvios('etiquetaComposicion', e.target.value)}
                  placeholder="0" min="0" step="0.01" className={inp} />
              </div>
              <div>
                <label className={lbl}>Bolsa polipropileno $</label>
                <input type="number" value={datos.avios.bolsaPolipropileno || ''} onChange={e => updAvios('bolsaPolipropileno', e.target.value)}
                  placeholder="0" min="0" step="0.01" className={inp} />
              </div>
              <div>
                <label className={lbl}>Tiempo embolsado (min)</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={datos.avios.tiempoEmbolsado || ''} onChange={e => updAvios('tiempoEmbolsado', e.target.value)}
                    placeholder="0" min="0" step="0.5" className={inp} />
                  <span className="text-xs text-stone-400 shrink-0 tabular-nums">= {fmt$(datos.avios.tiempoEmbolsado * costoMinuto)}</span>
                </div>
              </div>
            </div>
            <div className="border-t border-stone-100 pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-stone-500 font-semibold">Extras avíos</p>
                <button type="button" onClick={addAvioExtra}
                  className="text-xs px-3 py-1 border border-stone-200 rounded-lg text-stone-600 hover:border-stone-400 transition">
                  + Agregar
                </button>
              </div>
              {datos.avios.extras.length === 0 && <p className="text-xs text-stone-400 italic">Sin extras</p>}
              <div className="space-y-2">
                {datos.avios.extras.map((ex, i) => (
                  <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                    <input type="text" value={ex.nombre} onChange={e => updAvioExtra(i, 'nombre', e.target.value)}
                      placeholder="Descripción" className={inp} />
                    <input type="number" value={ex.costo || ''} onChange={e => updAvioExtra(i, 'costo', e.target.value)}
                      placeholder="$" min="0" step="0.01" className={inp} />
                    <button type="button" onClick={() => delAvioExtra(i)}
                      className="text-stone-300 hover:text-red-400 transition text-xl leading-none">×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Márgenes */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <p className={`${sec} mb-3`}>Márgenes de seguridad</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Margen de desarrollo %</label>
                <input type="number" value={datos.margenDesarrollo} onChange={e => updDatos('margenDesarrollo', e.target.value)}
                  placeholder="10" min="0" max="100" step="0.5" className={inp} />
              </div>
              <div>
                <label className={lbl}>Margen de fallas %</label>
                <input type="number" value={datos.margenFallas} onChange={e => updDatos('margenFallas', e.target.value)}
                  placeholder="5" min="0" max="100" step="0.5" className={inp} />
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div className="bg-stone-900 rounded-2xl p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-4">Resumen de costos</p>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Telas',                                  val: calc.costoTelas },
                { label: 'Servicios (corte + tizada + lavadero)', val: calc.costoServicios },
                { label: 'MO Confección',                          val: calc.costoMO },
                { label: 'Varios',                                 val: calc.costoVarios },
                { label: 'Terminación y avíos',                    val: calc.costoAvios },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-stone-300">
                  <span>{row.label}</span>
                  <span className="tabular-nums">{fmt$(row.val)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-stone-700 pt-2 mt-1 font-semibold text-stone-200">
                <span>Costo base</span>
                <span className="tabular-nums">{fmt$(calc.costoBase)}</span>
              </div>
              <div className="flex justify-between text-stone-500 text-xs">
                <span>+ Margen desarrollo ({datos.margenDesarrollo}%)</span>
                <span className="tabular-nums">+{fmt$(calc.costoBase * datos.margenDesarrollo / 100)}</span>
              </div>
              <div className="flex justify-between text-stone-500 text-xs">
                <span>+ Margen fallas ({datos.margenFallas}%)</span>
                <span className="tabular-nums">+{fmt$(calc.conDesarrollo * datos.margenFallas / 100)}</span>
              </div>
              <div className="flex justify-between border-t border-stone-700 pt-3 mt-1">
                <span className="text-base font-bold">Costo total unitario</span>
                <span className="text-xl font-bold text-amber-400 tabular-nums">{fmt$(calc.costoTotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={saving || !nombre.trim()}
              className="flex-1 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-semibold transition">
              {saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear escandallo'}
            </button>
            <button type="button" onClick={resetForm}
              className="px-5 py-3 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
