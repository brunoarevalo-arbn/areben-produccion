'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Material { id?: string; nombre: string; cantidad: number; unidad: string; costoUnitario: number; }
interface Escandallo {
  id: string; nombre: string; sku: string | null; marca: string | null;
  proyectoId: string | null; notas: string | null; margen: number;
  materiales: Material[];
  createdAt: string; updatedAt: string;
}

const MARCAS   = ['Zattia', 'Stunned'];
const UNIDADES = ['m', 'kg', 'u', 'cm', 'ml', 'rollo'];

function fmt$(n: number) { return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export function Escandallos({ costoMinuto = 0 }: { costoMinuto?: number }) {
  const router = useRouter();
  const [lista,    setLista]    = useState<Escandallo[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState<string | null>(null);

  const [nombre,  setNombre]  = useState('');
  const [sku,     setSku]     = useState('');
  const [marca,   setMarca]   = useState('');
  const [notas,   setNotas]   = useState('');
  const [margen,  setMargen]  = useState('2.5');
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [tiempoMin, setTiempoMin]   = useState('');
  const [saving,  setSaving]  = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/costos/escandallos');
    if (r.ok) setLista(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const resetForm = () => {
    setNombre(''); setSku(''); setMarca(''); setNotas(''); setMargen('2.5');
    setMateriales([]); setTiempoMin(''); setEditId(null); setShowForm(false);
  };

  const openEdit = (e: Escandallo) => {
    setEditId(e.id); setNombre(e.nombre); setSku(e.sku ?? ''); setMarca(e.marca ?? '');
    setNotas(e.notas ?? ''); setMargen(String(e.margen));
    setMateriales(e.materiales.map((m) => ({ nombre: m.nombre, cantidad: m.cantidad, unidad: m.unidad, costoUnitario: m.costoUnitario })));
    setTiempoMin(''); setShowForm(true);
  };

  const addMaterial = () => setMateriales((prev) => [...prev, { nombre: '', cantidad: 1, unidad: 'm', costoUnitario: 0 }]);
  const updMaterial = (i: number, field: keyof Material, val: string | number) =>
    setMateriales((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m));
  const delMaterial = (i: number) => setMateriales((prev) => prev.filter((_, idx) => idx !== i));

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true);
    const body = { nombre, sku, marca, notas, margen: parseFloat(margen) || 2.5, materiales };
    const url    = editId ? `/api/costos/escandallos/${editId}` : '/api/costos/escandallos';
    const method = editId ? 'PATCH' : 'POST';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) {
      const data = await r.json();
      setLista((prev) => editId ? prev.map((e) => e.id === editId ? data : e) : [data, ...prev]);
      resetForm();
    }
    setSaving(false);
  };

  const eliminar = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar el escandallo "${nombre}"?`)) return;
    const r = await fetch(`/api/costos/escandallos/${id}`, { method: 'DELETE' });
    if (r.ok) setLista((prev) => prev.filter((e) => e.id !== id));
  };

  // Cálculos para el formulario activo
  const costoMateriales = materiales.reduce((s, m) => s + m.cantidad * m.costoUnitario, 0);
  const costoMO         = costoMinuto > 0 && tiempoMin ? parseFloat(tiempoMin) * costoMinuto : 0;
  const costoTotal      = costoMateriales + costoMO;
  const precioSugerido  = costoTotal * (parseFloat(margen) || 2.5);

  if (loading) return <div className="text-center py-16 text-stone-400 text-sm">Cargando...</div>;

  return (
    <div className="space-y-5">
      {/* Lista */}
      {!showForm && (
        <>
          <div className="grid grid-cols-1 gap-3">
            {lista.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center">
                <p className="text-stone-400 text-sm">No hay escandallos creados todavía.</p>
              </div>
            )}
            {lista.map((e) => {
              const costoMat = e.materiales.reduce((s, m) => s + m.cantidad * m.costoUnitario, 0);
              return (
                <div key={e.id} className="bg-white rounded-2xl border border-stone-200 p-5 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-bold text-stone-900">{e.nombre}</p>
                      {e.sku  && <span className="font-mono text-xs bg-stone-100 px-2 py-0.5 rounded text-stone-600">{e.sku}</span>}
                      {e.marca && <span className="text-xs text-stone-400">{e.marca}</span>}
                    </div>
                    <p className="text-xs text-stone-400 mt-1">{e.materiales.length} materiales · Costo mat. {fmt$(costoMat)} · Margen ×{e.margen}</p>
                    {e.notas && <p className="text-xs text-stone-400 mt-0.5">{e.notas}</p>}
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
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition">×</button>
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

      {/* Formulario */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <h3 className="text-sm font-bold text-stone-800 mb-5">{editId ? 'Editar' : 'Nuevo'} escandallo</h3>
          <form onSubmit={guardar} className="space-y-5">

            {/* Cabecera */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Nombre / producto <span className="text-red-400">*</span></label>
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Remera básica manga corta"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">SKU</label>
                <input type="text" value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())}
                  placeholder="ZATT-TOP-001"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm font-mono focus:outline-none focus:border-violet-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Marca</label>
                <select value={marca} onChange={(e) => setMarca(e.target.value)}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400">
                  <option value="">— Sin marca —</option>
                  {MARCAS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {/* Materiales */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Materiales</p>
                <button type="button" onClick={addMaterial}
                  className="text-xs px-3 py-1 border border-stone-200 rounded-lg text-stone-600 hover:border-stone-400 transition">
                  + Agregar
                </button>
              </div>
              {materiales.length === 0 && <p className="text-xs text-stone-400 italic py-2">Sin materiales agregados</p>}
              <div className="space-y-2">
                {materiales.map((m, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_80px_100px_auto] gap-2 items-center">
                    <input type="text" value={m.nombre} onChange={(e) => updMaterial(i, 'nombre', e.target.value)}
                      placeholder="Nombre del material" className="px-2.5 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
                    <input type="number" value={m.cantidad} onChange={(e) => updMaterial(i, 'cantidad', parseFloat(e.target.value) || 0)}
                      placeholder="Cant." min="0" step="0.01" className="px-2.5 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-violet-400 text-center" />
                    <select value={m.unidad} onChange={(e) => updMaterial(i, 'unidad', e.target.value)}
                      className="px-2 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-violet-400">
                      {UNIDADES.map((u) => <option key={u}>{u}</option>)}
                    </select>
                    <input type="number" value={m.costoUnitario} onChange={(e) => updMaterial(i, 'costoUnitario', parseFloat(e.target.value) || 0)}
                      placeholder="$ / unidad" min="0" step="0.01" className="px-2.5 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
                    <button type="button" onClick={() => delMaterial(i)} className="text-stone-300 hover:text-red-400 text-lg leading-none transition">×</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Mano de obra */}
            <div>
              <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide mb-2">Mano de obra</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs text-stone-400 mb-1 block">Tiempo de confección (minutos)</label>
                  <input type="number" value={tiempoMin} onChange={(e) => setTiempoMin(e.target.value)}
                    placeholder="Ej: 45"
                    className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-stone-400">Costo MO</p>
                  <p className="text-sm font-bold text-stone-800">{fmt$(costoMO)}</p>
                  {costoMinuto === 0 && <p className="text-xs text-amber-500">Configura parámetros</p>}
                </div>
              </div>
            </div>

            {/* Resumen */}
            <div className="bg-stone-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Materiales</span>
                <span className="font-semibold">{fmt$(costoMateriales)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Mano de obra</span>
                <span className="font-semibold">{fmt$(costoMO)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-stone-200 pt-2 mt-2">
                <span className="font-bold text-stone-700">Costo total</span>
                <span className="font-bold text-stone-900">{fmt$(costoTotal)}</span>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs text-stone-500">Margen ×</span>
                  <input type="number" value={margen} onChange={(e) => setMargen(e.target.value)}
                    min="1" step="0.1" className="w-16 px-2 py-1 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-violet-400 text-center" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-stone-400">Precio sugerido</p>
                  <p className="text-lg font-bold text-violet-700">{fmt$(precioSugerido)}</p>
                </div>
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Notas</label>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2}
                placeholder="Observaciones, versión, referencia..."
                className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm resize-none focus:outline-none focus:border-violet-400" />
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving || !nombre.trim()}
                className="flex-1 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition">
                {saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear escandallo'}
              </button>
              <button type="button" onClick={resetForm}
                className="px-4 py-2.5 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
