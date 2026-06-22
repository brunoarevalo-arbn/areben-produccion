'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import {
  type DatosEscandallo, type Margenes, type Tela, type ItemExtra,
  DEFAULT_DATOS, TELA_EMPTY,
  deepClone, parseDatos, calcular, itemCosto,
} from '@/lib/costos/escandallo';
import { confirmAsync } from '@/components/ui/ConfirmProvider';

interface Escandallo {
  id: string; nombre: string; sku: string | null; marca: string | null;
  tipoPrenda: string | null; notas: string | null; datos: string | null;
  createdAt: string; updatedAt: string;
}
interface ProductoProd {
  sku: string;
  marca: string;
  descripcion: string | null;
  costoTelaUnit: number | null;
  costoCorteUnit: number | null;
  tieneFicha: boolean;
  tieneEscandallo: boolean;
  descartado: boolean;
}
interface EtiquetaOpt { id: string; nombre: string; tipo: string | null; precio: number; }
interface CostoCorteOpt { id: string; tipoPrenda: string; costo: number; }

const MARCAS = ['Zattia', 'Stunned'];

function pf(v: string) { return parseFloat(v) || 0; }
function fmt$(n: number) { return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export function Escandallos() {
  const router = useRouter();
  const [lista,    setLista]    = useState<Escandallo[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState<string | null>(null);
  const [costoMinuto, setCostoMinuto] = useState(0);
  const [margenes, setMargenes] = useState<Margenes>({ margenDesarrollo: 10, margenFallas: 5 });
  const [productos, setProductos] = useState<ProductoProd[]>([]);
  const [etiquetas, setEtiquetas] = useState<EtiquetaOpt[]>([]);
  const [costosCorte, setCostosCorte] = useState<CostoCorteOpt[]>([]);
  const [modoProducido, setModoProducido] = useState(false);
  const [subTab, setSubTab] = useState<'pendientes' | 'listos'>('pendientes');
  const [verDescartados, setVerDescartados] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/costos/gastos').then((r) => r.json()),
      fetch('/api/costos/costureras').then((r) => r.json()),
    ]).then(([gastos, { costureras }]) => {
      if (!Array.isArray(gastos) || !Array.isArray(costureras)) return;
      const totalGastos   = gastos.filter((g: { activo: boolean; monto: number }) => g.activo).reduce((s: number, g: { monto: number }) => s + g.monto, 0);
      const totalCosturas = costureras.reduce((s: number, c: { sueldoBruto: number; cargasSociales: number }) => s + c.sueldoBruto + c.cargasSociales, 0);
      const totalHoras    = costureras.reduce((s: number, c: { horasMes: number }) => s + c.horasMes, 0);
      const valorHora     = totalHoras > 0 ? (totalGastos + totalCosturas) / totalHoras : 0;
      setCostoMinuto(valorHora / 60);
    }).catch(() => {});

    fetch('/api/costos/config')
      .then((r) => r.json())
      .then((c) => { if (c && typeof c.margenDesarrollo === 'number') setMargenes({ margenDesarrollo: c.margenDesarrollo, margenFallas: c.margenFallas }); })
      .catch(() => {});

    fetch('/api/costos/productos-producidos')
      .then((r) => r.json())
      .then((p) => { if (Array.isArray(p)) setProductos(p); })
      .catch(() => {});

    fetch('/api/costos/etiquetas')
      .then((r) => r.ok ? r.json() : [])
      .then((e) => { if (Array.isArray(e)) setEtiquetas(e.map((x) => ({ ...x, precio: Number(x.precio) }))); })
      .catch(() => {});

    fetch('/api/costos/costos-corte')
      .then((r) => r.ok ? r.json() : [])
      .then((c) => { if (Array.isArray(c)) setCostosCorte(c.map((x) => ({ ...x, costo: Number(x.costo) }))); })
      .catch(() => {});
  }, []);

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
    setModoProducido(false);
  };

  const openEdit = (e: Escandallo) => {
    setEditId(e.id);
    setNombre(e.nombre); setSku(e.sku ?? ''); setMarca(e.marca ?? '');
    setTipoPrenda(e.tipoPrenda ?? ''); setNotas(e.notas ?? '');
    setDatos(parseDatos(e.datos));
    setShowForm(true);
  };

  // Telas
  const addTela = () => setDatos(prev => ({ ...prev, telas: [...prev.telas, { ...TELA_EMPTY }] }));
  const updTela = (i: number, field: string, val: string) =>
    setDatos(prev => ({ ...prev, telas: prev.telas.map((t, idx) => idx !== i ? t : ({ ...t, [field]: field === 'nombre' ? val : pf(val) } as Tela)) }));
  const delTela = (i: number) => setDatos(prev => ({ ...prev, telas: prev.telas.filter((_, idx) => idx !== i) }));

  // Varios
  const addVario = () => setDatos(prev => ({ ...prev, varios: [...prev.varios, { nombre: '', cantidad: 1, costoUnitario: 0 }] }));
  const updVario = (i: number, field: string, val: string) =>
    setDatos(prev => ({ ...prev, varios: prev.varios.map((v, idx) => idx !== i ? v : ({ ...v, [field]: field === 'nombre' ? val : pf(val) } as ItemExtra)) }));
  const delVario = (i: number) => setDatos(prev => ({ ...prev, varios: prev.varios.filter((_, idx) => idx !== i) }));

  // Avíos extras
  const addAvioExtra = () => setDatos(prev => ({ ...prev, avios: { ...prev.avios, extras: [...prev.avios.extras, { nombre: '', cantidad: 1, costoUnitario: 0 }] } }));
  const updAvioExtra = (i: number, field: string, val: string) =>
    setDatos(prev => ({ ...prev, avios: { ...prev.avios, extras: prev.avios.extras.map((e, idx) => idx !== i ? e : ({ ...e, [field]: field === 'nombre' ? val : pf(val) } as ItemExtra)) } }));
  const delAvioExtra = (i: number) => setDatos(prev => ({ ...prev, avios: { ...prev.avios, extras: prev.avios.extras.filter((_, idx) => idx !== i) } }));

  const updDatos = (field: string, val: string) => setDatos(prev => ({ ...prev, [field]: pf(val) }));
  const updAvios = (field: string, val: string) => setDatos(prev => ({ ...prev, avios: { ...prev.avios, [field]: pf(val) } }));

  // Elegir una etiqueta del catálogo: trae su precio (snapshot) y guarda la
  // referencia. Vaciar la selección deja el precio editable a mano.
  const elegirEtiqueta = (campo: 'etiquetaPrincipal' | 'etiquetaComposicion', etiquetaId: string) => {
    const et = etiquetas.find(e => e.id === etiquetaId) || null;
    const idKey = campo === 'etiquetaPrincipal' ? 'etiquetaPrincipalId' : 'etiquetaComposicionId';
    setDatos(prev => ({
      ...prev,
      avios: { ...prev.avios, ...(et ? { [campo]: et.precio } : {}), [idKey]: et ? et.id : null },
    }));
  };

  // Costo de corte de referencia para el tipo de prenda cargado (match flexible).
  const costoCorteSugerido = tipoPrenda.trim()
    ? costosCorte.find(c => c.tipoPrenda.trim().toLowerCase() === tipoPrenda.trim().toLowerCase()) ?? null
    : null;

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

  const seleccionarProducto = async (p: ProductoProd) => {
    setSku(p.sku);
    setNombre(p.descripcion || p.sku);
    setMarca(p.marca);
    setDatos(prev => ({
      ...prev,
      costoTelaFicha: p.costoTelaUnit != null ? p.costoTelaUnit : undefined,
      // Un solo corte por SKU: si la ficha tiene costo de corte, se trae y se bloquea.
      costoCorteFicha: p.costoCorteUnit != null ? p.costoCorteUnit : undefined,
      costoCorte: p.costoCorteUnit != null ? p.costoCorteUnit : prev.costoCorte,
    }));
    setTiempoProduccion(null);
    setSinDatosProduccion(false);
    setLoadingTiempo(true);
    try {
      const r = await fetch(`/api/produccion/tiempo-sku?sku=${encodeURIComponent(p.sku)}`);
      if (r.ok) {
        const d = await r.json();
        if (d.encontrado) {
          setTiempoProduccion({ minutos: d.minutosPromedio, registros: d.registros, cantidadTotal: d.cantidadTotal });
          setDatos(prev => ({ ...prev, tiempoConfeccion: d.minutosPromedio }));
        } else {
          setSinDatosProduccion(true);
        }
      }
    } catch { /* ignore */ }
    setLoadingTiempo(false);
  };

  const onSelectProducidoSku = (skuSel: string) => {
    const p = productos.find(x => x.sku === skuSel);
    if (p) seleccionarProducto(p);
  };

  const costearPendiente = (p: ProductoProd) => {
    setShowForm(true);
    setModoProducido(true);
    seleccionarProducto(p);
  };

  const descartarSku = async (skuDesc: string) => {
    setProductos(prev => prev.map(p => p.sku === skuDesc ? { ...p, descartado: true } : p));
    try {
      await fetch('/api/costos/productos-producidos/descartar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku: skuDesc }),
      });
    } catch { setProductos(prev => prev.map(p => p.sku === skuDesc ? { ...p, descartado: false } : p)); }
  };

  const recuperarSku = async (skuRec: string) => {
    setProductos(prev => prev.map(p => p.sku === skuRec ? { ...p, descartado: false } : p));
    try {
      await fetch('/api/costos/productos-producidos/descartar', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku: skuRec }),
      });
    } catch { setProductos(prev => prev.map(p => p.sku === skuRec ? { ...p, descartado: true } : p)); }
  };

  const calc = calcular(datos, costoMinuto, margenes);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true);
    datos.margenDesarrollo = margenes.margenDesarrollo;
    datos.margenFallas = margenes.margenFallas;
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

  const duplicar = async (e: Escandallo) => {
    let datosObj: unknown = null;
    try { datosObj = e.datos ? JSON.parse(e.datos) : null; } catch { datosObj = null; }
    // El SKU identifica un producto puntual: no se copia para no duplicarlo.
    const body = {
      nombre: `${e.nombre} (copia)`, sku: '', marca: e.marca ?? '',
      tipoPrenda: e.tipoPrenda ?? '', notas: e.notas ?? '', datos: datosObj,
    };
    const r = await fetch('/api/costos/escandallos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (r.ok) { const data = await r.json(); setLista(prev => [data, ...prev]); }
  };

  const eliminar = async (id: string, nom: string) => {
    if (!(await confirmAsync({ message: `¿Eliminar el escandallo "${nom}"?`, danger: true, confirmLabel: 'Eliminar' }))) return;
    const r = await fetch(`/api/costos/escandallos/${id}`, { method: 'DELETE' });
    if (r.ok) setLista(prev => prev.filter(e => e.id !== id));
  };

  if (loading) return <div className="text-center py-16 text-stone-400 text-sm">Cargando...</div>;

  const inp = 'w-full px-2.5 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';
  const lbl = 'text-xs text-stone-400 mb-1 block';
  const sec = 'text-xs font-bold uppercase tracking-widest text-stone-500';

  return (
    <div className="space-y-5 max-w-4xl">

      {/* ── Lista ── */}
      {!showForm && (() => {
        const pendientes  = productos.filter(p => !p.tieneEscandallo && !p.descartado);
        const descartados = productos.filter(p => !p.tieneEscandallo && p.descartado);
        const pill = (active: boolean) =>
          `px-4 py-2 text-sm font-semibold rounded-xl transition ${
            active ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500 hover:text-stone-800'}`;
        const count = (n: number, active: boolean) =>
          n > 0 ? <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-stone-200 text-stone-600'}`}>{n}</span> : null;

        return (
          <>
            {/* Sub-tabs */}
            <div className="flex gap-2">
              <button onClick={() => setSubTab('pendientes')} className={pill(subTab === 'pendientes')}>
                Pendientes de costear{count(pendientes.length, subTab === 'pendientes')}
              </button>
              <button onClick={() => setSubTab('listos')} className={pill(subTab === 'listos')}>
                Costos listos{count(lista.length, subTab === 'listos')}
              </button>
            </div>

            {/* Pendientes */}
            {subTab === 'pendientes' && (
              <div className="space-y-3">
                {pendientes.length === 0 && (
                  <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center">
                    <p className="text-stone-400 text-sm">No hay SKU producidos pendientes de costear.</p>
                  </div>
                )}
                {pendientes.map(p => (
                  <div key={p.sku} className="flex items-center gap-3 bg-white rounded-2xl border border-amber-200 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-xs bg-stone-100 px-2 py-0.5 rounded text-stone-600">{p.sku}</span>
                      {p.marca && <span className="text-xs text-stone-400 ml-2">{p.marca}</span>}
                      {p.descripcion && <span className="text-sm text-stone-600 ml-2">{p.descripcion}</span>}
                    </div>
                    <button onClick={() => costearPendiente(p)}
                      className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold transition">
                      Costear
                    </button>
                    <Button variant="secondary" size="sm" onClick={() => descartarSku(p.sku)} className="shrink-0">
                      No costear
                    </Button>
                  </div>
                ))}

                {/* Descartados */}
                {descartados.length > 0 && (
                  <div className="pt-2">
                    <button onClick={() => setVerDescartados(v => !v)}
                      className="text-xs font-semibold text-stone-400 hover:text-stone-600 transition">
                      {verDescartados ? '▾' : '▸'} Descartados ({descartados.length})
                    </button>
                    {verDescartados && (
                      <div className="space-y-2 mt-3">
                        {descartados.map(p => (
                          <div key={p.sku} className="flex items-center gap-3 bg-stone-50 rounded-xl border border-stone-200 px-4 py-2.5">
                            <div className="flex-1 min-w-0">
                              <span className="font-mono text-xs bg-stone-100 px-2 py-0.5 rounded text-stone-500">{p.sku}</span>
                              {p.marca && <span className="text-xs text-stone-400 ml-2">{p.marca}</span>}
                              {p.descripcion && <span className="text-sm text-stone-500 ml-2">{p.descripcion}</span>}
                            </div>
                            <Button variant="secondary" size="sm" onClick={() => recuperarSku(p.sku)} className="shrink-0">
                              Recuperar
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Costos listos */}
            {subTab === 'listos' && (
              <>
                <div className="space-y-3">
                  {lista.length === 0 && (
                    <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center">
                      <p className="text-stone-400 text-sm">No hay escandallos creados todavía.</p>
                    </div>
                  )}
                  {lista.map(e => {
                    const c = calcular(parseDatos(e.datos), costoMinuto, margenes);
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
                          <Button variant="secondary" size="sm" onClick={() => openEdit(e)}>
                            Editar
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => duplicar(e)}>
                            Duplicar
                          </Button>
                          <button onClick={() => eliminar(e.id, e.nombre)} aria-label="Eliminar"
                            className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">×</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Button onClick={() => setShowForm(true)}>
                  + Nuevo escandallo
                </Button>
              </>
            )}
          </>
        );
      })()}

      {/* ── Formulario ── */}
      {showForm && (
        <form onSubmit={guardar} className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-800">{editId ? 'Editar' : 'Nuevo'} escandallo</h3>
            <button type="button" onClick={resetForm} className="text-xs text-stone-400 hover:text-stone-700 transition">✕ Cancelar</button>
          </div>

          {/* Selector de producto */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
            <p className={sec}>¿Qué producto querés costear?</p>
            <div className="flex gap-2">
              <button type="button"
                onClick={() => setModoProducido(true)}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border transition ${modoProducido ? 'bg-violet-600 border-violet-600 text-white' : 'border-stone-200 text-stone-600 hover:border-stone-400'}`}>
                Producto producido
              </button>
              <button type="button"
                onClick={() => { setModoProducido(false); setDatos(prev => ({ ...prev, costoTelaFicha: undefined, costoCorteFicha: undefined })); }}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border transition ${!modoProducido ? 'bg-violet-600 border-violet-600 text-white' : 'border-stone-200 text-stone-600 hover:border-stone-400'}`}>
                Nuevo producto
              </button>
            </div>
            {modoProducido && (
              <Select label="Elegí un producto ya producido" value={sku} onChange={e => onSelectProducidoSku(e.target.value)} fullWidth>
                <option value="">— Seleccionar producto —</option>
                {productos.map(p => (
                  <option key={p.sku} value={p.sku}>
                    {p.sku}{p.descripcion ? ` · ${p.descripcion}` : ''}
                  </option>
                ))}
              </Select>
            )}
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
          {datos.costoTelaFicha != null ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <p className={`${sec} mb-3`}>Telas — resumen de la ficha de corte</p>
            <div className="rounded-xl bg-violet-50 border border-violet-100 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-600">Costo de tela (incluye insumos del corte)</span>
                <span className="text-base font-bold font-mono tabular-nums text-violet-700">
                  {fmt$(datos.costoTelaFicha)} <span className="text-xs font-normal text-stone-400">/ prenda</span>
                </span>
              </div>
              <p className="text-xs text-stone-400 pt-2 border-t border-violet-100">
                Sale de la ficha de corte del SKU {sku ? <span className="font-mono">{sku}</span> : 'producido'}. No se edita acá: para cambiarlo, corregí la ficha en producción.
              </p>
            </div>
          </div>
          ) : (
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
                    <div className="flex items-end gap-3 mb-3">
                      <div className="flex-1">
                        <label className={lbl}>Nombre de la tela</label>
                        <input type="text" value={t.nombre} onChange={e => updTela(i, 'nombre', e.target.value)}
                          placeholder="Ej: Jersey de algodón, Morley, French terry"
                          className={inp} />
                      </div>
                      {datos.telas.length > 1 && (
                        <button type="button" aria-label="Eliminar tela" onClick={() => delTela(i)}
                          className="text-stone-300 hover:text-red-400 transition text-xl shrink-0 leading-none mb-2">×</button>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className={lbl}>Precio por kg $</label>
                        <p className="text-xs text-stone-300 -mt-0.5 mb-1">precio de lista sin flete</p>
                        <NumInput value={t.precioKgNeto} onChange={n => updTela(i, 'precioKgNeto', String(n))}
                          min="0" step="any" className={inp} />
                      </div>
                      <div>
                        <label className={lbl}>Flete %</label>
                        <p className="text-xs text-stone-300 -mt-0.5 mb-1">% adicional sobre kg</p>
                        <NumInput value={t.fletePercent} onChange={n => updTela(i, 'fletePercent', String(n))}
                          min="0" step="any" className={inp} />
                      </div>
                      <div>
                        <label className={lbl}>Metros por kg</label>
                        <p className="text-xs text-stone-300 -mt-0.5 mb-1">rendimiento de la tela</p>
                        <NumInput value={t.rindeMetrosKg} onChange={n => updTela(i, 'rindeMetrosKg', String(n))}
                          min="0" step="any" className={inp} />
                      </div>
                      <div>
                        <label className={lbl}>Metros por prenda</label>
                        <p className="text-xs text-stone-300 -mt-0.5 mb-1">consumo de esta tela</p>
                        <NumInput value={t.consumoMetros} onChange={n => updTela(i, 'consumoMetros', String(n))}
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
          )}

          {/* Servicios fijos */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <p className={`${sec} mb-3`}>Servicios fijos</p>
            {!datos.costoCorteFicha && costoCorteSugerido && costoCorteSugerido.costo !== datos.costoCorte && (
              <div className="flex items-center justify-between gap-3 bg-violet-50 border border-violet-100 rounded-xl px-4 py-2.5 mb-3">
                <p className="text-xs text-stone-600">
                  Costo de corte para <span className="font-semibold">{costoCorteSugerido.tipoPrenda}</span>:{' '}
                  <span className="font-bold text-violet-700">{fmt$(costoCorteSugerido.costo)}</span>
                </p>
                <button type="button" onClick={() => updDatos('costoCorte', String(costoCorteSugerido.costo))}
                  className="shrink-0 text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold transition">
                  Usar este costo
                </button>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              {([
                { label: 'Corte $',    field: 'costoCorte',    val: datos.costoCorte },
                { label: 'Tizada $',   field: 'costoTizada',   val: datos.costoTizada },
                { label: 'Lavadero $', field: 'costoLavadero', val: datos.costoLavadero },
              ] as const).map(r => (
                <div key={r.field}>
                  <label className={lbl}>{r.label}</label>
                  {r.field === 'costoCorte' && datos.costoCorteFicha != null ? (
                    <div className="rounded-lg bg-violet-50 border border-violet-100 px-3 py-2">
                      <span className="text-sm font-bold font-mono tabular-nums text-violet-700">{fmt$(datos.costoCorteFicha)}</span>
                      <p className="text-xs text-stone-400 mt-0.5">de la ficha de corte</p>
                    </div>
                  ) : (
                    <NumInput value={r.val} onChange={n => updDatos(r.field, String(n))}
                      placeholder="0" min="0" step="0.01" className={inp} />
                  )}
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
                <NumInput value={datos.tiempoConfeccion} onChange={n => updDatos('tiempoConfeccion', String(n))}
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
                    <button type="button" aria-label="Descartar aviso" onClick={() => setSinDatosProduccion(false)}
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
                      <button type="button" aria-label="Descartar" onClick={() => setTiempoProduccion(null)}
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
                <div key={i} className="grid grid-cols-[1fr_64px_110px_90px_auto] gap-2 items-center">
                  <input type="text" value={v.nombre} onChange={e => updVario(i, 'nombre', e.target.value)}
                    placeholder="Descripción" className={inp} />
                  <NumInput value={v.cantidad} onChange={n => updVario(i, 'cantidad', String(n))}
                    placeholder="Cant." min="0" step="1" className={`${inp} text-center`} />
                  <NumInput value={v.costoUnitario} onChange={n => updVario(i, 'costoUnitario', String(n))}
                    placeholder="$ c/u" min="0" step="0.01" className={inp} />
                  <span className="text-xs font-semibold text-stone-600 tabular-nums text-right">{fmt$(itemCosto(v))}</span>
                  <button type="button" aria-label="Eliminar" onClick={() => delVario(i)}
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
                <label className={lbl}>Etiqueta principal</label>
                {etiquetas.length > 0 && (
                  <select value={datos.avios.etiquetaPrincipalId ?? ''} onChange={e => elegirEtiqueta('etiquetaPrincipal', e.target.value)}
                    className={`${inp} mb-1.5`}>
                    <option value="">— Precio manual —</option>
                    {etiquetas.map(et => <option key={et.id} value={et.id}>{et.nombre} · {fmt$(et.precio)}</option>)}
                  </select>
                )}
                <NumInput value={datos.avios.etiquetaPrincipal} onChange={n => updAvios('etiquetaPrincipal', String(n))}
                  placeholder="$ 0" min="0" step="0.01" className={inp} />
              </div>
              <div>
                <label className={lbl}>Etiqueta composición</label>
                {etiquetas.length > 0 && (
                  <select value={datos.avios.etiquetaComposicionId ?? ''} onChange={e => elegirEtiqueta('etiquetaComposicion', e.target.value)}
                    className={`${inp} mb-1.5`}>
                    <option value="">— Precio manual —</option>
                    {etiquetas.map(et => <option key={et.id} value={et.id}>{et.nombre} · {fmt$(et.precio)}</option>)}
                  </select>
                )}
                <NumInput value={datos.avios.etiquetaComposicion} onChange={n => updAvios('etiquetaComposicion', String(n))}
                  placeholder="$ 0" min="0" step="0.01" className={inp} />
              </div>
              <div>
                <label className={lbl}>Bolsa polipropileno $</label>
                <NumInput value={datos.avios.bolsaPolipropileno} onChange={n => updAvios('bolsaPolipropileno', String(n))}
                  placeholder="0" min="0" step="0.01" className={inp} />
              </div>
              <div>
                <label className={lbl}>Tiempo embolsado (min)</label>
                <div className="flex items-center gap-2">
                  <NumInput value={datos.avios.tiempoEmbolsado} onChange={n => updAvios('tiempoEmbolsado', String(n))}
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
                  <div key={i} className="grid grid-cols-[1fr_64px_110px_90px_auto] gap-2 items-center">
                    <input type="text" value={ex.nombre} onChange={e => updAvioExtra(i, 'nombre', e.target.value)}
                      placeholder="Descripción" className={inp} />
                    <NumInput value={ex.cantidad} onChange={n => updAvioExtra(i, 'cantidad', String(n))}
                      placeholder="Cant." min="0" step="1" className={`${inp} text-center`} />
                    <NumInput value={ex.costoUnitario} onChange={n => updAvioExtra(i, 'costoUnitario', String(n))}
                      placeholder="$ c/u" min="0" step="0.01" className={inp} />
                    <span className="text-xs font-semibold text-stone-600 tabular-nums text-right">{fmt$(itemCosto(ex))}</span>
                    <button type="button" aria-label="Eliminar" onClick={() => delAvioExtra(i)}
                      className="text-stone-300 hover:text-red-400 transition text-xl leading-none">×</button>
                  </div>
                ))}
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
                <span>+ Margen desarrollo ({margenes.margenDesarrollo}%)</span>
                <span className="tabular-nums">+{fmt$(calc.costoBase * margenes.margenDesarrollo / 100)}</span>
              </div>
              <div className="flex justify-between text-stone-500 text-xs">
                <span>+ Margen fallas ({margenes.margenFallas}%)</span>
                <span className="tabular-nums">+{fmt$(calc.conDesarrollo * margenes.margenFallas / 100)}</span>
              </div>
              <div className="flex justify-between border-t border-stone-700 pt-3 mt-1">
                <span className="text-base font-bold">Costo total unitario</span>
                <span className="text-xl font-bold text-amber-400 tabular-nums">{fmt$(calc.costoTotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving || !nombre.trim()} isLoading={saving} className="flex-1">
              {editId ? 'Guardar cambios' : 'Crear escandallo'}
            </Button>
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
