'use client';

import { useState, useEffect, useCallback } from 'react';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { toast } from '@/components/ui/Toaster';

interface Estampa {
  id: string; codigoInterno: string; nombreComercial: string | null; coleccion: string | null;
  imagenUrl: string | null; precioMetroDtf: string | number; largoCm: string | number;
  estado: string; sku: string | null; notas: string | null;
}

const ESTADOS = [
  { value: 'pensada',  label: 'Pensada',  variant: 'warning' as const },
  { value: 'pedida',   label: 'DTF pedido', variant: 'info' as const },
  { value: 'recibida', label: 'Recibido', variant: 'success' as const },
];
const estadoInfo = (e: string) => ESTADOS.find((x) => x.value === e) ?? ESTADOS[0];
const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30';
const fmt$ = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
const costoUnit = (e: { precioMetroDtf: string | number; largoCm: string | number }) => Number(e.precioMetroDtf) * Number(e.largoCm) / 100;

export function EstamperiaClient() {
  const [lista, setLista] = useState<Estampa[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [soloSinNombre, setSoloSinNombre] = useState(false);
  const [q, setQ] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [codigoInterno, setCodigoInterno] = useState('');
  const [nombreComercial, setNombreComercial] = useState('');
  const [coleccion, setColeccion] = useState('');
  const [estado, setEstado] = useState('pensada');
  const [precioMetroDtf, setPrecioMetroDtf] = useState('');
  const [largoCm, setLargoCm] = useState('');
  const [sku, setSku] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

  const resetForm = () => {
    setEditId(null); setCodigoInterno(''); setNombreComercial(''); setColeccion('');
    setEstado('pensada'); setLargoCm(''); setSku(''); setImagenUrl(''); setNotas(''); setError('');
    // El precio del DTF se prellena con el último usado (suele ser el mismo).
    setPrecioMetroDtf(lista[0]?.precioMetroDtf ? String(Number(lista[0].precioMetroDtf)) : '');
  };
  const abrirNuevo = () => { resetForm(); setShowForm(true); };
  const abrirEdicion = (e: Estampa) => {
    setEditId(e.id); setCodigoInterno(e.codigoInterno); setNombreComercial(e.nombreComercial ?? '');
    setColeccion(e.coleccion ?? ''); setEstado(e.estado); setPrecioMetroDtf(String(Number(e.precioMetroDtf) || ''));
    setLargoCm(String(Number(e.largoCm) || '')); setSku(e.sku ?? ''); setImagenUrl(e.imagenUrl ?? '');
    setNotas(e.notas ?? ''); setError(''); setShowForm(true);
  };

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!codigoInterno.trim()) { setError('Poné el código interno'); return; }
    setSaving(true); setError('');
    const payload = {
      codigoInterno: codigoInterno.trim(),
      nombreComercial: nombreComercial.trim() || null,
      coleccion: coleccion.trim() || null,
      estado,
      precioMetroDtf: parseFloat(precioMetroDtf) || 0,
      largoCm: parseFloat(largoCm) || 0,
      sku: sku.trim() || null,
      imagenUrl: imagenUrl.trim() || null,
      notas: notas.trim() || null,
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

  const costoVivo = (parseFloat(precioMetroDtf) || 0) * (parseFloat(largoCm) || 0) / 100;
  const vista = soloSinNombre ? lista.filter((e) => !e.nombreComercial?.trim()) : lista;

  return (
    <div className="space-y-5">
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
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar código / nombre / colección / SKU"
          className="px-3 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400 flex-1 min-w-[12rem]" />
        {!showForm && <Button onClick={abrirNuevo}>+ Nueva estampa</Button>}
      </div>

      {/* Form */}
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
            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Precio DTF ($/metro)</label>
              <NumInput value={parseFloat(precioMetroDtf) || 0} onChange={(n) => setPrecioMetroDtf(n ? String(n) : '')} min="0" className={inp} />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Largo en el rollo (cm)</label>
              <NumInput value={parseFloat(largoCm) || 0} onChange={(n) => setLargoCm(n ? String(n) : '')} min="0" className={inp} />
            </div>
            <Input label="Producto / SKU vinculado" fullWidth value={sku} onChange={(e) => setSku(e.target.value)} placeholder="(opcional, después)" />
            <Input label="Imagen (URL)" fullWidth value={imagenUrl} onChange={(e) => setImagenUrl(e.target.value)} placeholder="(opcional)" />
            <Input label="Notas" fullWidth value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
          <div className="flex items-center gap-4 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5">
            <span className="text-xs text-stone-400">Costo por prenda:</span>
            <span className="text-base font-bold font-mono tabular-nums text-violet-700">{fmt$(costoVivo)}</span>
            <span className="text-xs text-stone-400">= $/m × {parseFloat(largoCm) || 0} cm</span>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" isLoading={saving}>{editId ? 'Guardar' : 'Crear estampa'}</Button>
            <Button type="button" variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</Button>
          </div>
        </form>
      )}

      {/* Lista */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-sm text-stone-400">Cargando…</div>
      ) : vista.length === 0 ? (
        <EmptyState title="Sin estampas" message="Cargá la primera estampa con su código; el nombre comercial lo ponés cuando quieras." />
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
          {vista.map((e) => {
            const est = estadoInfo(e.estado);
            return (
              <div key={e.id} className="flex items-center gap-3 px-4 md:px-5 py-3 hover:bg-stone-50 transition">
                <span className="font-mono text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded shrink-0">{e.codigoInterno}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-800 truncate">
                    {e.nombreComercial || <span className="text-stone-400 italic">— sin nombre comercial —</span>}
                    {e.coleccion && <span className="text-xs text-stone-400 ml-2">· {e.coleccion}</span>}
                  </p>
                  {e.sku && <p className="text-xs text-stone-400">SKU: {e.sku}</p>}
                </div>
                <Badge variant={est.variant} size="sm">{est.label}</Badge>
                <span className="text-sm font-semibold tabular-nums text-stone-700 w-20 text-right shrink-0">{fmt$(costoUnit(e))}</span>
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
