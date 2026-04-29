'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProyectoDiseno, EstadoProyecto, EstadoCiclo, UsuarioSimple } from '@/types/diseno';
import { FlujoDiseno } from './FlujoDiseno';
import { SeccionInspiracion } from './SeccionInspiracion';
import { SeccionIdeas } from './SeccionIdeas';
import { SeccionDesarrollo } from './SeccionDesarrollo';
import { SeccionMuestras } from './SeccionMuestras';
import { SeccionAjustes } from './SeccionAjustes';
import { SeccionInsumos } from './SeccionInsumos';
import { SeccionSKUs } from './SeccionSKUs';
import { SeccionProduccion } from './SeccionProduccion';

type Tab = 'inspiracion' | 'ideas' | 'desarrollo' | 'muestras' | 'ajustes' | 'insumos' | 'skus' | 'produccion';

const TABS: { id: Tab; label: string }[] = [
  { id: 'inspiracion', label: 'Inspiración' },
  { id: 'ideas',       label: 'Ideas' },
  { id: 'desarrollo',  label: 'Desarrollo' },
  { id: 'muestras',    label: 'Muestras' },
  { id: 'ajustes',     label: 'Ajustes' },
  { id: 'insumos',     label: 'Insumos' },
  { id: 'skus',        label: 'SKUs' },
  { id: 'produccion',  label: 'Producción' },
];

const DISENO_BADGE: Record<EstadoProyecto, string> = {
  inspiracion:   'bg-violet-100 text-violet-700',
  en_desarrollo: 'bg-amber-100 text-amber-700',
  muestra_lista: 'bg-blue-100 text-blue-700',
  ajustes:       'bg-orange-100 text-orange-700',
  produccion:    'bg-emerald-100 text-emerald-700',
  descontinuado: 'bg-stone-100 text-stone-500',
};

const DISENO_LABEL: Record<EstadoProyecto, string> = {
  inspiracion:   'Inspiración',
  en_desarrollo: 'En desarrollo',
  muestra_lista: 'Muestra lista',
  ajustes:       'Ajustes',
  produccion:    'Producción',
  descontinuado: 'Descontinuado',
};

const ESTADOS_DISENO: EstadoProyecto[] = [
  'inspiracion', 'en_desarrollo', 'muestra_lista', 'ajustes', 'produccion', 'descontinuado',
];

const CICLO_BADGE: Record<EstadoCiclo, string> = {
  activo:    'bg-emerald-100 text-emerald-700',
  standby:   'bg-amber-100 text-amber-700',
  archivado: 'bg-stone-100 text-stone-500',
};

const CICLO_LABEL: Record<EstadoCiclo, string> = {
  activo:    'Activo',
  standby:   'Standby',
  archivado: 'Archivado',
};

const ESTADOS_CICLO: EstadoCiclo[] = ['activo', 'standby', 'archivado'];

export function ProyectoView({ proyecto, usuarios }: { proyecto: ProyectoDiseno; usuarios: UsuarioSimple[] }) {
  const router = useRouter();

  const [activeTab,    setActiveTab]    = useState<Tab>('inspiracion');
  const [estadoDiseno, setEstadoDiseno] = useState<EstadoProyecto>(proyecto.estadoDiseno);
  const [estado,       setEstado]       = useState<EstadoCiclo>(proyecto.estado);
  const [updatingEstado, setUpdatingEstado] = useState(false);

  const patchProyecto = async (data: Record<string, unknown>) => {
    setUpdatingEstado(true);
    await fetch(`/api/proyectos/${proyecto.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    setUpdatingEstado(false);
    router.refresh();
  };

  const cambiarEstadoDiseno = (nuevoEstado: EstadoProyecto) => {
    setEstadoDiseno(nuevoEstado);
    patchProyecto({ estadoDiseno: nuevoEstado });
  };

  const cambiarEstadoCiclo = (nuevoEstado: EstadoCiclo) => {
    setEstado(nuevoEstado);
    patchProyecto({ estado: nuevoEstado });
  };

  const totalPendientes = proyecto.iteraciones.flatMap((it) => it.ajustes).filter((a) => a.estado === 'pendiente').length;

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-2xl font-bold text-stone-900 truncate">{proyecto.nombre}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${DISENO_BADGE[estadoDiseno]}`}>
              {DISENO_LABEL[estadoDiseno]}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${CICLO_BADGE[estado]}`}>
              {CICLO_LABEL[estado]}
            </span>
          </div>
          <p className="text-stone-400 text-sm">{proyecto.marca}</p>
        </div>

        <div className="flex gap-2 shrink-0">
          <select
            value={estadoDiseno}
            onChange={(e) => cambiarEstadoDiseno(e.target.value as EstadoProyecto)}
            disabled={updatingEstado}
            title="Estado del diseño"
            className="text-xs border border-stone-200 rounded-lg px-2.5 py-2 bg-white text-stone-600 focus:outline-none focus:border-violet-400 disabled:opacity-60"
          >
            {ESTADOS_DISENO.map((est) => (
              <option key={est} value={est}>{DISENO_LABEL[est]}</option>
            ))}
          </select>

          <select
            value={estado}
            onChange={(e) => cambiarEstadoCiclo(e.target.value as EstadoCiclo)}
            disabled={updatingEstado}
            title="Estado del proyecto"
            className="text-xs border border-stone-200 rounded-lg px-2.5 py-2 bg-white text-stone-600 focus:outline-none focus:border-violet-400 disabled:opacity-60"
          >
            {ESTADOS_CICLO.map((est) => (
              <option key={est} value={est}>{CICLO_LABEL[est]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Flujo de diseño */}
      <div className="mb-5">
        <FlujoDiseno estadoDiseno={estadoDiseno} />
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-stone-200 mb-5 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition -mb-px ${
              activeTab === tab.id
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {tab.label}
            {tab.id === 'ajustes' && totalPendientes > 0 && (
              <span className="ml-1.5 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {totalPendientes}
              </span>
            )}
            {tab.id === 'ideas' && proyecto.ideas.length > 0 && (
              <span className="ml-1 text-stone-300 text-[10px]">{proyecto.ideas.length}</span>
            )}
            {tab.id === 'insumos' && proyecto.insumos.length > 0 && (
              <span className="ml-1 text-stone-300 text-[10px]">{proyecto.insumos.length}</span>
            )}
            {tab.id === 'skus' && proyecto.skus.length > 0 && (
              <span className="ml-1 text-stone-300 text-[10px]">{proyecto.skus.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'inspiracion' && <SeccionInspiracion proyecto={proyecto} />}
      {activeTab === 'ideas'       && <SeccionIdeas       proyecto={proyecto} />}
      {activeTab === 'desarrollo'  && <SeccionDesarrollo  proyecto={proyecto} usuarios={usuarios} />}
      {activeTab === 'muestras'    && <SeccionMuestras    proyecto={proyecto} />}
      {activeTab === 'ajustes'     && <SeccionAjustes     proyecto={proyecto} />}
      {activeTab === 'insumos'     && <SeccionInsumos     proyecto={proyecto} />}
      {activeTab === 'skus'        && <SeccionSKUs        proyecto={proyecto} />}
      {activeTab === 'produccion'  && <SeccionProduccion  proyecto={proyecto} />}
    </div>
  );
}
