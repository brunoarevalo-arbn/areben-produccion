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
import { ImageDrop, Thumbnail } from '@/components/ui/ImageDrop';

interface Estampa {
  id: string; codigoInterno: string; nombreComercial: string | null; coleccion: string | null;
  imagenUrl: string | null; anchoCm: string | number; largoCm: string | number; mermaPercent: string | number;
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
const fmt$ = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

export function EstamperiaClient({ esAdmin }: { esAdmin: boolean }) {
  const [lista, setLista] = useState<Estampa[]>([]);
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<DtfCfg>({ dtfPrecioMetro: 0, dtfAnchoCm: 58, dtfMermaDefault: 0 });
  const [filtroEstado, setFiltroEstado] = useState('');
  const [soloSinNombre, setSoloSinNombre] = useState(false);
  const [q, setQ] = useState('');

  // Form individual
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [codigoInterno, setCodigoInterno] = useState('');
  const [nombreComercial, setNombreComercial] = useState('');
  const [coleccion, setColeccion] = useState('');
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
  const [bulkRows, setBulkRows] = useState<{ id: number; codigo: string; ancho: string; largo: string; coleccion: string }[]>([{ id: 0, codigo: '', ancho: '', largo: '', coleccion: '' }]);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Edición masiva de tamaños (ancho/largo, + 2º tamaño opcional)
  const [editTam, setEditTam] = useState(false);
  const [tamLista, setTamLista] = useState<Estampa[]>([]);
  const [tam, setTam] = useState<Record<string, { ancho: string; largo: string; ancho2: string; largo2: string }>>({});
  const [tamSaving, setTamSaving] = useState(false);

  // Vincular estampas ↔ liso (crea 1 producto con estampa por estampa tildada)
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [lisos, setLisos] = useState<{ id: string; nombre: string; nombreComercial: string | null; sku: string | null; marca: string | null }[]>([]);
  const [minGlobal, setMinGlobal] = useState(0);
  const [vincLisoId, setVincLisoId] = useState('');
  const [vincMin, setVincMin] = useState('');
  const [vincNombres, setVincNombres] = useState<Record<string, string>>({});
  const [vincSaving, setVincSaving] = useState(false);
  const [productosPorEstampa, setProductosPorEstampa] = useState<Record<string, { id: string; nombre: string }[]>>({});
  const [soloSinProducto, setSoloSinProducto] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filtroEstado) p.set('estado', filtroEstado);
    if (q.trim()) p.set('q', q.trim());
    const r = await fetch(`/api/estampas?${p}`);
    if (r.ok) setLista(await r.json());
    setLoading(false);
  }, [filtroEstado, q]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    fetch('/api/estampas/config').then((r) => r.ok ? r.json() : null).then((c) => { if (c) setCfg(c); }).catch(() => {});
    fetch('/api/costos/escandallos').then((r) => r.ok ? r.json() : []).then((e) => { if (Array.isArray(e)) setLisos(e); }).catch(() => {});
    fetch('/api/estampado/tiempo').then((r) => r.ok ? r.json() : null).then((c) => { if (c && c.minPorEstampa) { setMinGlobal(c.minPorEstampa); setVincMin(String(Math.round(c.minPorEstampa * 10) / 10)); } }).catch(() => {});
    cargarVinculos();
  }, []);

  const cargarVinculos = () => {
    fetch('/api/costos/productos-estampados/por-estampa').then((r) => r.ok ? r.json() : null).then((m) => { if (m && typeof m === 'object') setProductosPorEstampa(m); }).catch(() => {});
  };

  const toggleSel = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const lisoLabel = (l: { nombre: string; sku: string | null }) => `${l.nombre}${l.sku ? ` · ${l.sku}` : ''}`;
  const nombreAuto = (e: Estampa) => e.nombreComercial?.trim() || e.codigoInterno;

  const crearVinculos = async () => {
    if (!vincLisoId) { toast.error('Elegí el liso base'); return; }
    const liso = lisos.find((l) => l.id === vincLisoId);
    const min = parseFloat(vincMin) || 0;
    const productos = [...sel].map((id) => {
      const e = lista.find((x) => x.id === id);
      return {
        nombre: (vincNombres[id] ?? (e ? nombreAuto(e) : '')).trim() || (e?.codigoInterno ?? 'Producto'),
        marca: liso?.marca ?? null,
        lisoEscandalloId: vincLisoId,
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
    setEditId(null); setCodigoInterno(''); setNombreComercial(''); setColeccion('');
    setEstado('pensada'); setAnchoCm(''); setLargoCm(''); setMermaPercent(String(cfg.dtfMermaDefault || ''));
    setAncho2Cm(''); setLargo2Cm(''); setMerma2Percent(''); setTiene2(false);
    setSku(''); setImagenUrl(''); setNotas(''); setError('');
  };
  const abrirNuevo = () => { resetForm(); setBulk(false); setShowForm(true); };
  const abrirEdicion = (e: Estampa) => {
    setEditId(e.id); setCodigoInterno(e.codigoInterno); setNombreComercial(e.nombreComercial ?? '');
    setColeccion(e.coleccion ?? ''); setEstado(e.estado);
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
      codigoInterno: codigoInterno.trim(), nombreComercial: nombreComercial.trim() || null, coleccion: coleccion.trim() || null,
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
  const abrirBulk = () => { setBulkRows([{ id: 0, codigo: '', ancho: '', largo: '', coleccion: '' }]); seq.current = 1; setShowForm(false); setBulk(true); };
  const guardarBulk = async () => {
    const filas = bulkRows.filter((r) => r.codigo.trim()).map((r) => ({
      codigoInterno: r.codigo.trim(), coleccion: r.coleccion.trim() || undefined,
      anchoCm: parseFloat(r.ancho) || 0, largoCm: parseFloat(r.largo) || 0,
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
            <button type="button" onClick={() => setBulk(false)} className="text-xs text-stone-400 hover:text-stone-700">✕ Cancelar</button>
          </div>
          <div className="grid grid-cols-[1fr_5rem_5rem_1fr_auto] gap-2 text-xs font-bold uppercase tracking-widest text-stone-400 px-1">
            <span>Código *</span><span>Ancho cm</span><span>Largo cm</span><span>Colección</span><span />
          </div>
          {bulkRows.map((row, i) => (
            <div key={row.id} className="grid grid-cols-[1fr_5rem_5rem_1fr_auto] gap-2 items-center">
              <input value={row.codigo} onChange={(e) => setBulkRows((p) => p.map((r) => r.id === row.id ? { ...r, codigo: e.target.value } : r))} placeholder="EST-00X" className={inpSm} />
              <NumInput value={parseFloat(row.ancho) || 0} onChange={(n) => setBulkRows((p) => p.map((r) => r.id === row.id ? { ...r, ancho: n ? String(n) : '' } : r))} min="0" className={inpSm} />
              <NumInput value={parseFloat(row.largo) || 0} onChange={(n) => setBulkRows((p) => p.map((r) => r.id === row.id ? { ...r, largo: n ? String(n) : '' } : r))} min="0" className={inpSm} />
              <input value={row.coleccion} onChange={(e) => setBulkRows((p) => p.map((r) => r.id === row.id ? { ...r, coleccion: e.target.value } : r))} placeholder="(opcional)" className={inpSm} />
              <button type="button" onClick={() => setBulkRows((p) => p.length > 1 ? p.filter((r) => r.id !== row.id) : p)} className="text-stone-300 hover:text-red-400 text-xl leading-none px-1">×</button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setBulkRows((p) => [...p, { id: seq.current++, codigo: '', ancho: '', largo: '', coleccion: '' }])}>+ Fila</Button>
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

      {/* Vincular con liso → crea 1 producto con estampa por estampa tildada */}
      {sel.size > 0 && !bulk && !showForm && !editTam && (
        <div className="bg-white rounded-2xl border border-amber-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-800">Vincular {sel.size} estampa{sel.size !== 1 ? 's' : ''} a un liso</h3>
            <button type="button" onClick={() => { setSel(new Set()); setVincNombres({}); }} className="text-xs text-stone-400 hover:text-stone-700">✕ Deseleccionar</button>
          </div>
          <p className="text-xs text-stone-500">Se crea un producto con estampa por cada estampa tildada, sobre el liso elegido. El nombre y los minutos se pueden editar después en Costos.</p>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[14rem]">
              <label className="text-xs text-stone-500 block mb-1">Liso base (escandallo)</label>
              <Select fullWidth value={vincLisoId} onChange={(e) => setVincLisoId(e.target.value)}>
                <option value="">— elegí el liso —</option>
                {lisos.map((l) => <option key={l.id} value={l.id}>{lisoLabel(l)}</option>)}
              </Select>
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
                <Thumbnail src={e.imagenUrl} size={36} />
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
