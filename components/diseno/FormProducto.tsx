'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProductoInput } from '@/types/diseno';
import { calcularPrecioVenta, MARGEN_DEFAULT } from '@/lib/utils/calculos';

const MARCAS     = ['Zattia', 'Stunned', 'BDI'];
const TELAS      = ['Algodón', 'Poliéster', 'Lino', 'Seda', 'Denim', 'Lycra', 'Modal', 'Otro'];
const MOLDERIAS  = ['Base recta', 'Base entallada', 'Base evasé', 'Moldería propia', 'Otro'];
const TEMPORADAS = ['Verano 2025', 'Invierno 2025', 'Verano 2026', 'Invierno 2026'];

interface FormProductoProps {
  inicial?: Partial<ProductoInput>;
  productoId?: string;
}

export function FormProducto({ inicial, productoId }: FormProductoProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const [form, setForm] = useState<ProductoInput>({
    nombre:      inicial?.nombre      ?? '',
    descripcion: inicial?.descripcion ?? '',
    molderia:    inicial?.molderia    ?? '',
    tela:        inicial?.tela        ?? '',
    colores:     inicial?.colores     ?? '',
    costoTela:   inicial?.costoTela   ?? 0,
    costoMO:     inicial?.costoMO     ?? 0,
    costoTotal:  inicial?.costoTotal  ?? 0,
    estado:      inicial?.estado      ?? 'borrador',
    marca:       inicial?.marca       ?? '',
    temporada:   inicial?.temporada   ?? '',
  });

  const costoTotal   = (form.costoTela ?? 0) + (form.costoMO ?? 0);
  const precioVenta  = calcularPrecioVenta(costoTotal);

  const set = (field: keyof ProductoInput, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url    = productoId ? `/api/productos/${productoId}` : '/api/productos';
      const method = productoId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, costoTotal }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Error al guardar');
      }

      const producto = await res.json();
      router.push(`/diseno/${producto.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Sección: Identificación */}
      <section className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
        <h2 className="text-sm font-bold text-stone-500 uppercase tracking-widest">Identificación</h2>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1">Nombre del producto *</label>
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => set('nombre', e.target.value)}
            required
            placeholder="ej: Remera básica manga larga"
            className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Marca</label>
            <select
              value={form.marca ?? ''}
              onChange={(e) => set('marca', e.target.value)}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:border-violet-400"
            >
              <option value="">— Sin marca —</option>
              {MARCAS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Temporada</label>
            <select
              value={form.temporada ?? ''}
              onChange={(e) => set('temporada', e.target.value)}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:border-violet-400"
            >
              <option value="">— Sin temporada —</option>
              {TEMPORADAS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1">Estado</label>
          <div className="flex gap-2">
            {(['borrador', 'activo', 'archivado'] as const).map((est) => (
              <button
                key={est}
                type="button"
                onClick={() => set('estado', est)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold border transition capitalize ${
                  form.estado === est
                    ? 'bg-violet-600 border-violet-600 text-white'
                    : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'
                }`}
              >
                {est}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1">Descripción</label>
          <textarea
            value={form.descripcion ?? ''}
            onChange={(e) => set('descripcion', e.target.value)}
            rows={2}
            placeholder="Descripción del diseño..."
            className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm resize-none focus:outline-none focus:border-violet-400"
          />
        </div>
      </section>

      {/* Sección: Ficha técnica */}
      <section className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
        <h2 className="text-sm font-bold text-stone-500 uppercase tracking-widest">Ficha técnica</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Moldería</label>
            <select
              value={form.molderia ?? ''}
              onChange={(e) => set('molderia', e.target.value)}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:border-violet-400"
            >
              <option value="">— Seleccionar —</option>
              {MOLDERIAS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Tela</label>
            <select
              value={form.tela ?? ''}
              onChange={(e) => set('tela', e.target.value)}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:border-violet-400"
            >
              <option value="">— Seleccionar —</option>
              {TELAS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1">Colores</label>
          <input
            type="text"
            value={form.colores ?? ''}
            onChange={(e) => set('colores', e.target.value)}
            placeholder="ej: Negro, Blanco, Verde oliva"
            className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400"
          />
        </div>
      </section>

      {/* Sección: Costos */}
      <section className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
        <h2 className="text-sm font-bold text-stone-500 uppercase tracking-widest">Costos</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Costo tela ($)</label>
            <input
              type="number"
              value={form.costoTela}
              onChange={(e) => set('costoTela', parseFloat(e.target.value) || 0)}
              min="0"
              step="0.01"
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Costo mano de obra ($)</label>
            <input
              type="number"
              value={form.costoMO}
              onChange={(e) => set('costoMO', parseFloat(e.target.value) || 0)}
              min="0"
              step="0.01"
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400"
            />
          </div>
        </div>

        <div className="bg-stone-50 rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-500">Costo total</span>
            <span className="font-semibold text-stone-700">${costoTotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-stone-200 pt-2">
            <div>
              <span className="text-sm font-bold text-stone-800">Precio venta sugerido</span>
              <span className="text-xs text-stone-400 ml-2">(×{MARGEN_DEFAULT})</span>
            </div>
            <span className="text-xl font-bold text-violet-700">${precioVenta.toFixed(0)}</span>
          </div>
        </div>
      </section>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-all active:scale-95"
      >
        {loading ? 'Guardando...' : productoId ? 'Guardar cambios' : 'Crear producto'}
      </button>
    </form>
  );
}
