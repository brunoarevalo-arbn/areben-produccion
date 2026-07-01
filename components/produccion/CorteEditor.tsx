'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RegistrarCorteForm, type CortePrefill, type FichaData } from './RegistrarCorteForm';
import { CorteEditRapido } from './CorteEditRapido';
import { CorteRevertir } from './CorteRevertir';

const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

interface Resumen {
  cantidad: number;
  kgTotal: number;
  metrosTotal: number;
  metrosPorU: number;
  kgPorU: number;
  cortador: string | null;
  fechaCorte: string | null; // YYYY-MM-DD
  talles: { talle: string; cantidad: number }[];
}

const fmtFecha = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

// Ficha ya cargada: muestra una vista IDÉNTICA a lo que se cargó (solo lectura) y permite
// editarla en el lugar. "Editar" abre el mismo formulario pre-cargado; al Guardar, el
// backend repone y re-registra en una sola transacción (impacto neto = la diferencia).
// Nada se toca hasta guardar.
export function CorteEditor({ ordenId, sku, cantidadPlanificada, marca, resumen, fichaData, prefill }: {
  ordenId: string; sku: string; cantidadPlanificada: number; marca: string | null;
  resumen: Resumen; fichaData: FichaData | null; prefill: CortePrefill;
}) {
  const [modo, setModo] = useState<'ver' | 'rapido' | 'completo'>('ver');

  if (modo === 'completo') {
    return (
      <div className="space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800">
          Editando la <strong>tela</strong> de la ficha. Ajustá y <strong>Guardá</strong> — recién ahí se aplican los cambios a los rollos.
          <button onClick={() => setModo('ver')} className="underline font-semibold ml-2">Cancelar</button>
        </div>
        <RegistrarCorteForm ordenId={ordenId} sku={sku} cantidadPlanificada={cantidadPlanificada} marca={marca} prefill={prefill} />
      </div>
    );
  }

  if (modo === 'rapido') {
    return (
      <CorteEditRapido
        ordenId={ordenId}
        marca={marca}
        onCancel={() => setModo('ver')}
        inicial={{
          cortadorId: fichaData?.cortadorId ?? prefill.cortadorId ?? null,
          costoCorte: fichaData?.costoCorte ?? prefill.costoCorte ?? 0,
          modoCosto: fichaData?.modoCosto ?? 'total',
          talles: resumen.talles,
          avios: (fichaData?.avios ?? prefill.avios ?? []).map((a) => ({ etiquetaId: a.etiquetaId, cantidad: a.cantidad })),
          fechaCorte: fichaData?.fechaCorte ?? resumen.fechaCorte,
        }}
      />
    );
  }

  return (
    <>
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-6 space-y-4">
        <h3 className="text-sm font-bold text-emerald-800">Corte registrado</h3>

        {/* Resumen de consumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><p className="text-xs text-emerald-600 uppercase tracking-widest font-bold">Cortadas</p><p className="font-bold text-stone-800 tabular-nums">{resumen.cantidad} u</p></div>
          {resumen.fechaCorte && <div><p className="text-xs text-emerald-600 uppercase tracking-widest font-bold">Fecha corte</p><p className="font-semibold text-stone-800 tabular-nums">{fmtFecha(resumen.fechaCorte)}</p></div>}
          <div><p className="text-xs text-emerald-600 uppercase tracking-widest font-bold">Total kg</p><p className="font-bold text-stone-800 tabular-nums">{resumen.kgTotal > 0 ? `${fmt(resumen.kgTotal)} kg` : '--'}</p></div>
          <div><p className="text-xs text-emerald-600 uppercase tracking-widest font-bold">Metros/u</p><p className="font-semibold text-stone-800 tabular-nums">{resumen.metrosPorU > 0 ? `${fmt(resumen.metrosPorU)} m` : '--'}</p></div>
          <div><p className="text-xs text-emerald-600 uppercase tracking-widest font-bold">Kg/u</p><p className="text-stone-800 tabular-nums">{resumen.kgPorU > 0 ? `${fmt(resumen.kgPorU)} kg` : '--'}</p></div>
        </div>

        {/* Talles */}
        <div>
          <p className="text-xs text-emerald-700 uppercase tracking-widest font-bold mb-2">Talles cortados</p>
          <div className="flex flex-wrap gap-2">
            {resumen.talles.map((c) => (
              <div key={c.talle} className="bg-white rounded-lg px-3 py-1.5 text-sm border border-emerald-200"><span className="text-emerald-600">{c.talle}:</span> <strong>{c.cantidad}</strong></div>
            ))}
          </div>
        </div>

        {/* Detalle idéntico a lo cargado (tizadas + rollos + metros) */}
        {fichaData?.tizadas?.length ? (
          <div>
            <p className="text-xs text-emerald-700 uppercase tracking-widest font-bold mb-2">Tela por tizada</p>
            <div className="space-y-2">
              {fichaData.tizadas.map((t, i) => (
                <div key={t.id ?? i} className="bg-white rounded-lg border border-emerald-200 p-3 text-sm">
                  <p className="font-semibold text-stone-700 mb-1">{t.nombre?.trim() || `Tizada ${i + 1}`}{t.modo === 'tizada' && t.metros ? <span className="text-stone-400 font-normal"> · {t.metros}m / {t.unidades}u</span> : null}</p>
                  {t.rollos.length === 0 ? <p className="text-xs text-stone-400">Sin rollos</p> : (
                    <div className="space-y-0.5">
                      {t.rollos.map((r) => (
                        <div key={r.rolloId} className="flex justify-between text-stone-600">
                          <span className="font-mono text-xs">{r.codigo} · {r.nombre}</span>
                          {r.metros ? <span className="tabular-nums">{r.metros} m</span> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Avíos */}
        {fichaData?.avios?.length ? (
          <div>
            <p className="text-xs text-emerald-700 uppercase tracking-widest font-bold mb-2">Avíos</p>
            <div className="flex flex-wrap gap-2">
              {fichaData.avios.map((a) => (
                <div key={a.etiquetaId} className="bg-white rounded-lg px-3 py-1.5 text-sm border border-emerald-200">{a.nombre || a.etiquetaId} <span className="text-stone-400">×{a.cantidad}</span></div>
              ))}
            </div>
          </div>
        ) : null}

        {(resumen.cortador || fichaData?.costoCorte) && (
          <div className="flex gap-6 text-sm pt-2 border-t border-emerald-200">
            {resumen.cortador && <div><span className="text-emerald-600">Cortador:</span> <strong className="text-stone-800">{resumen.cortador}</strong></div>}
            {fichaData?.costoCorte ? <div><span className="text-emerald-600">Costo corte:</span> <strong className="text-stone-800">${fmt(Number(fichaData.costoCorte))}{fichaData.modoCosto === 'unidad' ? ' /u' : ''}</strong></div> : null}
          </div>
        )}

        {!fichaData && <p className="text-xs text-stone-400">Esta ficha se cargó antes de guardar el detalle editable; al editarla se reconstruye lo mejor posible.</p>}
      </div>

      <div className="flex gap-3 flex-wrap">
        <button onClick={() => setModo('rapido')}
          className="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
          ✎ Editar datos
        </button>
        <button onClick={() => setModo('completo')}
          className="px-4 py-2.5 rounded-xl text-sm border border-stone-300 text-stone-700 hover:border-stone-400 transition font-semibold">
          Editar ficha (tela)
        </button>
        <CorteRevertir ordenId={ordenId} />
        <Link href={`/produccion/${ordenId}`} className="px-4 py-2.5 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition">
          Volver al detalle
        </Link>
      </div>
    </>
  );
}
