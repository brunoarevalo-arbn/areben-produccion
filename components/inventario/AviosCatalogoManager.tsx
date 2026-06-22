'use client';

import { useState, useEffect, useCallback } from 'react';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Etiqueta {
  id: string; nombre: string; tipo: string | null; precio: number; stock: number | null;
  categoria: string | null; unidad: string | null; marca: string | null; proveedorId: string | null;
}
interface ProveedorOpt { id: string; nombre: string; activo: boolean; }

const TIPOS_ETIQUETA = ['principal', 'composicion', 'otro'];
const CATEGORIAS = ['etiqueta', 'badana', 'boton', 'hilo', 'otro'];
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
  const [unidad, setUnidad] = useState('etiqueta');
  const [marca, setMarca] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [precio, setPrecio] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrecio, setEditPrecio] = useState(0);
  const [editSeguir, setEditSeguir] = useState(false);
  const [editStock, setEditStock] = useState(0);

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
      body: JSON.stringify({ nombre, tipo, categoria, unidad, marca: marca || null, proveedorId: proveedorId || null, precio }),
    });
    if (r.ok) { const it = await r.json(); setItems(prev => [...prev, { ...it, precio: Number(it.precio) }].sort((a, b) => a.nombre.localeCompare(b.nombre))); setNombre(''); setPrecio(0); setMarca(''); }
    setSaving(false);
  };

  const startEdit = (it: Etiqueta) => {
    setEditId(it.id); setEditPrecio(it.precio);
    setEditSeguir(it.stock != null); setEditStock(it.stock ?? 0);
  };

  const guardar = async (id: string) => {
    const r = await fetch(`/api/costos/etiquetas/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ precio: editPrecio, stock: editSeguir ? editStock : null }),
    });
    if (r.ok) { const it = await r.json(); setItems(prev => prev.map(x => x.id === id ? { ...it, precio: Number(it.precio) } : x)); setEditId(null); }
  };

  const eliminar = async (id: string, nom: string) => {
    if (!confirm(`¿Eliminar la etiqueta "${nom}"?`)) return;
    const r = await fetch(`/api/costos/etiquetas/${id}`, { method: 'DELETE' });
    if (r.ok) setItems(prev => prev.filter(x => x.id !== id));
  };

  return (
    <div className="max-w-2xl">
      <h3 className="text-sm font-bold text-stone-800 mb-1">Catálogo de avíos</h3>
      <p className="text-xs text-stone-400 mb-4">Etiquetas, badanas, botones, hilos. Una fila por variante (color). El talle va en el nombre. Stock vacío = sin seguimiento; se descuenta al terminar producción.</p>

      <div className={`${card} divide-y divide-stone-100 mb-3`}>
        {items.length === 0 && <p className="text-sm text-stone-400 text-center py-8 italic">Sin avíos todavía</p>}
        {items.map(it => (
          <div key={it.id} className="px-5 py-3">
            <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-stone-800">{it.nombre}</p>
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
                <button onClick={() => guardar(it.id)} className="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg font-semibold">OK</button>
                <button onClick={() => setEditId(null)} className="text-xs text-stone-400 hover:text-stone-600">✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-stone-900 tabular-nums">{fmt$(it.precio)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full tabular-nums ${it.stock == null ? 'bg-stone-100 text-stone-400' : it.stock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {it.stock == null ? '∞ sin seguimiento' : `${it.stock} en stock`}
                </span>
                <button onClick={() => startIngreso(it)}
                  className="text-xs px-2 py-1 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 transition">+ Ingresar</button>
                <Button variant="secondary" size="sm" onClick={() => startEdit(it)}>Editar</Button>
                <button onClick={() => eliminar(it.id, it.nombre)}
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
