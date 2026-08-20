'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { toast } from '@/components/ui/Toaster';
import { costoEstampa } from '@/lib/costos/estampaCosto';
import { ImageDrop, ThumbUpload } from '@/components/ui/ImageDrop';
import { MARCAS } from '@/lib/marcas';
import { PedirEstampaPanel } from './PedirEstampaPanel';
import { parseLisoValue } from '@/lib/costos/lisoRef';

interface Estampa {
  id: string; codigoInterno: string; nombreComercial: string | null; coleccion: string | null;
  marca: string | null; imagenUrl: string | null; anchoCm: string | number; largoCm: string | number; mermaPercent: string | number;
  ancho2Cm: string | number; largo2Cm: string | number; merma2Percent: string | number;
  estado: string; sku: string | null; notas: string | null;
}
// ¿tiene 2º tamaño cargado?
const tiene2Tam = (e: { ancho2Cm: string | number; largo2Cm: string | number }) => (Number(e.ancho2Cm) || 0) > 0 && (Number(e.largo2Cm) || 0) > 0;
interface DtfCfg { dtfPrecioMetro: number; dtfAnchoCm: number; dtfMermaDefault: number }

const ESTADOS = [
  { value: 'pensada',  label: 'Pensada',    variant: 'warning' as const },
  { value: 'pedida',   label: 'DTF pedido', variant: 'info' as const },
  { value: 'recibida', label: 'Recibido',   variant: 'success' as const },
];
const estadoInfo = (e: string) => ESTADOS.find((x) => x.value === e) ?? ESTADOS[0];
const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30';
const inpSm = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400 w-full';
// Una fila de la carga masiva. El 2º tamaño es la excepción, no la regla: se despliega
// en una segunda línea con "+ tamaño" en vez de ocupar dos columnas vacías en cada fila.
interface BulkRow {
  id: number; codigo: string; marca: string; ancho: string; largo: string;
  coleccion: string; imagenUrl: string; tiene2: boolean; ancho2: string; largo2: string;
}
const GRID_BULK = 'grid-cols-[2.5rem_1fr_7rem_4.5rem_4.5rem_1fr_5rem_auto]';
const inpTam2 = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400 w-[4.5rem] text-center';
const FILA_BULK_VACIA: Omit<BulkRow, 'id'> = {
  codigo: '', marca: '', ancho: '', largo: '', coleccion: '', imagenUrl: '', tiene2: false, ancho2: '', largo2: '',
};

const fmt$ = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

