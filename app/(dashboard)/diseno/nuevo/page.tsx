'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MARCAS_DISENO } from '@/lib/constants/diseno';

export default function NuevoProyectoPage() {
  const router = useRouter();
  const [form, setForm] = useState({ nombre: '', marca: 'Zattia' as string, inspiracion: '' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/proyectos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(Array.isArray(data.error) ? 'Error de validación' : data.error);
      }

      const proyecto = await res.json();
      router.push(`/diseno/${proyecto.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/diseno" className="text-sm text-stone-400 hover:text-stone-600 transition">
          ← Volver a proyectos
        </Link>
        <h1 className="text-2xl font-bold text-stone-900 mt-3">Nuevo proyecto</h1>
        <p className="text-stone-500 text-sm mt-1">Se crean automáticamente los 18 pasos del flujo de diseño.</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">{error}</div>
        )}

        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5">
              Nombre del proyecto *
            </label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
              required
              placeholder='ej: Bikini Tropical'
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400"
              autoFocus
            />
          </div>

          {/* Marca */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5">Marca *</label>
            <div className="flex gap-2">
              {MARCAS_DISENO.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, marca: m }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition ${
                    form.marca === m
                      ? m === 'Zattia'
                        ? 'bg-violet-600 border-violet-600 text-white'
                        : 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Inspiración */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5">
              Inspiración <span className="text-stone-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={form.inspiracion}
              onChange={(e) => setForm((p) => ({ ...p, inspiracion: e.target.value }))}
              rows={4}
              placeholder="Referencias, links, idea general del diseño, temporada..."
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm resize-none focus:outline-none focus:border-violet-400"
            />
          </div>
        </div>

        {/* Preview de pasos */}
        <div className="bg-stone-50 rounded-xl border border-stone-200 px-4 py-3">
          <p className="text-xs text-stone-500 font-medium mb-1">Se crearán 18 pasos automáticamente:</p>
          <p className="text-xs text-stone-400 leading-relaxed">
            Materia prima → Moldería → Cortar muestra → Confección → Prueba de calce → Arreglo moldería → Lavado → Medidas pre-lavado → Medidas post-lavado → Análisis encogimiento → Arreglo moldería final → Planificación producción → Pedido tela → Ficha de corte → Corte → Armado SKU → Ficha de producción → Confección final
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || !form.nombre.trim()}
          className="w-full bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest transition"
        >
          {loading ? 'Creando proyecto...' : 'Crear proyecto →'}
        </button>
      </form>
    </div>
  );
}
