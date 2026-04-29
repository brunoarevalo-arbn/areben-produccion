'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MARCAS_DISENO } from '@/lib/constants/diseno';

interface Props {
  proyecto: {
    id: string;
    nombre: string;
    marca: string;
    inspiracion?: string | null;
  };
}

export function AccionesProyecto({ proyecto }: Props) {
  const router = useRouter();
  const [modo,     setModo]     = useState<'idle' | 'editar' | 'eliminar'>('idle');
  const [form,     setForm]     = useState({
    nombre:      proyecto.nombre,
    marca:       proyecto.marca,
    inspiracion: proyecto.inspiracion ?? '',
  });
  const [saving,   setSaving]   = useState(false);

  const guardar = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    await fetch(`/api/proyectos/${proyecto.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setModo('idle');
    router.refresh();
  };

  const eliminar = async () => {
    setSaving(true);
    await fetch(`/api/proyectos/${proyecto.id}`, { method: 'DELETE' });
    router.push('/diseno');
  };

  if (modo === 'editar') {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-5 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400">Editar proyecto</h2>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1.5">Nombre</label>
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
            className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1.5">Marca</label>
          <div className="flex gap-2">
            {MARCAS_DISENO.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setForm((p) => ({ ...p, marca: m }))}
                className={`flex-1 py-2 rounded-xl text-sm font-bold border transition ${
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

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1.5">Inspiración</label>
          <textarea
            value={form.inspiracion}
            onChange={(e) => setForm((p) => ({ ...p, inspiracion: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm resize-none focus:outline-none focus:border-violet-400"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={guardar}
            disabled={saving || !form.nombre.trim()}
            className="flex-1 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-xl transition"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <button
            onClick={() => { setModo('idle'); setForm({ nombre: proyecto.nombre, marca: proyecto.marca, inspiracion: proyecto.inspiracion ?? '' }); }}
            className="px-5 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-500 hover:border-stone-400 transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (modo === 'eliminar') {
    return (
      <div className="bg-red-50 rounded-2xl border border-red-200 p-5 mb-5">
        <p className="text-sm font-semibold text-red-800 mb-1">¿Eliminar este proyecto?</p>
        <p className="text-xs text-red-600 mb-4">Se borran el proyecto y todos sus pasos. Esta acción no se puede deshacer.</p>
        <div className="flex gap-2">
          <button
            onClick={eliminar}
            disabled={saving}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-5 py-2 rounded-xl transition disabled:opacity-50"
          >
            {saving ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
          <button
            onClick={() => setModo('idle')}
            className="px-5 py-2 rounded-xl border border-stone-200 text-sm text-stone-500 hover:border-stone-400 transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => setModo('editar')}
        className="text-xs border border-stone-200 hover:border-stone-400 text-stone-600 hover:text-stone-900 px-3 py-1.5 rounded-lg transition font-medium"
      >
        Editar
      </button>
      <button
        onClick={() => setModo('eliminar')}
        className="text-xs border border-red-200 hover:border-red-400 text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg transition font-medium"
      >
        Eliminar
      </button>
    </div>
  );
}
