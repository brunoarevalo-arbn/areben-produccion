'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProyectoDiseno, AjusteMuestra, EstadoAjuste, TipoIteracion } from '@/types/diseno';

const BADGE: Record<EstadoAjuste, string> = {
  pendiente: 'bg-orange-100 text-orange-700',
  realizado: 'bg-emerald-100 text-emerald-700',
  aprobado:  'bg-violet-100 text-violet-700',
};

const TIPO_LABEL: Record<TipoIteracion, string> = {
  muestra:       'M',
  contramuestra: 'CM',
};

type Filtro = 'todos' | 'pendientes' | 'realizados';

interface AjusteExtendido extends AjusteMuestra {
  version: number;
  tipo: TipoIteracion;
}

export function SeccionAjustes({ proyecto }: { proyecto: ProyectoDiseno }) {
  const router = useRouter();
  const [filtro,    setFiltro]    = useState<Filtro>('todos');
  const [newAjuste, setNewAjuste] = useState('');
  const [iterSeleccionada, setIterSeleccionada] = useState(
    proyecto.iteraciones[proyecto.iteraciones.length - 1]?.id ?? ''
  );

  const todosAjustes: AjusteExtendido[] = proyecto.iteraciones.flatMap((it) =>
    it.ajustes.map((aj) => ({
      ...aj,
      version: it.version,
      tipo:    it.tipo as TipoIteracion,
    }))
  );

  const ajustesFiltrados = todosAjustes.filter((aj) => {
    if (filtro === 'pendientes') return aj.estado === 'pendiente';
    if (filtro === 'realizados') return aj.estado !== 'pendiente';
    return true;
  });

  const pendientes = todosAjustes.filter((a) => a.estado === 'pendiente').length;
  const realizados = todosAjustes.filter((a) => a.estado !== 'pendiente').length;

  const toggleAjuste = async (ajuste: AjusteExtendido) => {
    const nuevoEstado = ajuste.estado === 'pendiente' ? 'realizado' : 'pendiente';
    await fetch(`/api/ajustes/${ajuste.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: nuevoEstado }),
    });
    router.refresh();
  };

  const agregarAjuste = async () => {
    if (!newAjuste.trim() || !iterSeleccionada) return;
    await fetch(`/api/proyectos/${proyecto.id}/ajustes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iteracionId: iterSeleccionada, descripcion: newAjuste.trim() }),
    });
    setNewAjuste('');
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-stone-200 p-4 text-center">
          <p className="text-2xl font-bold text-stone-800">{todosAjustes.length}</p>
          <p className="text-xs text-stone-400 mt-0.5">Total</p>
        </div>
        <div className="bg-orange-50 rounded-xl border border-orange-100 p-4 text-center">
          <p className="text-2xl font-bold text-orange-700">{pendientes}</p>
          <p className="text-xs text-orange-500 mt-0.5">Pendientes</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-700">{realizados}</p>
          <p className="text-xs text-emerald-500 mt-0.5">Realizados</p>
        </div>
      </div>

      {/* Agregar ajuste */}
      {proyecto.iteraciones.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Agregar ajuste</p>
          <div className="flex gap-2">
            <select
              value={iterSeleccionada}
              onChange={(e) => setIterSeleccionada(e.target.value)}
              className="border border-stone-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:border-violet-400"
            >
              {proyecto.iteraciones.map((it) => (
                <option key={it.id} value={it.id}>{TIPO_LABEL[it.tipo as TipoIteracion]} v{it.version}</option>
              ))}
            </select>
            <input
              type="text"
              value={newAjuste}
              onChange={(e) => setNewAjuste(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarAjuste(); } }}
              placeholder="Describir el ajuste necesario..."
              className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-400"
            />
            <button onClick={agregarAjuste} disabled={!newAjuste.trim()} className="bg-stone-900 text-white text-xs px-4 py-2 rounded-lg disabled:opacity-40">
              Agregar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="flex border-b border-stone-100">
          {(['todos', 'pendientes', 'realizados'] as Filtro[]).map((f) => (
            <button key={f} onClick={() => setFiltro(f)} className={`flex-1 py-2.5 text-xs font-semibold capitalize transition ${filtro === f ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-50'}`}>
              {f}
            </button>
          ))}
        </div>

        <div className="divide-y divide-stone-50">
          {ajustesFiltrados.length === 0 && (
            <p className="text-sm text-stone-400 text-center py-8 italic">Sin ajustes en esta categoría</p>
          )}
          {ajustesFiltrados.map((aj) => (
            <div key={aj.id} className="flex items-center gap-3 px-5 py-3">
              <button
                onClick={() => toggleAjuste(aj)}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${aj.estado !== 'pendiente' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-300 hover:border-violet-400'}`}
              >
                {aj.estado !== 'pendiente' && <span className="text-[10px]">✓</span>}
              </button>
              <span className={`flex-1 text-sm ${aj.estado !== 'pendiente' ? 'line-through text-stone-400' : 'text-stone-700'}`}>
                {aj.descripcion}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE[aj.estado as EstadoAjuste]}`}>
                {TIPO_LABEL[aj.tipo]} v{aj.version}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
