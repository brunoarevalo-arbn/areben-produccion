'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { toast } from '@/components/ui/Toaster';
import { parseDatos, calcular, type Margenes } from '@/lib/costos/escandallo';
import { costoEstampa } from '@/lib/costos/estampaCosto';
import { Thumbnail } from '@/components/ui/ImageDrop';
import { lisoValue, parseLisoValue, type LisoRef } from '@/lib/costos/lisoRef';

interface Escandallo { id: string; nombre: string; sku: string | null; marca: string | null; datos: string | null; }
interface EstampaOpt { id: string; codigoInterno: string; nombreComercial: string | null; imagenUrl: string | null; anchoCm: string | number; largoCm: string | number; mermaPercent: string | number; ancho2Cm: string | number; largo2Cm: string | number; merma2Percent: string | number; }
interface LineaEstampa { id: number; estampaId: string; tamano: number; minutosEstampado: string; }
interface BulkRow { id: number; nombre: string; liso: string; estampas: LineaEstampa[]; }
interface EstampaProducto { estampaId: string; tamano?: number; minutosEstampado?: number; costoEstampado?: number }
interface Producto extends LisoRef { id: string; nombre: string; sku: string | null; marca: string | null; estampas: EstampaProducto[]; notas: string | null; }
interface LisoStock { sku: string; total: number }

const tiene2 = (e?: EstampaOpt) => !!e && (Number(e.ancho2Cm) || 0) > 0 && (Number(e.largo2Cm) || 0) > 0;

const inp = 'px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
const fmt1 = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });

