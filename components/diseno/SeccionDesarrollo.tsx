'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ProyectoDiseno, UsuarioSimple } from '@/types/diseno';
import { TimelinePasos } from './TimelinePasos';

interface CatalogoItem { id: string; nombre: string; }

function parseTelas(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [val];
  } catch {
    return [val];
  }
}

export function SeccionDesarrollo({ proyecto, usuarios }: { proyecto: ProyectoDiseno; usuarios: UsuarioSimple[] }) {
  const router  = useRouter();
  const [form,   setForm]   = useState({
    molderia:        proyecto.molderia        ?? '',
    molderiaFormato: proyecto.molderiaFormato ?? '',
    fechaObjetivo:   proyecto.fechaObjetivo
      ? proyecto.fechaObjetivo.slice(0, 10)
      : '',
  });
  const [selectedTelas, setSelectedTelas] = useState<string[]>(() => parseTelas(proyecto.tela));
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [molderias, setMolderias] = useState<CatalogoItem[]>([]);
  const [telas,     setTelas]     = useState<CatalogoItem[]>([]);

  useEffect(() => {
    fetch('/api/molderias').then((r) => r.ok ? r.json() : []).then(setMolderias).catch(() => {});
    fetch('/api/telas-catalogo').then((r) => r.ok ? r.json() : []).then(setTelas).catch(() => {});
  }, []);

  const toggleTela = (nombre: string) => {
    setSelectedTelas((prev) =>
      prev.includes(nombre) ? prev.filter((t) => t !== nombre) : [...prev, nombre]
    );
  };

  const guardar = async () => {
    setSaving(true);
    await fetch(`/api/proyectos/${proyecto.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        tela: selectedTelas.length > 0 ? JSON.stringify(selectedTelas) : null,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Ficha técnica */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400">Ficha técnica & Costos</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5">Moldería</label>
            <select value={form.molderia} onChange={(e) => setForm((p) => ({ ...p, molderia: e.target.value }))} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:border-violet-400">
              <option value="">— Seleccionar —</option>
              {molderias.map((m) => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5">Formato de moldería</label>
            <div className="flex gap-2 h-[42px] items-center">
              {(['fisica', 'digital'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, molderiaFormato: p.molderiaFormato === f ? '' : f }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                    form.molderiaFormato === f
                      ? f === 'fisica' ? 'bg-amber-100 text-amber-700 border-transparent' : 'bg-violet-100 text-violet-700 border-transparent'
                      : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'
                  }`}
                >
                  {f === 'fisica' ? 'Física' : 'Digital'}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-stone-600 mb-1.5">
              Telas
              {selectedTelas.length > 0 && (
                <span className="ml-2 font-normal text-stone-400">{selectedTelas.length} seleccionada{selectedTelas.length > 1 ? 's' : ''}</span>
              )}
            </label>
            {telas.length === 0 ? (
              <p className="text-xs text-stone-400 italic">Sin telas en el catálogo. Agregá desde Configuración → Telas.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {telas.map((t) => {
                  const activa = selectedTelas.includes(t.nombre);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTela(t.nombre)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                        activa
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-stone-600 border-stone-200 hover:border-violet-400 hover:text-violet-700'
                      }`}
                    >
                      {t.nombre}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5">Fecha objetivo</label>
            <input
              type="date"
              value={form.fechaObjetivo}
              onChange={(e) => setForm((p) => ({ ...p, fechaObjetivo: e.target.value }))}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:border-violet-400"
            />
          </div>
        </div>

        <button
          onClick={guardar}
          disabled={saving}
          className={`w-full py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition ${saved ? 'bg-emerald-600 text-white' : 'bg-stone-900 hover:bg-stone-800 text-white disabled:opacity-50'}`}
        >
          {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}
        </button>
      </div>

      {/* Timeline de los 18 pasos */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Checklist de desarrollo (18 pasos)</p>
        <TimelinePasos proyectoId={proyecto.id} pasos={proyecto.pasos} usuarios={usuarios} />
      </div>
    </div>
  );
}
