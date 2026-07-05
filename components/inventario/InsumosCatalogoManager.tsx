'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { toast } from '@/components/ui/Toaster';
import { Card } from '@/components/ui/Card';

interface InsumoItem {
  id: string;
  nombre: string;
  nombreInterno: string | null;
  categoria: string;
  tipoTrazabilidad: string;
  unidadDefault: string;
  stockMinimo: number | null;
  manejaColor: boolean;
  rinde: number | null;
  activo: boolean;
}

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';

// Las categorías de avíos (etiqueta/badana/hilo/aviso) se quitan del alta de
// insumos: todo avío se carga en el Catálogo de avíos (sistema liviano). Acá
// quedan solo los materiales productivos. Los valores viejos siguen siendo
// válidos para mostrar insumos ya cargados.
const CATEGORIAS = ['tela', 'vinilo', 'packaging', 'otro'];
const UNIDADES = ['kg', 'metro', 'unidad'];
// El valor interno queda 'aviso' (para no romper datos existentes) pero se
// muestra "Avíos" bien escrito.
const CAT_LABEL: Record<string, string> = { aviso: 'Avíos' };
const catLabel = (c: string) => CAT_LABEL[c] ?? c;

export function InsumosCatalogoManager({ initial }: { initial: InsumoItem[] }) {
  const [insumos, setInsumos]       = useState(initial);
  const [showForm, setShowForm]     = useState(false);
  const [editando, setEditando]     = useState<InsumoItem | null>(null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  const [nombre, setNombre]                   = useState('');
  const [nombreInterno, setNombreInterno]     = useState('');
  const [telasCatalogo, setTelasCatalogo]     = useState<string[]>([]);
  const [categoria, setCategoria]             = useState('tela');
  const [tipoTrazabilidad, setTipoTrazabilidad] = useState('rollo');
  const [unidadDefault, setUnidadDefault]     = useState('kg');
  const [stockMinimo, setStockMinimo]         = useState('');
  const [manejaColor, setManejaColor]         = useState(false);
  const [rinde, setRinde]                     = useState('');

  // Catálogo de telas internas para sugerir nombres internos
  useEffect(() => {
    fetch('/api/telas-catalogo')
      .then((r) => r.ok ? r.json() : [])
      .then((t) => { if (Array.isArray(t)) setTelasCatalogo(t.map((x: { nombre: string }) => x.nombre)); })
      .catch(() => {});
  }, []);

  const resetForm = () => {
    setNombre(''); setNombreInterno(''); setCategoria('tela'); setTipoTrazabilidad('rollo');
    setUnidadDefault('kg'); setStockMinimo(''); setManejaColor(false); setRinde(''); setError('');
  };

  const abrirNuevo = () => { resetForm(); setEditando(null); setShowForm(true); };

  const abrirEdicion = (ins: InsumoItem) => {
    setNombre(ins.nombre);
    setNombreInterno(ins.nombreInterno ?? '');
    setCategoria(ins.categoria);
    setTipoTrazabilidad(ins.tipoTrazabilidad);
    setUnidadDefault(ins.unidadDefault);
    setStockMinimo(ins.stockMinimo != null ? String(ins.stockMinimo) : '');
    setManejaColor(ins.manejaColor);
    setRinde(ins.rinde != null ? String(ins.rinde) : '');
    setEditando(ins);
    setShowForm(true);
    setError('');
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('Nombre obligatorio'); return; }
    setSaving(true);
    setError('');

    const payload = {
      nombre: nombre.trim(),
      nombreInterno: nombreInterno.trim() || null,
      categoria,
      tipoTrazabilidad,
      unidadDefault,
      stockMinimo: stockMinimo ? Number(stockMinimo) : undefined,
      manejaColor,
      rinde: rinde ? Number(rinde) : undefined,
    };

    const url = editando ? `/api/insumos/${editando.id}` : '/api/insumos';
    const method = editando ? 'PUT' : 'POST';

    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (r.ok) {
      const item = await r.json();
      if (editando) {
        setInsumos((prev) => prev.map((i) => i.id === item.id ? item : i));
      } else {
        setInsumos((prev) => [...prev, item].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      }
      setShowForm(false);
      resetForm();
    } else {
      const d = await r.json();
      setError(d.error || 'Error al guardar');
    }
    setSaving(false);
  };

  const toggleActivo = async (ins: InsumoItem) => {
    const r = await fetch(`/api/insumos/${ins.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !ins.activo }),
    });
    if (r.ok) {
      const item = await r.json();
      setInsumos((prev) => prev.map((x) => x.id === item.id ? item : x));
    }
  };

  // Eliminar inteligente: borra si no tiene historial, desactiva con aviso si sí.
  const eliminar = async (ins: InsumoItem) => {
    if (!(await confirmAsync({ message: `¿Eliminar "${ins.nombre}"? Si tiene rollos, lotes o compras asociadas, se desactivará en vez de borrarse (para no perder el historial).`, danger: true, confirmLabel: 'Eliminar' }))) return;
    const r = await fetch(`/api/insumos/${ins.id}`, { method: 'DELETE' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error || 'No se pudo eliminar'); return; }
    if (d.deleted) {
      setInsumos((prev) => prev.filter((x) => x.id !== ins.id));
      toast.success('Insumo eliminado');
    } else {
      setInsumos((prev) => prev.map((x) => x.id === ins.id ? { ...x, activo: false } : x));
      toast.info(d.motivo || 'Se desactivó en vez de borrarse');
    }
  };

  const filtrados = filtroCategoria
    ? insumos.filter((i) => i.categoria === filtroCategoria)
    : insumos;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {!showForm && (
          <Button onClick={abrirNuevo}>
            + Agregar insumo
          </Button>
        )}
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}
          className="px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400">
          <option value="">Todas las categorias</option>
          {CATEGORIAS.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
        </select>
      </div>

      {showForm && (
        <Card padding="none" className="p-6">
          <h3 className="text-sm font-bold text-stone-800 mb-4">
            {editando ? 'Editar insumo' : 'Nuevo insumo'}
          </h3>
          <form onSubmit={guardar} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input label="Nombre del artículo *" fullWidth type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                <p className="text-xs text-stone-400 mt-1">Como lo nombra el proveedor / factura.</p>
              </div>
              <div>
                <Input label="Nombre interno" fullWidth type="text" value={nombreInterno} onChange={(e) => setNombreInterno(e.target.value)}
                  list="telas-catalogo-list" placeholder="Opcional" />
                <datalist id="telas-catalogo-list">
                  {telasCatalogo.map((t) => <option key={t} value={t} />)}
                </datalist>
                <p className="text-xs text-stone-400 mt-1">Cómo lo llamás internamente (sugerencias del catálogo de telas).</p>
              </div>
              <Select label="Categoria *" fullWidth value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                {CATEGORIAS.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
              </Select>
              <Select label="Trazabilidad *" fullWidth value={tipoTrazabilidad} onChange={(e) => setTipoTrazabilidad(e.target.value)}>
                <option value="rollo">Rollo (peso individual)</option>
              </Select>
              <Select label="Unidad default" fullWidth value={unidadDefault} onChange={(e) => setUnidadDefault(e.target.value)}>
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Stock minimo</label>
                <NumInput value={parseFloat(stockMinimo) || 0} onChange={(n) => setStockMinimo(n ? String(n) : '')}
                  min="0" step="0.01" placeholder="Opcional" className={inp} />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Rinde (m/kg)</label>
                <NumInput value={parseFloat(rinde) || 0} onChange={(n) => setRinde(n ? String(n) : '')}
                  min="0" step="0.01" placeholder="Ej: 3.2" className={inp} />
                <p className="text-xs text-stone-400 mt-1">Metros por kg. Solo para telas.</p>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                  <input type="checkbox" checked={manejaColor} onChange={(e) => setManejaColor(e.target.checked)}
                    className="rounded border-stone-300" />
                  Maneja color
                </label>
              </div>
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={saving} isLoading={saving}>
                {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card padding="none" className="overflow-hidden">
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-4 text-xs font-bold uppercase tracking-widest text-stone-400">
          <span>Nombre</span>
          <span>Categoria</span>
          <span>Trazabilidad</span>
          <span>Unidad</span>
          <span>Color</span>
          <span>Estado</span>
          <span />
        </div>
        {filtrados.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-10">Sin insumos</p>
        ) : (
          filtrados.map((ins, i) => (
            <div key={ins.id}
              className={`px-5 py-3 grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-4 items-center ${i > 0 ? 'border-t border-stone-100' : ''} ${!ins.activo ? 'opacity-50' : ''}`}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-800 truncate">{ins.nombre}</p>
                {ins.nombreInterno && <p className="text-xs text-stone-400 truncate">interno: {ins.nombreInterno}</p>}
              </div>
              <Badge variant="default">{catLabel(ins.categoria)}</Badge>
              <span className="text-xs text-stone-500">{ins.tipoTrazabilidad}</span>
              <span className="text-xs text-stone-500">{ins.unidadDefault}</span>
              <span className="text-xs text-stone-500">{ins.manejaColor ? 'Si' : '--'}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ins.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                {ins.activo ? 'Activo' : 'Inactivo'}
              </span>
              <div className="flex gap-1.5">
                {ins.manejaColor && (
                  <Link href={`/inventario/catalogo/${ins.id}/colores`}
                    className="text-xs px-2.5 py-1 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 transition">
                    Colores
                  </Link>
                )}
                <Button variant="secondary" size="sm" onClick={() => abrirEdicion(ins)} className="px-2.5 py-1 rounded-lg">
                  Editar
                </Button>
                <Button variant="secondary" size="sm" onClick={() => toggleActivo(ins)} className="px-2.5 py-1 rounded-lg">
                  {ins.activo ? 'Desactivar' : 'Activar'}
                </Button>
                <button onClick={() => eliminar(ins)} aria-label="Eliminar"
                  className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition">×</button>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