export function ProductosEstampados() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [escandallos, setEscandallos] = useState<Escandallo[]>([]);
  // Lisos que sólo existen como SKU en stock_terminado: no tienen costo, pero la receta
  // (esta estampa sobre este liso) se puede declarar igual.
  const [lisosSku, setLisosSku] = useState<LisoStock[]>([]);
  const [estampas, setEstampas] = useState<EstampaOpt[]>([]);
  const [cfgDTF, setCfgDTF] = useState({ dtfPrecioMetro: 0, dtfAnchoCm: 58 });
  const [costoMinuto, setCostoMinuto] = useState(0);        // tarifa costura, para el liso
  const [costoMinutoEst, setCostoMinutoEst] = useState(0);  // tarifa estampería, para la MO de estampa
  const [minGlobal, setMinGlobal] = useState(0);            // promedio global min/estampa del sistema
  const [margenes, setMargenes] = useState<Margenes>({ margenDesarrollo: 10, margenFallas: 5 });

  // Editor
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [sku, setSku] = useState('');
  const [marca, setMarca] = useState('');
  const [lisoId, setLisoId] = useState(''); // value combinado: 'esc:<id>' | 'sku:<SKU>' | ''
  const [notas, setNotas] = useState('');
  const [lineas, setLineas] = useState<LineaEstampa[]>([{ id: 0, estampaId: '', tamano: 1, minutosEstampado: '' }]);
  const seq = useRef(1);
  const [saving, setSaving] = useState(false);

  // Carga masiva (grilla; cada fila = 1 producto con N estampas)
  const [showBulk, setShowBulk] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const bulkSeq = useRef(1);
  const lineaSeq = useRef(1);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Edición masiva de tiempos de estampería (minutos por estampa)
  const [showTiempos, setShowTiempos] = useState(false);
  const [tiempos, setTiempos] = useState<Record<string, string[]>>({});
  const [fillValue, setFillValue] = useState('');
  const [tiemposSaving, setTiemposSaving] = useState(false);

  // Detalle de costo expandible por fila
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExp = (id: string) => setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Selección para exportar
  const [selCsv, setSelCsv] = useState<Set<string>>(new Set());
  const toggleSelCsv = (id: string) => setSelCsv((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [cargando, setCargando] = useState(true);

  const cargarProductos = useCallback(async () => {
    try {
      const r = await fetch('/api/costos/productos-estampados');
      if (r.ok) setProductos(await r.json());
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarProductos();
    fetch('/api/costos/escandallos').then((r) => r.ok ? r.json() : []).then((e) => { if (Array.isArray(e)) setEscandallos(e); }).catch(() => {});
    fetch('/api/reposicion/lisos').then((r) => r.ok ? r.json() : []).then((l) => { if (Array.isArray(l)) setLisosSku(l); }).catch(() => {});
    fetch('/api/estampas').then((r) => r.ok ? r.json() : []).then((e) => { if (Array.isArray(e)) setEstampas(e); }).catch(() => {});
    fetch('/api/estampas/config').then((r) => r.ok ? r.json() : null).then((c) => { if (c) setCfgDTF({ dtfPrecioMetro: c.dtfPrecioMetro, dtfAnchoCm: c.dtfAnchoCm }); }).catch(() => {});
    fetch('/api/costos/config').then((r) => r.ok ? r.json() : null).then((c) => {
      if (!c) return;
      if (typeof c.margenDesarrollo === 'number') setMargenes({ margenDesarrollo: c.margenDesarrollo, margenFallas: c.margenFallas });
      setCostoMinutoEst((Number(c.estampadoValorHora) || 0) / 60);
    }).catch(() => {});
    fetch('/api/estampado/tiempo').then((r) => r.ok ? r.json() : null).then((c) => { if (c && c.minPorEstampa) setMinGlobal(c.minPorEstampa); }).catch(() => {});
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

  // Los SKU de liso que ningún escandallo cubre ya: si el escandallo existe, la opción
  // buena es ésa (trae el costo), así que no se ofrece dos veces el mismo liso.
  const lisosSoloSku = lisosSku.filter((l) => !escandallos.some((e) => e.sku && e.sku === l.sku));

  // Costo del liso (referencia viva) desde su escandallo.
  const lisoTotal = (escId: string | null): number | null => {
    if (!escId) return null;
    const e = escandallos.find((x) => x.id === escId);
    if (!e) return null;
    return calcular(parseDatos(e.datos), costoMinuto, margenes).costoTotal;
  };
  const costoDTF = (estampaId: string, tamano = 1): number => {
    const e = estampas.find((x) => x.id === estampaId);
    if (!e) return 0;
    if (tamano === 2 && tiene2(e)) return costoEstampa({ anchoCm: Number(e.ancho2Cm), largoCm: Number(e.largo2Cm), mermaPercent: Number(e.merma2Percent) }, cfgDTF);
    return costoEstampa({ anchoCm: Number(e.anchoCm), largoCm: Number(e.largoCm), mermaPercent: Number(e.mermaPercent) }, cfgDTF);
  };
  // MO de estampería de una línea guardada: minutos × tarifa; registros viejos caen al monto legacy.
  const moGuardado = (l: EstampaProducto): number =>
    l.minutosEstampado != null ? (l.minutosEstampado * costoMinutoEst) : (l.costoEstampado || 0);
  const estampaLabel = (e: EstampaOpt) => `${e.codigoInterno}${e.nombreComercial ? ` · ${e.nombreComercial}` : ''}`;

  // Sin costo de liso NO hay costo final: `total` queda en null en vez de sumar 0 y
  // presentar un número incompleto como si fuera el costo del producto.
  const desglose = (p: Producto): { liso: number | null; dtf: number; mo: number; min: number; total: number | null } => {
    const liso = lisoTotal(p.lisoEscandalloId);
    const dtf = p.estampas.reduce((s, l) => s + costoDTF(l.estampaId, l.tamano ?? 1), 0);
    const mo = p.estampas.reduce((s, l) => s + moGuardado(l), 0);
    const min = p.estampas.reduce((s, l) => s + (Number(l.minutosEstampado) || 0), 0);
    return { liso, dtf, mo, min, total: liso == null ? null : liso + dtf + mo };
  };
  // Por qué a este producto le falta el costo del liso. Son dos causas distintas y la
  // pantalla las tiene que separar: una se arregla haciendo el escandallo, la otra es
  // un escandallo borrado.
  const faltaLiso = (p: Producto): string | null => {
    if (lisoTotal(p.lisoEscandalloId) != null) return null;
    if (p.lisoSku) return 'falta el escandallo';
    return p.lisoEscandalloId ? 'escandallo no encontrado' : 'sin liso';
  };
  const lisoNombre = (p: Producto): string =>
    escandallos.find((e) => e.id === p.lisoEscandalloId)?.nombre ?? p.lisoSku ?? '— liso —';

  const resetForm = () => { setEditId(null); setNombre(''); setSku(''); setMarca(''); setLisoId(''); setNotas(''); setLineas([{ id: 0, estampaId: '', tamano: 1, minutosEstampado: '' }]); seq.current = 1; };
  const abrirNuevo = () => { resetForm(); setShowForm(true); };
  const abrirEdicion = (p: Producto) => {
    setEditId(p.id); setNombre(p.nombre); setSku(p.sku ?? ''); setMarca(p.marca ?? ''); setLisoId(lisoValue(p)); setNotas(p.notas ?? '');
    setLineas(p.estampas.length ? p.estampas.map((l, i) => ({ id: i, estampaId: l.estampaId, tamano: l.tamano ?? 1, minutosEstampado: l.minutosEstampado ? String(l.minutosEstampado) : '' })) : [{ id: 0, estampaId: '', tamano: 1, minutosEstampado: '' }]);
    seq.current = p.estampas.length + 1;
    setShowForm(true);
  };

  const traerMin = (lineaId: number) => {
    if (!minGlobal) return;
    setLineas((p) => p.map((x) => x.id === lineaId ? { ...x, minutosEstampado: String(Math.round(minGlobal * 10) / 10) } : x));
  };

  const guardar = async () => {
    if (!nombre.trim()) { toast.error('Poné un nombre'); return; }
    if (!lisoId) { toast.error('Elegí el liso base'); return; }
    const estampasBody = lineas.filter((l) => l.estampaId).map((l) => ({ estampaId: l.estampaId, tamano: l.tamano ?? 1, minutosEstampado: parseFloat(l.minutosEstampado) || 0 }));
    setSaving(true);
    const body = { nombre: nombre.trim(), sku: sku.trim() || null, marca: marca.trim() || null, ...parseLisoValue(lisoId), estampas: estampasBody, notas: notas.trim() || null };
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

  // MO de estampería de una línea del editor: minutos × tarifa.
  const moLinea = (l: LineaEstampa): number => (parseFloat(l.minutosEstampado) || 0) * costoMinutoEst;

  // ── Carga masiva ──────────────────────────────────────────────
  const minDefault = () => (minGlobal ? String(Math.round(minGlobal * 10) / 10) : '');
  const nombreAutoEst = (e?: EstampaOpt) => e ? (e.nombreComercial?.toString().trim() || e.codigoInterno) : '';
  const nuevaLineaBulk = (): LineaEstampa => ({ id: lineaSeq.current++, estampaId: '', tamano: 1, minutosEstampado: minDefault() });
  const nuevaFilaBulk = (): BulkRow => ({ id: bulkSeq.current++, nombre: '', liso: '', estampas: [nuevaLineaBulk()] });
  const abrirBulk = () => { setShowForm(false); setBulkRows([nuevaFilaBulk()]); setShowBulk(true); };
  const cerrarBulk = () => { setShowBulk(false); setBulkRows([]); };
  const setFila = (rowId: number, patch: Partial<BulkRow>) => setBulkRows((p) => p.map((r) => r.id === rowId ? { ...r, ...patch } : r));
  const setLineaBulk = (rowId: number, lineaId: number, patch: Partial<LineaEstampa>) =>
    setBulkRows((p) => p.map((r) => r.id === rowId ? { ...r, estampas: r.estampas.map((l) => l.id === lineaId ? { ...l, ...patch } : l) } : r));
  const elegirEstampaBulk = (rowId: number, lineaId: number, estampaId: string) =>
    setBulkRows((p) => p.map((r) => {
      if (r.id !== rowId) return r;
      const nuevasLineas = r.estampas.map((l) => l.id === lineaId ? { ...l, estampaId, tamano: 1 } : l);
      // Auto-nombre desde la estampa elegida, solo si el nombre está vacío (no pisa).
      const nombre = r.nombre.trim() || nombreAutoEst(estampas.find((e) => e.id === estampaId));
      return { ...r, estampas: nuevasLineas, nombre };
    }));
  const bulkRowTotal = (r: BulkRow): number | null => {
    const liso = lisoTotal(parseLisoValue(r.liso).lisoEscandalloId);
    const est = r.estampas.reduce((s, l) => s + (l.estampaId ? costoDTF(l.estampaId, l.tamano) + moLinea(l) : 0), 0);
    return liso == null ? null : liso + est;
  };
  const guardarBulk = async () => {
    const productos = bulkRows
      .filter((r) => r.liso && r.estampas.some((l) => l.estampaId))
      .map((r) => {
        const ref = parseLisoValue(r.liso);
        const liso = escandallos.find((e) => e.id === ref.lisoEscandalloId);
        const primera = r.estampas.find((l) => l.estampaId);
        const est = primera && estampas.find((e) => e.id === primera.estampaId);
        const nombre = r.nombre.trim() || nombreAutoEst(est) || liso?.nombre || ref.lisoSku || 'Producto';
        return {
          nombre, marca: liso?.marca ?? null, ...ref,
          estampas: r.estampas.filter((l) => l.estampaId).map((l) => ({ estampaId: l.estampaId, tamano: l.tamano ?? 1, minutosEstampado: parseFloat(l.minutosEstampado) || 0 })),
        };
      });
    if (productos.length === 0) { toast.error('Cargá al menos una fila con liso y estampa'); return; }
    setBulkSaving(true);
    const r = await fetch('/api/costos/productos-estampados/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productos }) });
    if (r.ok) { const d = await r.json(); toast.success(`${d.creados} producto(s) creados`); cerrarBulk(); cargarProductos(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo cargar'); }
    setBulkSaving(false);
  };

  // ── Edición masiva de tiempos ─────────────────────────────────
  const lineaSinTiempo = (l: EstampaProducto) => !(l.minutosEstampado) && !(l.costoEstampado);
  const sinTiempo = (p: Producto) => p.estampas.some(lineaSinTiempo);
  const abrirTiempos = () => {
    setShowForm(false); setShowBulk(false);
    setTiempos(Object.fromEntries(productos.map((p) => [p.id, p.estampas.map((l) => l.minutosEstampado ? String(l.minutosEstampado) : '')])));
    setFillValue(''); setShowTiempos(true);
  };
  const setTiempoVal = (pid: string, idx: number, v: string) =>
    setTiempos((prev) => ({ ...prev, [pid]: prev[pid].map((x, i) => i === idx ? v : x) }));
  const completarVacios = () => {
    const val = fillValue.trim(); if (!val) { toast.error('Poné un valor'); return; }
    setTiempos((prev) => Object.fromEntries(Object.entries(prev).map(([pid, arr]) => [pid, arr.map((x) => (parseFloat(x) || 0) > 0 ? x : val)])));
  };
  const nSinTiempo = productos.reduce((s, p) => s + (showTiempos ? (tiempos[p.id]?.filter((x) => !((parseFloat(x) || 0) > 0)).length ?? 0) : 0), 0);
  // Total en vivo de una fila de la grilla de tiempos (usa los minutos en edición).
  const tiemposRowTotal = (p: Producto): number | null => {
    const liso = lisoTotal(p.lisoEscandalloId);
    const arr = tiempos[p.id] ?? [];
    const est = p.estampas.reduce((s, l, i) => s + costoDTF(l.estampaId, l.tamano ?? 1) + (parseFloat(arr[i]) || 0) * costoMinutoEst, 0);
    return liso == null ? null : liso + est;
  };
  // Totales del pie de la grilla de tiempos (en vivo).
  const totMinutos = Object.values(tiempos).flat().reduce((s, x) => s + (parseFloat(x) || 0), 0);
  const totMO = totMinutos * costoMinutoEst;
  const totFinal = productos.reduce((s, p) => s + (tiemposRowTotal(p) ?? 0), 0);
  const nSinCosto = productos.filter((p) => faltaLiso(p)).length;

  // Export CSV: nombre, marca, costo final (para importar en otro sistema).
  // Exporta los seleccionados; si no hay selección, exporta todos.
  const exportarCSV = () => {
    const elegidos = selCsv.size > 0 ? productos.filter((p) => selCsv.has(p.id)) : productos;
    const csvCell = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    // Un costo incompleto no sale como número: sale diciendo qué le falta, o el CSV
    // lleva la mentira a donde nadie puede ver la advertencia de la pantalla.
    const filas = [['Nombre', 'Marca', 'Costo final'], ...elegidos.map((p) => {
      const t = desglose(p).total;
      return [p.nombre, p.marca ?? '', t == null ? (faltaLiso(p) ?? 'sin costo') : String(Math.round(t))];
    })];
    const csv = '﻿' + filas.map((f) => f.map((c) => csvCell(c)).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'productos-con-estampa.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const guardarTiempos = async () => {
    const cambios = productos
      .filter((p) => {
        const arr = tiempos[p.id]; if (!arr) return false;
        return p.estampas.some((l, i) => (parseFloat(arr[i]) || 0) !== (Number(l.minutosEstampado) || 0));
      })
      .map((p) => ({ id: p.id, estampas: p.estampas.map((l, i) => ({ estampaId: l.estampaId, tamano: l.tamano ?? 1, minutosEstampado: parseFloat(tiempos[p.id][i]) || 0 })) }));
    if (cambios.length === 0) { toast.error('No cambiaste ningún tiempo'); return; }
    setTiemposSaving(true);
    const r = await fetch('/api/costos/productos-estampados/tiempos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cambios }) });
    if (r.ok) { const d = await r.json(); toast.success(`${d.actualizados} producto(s) actualizados`); setShowTiempos(false); cargarProductos(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo guardar'); }
    setTiemposSaving(false);
  };

  // Total en vivo del editor
  const lisoRefVivo = parseLisoValue(lisoId);
  const lisoVivo = lisoTotal(lisoRefVivo.lisoEscandalloId);
  const estVivo = lineas.reduce((s, l) => s + (l.estampaId ? costoDTF(l.estampaId, l.tamano) + moLinea(l) : 0), 0);
  const totalVivo = lisoVivo == null ? null : lisoVivo + estVivo;

  return (
    <div className="space-y-5 max-w-3xl">
      {!showForm && !showBulk && !showTiempos && (
        <div className="flex justify-between items-center gap-3">
          <p className="text-sm text-stone-500">
            El liso se referencia vivo: si cambia su escandallo, cambia este costo.
            {nSinCosto > 0 && <span className="text-amber-700 font-semibold"> · {nSinCosto} sin costo, esperando el escandallo del liso.</span>}
          </p>
          <div className="flex gap-2 shrink-0">
            {productos.length > 0 && <Button variant="secondary" onClick={exportarCSV}>Exportar CSV{selCsv.size > 0 ? ` (${selCsv.size})` : ''}</Button>}
            {productos.length > 0 && <Button variant="secondary" onClick={abrirTiempos}>Editar tiempos</Button>}
            <Button variant="secondary" onClick={abrirBulk}>Carga masiva</Button>
            <Button onClick={abrirNuevo}>+ Nuevo</Button>
          </div>
        </div>
      )}

      {showTiempos && (
        <Card padding="none" className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-800">Tiempos de estampería {nSinTiempo > 0 && <span className="text-amber-600 font-semibold">· {nSinTiempo} sin tiempo</span>}</h3>
            <button onClick={() => setShowTiempos(false)} className="text-xs text-stone-400 hover:text-stone-700">✕ Cancelar</button>
          </div>
          <div className="flex items-end gap-2 flex-wrap bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5">
            <div>
              <label className="text-xs text-stone-500 block mb-1">Poner a los sin tiempo</label>
              <NumInput value={parseFloat(fillValue) || 0} onChange={(n) => setFillValue(n ? String(n) : '')} min="0" step="0.5" placeholder="min" className={`${inp} w-24`} />
            </div>
            <Button size="sm" variant="secondary" onClick={completarVacios}>Completar los sin tiempo</Button>
            <span className="text-[11px] text-stone-400">No pisa los que ya tienen tiempo cargado.</span>
          </div>
          <div className="border border-stone-100 rounded-xl divide-y divide-stone-100">
            {productos.map((p) => {
              const arr = tiempos[p.id] ?? [];
              return (
                <div key={p.id} className="grid grid-cols-[1fr_auto] gap-3 items-center px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-800 truncate">{p.nombre}</p>
                    <p className="text-xs text-stone-400 truncate">{lisoNombre(p)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.estampas.map((l, i) => {
                      const e = estampas.find((x) => x.id === l.estampaId);
                      const vacio = !((parseFloat(arr[i]) || 0) > 0);
                      return (
                        <div key={i} className="flex items-center gap-1">
                          {p.estampas.length > 1 && <span className="text-[10px] text-stone-400 font-mono">{e?.codigoInterno ?? '?'}</span>}
                          <NumInput value={parseFloat(arr[i]) || 0} onChange={(n) => setTiempoVal(p.id, i, n ? String(n) : '')} min="0" step="0.5" placeholder="min"
                            className={`${inp} w-20 ${vacio ? 'border-amber-300 bg-amber-50' : ''}`} />
                          <span className="text-xs text-stone-400">min</span>
                        </div>
                      );
                    })}
                    <span className={`text-xs font-semibold tabular-nums w-20 text-right ${tiemposRowTotal(p) == null ? 'text-stone-400' : 'text-emerald-700'}`}>{tiemposRowTotal(p) == null ? 's/ costo' : `= ${fmt$(tiemposRowTotal(p)!)}`}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3 items-center px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl">
            <span className="text-xs font-bold text-stone-600 uppercase tracking-wide">Totales ({productos.length} producto{productos.length !== 1 ? 's' : ''})</span>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-stone-500 tabular-nums">{fmt1(totMinutos)} min</span>
              <span className="text-stone-500 tabular-nums">MO {fmt$(totMO)}</span>
              <span className="font-bold text-emerald-700 tabular-nums">= {fmt$(totFinal)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={guardarTiempos} isLoading={tiemposSaving}>Guardar</Button>
            <Button variant="secondary" onClick={() => setShowTiempos(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {showBulk && (
        <Card padding="none" className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-800">Carga masiva de productos con estampa</h3>
            <button onClick={cerrarBulk} className="text-xs text-stone-400 hover:text-stone-700">✕ Cancelar</button>
          </div>
          <p className="text-[11px] text-stone-400">Cada fila es un producto. Podés juntar varias estampas en la misma prenda (frente + espalda) con "+ estampa". Nombre y minutos vienen auto y se editan.</p>
          {bulkRows.map((row) => (
            <div key={row.id} className="border border-stone-200 rounded-xl p-3 space-y-2">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <input value={row.nombre} onChange={(e) => setFila(row.id, { nombre: e.target.value })} placeholder="Nombre del producto" className={`${inp} w-full`} />
                <select value={row.liso} onChange={(e) => setFila(row.id, { liso: e.target.value })} className={`${inp} w-full`}>
                  <option value="">— liso base —</option>
                  <optgroup label="Con escandallo (traen el costo)">
                    {escandallos.map((e) => <option key={e.id} value={`esc:${e.id}`}>{e.nombre}{e.sku ? ` · ${e.sku}` : ''}</option>)}
                  </optgroup>
                  {lisosSoloSku.length > 0 && (
                    <optgroup label="Sin escandallo (sin costo del liso)">
                      {lisosSoloSku.map((l) => <option key={l.sku} value={`sku:${l.sku}`}>{l.sku}</option>)}
                    </optgroup>
                  )}
                </select>
                <button type="button" onClick={() => setBulkRows((p) => p.length > 1 ? p.filter((r) => r.id !== row.id) : p)} className="text-stone-300 hover:text-red-400 text-xl leading-none px-1">×</button>
              </div>
              {row.estampas.map((l) => {
                const e = estampas.find((x) => x.id === l.estampaId);
                const con2 = tiene2(e);
                return (
                  <div key={l.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center pl-2">
                    <select value={l.estampaId} onChange={(ev) => elegirEstampaBulk(row.id, l.id, ev.target.value)} className={`${inp} min-w-0`}>
                      <option value="">— estampa —</option>
                      {estampas.map((es) => <option key={es.id} value={es.id}>{estampaLabel(es)}</option>)}
                    </select>
                    {con2 ? (
                      <select value={l.tamano} onChange={(ev) => setLineaBulk(row.id, l.id, { tamano: Number(ev.target.value) })} className={`${inp} w-20`} title="Tamaño">
                        <option value={1}>T1</option>
                        <option value={2}>T2</option>
                      </select>
                    ) : <span />}
                    <div className="flex items-center gap-1">
                      <NumInput value={parseFloat(l.minutosEstampado) || 0} onChange={(n) => setLineaBulk(row.id, l.id, { minutosEstampado: n ? String(n) : '' })} min="0" step="0.5" placeholder="min" className={`${inp} w-16`} />
                      <span className="text-xs text-stone-400">min</span>
                    </div>
                    <button type="button" onClick={() => setBulkRows((p) => p.map((r) => r.id === row.id ? { ...r, estampas: r.estampas.length > 1 ? r.estampas.filter((x) => x.id !== l.id) : r.estampas } : r))} className="text-stone-300 hover:text-red-400 text-lg leading-none">×</button>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pl-2">
                <button type="button" onClick={() => setFila(row.id, { estampas: [...row.estampas, nuevaLineaBulk()] })} className="text-xs px-2 py-0.5 border border-stone-200 rounded-lg text-stone-500 hover:border-stone-400 transition">+ estampa</button>
                <span className="text-xs text-stone-500">{!row.liso ? '' : bulkRowTotal(row) == null ? <span className="text-amber-700">sin escandallo · sin costo</span> : <>Total: <strong className="text-emerald-700">{fmt$(bulkRowTotal(row)!)}</strong></>}</span>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setBulkRows((p) => [...p, nuevaFilaBulk()])}>+ Fila</Button>
            <Button size="sm" onClick={guardarBulk} isLoading={bulkSaving}>Crear {bulkRows.filter((r) => r.liso && r.estampas.some((l) => l.estampaId)).length || ''}</Button>
          </div>
        </Card>
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
            <label className="text-xs font-semibold text-stone-600 mb-1 block">Liso base</label>
            <select value={lisoId} onChange={(e) => setLisoId(e.target.value)} className={`${inp} w-full`}>
              <option value="">— elegí el liso —</option>
              <optgroup label="Con escandallo (traen el costo)">
                {escandallos.map((e) => <option key={e.id} value={`esc:${e.id}`}>{e.nombre}{e.sku ? ` · ${e.sku}` : ''}</option>)}
              </optgroup>
              {lisosSoloSku.length > 0 && (
                <optgroup label="Sin escandallo (sin costo del liso)">
                  {lisosSoloSku.map((l) => <option key={l.sku} value={`sku:${l.sku}`}>{l.sku}</option>)}
                </optgroup>
              )}
            </select>
            {lisoId && (
              <p className="text-xs mt-1">
                {lisoVivo != null
                  ? <span className="text-stone-500">Costo del liso: <strong>{fmt$(lisoVivo)}</strong></span>
                  : <span className="text-amber-700">{lisoRefVivo.lisoSku ? 'Este liso no tiene escandallo: el producto queda sin costo final hasta que se le haga.' : 'Liso no encontrado.'}</span>}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-600 block">Estampas</label>
              <button type="button" onClick={() => setLineas((p) => [...p, { id: seq.current++, estampaId: '', tamano: 1, minutosEstampado: '' }])}
                className="text-xs px-2.5 py-1 border border-stone-200 rounded-lg text-stone-600 hover:border-stone-400 transition">+ Estampa</button>
            </div>
            {lineas.map((l) => {
              const est = estampas.find((x) => x.id === l.estampaId);
              const con2 = tiene2(est);
              const dtf = l.estampaId ? costoDTF(l.estampaId, l.tamano) : 0;
              const mo = l.estampaId ? moLinea(l) : 0;
              return (
                <div key={l.id} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                  <div className="flex gap-1 items-center">
                    {l.estampaId && <Thumbnail src={est?.imagenUrl} size={32} />}
                    <select value={l.estampaId} onChange={(e) => setLineas((p) => p.map((x) => x.id === l.id ? { ...x, estampaId: e.target.value, tamano: 1 } : x))} className={`${inp} flex-1 min-w-0`}>
                      <option value="">— elegí estampa —</option>
                      {estampas.map((e) => <option key={e.id} value={e.id}>{estampaLabel(e)}</option>)}
                    </select>
                    {con2 && (
                      <select value={l.tamano} onChange={(e) => setLineas((p) => p.map((x) => x.id === l.id ? { ...x, tamano: Number(e.target.value) } : x))} className={`${inp} w-24 shrink-0`} title="Tamaño de la estampa">
                        <option value={1}>Tam. 1</option>
                        <option value={2}>Tam. 2</option>
                      </select>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <NumInput value={parseFloat(l.minutosEstampado) || 0} onChange={(n) => setLineas((p) => p.map((x) => x.id === l.id ? { ...x, minutosEstampado: n ? String(n) : '' } : x))} min="0" step="0.5" placeholder="min" className={`${inp} w-20`} />
                      <span className="text-xs text-stone-400">min</span>
                      {minGlobal > 0 && (
                        <button type="button" onClick={() => traerMin(l.id)} title={`Traer ${fmt1(minGlobal)} min/estampa del sistema de tiempos`}
                          className="text-xs px-1.5 py-1 border border-stone-200 rounded-lg text-stone-500 hover:border-amber-400 hover:text-amber-600 transition">↓</button>
                      )}
                    </div>
                    <span className="text-xs text-stone-400 whitespace-nowrap w-32 text-right">{l.estampaId ? `DTF ${fmt$(dtf)} · MO ${fmt$(mo)}` : ''}</span>
                    <button type="button" onClick={() => setLineas((p) => p.length > 1 ? p.filter((x) => x.id !== l.id) : p)} className="text-stone-300 hover:text-red-400 text-xl leading-none">×</button>
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] text-stone-400">DTF = material (automático del catálogo). Min = tiempo de estampería × valor hora ({fmt$(Math.round(costoMinutoEst * 60))}/h). El ↓ trae el promedio del sistema de tiempos.</p>
          </div>

          <div className="flex items-center gap-4 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5">
            <span className="text-xs text-stone-400">Total producto final:</span>
            {totalVivo == null
              ? <span className="text-sm font-semibold text-amber-700">falta el escandallo del liso</span>
              : <span className="text-lg font-bold font-mono tabular-nums text-emerald-700">{fmt$(totalVivo)}</span>}
            <span className="text-xs text-stone-400">{totalVivo == null ? `estampas ${fmt$(estVivo)}` : `= liso ${fmt$(lisoVivo!)} + estampas ${fmt$(estVivo)}`}</span>
          </div>

          <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas (opcional)" className={`${inp} w-full`} />
          <div className="flex gap-2">
            <Button onClick={guardar} isLoading={saving}>{editId ? 'Guardar' : 'Crear'}</Button>
            <Button variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</Button>
          </div>
        </Card>
      )}

      {!showForm && !showBulk && !showTiempos && (
        cargando ? (
          <LoadingState />
        ) : productos.length === 0 ? (
          <EmptyState title="Sin productos con estampa" message="Creá uno: liso base (escandallo) + la(s) estampa(s) del catálogo." />
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
            <label className="flex items-center gap-2 px-4 md:px-5 py-2 text-xs text-stone-500 bg-stone-50/60 rounded-t-2xl">
              <input type="checkbox" checked={productos.length > 0 && productos.every((p) => selCsv.has(p.id))}
                onChange={(e) => setSelCsv(e.target.checked ? new Set(productos.map((p) => p.id)) : new Set())}
                className="rounded border-stone-300 accent-amber-500" />
              Seleccionar todo{selCsv.size > 0 ? ` · ${selCsv.size} seleccionado${selCsv.size !== 1 ? 's' : ''}` : ''}
            </label>
            {productos.map((p) => {
              const d = desglose(p);
              const abierto = expanded.has(p.id);
              return (
                <div key={p.id} className="px-4 md:px-5 py-3">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={selCsv.has(p.id)} onChange={() => toggleSelCsv(p.id)} aria-label={`Seleccionar ${p.nombre}`}
                      className="rounded border-stone-300 accent-amber-500 shrink-0" />
                    <button onClick={() => toggleExp(p.id)} aria-label={abierto ? 'Ocultar detalle' : 'Ver detalle'} aria-expanded={abierto}
                      className="text-xs text-stone-400 hover:text-stone-700 w-4 shrink-0 leading-none">{abierto ? '▾' : '▸'}</button>
                    <Thumbnail src={estampas.find((x) => x.id === p.estampas[0]?.estampaId)?.imagenUrl} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-stone-800 truncate">{p.nombre}{p.sku && <span className="text-xs text-stone-400 font-mono ml-2">{p.sku}</span>}</p>
                      <p className="text-xs text-stone-400">{p.estampas.length} estampa{p.estampas.length !== 1 ? 's' : ''} · liso {lisoNombre(p)} {d.liso == null ? '' : `· ${fmt$(d.liso)}`}</p>
                    </div>
                    {sinTiempo(p) && <span className="text-[11px] px-1.5 py-0.5 rounded-md border border-amber-200 bg-amber-50 text-amber-700 shrink-0" title="Falta el tiempo de estampería: el costo está incompleto">⚠ sin tiempo</span>}
                    {d.total == null
                      ? <span className="text-[11px] font-semibold text-amber-700 w-24 text-right leading-tight" title="Sin el escandallo del liso no hay costo final: se muestra lo que falta, no un total incompleto">{faltaLiso(p)}</span>
                      : <span className="text-sm font-bold tabular-nums text-emerald-700 w-24 text-right">{fmt$(d.total)}</span>}
                    <div className="flex gap-1.5 shrink-0">
                      <Button variant="secondary" size="sm" onClick={() => abrirEdicion(p)}>Editar</Button>
                      <button onClick={() => eliminar(p)} aria-label="Eliminar" className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">×</button>
                    </div>
                  </div>
                  {abierto && (
                    <div className="ml-7 mt-2 max-w-xs space-y-0.5 text-xs">
                      <div className="flex justify-between text-stone-500"><span>Liso ({p.lisoSku ? 'sin escandallo' : 'escandallo'})</span><span className="tabular-nums">{d.liso == null ? `— ${faltaLiso(p)}` : fmt$(d.liso)}</span></div>
                      <div className="flex justify-between text-stone-500"><span>Material DTF</span><span className="tabular-nums">{fmt$(d.dtf)}</span></div>
                      <div className="flex justify-between text-stone-500"><span>Estampería (MO){d.min ? ` · ${fmt1(d.min)} min` : ''}</span><span className="tabular-nums">{fmt$(d.mo)}</span></div>
                      <div className="flex justify-between font-semibold text-stone-700 border-t border-stone-100 pt-1 mt-1"><span>Total</span>{d.total == null ? <span className="text-amber-700">sin costo · {faltaLiso(p)}</span> : <span className="tabular-nums text-emerald-700">{fmt$(d.total)}</span>}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
