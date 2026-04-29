'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ProyectoCard } from './ProyectoCard';
import { MARCAS_DISENO } from '@/lib/constants/diseno';

type Tab = 'activos' | 'archivados';
type EstadoCiclo = 'activo' | 'standby';

interface Paso { numeroPaso: number; nombrePaso: string; estado: string }
interface Proyecto {
  id: string;
  nombre: string;
  marca: string;
  estado: string;
  inspiracion?: string | null;
  pasos: Paso[];
  createdAt: Date | string;
}

const CICLO_FILTROS: { id: EstadoCiclo | 'Todos'; label: string }[] = [
  { id: 'Todos',   label: 'Todos' },
  { id: 'activo',  label: 'Activos' },
  { id: 'standby', label: 'Standby' },
];

export function ProyectosLista({ proyectos }: { proyectos: Proyecto[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const activos    = proyectos.filter((p) => p.estado !== 'archivado');
  const archivados = proyectos.filter((p) => p.estado === 'archivado');

  const [tab,           setTab]           = useState<Tab>('activos');
  const [filtroMarca,   setFiltroMarca]   = useState<string>('Todas');
  const [filtroEstado,  setFiltroEstado]  = useState<EstadoCiclo | 'Todos'>('Todos');
  const [seleccionando, setSeleccionando] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [cambiandoMarca, setCambiandoMarca] = useState(false);
  const [busy,          setBusy]          = useState(false);

  const listaActual = tab === 'archivados' ? archivados : activos.filter((p) => {
    const marcaOk  = filtroMarca  === 'Todas' || p.marca  === filtroMarca;
    const estadoOk = filtroEstado === 'Todos' || p.estado === filtroEstado;
    return marcaOk && estadoOk;
  });

  const toggleSeleccion = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const seleccionarTodos = () => {
    if (seleccionados.size === listaActual.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(listaActual.map((p) => p.id)));
    }
  };

  const cancelarSeleccion = () => {
    setSeleccionando(false);
    setSeleccionados(new Set());
    setCambiandoMarca(false);
  };

  const bulkUpdate = async (data: Record<string, string>) => {
    if (seleccionados.size === 0) return;
    setBusy(true);
    await fetch('/api/proyectos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(seleccionados), data }),
    });
    setBusy(false);
    cancelarSeleccion();
    startTransition(() => router.refresh());
  };

  const bulkDelete = async () => {
    if (seleccionados.size === 0) return;
    const n = seleccionados.size;
    if (!confirm(`¿Eliminar ${n} proyecto${n !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`)) return;
    setBusy(true);
    await fetch('/api/proyectos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(seleccionados) }),
    });
    setBusy(false);
    cancelarSeleccion();
    startTransition(() => router.refresh());
  };

  const todosTienenMarcaArchivado = tab === 'archivados';

  return (
    <div>
      {/* Tabs: Activos / Archivados */}
      <div className="flex items-center gap-1 mb-6 border-b border-stone-200">
        <button
          onClick={() => { setTab('activos'); cancelarSeleccion(); }}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            tab === 'activos'
              ? 'border-stone-900 text-stone-900'
              : 'border-transparent text-stone-400 hover:text-stone-600'
          }`}
        >
          Proyectos
          <span className="ml-1.5 text-xs bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full font-normal">
            {activos.length}
          </span>
        </button>
        <button
          onClick={() => { setTab('archivados'); cancelarSeleccion(); }}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            tab === 'archivados'
              ? 'border-stone-900 text-stone-900'
              : 'border-transparent text-stone-400 hover:text-stone-600'
          }`}
        >
          Archivados
          {archivados.length > 0 && (
            <span className="ml-1.5 text-xs bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full font-normal">
              {archivados.length}
            </span>
          )}
        </button>
      </div>

      {/* Filters + Select toggle */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {tab === 'activos' && (
          <>
            <div className="flex gap-2">
              {(['Todas', ...MARCAS_DISENO] as string[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setFiltroMarca(m)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${
                    filtroMarca === m
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {CICLO_FILTROS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setFiltroEstado(id)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                    filtroEstado === id
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {listaActual.length > 0 && (
          <div className="ml-auto">
            {!seleccionando ? (
              <button
                onClick={() => setSeleccionando(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-stone-200 text-stone-500 hover:border-stone-400 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
                Seleccionar
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={seleccionarTodos}
                  className="text-xs text-stone-500 hover:text-stone-700 underline"
                >
                  {seleccionados.size === listaActual.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
                <span className="text-xs text-stone-400">
                  {seleccionados.size > 0 ? `${seleccionados.size} seleccionado${seleccionados.size !== 1 ? 's' : ''}` : ''}
                </span>
                <button
                  onClick={cancelarSeleccion}
                  className="text-xs text-stone-400 hover:text-stone-600"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'activos' && (filtroMarca !== 'Todas' || filtroEstado !== 'Todos') && !seleccionando && (
          <span className="text-xs text-stone-400 self-center">
            {listaActual.length} resultado{listaActual.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Grid */}
      {listaActual.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-200 py-16 text-center">
          <p className="text-stone-400 text-sm">
            {tab === 'archivados' ? 'No hay proyectos archivados todavía.' : 'Sin proyectos para los filtros seleccionados.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {listaActual.map((p) => (
            <ProyectoCard
              key={p.id}
              proyecto={p}
              seleccionable={seleccionando}
              seleccionado={seleccionados.has(p.id)}
              onToggle={toggleSeleccion}
            />
          ))}
        </div>
      )}

      {/* Bulk action bar */}
      {seleccionando && seleccionados.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-stone-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-3 min-w-max">
            <span className="text-sm font-semibold text-stone-300">
              {seleccionados.size} proyecto{seleccionados.size !== 1 ? 's' : ''}
            </span>

            <div className="w-px h-5 bg-stone-700" />

            {/* Cambiar marca */}
            {!todosTienenMarcaArchivado && (
              <div className="relative">
                {cambiandoMarca ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-400">Mover a:</span>
                    {MARCAS_DISENO.map((m) => (
                      <button
                        key={m}
                        disabled={busy}
                        onClick={() => { setCambiandoMarca(false); bulkUpdate({ marca: m }); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-stone-700 hover:bg-stone-600 transition disabled:opacity-50"
                      >
                        {m}
                      </button>
                    ))}
                    <button onClick={() => setCambiandoMarca(false)} className="text-stone-500 hover:text-stone-300 text-xs">✕</button>
                  </div>
                ) : (
                  <button
                    disabled={busy}
                    onClick={() => setCambiandoMarca(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-800 hover:bg-stone-700 transition disabled:opacity-50"
                  >
                    Cambiar marca
                  </button>
                )}
              </div>
            )}

            {/* Archivar / Restaurar */}
            {tab === 'activos' ? (
              <button
                disabled={busy}
                onClick={() => bulkUpdate({ estado: 'archivado' })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-800 hover:bg-stone-700 transition disabled:opacity-50"
              >
                Archivar
              </button>
            ) : (
              <button
                disabled={busy}
                onClick={() => bulkUpdate({ estado: 'activo' })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-800 hover:bg-stone-700 transition disabled:opacity-50"
              >
                Restaurar
              </button>
            )}

            {/* Eliminar */}
            <button
              disabled={busy}
              onClick={bulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 transition disabled:opacity-50"
            >
              Eliminar
            </button>

            {busy && (
              <span className="text-xs text-stone-400 animate-pulse">Guardando...</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