export function EstamperiaClient({ esAdmin }: { esAdmin: boolean }) {
  const [lista, setLista] = useState<Estampa[]>([]);
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<DtfCfg>({ dtfPrecioMetro: 0, dtfAnchoCm: 58, dtfMermaDefault: 0 });
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroMarca, setFiltroMarca] = useState('');
  const [soloSinNombre, setSoloSinNombre] = useState(false);
  const [q, setQ] = useState('');

  // Form individual
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [codigoInterno, setCodigoInterno] = useState('');
  const [nombreComercial, setNombreComercial] = useState('');
  const [coleccion, setColeccion] = useState('');
  const [marca, setMarca] = useState('');
  const [estado, setEstado] = useState('pensada');
  const [anchoCm, setAnchoCm] = useState('');
  const [largoCm, setLargoCm] = useState('');
  const [mermaPercent, setMermaPercent] = useState('');
  const [ancho2Cm, setAncho2Cm] = useState('');
  const [largo2Cm, setLargo2Cm] = useState('');
  const [merma2Percent, setMerma2Percent] = useState('');
  const [tiene2, setTiene2] = useState(false);
  const [sku, setSku] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Config editor (admin)
  const [editCfg, setEditCfg] = useState(false);
  const [cfgPrecio, setCfgPrecio] = useState('');
  const [cfgAncho, setCfgAncho] = useState('');
  const [cfgMerma, setCfgMerma] = useState('');

  // Carga masiva
  const [bulk, setBulk] = useState(false);
  const seq = useRef(1);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([{ ...FILA_BULK_VACIA, id: 0 }]);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Edición masiva de tamaños (ancho/largo, + 2º tamaño opcional)
  const [editTam, setEditTam] = useState(false);
  const [tamLista, setTamLista] = useState<Estampa[]>([]);
  const [tam, setTam] = useState<Record<string, { ancho: string; largo: string; ancho2: string; largo2: string }>>({});
  const [tamSaving, setTamSaving] = useState(false);

  // Vincular estampas ↔ liso (crea 1 producto con estampa por estampa tildada)
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [lisos, setLisos] = useState<{ id: string; nombre: string; nombreComercial: string | null; sku: string | null; marca: string | null }[]>([]);
  // Los lisos que sólo existen como SKU: sin escandallo no hay costo, pero la receta
  // (esta estampa sobre este liso) se puede declarar igual.
  const [lisosSku, setLisosSku] = useState<{ sku: string }[]>([]);
  const [minGlobal, setMinGlobal] = useState(0);
  const [vincLisoId, setVincLisoId] = useState('');
  const [vincMin, setVincMin] = useState('');
  const [vincNombres, setVincNombres] = useState<Record<string, string>>({});
  const [vincSaving, setVincSaving] = useState(false);
  const [productosPorEstampa, setProductosPorEstampa] = useState<Record<string, { id: string; nombre: string }[]>>({});
  const [soloSinProducto, setSoloSinProducto] = useState(false);
  // Qué se hace con las tildadas: vincularlas a un liso (receta/costo) o pedir el DTF.
  const [accionSel, setAccionSel] = useState<'vincular' | 'pedir'>('vincular');

  const cargar = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filtroEstado) p.set('estado', filtroEstado);
    if (filtroMarca) p.set('marca', filtroMarca);
    if (q.trim()) p.set('q', q.trim());
    const r = await fetch(`/api/estampas?${p}`);
    if (r.ok) setLista(await r.json());
    setLoading(false);
  }, [filtroEstado, filtroMarca, q]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    fetch('/api/estampas/config').then((r) => r.ok ? r.json() : null).then((c) => { if (c) setCfg(c); }).catch(() => {});
    fetch('/api/costos/escandallos').then((r) => r.ok ? r.json() : []).then((e) => { if (Array.isArray(e)) setLisos(e); }).catch(() => {});
    fetch('/api/reposicion/lisos').then((r) => r.ok ? r.json() : []).then((l) => { if (Array.isArray(l)) setLisosSku(l); }).catch(() => {});
    fetch('/api/estampado/tiempo').then((r) => r.ok ? r.json() : null).then((c) => { if (c && c.minPorEstampa) { setMinGlobal(c.minPorEstampa); setVincMin(String(Math.round(c.minPorEstampa * 10) / 10)); } }).catch(() => {});
    cargarVinculos();
  }, []);

  const cargarVinculos = () => {
    fetch('/api/costos/productos-estampados/por-estampa').then((r) => r.ok ? r.json() : null).then((m) => { if (m && typeof m === 'object') setProductosPorEstampa(m); }).catch(() => {});
  };

  const toggleSel = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const lisoLabel = (l: { nombre: string; sku: string | null }) => `${l.nombre}${l.sku ? ` · ${l.sku}` : ''}`;
  // No ofrecer dos veces el mismo liso: si ya hay escandallo, ésa es la opción buena.
  const lisosSoloSku = lisosSku.filter((x) => !lisos.some((l) => l.sku && l.sku === x.sku));
  const nombreAuto = (e: Estampa) => e.nombreComercial?.trim() || e.codigoInterno;

  const crearVinculos = async () => {
    if (!vincLisoId) { toast.error('Elegí el liso base'); return; }
    const ref = parseLisoValue(vincLisoId);
    const liso = lisos.find((l) => l.id === ref.lisoEscandalloId);
    const min = parseFloat(vincMin) || 0;
    const productos = [...sel].map((id) => {
      const e = lista.find((x) => x.id === id);
      return {
        nombre: (vincNombres[id] ?? (e ? nombreAuto(e) : '')).trim() || (e?.codigoInterno ?? 'Producto'),
        marca: liso?.marca ?? null,
        ...ref,
        estampas: [{ estampaId: id, tamano: 1, minutosEstampado: min }],
      };
    });
    if (productos.length === 0) { toast.error('Tildá al menos una estampa'); return; }
    setVincSaving(true);
    const r = await fetch('/api/costos/productos-estampados/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productos }) });
    if (r.ok) { const d = await r.json(); toast.success(`${d.creados} producto(s) creados`); setSel(new Set()); setVincNombres({}); setVincLisoId(''); cargarVinculos(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo vincular'); }
    setVincSaving(false);
  };

  const costo = (e: { anchoCm: string | number; largoCm: string | number; mermaPercent: string | number }) =>
    costoEstampa({ anchoCm: Number(e.anchoCm), largoCm: Number(e.largoCm), mermaPercent: Number(e.mermaPercent) }, cfg);

  const resetForm = () => {
    setEditId(null); setCodigoInterno(''); setNombreComercial(''); setColeccion(''); setMarca('');
    setEstado('pensada'); setAnchoCm(''); setLargoCm(''); setMermaPercent(String(cfg.dtfMermaDefault || ''));
    setAncho2Cm(''); setLargo2Cm(''); setMerma2Percent(''); setTiene2(false);
    setSku(''); setImagenUrl(''); setNotas(''); setError('');
  };
  const abrirNuevo = () => { resetForm(); setBulk(false); setShowForm(true); };
  const abrirEdicion = (e: Estampa) => {
    setEditId(e.id); setCodigoInterno(e.codigoInterno); setNombreComercial(e.nombreComercial ?? '');
    setColeccion(e.coleccion ?? ''); setMarca(e.marca ?? ''); setEstado(e.estado);
    setAnchoCm(String(Number(e.anchoCm) || '')); setLargoCm(String(Number(e.largoCm) || '')); setMermaPercent(String(Number(e.mermaPercent) || ''));
    const has2 = tiene2Tam(e);
    setTiene2(has2); setAncho2Cm(String(Number(e.ancho2Cm) || '')); setLargo2Cm(String(Number(e.largo2Cm) || '')); setMerma2Percent(String(Number(e.merma2Percent) || ''));
    setSku(e.sku ?? ''); setImagenUrl(e.imagenUrl ?? ''); setNotas(e.notas ?? ''); setError(''); setBulk(false); setShowForm(true);
  };

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!codigoInterno.trim()) { setError('Poné el código interno'); return; }
    setSaving(true); setError('');
    const payload = {
      codigoInterno: codigoInterno.trim(), nombreComercial: nombreComercial.trim() || null, coleccion: coleccion.trim() || null, marca: marca || null,
      estado, anchoCm: parseFloat(anchoCm) || 0, largoCm: parseFloat(largoCm) || 0, mermaPercent: parseFloat(mermaPercent) || 0,
      ancho2Cm: tiene2 ? (parseFloat(ancho2Cm) || 0) : 0, largo2Cm: tiene2 ? (parseFloat(largo2Cm) || 0) : 0, merma2Percent: tiene2 ? (parseFloat(merma2Percent) || 0) : 0,
      sku: sku.trim() || null, imagenUrl: imagenUrl.trim() || null, notas: notas.trim() || null,
    };
    const r = await fetch(editId ? `/api/estampas/${editId}` : '/api/estampas', {
      method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (r.ok) { setShowForm(false); resetForm(); cargar(); toast.success(editId ? 'Estampa actualizada' : 'Estampa cargada'); }
    else { const d = await r.json().catch(() => ({})); setError(d.error || 'No se pudo guardar'); }
    setSaving(false);
  };

  // Carga/cambia la foto directo desde la fila (update parcial de imagenUrl).
  const guardarFoto = async (id: string, imagenUrl: string) => {
    const r = await fetch(`/api/estampas/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imagenUrl }) });
    if (r.ok) { setLista((prev) => prev.map((e) => e.id === id ? { ...e, imagenUrl } : e)); toast.success('Foto cargada'); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo guardar la foto'); }
  };

  const eliminar = async (e: Estampa) => {
    if (!(await confirmAsync({ message: `¿Eliminar la estampa "${e.codigoInterno}"?`, danger: true, confirmLabel: 'Eliminar' }))) return;
    const r = await fetch(`/api/estampas/${e.id}`, { method: 'DELETE' });
    if (r.ok) setLista((prev) => prev.filter((x) => x.id !== e.id));
    else toast.error('No se pudo eliminar');
  };

  const guardarCfg = async () => {
    const r = await fetch('/api/estampas/config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dtfPrecioMetro: parseFloat(cfgPrecio) || 0, dtfAnchoCm: parseFloat(cfgAncho) || 58, dtfMermaDefault: parseFloat(cfgMerma) || 0 }),
    });
    if (r.ok) { const c = await r.json(); setCfg(c); setEditCfg(false); toast.success('Precio del DTF actualizado'); }
    else toast.error('No se pudo guardar');
  };
  const abrirCfg = () => { setCfgPrecio(String(cfg.dtfPrecioMetro || '')); setCfgAncho(String(cfg.dtfAnchoCm || 58)); setCfgMerma(String(cfg.dtfMermaDefault || '')); setEditCfg(true); };

  // Carga masiva
  const abrirBulk = () => { setBulkRows([{ ...FILA_BULK_VACIA, id: 0 }]); seq.current = 1; setShowForm(false); setBulk(true); };
  // Patch de una fila por id: SIEMPRE en forma funcional — el upload de la foto es asíncrono y
  // un snapshot viejo pisaría lo que se esté tipeando en el mismo momento.
  const setFila = (id: number, patch: Partial<BulkRow>) => setBulkRows((p) => p.map((r) => r.id === id ? { ...r, ...patch } : r));
  // Cerrar la carga masiva avisando si hay fotos ya subidas que se perderían.
  const cerrarBulk = async () => {
    const conFoto = bulkRows.filter((r) => r.imagenUrl).length;
    if (conFoto > 0 && !(await confirmAsync({
      title: 'Cancelar la carga masiva',
      message: `Hay ${conFoto} foto${conFoto !== 1 ? 's' : ''} ya subida${conFoto !== 1 ? 's' : ''} que se pierde${conFoto !== 1 ? 'n' : ''} si cancelás.`,
      confirmLabel: 'Cancelar igual', cancelLabel: 'Seguir cargando',
    }))) return;
    setBulk(false);
  };
  const guardarBulk = async () => {
    const filas = bulkRows.filter((r) => r.codigo.trim()).map((r) => ({
      codigoInterno: r.codigo.trim(), coleccion: r.coleccion.trim() || undefined,
      marca: r.marca || undefined, imagenUrl: r.imagenUrl || undefined,
      anchoCm: parseFloat(r.ancho) || 0, largoCm: parseFloat(r.largo) || 0,
      ancho2Cm: r.tiene2 ? (parseFloat(r.ancho2) || 0) : 0,
      largo2Cm: r.tiene2 ? (parseFloat(r.largo2) || 0) : 0,
    }));
    if (filas.length === 0) { toast.error('Cargá al menos una fila con código'); return; }
    setBulkSaving(true);
    const r = await fetch('/api/estampas/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filas }) });
    if (r.ok) { const d = await r.json(); toast.success(`${d.creadas} estampa(s) cargadas`); setBulk(false); cargar(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo cargar'); }
    setBulkSaving(false);
  };

  // Edición masiva de tamaños
  const abrirTam = () => {
    setShowForm(false); setBulk(false);
    setTamLista(vista);
    setTam(Object.fromEntries(vista.map((e) => [e.id, { ancho: String(Number(e.anchoCm) || ''), largo: String(Number(e.largoCm) || ''), ancho2: String(Number(e.ancho2Cm) || ''), largo2: String(Number(e.largo2Cm) || '') }])));
    setEditTam(true);
  };
  const setTamVal = (id: string, campo: 'ancho' | 'largo' | 'ancho2' | 'largo2', v: string) =>
    setTam((p) => ({ ...p, [id]: { ...p[id], [campo]: v } }));
  const tamCambios = () => tamLista
    .filter((e) => {
      const t = tam[e.id]; if (!t) return false;
      return (parseFloat(t.ancho) || 0) !== (Number(e.anchoCm) || 0) || (parseFloat(t.largo) || 0) !== (Number(e.largoCm) || 0)
        || (parseFloat(t.ancho2) || 0) !== (Number(e.ancho2Cm) || 0) || (parseFloat(t.largo2) || 0) !== (Number(e.largo2Cm) || 0);
    })
    .map((e) => ({ id: e.id, anchoCm: parseFloat(tam[e.id].ancho) || 0, largoCm: parseFloat(tam[e.id].largo) || 0, ancho2Cm: parseFloat(tam[e.id].ancho2) || 0, largo2Cm: parseFloat(tam[e.id].largo2) || 0 }));
  const guardarTam = async () => {
    const cambios = tamCambios();
    if (cambios.length === 0) { toast.error('No cambiaste ningún tamaño'); return; }
    setTamSaving(true);
    const r = await fetch('/api/estampas/tamanos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cambios }) });
    if (r.ok) { const d = await r.json(); toast.success(`${d.actualizadas} tamaño(s) actualizados`); setEditTam(false); cargar(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo guardar'); }
    setTamSaving(false);
  };

  const costoVivo = costo({ anchoCm, largoCm, mermaPercent });
  const costo2Vivo = costo({ anchoCm: ancho2Cm, largoCm: largo2Cm, mermaPercent: merma2Percent });
  let vista = lista;
  if (soloSinNombre) vista = vista.filter((e) => !e.nombreComercial?.trim());
  if (soloSinProducto) vista = vista.filter((e) => !(productosPorEstampa[e.id]?.length));

  return (
    <div className="space-y-5">
      {/* Banner config DTF */}
      <div className="bg-violet-50 border border-violet-100 rounded-2xl px-4 py-3 text-sm">
        {!editCfg ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-stone-700"><strong>DTF:</strong> {fmt$(cfg.dtfPrecioMetro)}/metro · rollo {cfg.dtfAnchoCm} cm · merma default {cfg.dtfMermaDefault}%</span>
            {esAdmin && <button onClick={abrirCfg} className="text-xs px-2.5 py-1 rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-100 transition ml-auto">Editar precio</button>}
          </div>
        ) : (
          <div className="flex items-end gap-3 flex-wrap">
            <div><label className="text-xs text-stone-500 block mb-1">$/metro</label><NumInput value={parseFloat(cfgPrecio) || 0} onChange={(n) => setCfgPrecio(n ? String(n) : '')} min="0" className={inpSm} /></div>
            <div><label className="text-xs text-stone-500 block mb-1">Ancho rollo (cm)</label><NumInput value={parseFloat(cfgAncho) || 0} onChange={(n) => setCfgAncho(n ? String(n) : '')} min="0" className={inpSm} /></div>
            <div><label className="text-xs text-stone-500 block mb-1">Merma default %</label><NumInput value={parseFloat(cfgMerma) || 0} onChange={(n) => setCfgMerma(n ? String(n) : '')} min="0" className={inpSm} /></div>
            <Button size="sm" onClick={guardarCfg}>Guardar</Button>
            <Button size="sm" variant="secondary" onClick={() => setEditCfg(false)}>Cancelar</Button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant={filtroEstado === '' ? 'primary' : 'secondary'} size="sm" onClick={() => setFiltroEstado('')}>Todas</Button>
        {ESTADOS.map((e) => (
          <Button key={e.value} variant={filtroEstado === e.value ? 'primary' : 'secondary'} size="sm" onClick={() => setFiltroEstado(e.value)}>{e.label}</Button>
        ))}
        <span className="w-px h-5 bg-stone-200 mx-1" />
        {[{ v: '', l: 'Todas las marcas' }, ...MARCAS.map((m) => ({ v: m as string, l: m as string })), { v: 'sin', l: 'Sin marca' }].map((m) => (
          <Button key={m.v || 'todas'} variant={filtroMarca === m.v ? 'primary' : 'secondary'} size="sm" onClick={() => setFiltroMarca(m.v)}>{m.l}</Button>
        ))}
        <label className="flex items-center gap-1.5 text-xs text-stone-600 ml-2">
          <input type="checkbox" checked={soloSinNombre} onChange={(e) => setSoloSinNombre(e.target.checked)} className="rounded border-stone-300 accent-amber-500" />
          Sin nombre comercial
        </label>
        <label className="flex items-center gap-1.5 text-xs text-stone-600">
          <input type="checkbox" checked={soloSinProducto} onChange={(e) => setSoloSinProducto(e.target.checked)} className="rounded border-stone-300 accent-amber-500" />
          Sin producto
        </label>
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar código / nombre / colección / SKU"
          className="px-3 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400 flex-1 min-w-[10rem]" />
        {!showForm && !bulk && !editTam && <><Button variant="secondary" onClick={abrirTam}>Editar tamaños</Button><Button variant="secondary" onClick={abrirBulk}>Carga masiva</Button><Button onClick={abrirNuevo}>+ Nueva</Button></>}
      </div>

      {/* Carga masiva */}
      {bulk && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-800">Carga masiva de estampas</h3>
            <button type="button" onClick={cerrarBulk} className="text-xs text-stone-400 hover:text-stone-700">✕ Cancelar</button>
          </div>
          {/* 8 columnas no entran en el ancho de la página: la grilla scrollea sola. */}
          <div className="overflow-x-auto">
            <div className="min-w-[52rem] space-y-2">
              <div className={`grid ${GRID_BULK} gap-2 text-xs font-bold uppercase tracking-widest text-stone-400 px-1`}>
                <span>Foto</span><span>Código *</span><span>Marca</span><span className="text-center">Ancho</span><span className="text-center">Largo</span><span>Colección</span><span className="text-right">Costo</span><span />
              </div>
              {bulkRows.map((row) => {
                const c1 = costo({ anchoCm: row.ancho, largoCm: row.largo, mermaPercent: cfg.dtfMermaDefault });
                const c2 = costo({ anchoCm: row.ancho2, largoCm: row.largo2, mermaPercent: cfg.dtfMermaDefault });
                return (
                  <div key={row.id} className="space-y-1">
                    <div className={`grid ${GRID_BULK} gap-2 items-center`}>
                      <ThumbUpload src={row.imagenUrl || null} size={36} onUploaded={(url) => setFila(row.id, { imagenUrl: url })} />
                      <input value={row.codigo} onChange={(e) => setFila(row.id, { codigo: e.target.value })} placeholder="EST-00X" className={inpSm} />
                      <select value={row.marca} onChange={(e) => setFila(row.id, { marca: e.target.value })} className={inpSm}>
                        <option value="">— marca —</option>
                        {MARCAS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <NumInput value={parseFloat(row.ancho) || 0} onChange={(n) => setFila(row.id, { ancho: n ? String(n) : '' })} min="0" className={`${inpSm} text-center`} />
                      <NumInput value={parseFloat(row.largo) || 0} onChange={(n) => setFila(row.id, { largo: n ? String(n) : '' })} min="0" className={`${inpSm} text-center`} />
                      <input value={row.coleccion} onChange={(e) => setFila(row.id, { coleccion: e.target.value })} placeholder="(opcional)" className={inpSm} />
                      <span className="text-sm font-semibold tabular-nums text-stone-700 text-right">{fmt$(c1)}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {!row.tiene2 && (
                          <button type="button" title="Agregar un 2º tamaño (mismo diseño, otra medida)" onClick={() => setFila(row.id, { tiene2: true })}
                            className="text-xs px-1.5 py-1 rounded-lg border border-stone-200 text-stone-500 hover:border-stone-400 transition leading-none whitespace-nowrap">+ tamaño</button>
                        )}
                        <button type="button" onClick={() => setBulkRows((p) => p.length > 1 ? p.filter((r) => r.id !== row.id) : p)} className="text-stone-300 hover:text-red-400 text-xl leading-none px-1">×</button>
                      </div>
                    </div>
                    {row.tiene2 && (
                      <div className="flex items-center gap-2 pl-[3.25rem] text-xs text-stone-500">
                        <span className="font-semibold uppercase tracking-widest text-stone-400 whitespace-nowrap">Tam. 2</span>
                        <NumInput value={parseFloat(row.ancho2) || 0} onChange={(n) => setFila(row.id, { ancho2: n ? String(n) : '' })} min="0" placeholder="ancho" className={inpTam2} />
                        <span>×</span>
                        <NumInput value={parseFloat(row.largo2) || 0} onChange={(n) => setFila(row.id, { largo2: n ? String(n) : '' })} min="0" placeholder="largo" className={inpTam2} />
                        <span>cm</span>
                        <span className="font-semibold tabular-nums text-violet-700">{fmt$(c2)}</span>
                        <button type="button" onClick={() => setFila(row.id, { tiene2: false, ancho2: '', largo2: '' })} className="text-stone-400 hover:text-red-500">Quitar</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setBulkRows((p) => [...p, { ...FILA_BULK_VACIA, id: seq.current++ }])}>+ Fila</Button>
            <Button size="sm" onClick={guardarBulk} isLoading={bulkSaving}>Guardar {bulkRows.filter((r) => r.codigo.trim()).length || ''}</Button>
          </div>
        </div>
      )}

      {/* Form individual */}
      {showForm && (
        <form onSubmit={guardar} className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-800">{editId ? 'Editar estampa' : 'Nueva estampa'}</h3>
            <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="text-xs text-stone-400 hover:text-stone-700">✕ Cancelar</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Código interno *" fullWidth value={codigoInterno} onChange={(e) => setCodigoInterno(e.target.value)} placeholder="Ej: EST-001 / girasol" />
            <Input label="Nombre comercial" fullWidth value={nombreComercial} onChange={(e) => setNombreComercial(e.target.value)} placeholder="(opcional, después)" />
            <Input label="Colección" fullWidth value={coleccion} onChange={(e) => setColeccion(e.target.value)} placeholder="(opcional)" />
            <Select label="Marca" fullWidth value={marca} onChange={(e) => setMarca(e.target.value)}>
              <option value="">— sin marca —</option>
              {MARCAS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
            <Select label="Estado" fullWidth value={estado} onChange={(e) => setEstado(e.target.value)}>
              {ESTADOS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
            <div><label className="text-xs font-semibold text-stone-600 mb-1.5 block">Ancho diseño (cm)</label><NumInput value={parseFloat(anchoCm) || 0} onChange={(n) => setAnchoCm(n ? String(n) : '')} min="0" className={inp} /></div>
            <div><label className="text-xs font-semibold text-stone-600 mb-1.5 block">Largo diseño (cm)</label><NumInput value={parseFloat(largoCm) || 0} onChange={(n) => setLargoCm(n ? String(n) : '')} min="0" className={inp} /></div>
            <div><label className="text-xs font-semibold text-stone-600 mb-1.5 block">Merma %</label><NumInput value={parseFloat(mermaPercent) || 0} onChange={(n) => setMermaPercent(n ? String(n) : '')} min="0" className={inp} /></div>
            <Input label="Producto / SKU vinculado" fullWidth value={sku} onChange={(e) => setSku(e.target.value)} placeholder="(opcional, después)" />
            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Imagen de la estampa</label>
              <ImageDrop value={imagenUrl || null} onChange={(u) => setImagenUrl(u ?? '')} />
            </div>
          </div>

          {/* 2º tamaño opcional */}
          {!tiene2 ? (
            <button type="button" onClick={() => setTiene2(true)} className="text-xs px-3 py-1.5 border border-stone-200 rounded-lg text-stone-600 hover:border-stone-400 transition">+ Agregar tamaño extra</button>
          ) : (
            <div className="border border-stone-200 rounded-xl p-4 space-y-3 bg-stone-50/50">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Tamaño 2 (opcional)</h4>
                <button type="button" onClick={() => { setTiene2(false); setAncho2Cm(''); setLargo2Cm(''); setMerma2Percent(''); }} className="text-xs text-stone-400 hover:text-red-500">Quitar</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="text-xs font-semibold text-stone-600 mb-1.5 block">Ancho 2 (cm)</label><NumInput value={parseFloat(ancho2Cm) || 0} onChange={(n) => setAncho2Cm(n ? String(n) : '')} min="0" className={inp} /></div>
                <div><label className="text-xs font-semibold text-stone-600 mb-1.5 block">Largo 2 (cm)</label><NumInput value={parseFloat(largo2Cm) || 0} onChange={(n) => setLargo2Cm(n ? String(n) : '')} min="0" className={inp} /></div>
                <div><label className="text-xs font-semibold text-stone-600 mb-1.5 block">Merma 2 %</label><NumInput value={parseFloat(merma2Percent) || 0} onChange={(n) => setMerma2Percent(n ? String(n) : '')} min="0" className={inp} /></div>
              </div>
              <p className="text-xs text-stone-500">Costo tamaño 2: <strong className="text-violet-700">{fmt$(costo2Vivo)}</strong></p>
            </div>
          )}

          <Input label="Notas" fullWidth value={notas} onChange={(e) => setNotas(e.target.value)} />
          <div className="flex items-center gap-4 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5">
            <span className="text-xs text-stone-400">Costo por prenda:</span>
            <span className="text-base font-bold font-mono tabular-nums text-violet-700">{fmt$(costoVivo)}</span>
            <span className="text-xs text-stone-400">= ({parseFloat(anchoCm) || 0}×{parseFloat(largoCm) || 0}) / ({cfg.dtfAnchoCm}×100) × {fmt$(cfg.dtfPrecioMetro)} + {parseFloat(mermaPercent) || 0}% merma</span>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" isLoading={saving}>{editId ? 'Guardar' : 'Crear estampa'}</Button>
            <Button type="button" variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</Button>
          </div>
        </form>
      )}

      {/* Edición masiva de tamaños */}
      {editTam && (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-stone-100">
            <h3 className="text-sm font-bold text-stone-800">Editar tamaños ({tamLista.length})</h3>
            <button type="button" onClick={() => setEditTam(false)} className="text-xs text-stone-400 hover:text-stone-700">✕ Cancelar</button>
          </div>
          <div className="grid grid-cols-[auto_1fr_4.5rem_4.5rem_4.5rem_4.5rem_5rem] gap-2 px-4 md:px-5 py-2 bg-stone-50 text-xs font-bold uppercase tracking-widest text-stone-400">
            <span>Código</span><span>Nombre</span><span className="text-center">Ancho</span><span className="text-center">Largo</span><span className="text-center">Ancho 2</span><span className="text-center">Largo 2</span><span className="text-right">Costo</span>
          </div>
          <div className="divide-y divide-stone-100">
            {tamLista.map((e) => {
              const t = tam[e.id] ?? { ancho: '', largo: '', ancho2: '', largo2: '' };
              const c = costo({ anchoCm: t.ancho, largoCm: t.largo, mermaPercent: e.mermaPercent });
              return (
                <div key={e.id} className="grid grid-cols-[auto_1fr_4.5rem_4.5rem_4.5rem_4.5rem_5rem] gap-2 items-center px-4 md:px-5 py-2">
                  <span className="font-mono text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded shrink-0">{e.codigoInterno}</span>
                  <span className="text-sm text-stone-700 truncate">{e.nombreComercial || <span className="text-stone-400 italic">— sin nombre —</span>}</span>
                  <NumInput value={parseFloat(t.ancho) || 0} onChange={(n) => setTamVal(e.id, 'ancho', n ? String(n) : '')} min="0" className={`${inpSm} text-center`} />
                  <NumInput value={parseFloat(t.largo) || 0} onChange={(n) => setTamVal(e.id, 'largo', n ? String(n) : '')} min="0" className={`${inpSm} text-center`} />
                  <NumInput value={parseFloat(t.ancho2) || 0} onChange={(n) => setTamVal(e.id, 'ancho2', n ? String(n) : '')} min="0" placeholder="—" className={`${inpSm} text-center`} />
                  <NumInput value={parseFloat(t.largo2) || 0} onChange={(n) => setTamVal(e.id, 'largo2', n ? String(n) : '')} min="0" placeholder="—" className={`${inpSm} text-center`} />
                  <span className="text-sm font-semibold tabular-nums text-stone-700 text-right">{fmt$(c)}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 px-4 md:px-5 py-3 border-t border-stone-100">
            <Button onClick={guardarTam} isLoading={tamSaving}>Guardar cambios {tamCambios().length || ''}</Button>
            <Button variant="secondary" onClick={() => setEditTam(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Con estampas tildadas hay dos caminos: vincularlas a un liso (receta + costo) o
          pedirles el DTF (orden de estampa de lanzamiento). */}
      {sel.size > 0 && !bulk && !showForm && !editTam && (
        <div className="flex gap-2">
          <button type="button" onClick={() => setAccionSel('vincular')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${accionSel === 'vincular' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}>
            Vincular a un liso
          </button>
          <button type="button" onClick={() => setAccionSel('pedir')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${accionSel === 'pedir' ? 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}>
            Pedir estampa
          </button>
        </div>
      )}

      {sel.size > 0 && !bulk && !showForm && !editTam && accionSel === 'pedir' && (
        <PedirEstampaPanel
          estampas={[...sel].map((id) => lista.find((x) => x.id === id)).filter((e): e is Estampa => !!e)
            .map((e) => ({ id: e.id, codigoInterno: e.codigoInterno, nombreComercial: e.nombreComercial }))}
          onCreada={() => { setSel(new Set()); setAccionSel('vincular'); cargar(); }}
          onCancelar={() => setSel(new Set())}
        />
      )}

      {/* Vincular con liso → crea 1 producto con estampa por estampa tildada */}
      {sel.size > 0 && !bulk && !showForm && !editTam && accionSel === 'vincular' && (
        <div className="bg-white rounded-2xl border border-amber-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-800">Vincular {sel.size} estampa{sel.size !== 1 ? 's' : ''} a un liso</h3>
            <button type="button" onClick={() => { setSel(new Set()); setVincNombres({}); }} className="text-xs text-stone-400 hover:text-stone-700">✕ Deseleccionar</button>
          </div>
          <p className="text-xs text-stone-500">Se crea un producto con estampa por cada estampa tildada, sobre el liso elegido. El nombre y los minutos se pueden editar después en Costos.</p>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[14rem]">
              <label className="text-xs text-stone-500 block mb-1">Liso base</label>
              <Select fullWidth value={vincLisoId} onChange={(e) => setVincLisoId(e.target.value)}>
                <option value="">— elegí el liso —</option>
                <optgroup label="Con escandallo (traen el costo)">
                  {lisos.map((l) => <option key={l.id} value={`esc:${l.id}`}>{lisoLabel(l)}</option>)}
                </optgroup>
                {lisosSoloSku.length > 0 && (
                  <optgroup label="Sin escandallo (sin costo del liso)">
                    {lisosSoloSku.map((l) => <option key={l.sku} value={`sku:${l.sku}`}>{l.sku}</option>)}
                  </optgroup>
                )}
              </Select>
              {parseLisoValue(vincLisoId).lisoSku && (
                <p className="text-[11px] text-amber-700 mt-1">Este liso no tiene escandallo: los productos quedan sin costo final hasta que se le haga.</p>
              )}
            </div>
            <div className="w-28">
              <label className="text-xs text-stone-500 block mb-1">Min estampería</label>
              <NumInput value={parseFloat(vincMin) || 0} onChange={(n) => setVincMin(n ? String(n) : '')} min="0" step="0.5" className={inpSm} />
            </div>
          </div>
          <div className="border border-stone-100 rounded-xl divide-y divide-stone-100">
            {[...sel].map((id) => {
              const e = lista.find((x) => x.id === id);
              if (!e) return null;
              return (
                <div key={id} className="grid grid-cols-[auto_1fr] gap-3 items-center px-3 py-2">
                  <span className="font-mono text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded shrink-0">{e.codigoInterno}</span>
                  <Input fullWidth value={vincNombres[id] ?? nombreAuto(e)} onChange={(ev) => setVincNombres((p) => ({ ...p, [id]: ev.target.value }))} placeholder="Nombre del producto" />
                </div>
              );
            })}
          </div>
          <Button onClick={crearVinculos} isLoading={vincSaving}>Crear {sel.size} producto{sel.size !== 1 ? 's' : ''}</Button>
        </div>
      )}

      {/* Lista */}
      {editTam ? null : loading ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-sm text-stone-400">Cargando…</div>
      ) : vista.length === 0 ? (
        <EmptyState title="Sin estampas" message="Cargá la primera estampa con su código; el nombre comercial lo ponés cuando quieras." />
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
          {vista.map((e) => {
            const est = estadoInfo(e.estado);
            return (
              <div key={e.id} className={`flex items-center gap-3 px-4 md:px-5 py-3 transition ${sel.has(e.id) ? 'bg-amber-50' : 'hover:bg-stone-50'}`}>
                <input type="checkbox" checked={sel.has(e.id)} onChange={() => toggleSel(e.id)} aria-label={`Seleccionar ${e.codigoInterno}`} className="rounded border-stone-300 accent-amber-500 shrink-0" />
                <ThumbUpload src={e.imagenUrl} size={40} onUploaded={(url) => guardarFoto(e.id, url)} />
                <div className="w-[4.5rem] shrink-0">{e.marca ? <MarcaChip marca={e.marca} /> : null}</div>
                <span className="font-mono text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded shrink-0">{e.codigoInterno}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-800 truncate">
                    {e.nombreComercial || <span className="text-stone-400 italic">— sin nombre comercial —</span>}
                    {e.coleccion && <span className="text-xs text-stone-400 ml-2">· {e.coleccion}</span>}
                  </p>
                  <p className="text-xs text-stone-400">
                    {Number(e.anchoCm) || 0}×{Number(e.largoCm) || 0} cm{e.sku ? ` · SKU ${e.sku}` : ''}
                    {tiene2Tam(e) && <span className="text-violet-500"> · T2 {Number(e.ancho2Cm)}×{Number(e.largo2Cm)} cm ({fmt$(costo({ anchoCm: e.ancho2Cm, largoCm: e.largo2Cm, mermaPercent: e.merma2Percent }))})</span>}
                  </p>
                </div>
                {productosPorEstampa[e.id]?.length ? <ProductosChip productos={productosPorEstampa[e.id]} /> : null}
                <Badge variant={est.variant} size="sm">{est.label}</Badge>
                <span className="text-sm font-semibold tabular-nums text-stone-700 w-20 text-right shrink-0">{fmt$(costo(e))}</span>
                <div className="flex gap-1.5 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => abrirEdicion(e)}>Editar</Button>
                  <button onClick={() => eliminar(e)} aria-label="Eliminar" className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Marca de la estampa. Mismo código de color que el resto de la app (Diseño, Gastos,
// Compras): Zattia violeta, Stunned rosa — se aprende una vez y vale en todas las pantallas.
function MarcaChip({ marca }: { marca: string }) {
  return (
    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md leading-none ${marca === 'Zattia' ? 'bg-violet-100 text-violet-700' : 'bg-pink-100 text-pink-700'}`}>
      {marca}
    </span>
  );
}

// Chip discreto: solo aparece en estampas que ya tienen productos. Al click,
// popover con los nombres (solo lectura).
function ProductosChip({ productos }: { productos: { id: string; nombre: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={`${productos.length} producto(s)`} aria-expanded={open}
        className="text-[11px] px-1.5 py-0.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition leading-none tabular-nums">
        🔗 {productos.length}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 mt-1 z-50 min-w-[11rem] max-w-[16rem] bg-white border border-stone-200 rounded-xl shadow-lg py-1">
            <p className="px-3 py-1 text-[10px] uppercase tracking-widest text-stone-400">En {productos.length} producto{productos.length !== 1 ? 's' : ''}</p>
            {productos.map((p) => <p key={p.id} className="px-3 py-1 text-xs text-stone-700 truncate">{p.nombre}</p>)}
          </div>
        </>
      )}
    </div>
  );
}
