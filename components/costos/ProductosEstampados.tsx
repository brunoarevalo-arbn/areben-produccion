'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { toast } from '@/components/ui/Toaster';
import { parseDatos, calcular, type Margenes } from '@/lib/costos/escandallo';
import { costoEstampa } from '@/lib/costos/estampaCosto';

interface Escandallo { id: string; nombre: string; sku: string | null; marca: string | null; datos: string | null; }
interface EstampaOpt { id: string; codigoInterno: string; nombreComercial: string | null; anchoCm: string | number; largoCm: string | number; mermaPercent: string | number; }
interface LineaEstampa { id: number; estampaId: string; costoEstampado: string; }
interface Producto { id: string; nombre: string; sku: string | null; marca: string | null; lisoEscandalloId: string; estampas: { estampaId: string; costoEstampado: number }[]; notas: string | null; }

const inp = 'px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

export function ProductosEstampados() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [escandallos, setEscandallos] = useState<Escandallo[]>([]);
  const [estampas, setEstampas] = useState<EstampaOpt[]>([]);
  const [cfgDTF, setCfgDTF] = useState({ dtfPrecioMetro: 0, dtfAnchoCm: 58 });
  const [costoMinuto, setCostoMinuto] = useState(0);
  const [margenes, setMargenes] = useState<Margenes>({ margenDesarrollo: 10, margenFallas: 5 });

  // Editor
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [sku, setSku] = useState('');
  const [marca, setMarca] = useState('');
  const [lisoId, setLisoId] = useState('');
  const [notas, setNotas] = useState('');
  const [lineas, setLineas] = useState<LineaEstampa[]>([{ id: 0, estampaId: '', costoEstampado: '' }]);
  const seq = useRef(1);
  const [saving, setSaving] = useState(false);

  const cargarProductos = useCallback(async () => {
    const r = await fetch('/api/costos/productos-estampados');
    if (r.ok) setProductos(await r.json());
  }, []);

  useEffect(() => {
    cargarProductos();
    fetch('/api/costos/escandallos').then((r) => r.ok ? r.json() : []).then((e) => { if (Array.isArray(e)) setEscandallos(e); }).catch(() => {});
    fetch('/api/estampas').then((r) => r.ok ? r.json() : []).then((e) => { if (Array.isArray(e)) setEstampas(e); }).catch(() => {});
    fetch('/api/estampas/config').then((r) => r.ok ? r.json() : null).then((c) => { if (c) setCfgDTF({ dtfPrecioMetro: c.dtfPrecioMetro, dtfAnchoCm: c.dtfAnchoCm }); }).catch(() => {});
    fetch('/api/costos/config').then((r) => r.ok ? r.json() : null).then((c) => { if (c && typeof c.margenDesarrollo === 'number') setMargenes({ margenDesarrollo: c.margenDesarrollo, margenFallas: c.margenFallas }); }).catch(() => {});
    Promise.all([
      fetch('/api/costos/gastos').then((r) => r.json()),
      fetch('/api/costos/costureras').then((r) => r.json()),
    ]).then(([gastos, { costureras }]) => {
      if (!Array.isArray(gastos) || !Array.isArray(costureras)) return;
      const totalGastos = gastos.filter((g: { activo: boolean }) => g.activo).reduce((s: number, g: { monto: number }) => s + g.monto, 0);
      const totalCosturas = costureras.reduce((s: number, c: { sueldoBruto: number; cargasSociales: number }) => s + c.sueldoBruto + c.cargasSociales, 0);
      const totalHoras = costureras.reduce((s: number, c: { horasMes: number }) => s + c.horasMes, 0);
      setCostoMinuto(totalHoras > 0 ? (totalGastos + totalCosturas) / totalHoras / 60 : 0);
    }).catch(() => {});
  }, [cargarProductos]);

  // Costo del liso (referencia viva) desde su escandallo.
  const lisoTotal = (escId: string): number | null => {
    const e = escandallos.find((x) => x.id === escId);
    if (!e) return null;
    return calcular(parseDatos(e.datos), costoMinuto, margenes).costoTotal;
  };
  const costoDTF = (estampaId: string): number => {
    const e = estampas.find((x) => x.id === estampaId);
    if (!e) return 0;
    return costoEstampa({ anchoCm: Number(e.anchoCm), largoCm: Number(e.largoCm), mermaPercent: Number(e.mermaPercent) }, cfgDTF);
  };
  const estampaLabel = (e: EstampaOpt) => `${e.codigoInterno}${e.nombreComercial ? ` · ${e.nombreComercial}` : ''}`;

  const totalProducto = (p: Producto): { liso: number | null; total: number } => {
    const liso = lisoTotal(p.lisoEscandalloId);
    const est = p.estampas.reduce((s, l) => s + costoDTF(l.estampaId) + (Number(l.costoEstampado) || 0), 0);
    return { liso, total: (liso ?? 0) + est };
  };

  const resetForm = () => { setEditId(null); setNombre(''); setSku(''); setMarca(''); setLisoId(''); setNotas(''); setLineas([{ id: 0, estampaId: '', costoEstampado: '' }]); seq.current = 1; };
  const abrirNuevo = () => { resetForm(); setShowForm(true); };
  const abrirEdicion = (p: Producto) => {
    setEditId(p.id); setNombre(p.nombre); setSku(p.sku ?? ''); setMarca(p.marca ?? ''); setLisoId(p.lisoEscandalloId); setNotas(p.notas ?? '');
    setLineas(p.estampas.length ? p.estampas.map((l, i) => ({ id: i, estampaId: l.estampaId, costoEstampado: l.costoEstampado ? String(l.costoEstampado) : '' })) : [{ id: 0, estampaId: '', costoEstampado: '' }]);
    seq.current = p.estampas.length + 1;
    setShowForm(true);
  };

  const guardar = async () => {
    if (!nombre.trim()) { toast.error('Poné un nombre'); return; }
    if (!lisoId) { toast.error('Elegí el liso base'); return; }
    const estampasBody = lineas.filter((l) => l.estampaId).map((l) => ({ estampaId: l.estampaId, costoEstampado: parseFloat(l.costoEstampado) || 0 }));
    setSaving(true);
    const body = { nombre: nombre.trim(), sku: sku.trim() || null, marca: marca.trim() || null, lisoEscandalloId: lisoId, estampas: estampasBody, notas: notas.trim() || null };
    const r = await fetch(editId ? `/api/costos/productos-estampados/${editId}` : '/api/costos/productos-estampados', {
      method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (r.ok) { setShowForm(false); resetForm(); cargarProductos(); toast.success(editId ? 'Producto actualizado' : 'Producto creado'); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo guardar'); }
    setSaving(false);
  };

  const eliminar = async (p: Producto) => {
    if (!(await confirmAsync({ message: `¿Eliminar "${p.nombre}"?`, danger: true, confirmLabel: 'Eliminar' }))) return;
    const r = await fetch(`/api/costos/productos-estampados/${p.id}`, { method: 'DELETE' });
    if (r.ok) setProductos((prev) => prev.filter((x) => x.id !== p.id)); else toast.error('No se pudo eliminar');
  };

  // Total en vivo del editor
  const lisoVivo = lisoId ? lisoTotal(lisoId) : null;
  const estVivo = lineas.reduce((s, l) => s + (l.estampaId ? costoDTF(l.estampaId) + (parseFloat(l.costoEstampado) || 0) : 0), 0);
  const totalVivo = (lisoVivo ?? 0) + estVivo;

  return (
    <div className="space-y-5 max-w-3xl">
      {!showForm && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-stone-500">Producto final = costo del liso (escandallo) + estampa(s). El liso se referencia vivo.</p>
          <Button onClick={abrirNuevo}>+ Nuevo</Button>
        </div>
      )}

      {showForm && (
        <Card padding="none" className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-800">{editId ? 'Editar producto con estampa' : 'Nuevo producto con estampa'}</h3>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="text-xs text-stone-400 hover:text-stone-700">✕ Cancelar</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className="text-xs font-semibold text-stone-600 mb-1 block">Nombre *</label><input value={nombre} onChange={(e) => setNombre(e.target.value)} className={`${inp} w-full`} placeholder="Ej: BABY TEE NOT" /></div>
            <div><label className="text-xs font-semibold text-stone-600 mb-1 block">SKU</label><input value={sku} onChange={(e) => setSku(e.target.value)} className={`${inp} w-full`} placeholder="(opcional)" /></div>
            <div><label className="text-xs font-semibold text-stone-600 mb-1 block">Marca</label><input value={marca} onChange={(e) => setMarca(e.target.value)} className={`${inp} w-full`} placeholder="(opcional)" /></div>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1 block">Liso base (escandallo)</label>
            <select value={lisoId} onChange={(e) => setLisoId(e.target.value)} className={`${inp} w-full`}>
              <option value="">— elegí el liso —</option>
              {escandallos.map((e) => <option key={e.id} value={e.id}>{e.nombre}{e.sku ? ` · ${e.sku}` : ''}</option>)}
            </select>
            {lisoId && <p className="text-xs text-stone-500 mt-1">Costo del liso: <strong>{lisoVivo == null ? 'liso no encontrado' : fmt$(lisoVivo)}</strong></p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-600 block">Estampas</label>
              <button type="button" onClick={() => setLineas((p) => [...p, { id: seq.current++, estampaId: '', costoEstampado: '' }])}
                className="text-xs px-2.5 py-1 border border-stone-200 rounded-lg text-stone-600 hover:border-stone-400 transition">+ Estampa</button>
            </div>
            {lineas.map((l) => {
              const dtf = l.estampaId ? costoDTF(l.estampaId) : 0;
              return (
                <div key={l.id} className="grid grid-cols-[1fr_8rem_auto] gap-2 items-center">
                  <select value={l.estampaId} onChange={(e) => setLineas((p) => p.map((x) => x.id === l.id ? { ...x, estampaId: e.target.value } : x))} className={`${inp} w-full`}>
                    <option value="">— elegí estampa —</option>
                    {estampas.map((e) => <option key={e.id} value={e.id}>{estampaLabel(e)}</option>)}
                  </select>
                  <div>
                    <NumInput value={parseFloat(l.costoEstampado) || 0} onChange={(n) => setLineas((p) => p.map((x) => x.id === l.id ? { ...x, costoEstampado: n ? String(n) : '' } : x))} min="0" placeholder="MO $" className={`${inp} w-full`} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-400 whitespace-nowrap w-24 text-right">{l.estampaId ? `DTF ${fmt$(dtf)}` : ''}</span>
                    <button type="button" onClick={() => setLineas((p) => p.length > 1 ? p.filter((x) => x.id !== l.id) : p)} className="text-stone-300 hover:text-red-400 text-xl leading-none">×</button>
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] text-stone-400">DTF = material (automático del catálogo). MO $ = costo de estampado que asignás a mano.</p>
          </div>

          <div className="flex items-center gap-4 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5">
            <span className="text-xs text-stone-400">Total producto final:</span>
            <span className="text-lg font-bold font-mono tabular-nums text-emerald-700">{fmt$(totalVivo)}</span>
            <span className="text-xs text-stone-400">= liso {fmt$(lisoVivo ?? 0)} + estampas {fmt$(estVivo)}</span>
          </div>

          <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas (opcional)" className={`${inp} w-full`} />
          <div className="flex gap-2">
            <Button onClick={guardar} isLoading={saving}>{editId ? 'Guardar' : 'Crear'}</Button>
            <Button variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</Button>
          </div>
        </Card>
      )}

      {!showForm && (
        productos.length === 0 ? (
          <EmptyState title="Sin productos con estampa" message="Creá uno: liso base (escandallo) + la(s) estampa(s) del catálogo." />
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
            {productos.map((p) => {
              const { liso, total } = totalProducto(p);
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 md:px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-stone-800 truncate">{p.nombre}{p.sku && <span className="text-xs text-stone-400 font-mono ml-2">{p.sku}</span>}</p>
                    <p className="text-xs text-stone-400">{p.estampas.length} estampa{p.estampas.length !== 1 ? 's' : ''} · liso {liso == null ? '— (no encontrado)' : fmt$(liso)}</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-emerald-700 w-24 text-right">{fmt$(total)}</span>
                  <div className="flex gap-1.5 shrink-0">
                    <Button variant="secondary" size="sm" onClick={() => abrirEdicion(p)}>Editar</Button>
                    <button onClick={() => eliminar(p)} aria-label="Eliminar" className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
