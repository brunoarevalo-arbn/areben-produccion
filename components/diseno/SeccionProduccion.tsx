'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProyectoDiseno } from '@/types/diseno';

const ESTADO_PROD = ['listo', 'en_produccion', 'completado'] as const;
type EstadoProd = typeof ESTADO_PROD[number];

const ESTADO_PROD_LABEL: Record<EstadoProd, string> = {
  listo:          'Listo para producir',
  en_produccion:  'En producción',
  completado:     'Completado',
};

const ESTADO_PROD_BADGE: Record<EstadoProd, string> = {
  listo:         'bg-blue-100 text-blue-700',
  en_produccion: 'bg-amber-100 text-amber-700',
  completado:    'bg-emerald-100 text-emerald-700',
};

export function SeccionProduccion({ proyecto }: { proyecto: ProyectoDiseno }) {
  const router = useRouter();
  const [estadoProd, setEstadoProd] = useState<EstadoProd | ''>(
    (proyecto.estadoProduccion as EstadoProd) ?? ''
  );
  const [cantidad, setCantidad] = useState(proyecto.cantidad ?? 0);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  const ultimaIteracion  = proyecto.iteraciones[proyecto.iteraciones.length - 1];
  const ajustesPendientes = proyecto.iteraciones.flatMap((it) => it.ajustes).filter((a) => a.estado === 'pendiente').length;

  const guardar = async () => {
    setSaving(true);
    await fetch(`/api/proyectos/${proyecto.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estadoProduccion: estadoProd || null, cantidad }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  };

  const pasarAProduccion = async () => {
    setSaving(true);
    await fetch(`/api/proyectos/${proyecto.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estadoDiseno: 'produccion', estadoProduccion: 'en_produccion' }),
    });
    setSaving(false);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <p className="text-xs text-stone-400 mb-1">Última muestra</p>
          {ultimaIteracion ? (
            <div className="flex items-center gap-2">
              <span className="font-bold text-stone-800">v{ultimaIteracion.version}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                ultimaIteracion.estado === 'aprobada' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'
              }`}>
                {ultimaIteracion.estado}
              </span>
            </div>
          ) : (
            <p className="text-stone-400 text-sm italic">Sin muestras</p>
          )}
        </div>
        <div className={`rounded-2xl border p-4 ${ajustesPendientes > 0 ? 'bg-orange-50 border-orange-200' : 'bg-emerald-50 border-emerald-100'}`}>
          <p className="text-xs text-stone-400 mb-1">Ajustes pendientes</p>
          <p className={`font-bold text-lg ${ajustesPendientes > 0 ? 'text-orange-700' : 'text-emerald-700'}`}>
            {ajustesPendientes}
          </p>
        </div>
      </div>

      {/* Resumen SKUs */}
      {proyecto.skus.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">SKUs del proyecto</p>
          <div className="flex flex-wrap gap-2">
            {proyecto.skus.map((sku) => (
              <div key={sku.id} className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5">
                <span className="text-xs font-mono font-bold text-stone-700">{sku.codigo}</span>
                {sku.talle && <span className="text-xs text-stone-500">{sku.talle}</span>}
                {sku.color && <span className="text-xs text-stone-400">{sku.color}</span>}
                <span className="text-xs font-semibold text-violet-700">{sku.cantidad}u</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configuración */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400">Orden de producción</h3>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1.5">Estado</label>
          <div className="flex gap-2 flex-wrap">
            {ESTADO_PROD.map((est) => (
              <button
                key={est}
                type="button"
                onClick={() => setEstadoProd(est)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold border transition ${
                  estadoProd === est
                    ? `${ESTADO_PROD_BADGE[est]} border-transparent`
                    : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'
                }`}
              >
                {ESTADO_PROD_LABEL[est]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1.5">Cantidad a producir</label>
          <input type="number" value={cantidad} onChange={(e) => setCantidad(parseInt(e.target.value) || 0)} min="0" className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400" />
        </div>

        <div className="flex gap-3">
          <button
            onClick={guardar}
            disabled={saving}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition ${
              saved ? 'bg-emerald-600 text-white' : 'bg-stone-900 hover:bg-stone-800 text-white disabled:opacity-50'
            }`}
          >
            {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar'}
          </button>

          {proyecto.estadoDiseno !== 'produccion' && (
            <button
              onClick={pasarAProduccion}
              disabled={saving || ajustesPendientes > 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-40"
              title={ajustesPendientes > 0 ? 'Hay ajustes pendientes' : ''}
            >
              Pasar a producción →
            </button>
          )}
        </div>

        {ajustesPendientes > 0 && (
          <p className="text-xs text-orange-600 text-center">
            ⚠ {ajustesPendientes} ajuste{ajustesPendientes > 1 ? 's' : ''} pendiente{ajustesPendientes > 1 ? 's' : ''} antes de producir
          </p>
        )}
      </div>
    </div>
  );
}
