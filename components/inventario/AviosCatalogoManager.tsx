'use client';

import { useState, useEffect, useCallback } from 'react';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { toast } from '@/components/ui/Toaster';

interface Etiqueta {
  id: string; nombre: string; tipo: string | null; precio: number; stock: number | null;
  categoria: string | null; frecuencia: string | null; unidad: string | null; marca: string | null; proveedorId: string | null;
}
interface ProveedorOpt { id: string; nombre: string; activo: boolean; }
interface AvioMov { id: string; tipo: string; cantidad: number; motivo: string | null; creadoPor: string; fecha: string; }

const TIPOS_ETIQUETA = ['principal', 'composicion', 'otro'];
const CATEGORIAS = ['etiqueta', 'badana', 'boton', 'cierre', 'tacha', 'hilo', 'otro'];
const FRECUENCIAS = ['habitual', 'ocasional'];   // habitual = va siempre; ocasional = según la prenda
const UNIDADES = ['etiqueta', 'unidad'];
const MARCAS = ['Zattia', 'Stunned'];
function fmt$(n: number) { return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

const inp = 'px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const card = 'bg-white rounded-2xl border border-stone-200';

// Catálogo de avíos/etiquetas (sistema liviano): nombre + precio + stock opcional.
// El stock se descuenta al terminar producción. Se usa tanto en Inventario como
// en Costos → Catálogos.
export function AviosCatalogoManager() {
  const [items, setItems] = useState<Etiqueta[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorOpt[]>([]);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('principal');
  const [categoria, setCategoria] = useState('etiqueta');
  const [frecuencia, setFrecuencia] = useState('habitual');
  const [unidad, setUnidad] = useState('etiqueta');
  const [marca, setMarca] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [precio, setPrecio] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrecio, setEditPrecio] = useState(0);
  const [editSeguir, setEditSeguir] = useState(false);
  const [editStock, setEditStock] = useState(0);
  const [editFrecuencia, setEditFrecuencia] = useState('habitual');
  const [filtroCat, setFiltroCat] = useState('');
  const [filtroFrec, setFiltroFrec] = useState('');

  // Ingreso/compra de stock
  const [ingId, setIngId] = useState<string | null>(null);
  const [ingCant, setIngCant] = useState(0);
  const [ingCosto, setIngCosto] = useState(0);
  const [ingActualizar, setIngActualizar] = useState(false);
  const [ingProv, setIngProv] = useState('');
  const [ingFactura, setIngFactura] = useState('');
  const [ingSeguirPago, setIngSeguirPago] = useState(false);
  const [ingEstado, setIngEstado] = useState<'PENDIENTE' | 'PARCIAL' | 'PAGADA'>('PENDIENTE');
  const [ingPagado, setIngPagado] = useState(0);
  const [ingSaving, setIngSaving] = useState(false);
  const [ingError, setIngError] = useState('');

  // Movimientos (auditoría) por avío
  const [movId, setMovId] = useState<string | null>(null);
  const [movs, setMovs] = useState<AvioMov[]>([]);
  const [movLoading, setMovLoading] = useState(false);

  const startIngreso = (it: Etiqueta) => {
    setIngId(it.id); setIngCant(0); setIngCosto(it.precio); setIngActualizar(false);
    setIngProv(it.proveedorId ?? ''); setIngFactura(''); setIngSeguirPago(false); setIngEstado('PENDIENTE'); setIngPagado(0);
    setIngError('');
  };

  const guardarIngreso = async (id: string) => {
    if (!ingCant || ingCant <= 0) return;
    setIngSaving(true); setIngError('');
    const body = {
      cantidad: ingCant, costoUnitario: ingCosto || 0, actualizarPrecio: ingActualizar,
      proveedorId: ingProv || null, numeroFactura: ingFactura.trim() || null,
      ...(ingProv && ingSeguirPago ? { estadoPago: ingEstado, montoPagado: ingPagado } : {}),
    };
    const r = await fetch(`/api/costos/etiquetas/${id}/ingreso`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (r.ok) {
      const d = await r.json();
      setItems(prev => prev.map(x => x.id === id ? { ...x, stock: d.stock, ...(ingActualizar ? { precio: ingCosto } : {}) } : x));
      setIngId(null);
    } else {
      const d = await r.json().catch(() => ({}));
      setIngError(typeof d.error === 'string' ? d.error : 'No se pudo registrar el ingreso');
    }
    setIngSaving(false);
  };

  const cargar = useCallback(async () => {
    const r = await fetch('/api/costos/etiquetas');
    if (r.ok) setItems((await r.json()).map((x: Etiqueta) => ({ ...x, precio: Number(x.precio) })));
  }, []);
  useEffect(() => {
    cargar();
    fetch('/api/proveedores').then(r => r.ok ? r.json() : []).then(setProveedores).catch(() => {});
  }, [cargar]);

  const agregar = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    const r = await fetch('/api/costos/etiquetas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, tipo, categoria, frecuencia, unidad, marca: marca || null, proveedorId: proveedorId || null, precio }),
    });
    if (r.ok) { const it = await r.json(); setItems(prev => [...prev, { ...it, precio: Number(it.precio) }].sort((a, b) => a.nombre.localeCompare(b.nombre))); setNombre(''); setPrecio(0); setMarca(''); setFrecuencia('habitual'); }
    setSaving(false);
  };

  const startEdit = (it: Etiqueta) => {
    setEditId(it.id); setEditPrecio(it.precio);
    setEditSeguir(it.stock != null); setEditStock(it.stock ?? 0);
    setEditFrecuencia(it.frecuencia ?? 'habitual');
  };

  const guardar = async (id: string) => {
    const r = await fetch(`/api/costos/etiquetas/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ precio: editPrecio, stock: editSeguir ? editStock : null, frecuencia: editFrecuencia }),
    });
    if (r.ok) { const it = await r.json(); setItems(prev => prev.map(x => x.id === id ? { ...it, precio: Number(it.precio) } : x)); setEditId(null); }
  };

  const eliminar = async (id: string, nom: string) => {
    if (!(await confirmAsync({ message: `¿Eliminar "${nom}"? Si tiene órdenes o movimientos asociados, se desactivará en vez de borrarse (para no perder el historial).`, danger: true, confirmLabel: 'Eliminar' }))) return;
    // DELETE inteligente: borra de verdad si no está en uso, o desactiva si tiene
    // historial. En ambos casos sale de la lista (el GET filtra activo:true).
    const r = await fetch(`/api/costos/etiquetas/${id}`, { method: 'DELETE' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error || 'No se pudo eliminar el avío'); return; }
    setItems(prev => prev.filter(x => x.id !== id));
    if (d.deleted) toast.success('Avío eliminado');
    else toast.info(d.motivo || 'Se desactivó en vez de borrarse');
  };

  const verMovimientos = async (id: string) => {
    if (movId === id) { setMovId(null); return; }
    setMovId(id); setMovLoading(true); setMovs([]);
    const r = await fetch(`/api/costos/etiquetas/${id}/movimientos`);
    if (r.ok) setMovs(await r.json());
    setMovLoading(false);
  };

  const visibles = items.filter(it =>
    (!filtroCat || it.categoria === filtroCat) &&
    (!filtroFrec || (it.frecuencia ?? 'habitual') === filtroFrec));

  return (
    <div className="max-w-2xl">
      <h3 className="text-sm font-bold text-stone-800 mb-1">Catálogo de avíos</h3>
      <p className="text-xs text-stone-400 mb-4">Etiquetas, badanas, botones, cierres, tachas, hilos. Una fila por variante (color); el talle va en el nombre. Habitual = va siempre; ocasional = según la prenda. Stock vacío = sin seguimiento.</p>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} className={`${inp} capitalize`}>
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
        </select>
        <select value={filtroFrec} onChange={e => setFiltroFrec(e.target.value)} className={`${inp} capitalize`}>
          <option value="">Habituales + ocasionales</option>
          {FRECUENCIAS.map(f => <option key={f} value={f} className="capitalize">solo {f}</option>)}
        </select>
        {(filtroCat || filtroFrec) && (
          <button onClick={() => { setFiltroCat(''); setFiltroFrec(''); }} className="text-xs text-stone-500 hover:text-stone-800 transition">Limpiar</button>
        )}
        <span className="text-xs text-stone-400 ml-auto">{visibles.length} de {items.length}</span>
      </div>

      <div className={`${card} divide-y divide-stone-100 mb-3`}>
        {visibles.length === 0 && <p className="text-sm text-stone-400 text-center py-8 italic">{items.length === 0 ? 'Sin avíos todavía' : 'Sin avíos con ese filtro'}</p>}
        {visibles.map(it => (
          <div key={it.id} className="px-5 py-3">
            <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm text-stone-800 truncate">{it.nombre}</p>
                <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${(it.frecuencia ?? 'habitual') === 'ocasional' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500'}`}>
                  {(it.frecuencia ?? 'habitual') === 'ocasional' ? 'ocasional' : 'habitual'}
                </span>
              </div>
              <p className="text-xs text-stone-400 capitalize">
                {[it.categoria, it.marca, it.unidad ? `por ${it.unidad}` : null, it.tipo].filter(Boolean).join(' · ')}
              </p>
            </div>
            {editId === it.id ? (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-stone-400">$</span>
                  <NumInput value={editPrecio} onChange={setEditPrecio} min="0" step="0.01" className={`w-24 ${inp}`} autoFocus />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer">
                  <input type="checkbox" checked={editSeguir} onChange={e => setEditSeguir(e.target.checked)} className="rounded border-stone-300 accent-amber-500" />
                  Stock
                </label>
                {editSeguir && <NumInput value={editStock} onChange={setEditStock} min="0" step="1" placeholder="cant." className={`w-20 ${inp}`} />}
                <select value={editFrecuencia} onChange={e => setEditFrecuencia(e.target.value)} className={`${inp} capitalize text-xs py-1`}>
                  {FRECUENCIAS.map(f => <option key={f} value={f} className="capitalize">{f}</option>)}
                </select>
                <button onClick={() => guardar(it.id)} className="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg font-semibold">OK</button>
                <button onClick={() => setEditId(null)} aria-label="Cancelar" className="text-xs text-stone-400 hover:text-stone-600">✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-stone-900 tabular-nums">{fmt$(it.precio)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full tabular-nums ${it.stock == null ? 'bg-stone-100 text-stone-400' : it.stock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {it.stock == null ? '∞ sin seguimiento' : `${it.stock} en stock`}
                </span>
                <button onClick={() => startIngreso(it)}
                  className="text-xs px-2 py-1 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 transition">+ Ingresar</button>
                <Button variant="secondary" size="sm" onClick={() => verMovimientos(it.id)}>Mov.</Button>
                <Button variant="secondary" size="sm" onClick={() => startEdit(it)}>Editar</Button>
                <button onClick={() => eliminar(it.id, it.nombre)} aria-label="Eliminar"
                  className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition">×</button>
              </div>
            )}
            </div>

            {ingId === it.id && (
              <div className="mt-3 bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Ingresar stock</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">Cantidad</label>
                    <NumInput value={ingCant} onChange={setIngCant} min="1" step="1" placeholder="cant." className={`w-full ${inp}`} />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">Costo unitario $</label>
                    <NumInput value={ingCosto} onChange={setIngCosto} min="0" step="0.01" className={`w-full ${inp}`} />
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer">
                  <input type="checkbox" checked={ingActualizar} onChange={e => setIngActualizar(e.target.checked)} className="rounded border-stone-300 accent-amber-500" />
                  Actualizar el precio de referencia con este costo
                </label>

                <div className="border-t border-stone-200 pt-2 space-y-2">
                  <select value={ingProv} onChange={e => setIngProv(e.target.value)} className={`w-full ${inp}`}>
                    <option value="">— Sin proveedor (ingreso interno) —</option>
                    {proveedores.filter(p => p.activo).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  {ingProv && (
                    <>
                      <input type="text" value={ingFactura} onChange={e => setIngFactura(e.target.value)} placeholder="N° factura (opcional)" className={`w-full ${inp}`} />
                      <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer">
                        <input type="checkbox" checked={ingSeguirPago} onChange={e => setIngSeguirPago(e.target.checked)} className="rounded border-stone-300 accent-amber-500" />
                        Seguir el pago (aparece en cuentas por pagar)
                      </label>
                      {ingSeguirPago && (
                        <div className="grid grid-cols-2 gap-2">
                          <select value={ingEstado} onChange={e => setIngEstado(e.target.value as typeof ingEstado)} className={`w-full ${inp}`}>
                            {['PENDIENTE', 'PARCIAL', 'PAGADA'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <NumInput value={ingPagado} onChange={setIngPagado} min="0" step="0.01" placeholder="Pagado $" className={`w-full ${inp}`} />
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 justify-between">
                  <span className="text-xs text-stone-500">Total: <strong>{fmt$((ingCant || 0) * (ingCosto || 0))}</strong></span>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => guardarIngreso(it.id)} disabled={!ingCant} isLoading={ingSaving}>
                      {ingProv ? 'Registrar compra' : 'Ingresar'}
                    </Button>
                    <button onClick={() => setIngId(null)} className="text-xs text-stone-400 hover:text-stone-600 px-2">Cancelar</button>
                  </div>
                </div>
                {ingError && <p className="text-xs text-red-600 font-semibold mt-2">{ingError}</p>}
              </div>
            )}

            {movId === it.id && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                {movLoading ? (
                  <p className="text-xs text-stone-400">Cargando…</p>
                ) : movs.length === 0 ? (
                  <p className="text-xs text-stone-400 italic">Sin movimientos registrados</p>
                ) : (
                  <div className="space-y-1">
                    {movs.map((m) => (
                      <div key={m.id} className="flex items-center gap-2 text-xs">
                        <span className="text-stone-400 w-28 shrink-0">
                          {new Date(m.fecha).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="font-semibold w-16 shrink-0">{m.tipo}</span>
                        <span className={`tabular-nums w-12 text-right shrink-0 ${m.cantidad >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {m.cantidad >= 0 ? '+' : ''}{m.cantidad}
                        </span>
                        <span className="text-stone-500 truncate">{[m.motivo, m.creadoPor].filter(Boolean).join(' · ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 space-y-2">
        <Input fullWidth type="text" value={nombre} onChange={e => setNombre(e.target.value)}
          placeholder="Nombre del avío (ej: Badana PU Zattia Negro)" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select value={categoria} onChange={e => setCategoria(e.target.value)} className={`${inp} capitalize`}>
            {CATEGORIAS.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
          <select value={frecuencia} onChange={e => setFrecuencia(e.target.value)} className={`${inp} capitalize`}>
            {FRECUENCIAS.map(f => <option key={f} value={f} className="capitalize">{f}</option>)}
          </select>
          <select value={unidad} onChange={e => setUnidad(e.target.value)} className={`${inp} capitalize`}>
            {UNIDADES.map(u => <option key={u} value={u} className="capitalize">por {u}</option>)}
          </select>
          <select value={marca} onChange={e => setMarca(e.target.value)} className={inp}>
            <option value="">— Marca —</option>
            {MARCAS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={tipo} onChange={e => setTipo(e.target.value)} className={`${inp} capitalize`}>
            {TIPOS_ETIQUETA.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
          </select>
          <select value={proveedorId} onChange={e => setProveedorId(e.target.value)} className={`${inp} col-span-2`}>
            <option value="">— Proveedor (opcional) —</option>
            {proveedores.filter(p => p.activo).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <NumInput value={precio} onChange={setPrecio} placeholder="$ precio ref." min="0" step="0.01" className={`${inp} col-span-2`} />
        </div>
        <Button onClick={agregar} disabled={!nombre.trim()} isLoading={saving} className="w-full">
          + Agregar avío
        </Button>
      </div>
    </div>
  );
}
