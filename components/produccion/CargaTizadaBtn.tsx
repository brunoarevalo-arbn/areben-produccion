'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CargaCorteForm, type CargaCortePrefill, type HermanaTizadas } from '@/components/produccion/cortador/CargaCorteForm';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toaster';
import { confirmAsync } from '@/components/ui/ConfirmProvider';

interface Datos {
  sku: string | null;
  descripcion: string | null;
  cantidadPlanificada: number;
  cortadorNombre: string | null;
  prefill?: CargaCortePrefill;
  hermanas: HermanaTizadas[];
  yaCargado: boolean;
  cargaInterna: boolean;
  cargadaPor: string | null;
  puedeDeshacer: boolean;
  motivo: string | null;
}

/**
 * "+ Tizada" — carga rápida de la tizada por el taller, con el MISMO formulario que ve el
 * cortador. Existe para las órdenes cuyo cortador no carga nunca (no tiene usuario, o lo
 * pasa por teléfono): al guardar, el corte queda cobrable y suma al saldo pendiente.
 *
 * Sirve igual en el detalle de la orden (que refresca con `router.refresh()`) y en la Cola
 * (que refresca con su propio `cargar()`): para eso está `onGuardado`.
 */
export function CargaTizadaBtn({ ordenId, cortadorId, corteEstado, fichaCorteCargada, onGuardado, size = 'md' }: {
  ordenId: string;
  cortadorId: string | null;
  corteEstado: string | null;
  fichaCorteCargada: boolean;
  onGuardado?: () => void;
  size?: 'sm' | 'md';
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  const cerrar = useCallback(() => { setAbierto(false); setDatos(null); }, []);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [abierto, cerrar]);

  // La orden ya tiene ficha de tela, o no tiene a quién cobrarle: no hay carga rápida.
  if (fichaCorteCargada || !cortadorId) return null;
  // El cortador ya cargó lo suyo: el camino es "Validar corte", no pisárselo.
  const cargadoPorElCortador = corteEstado === 'cargado';
  if (cargadoPorElCortador) return null;

  const abrir = async () => {
    setAbierto(true);
    setCargando(true);
    const r = await fetch(`/api/produccion/cola/${ordenId}/carga-tizada`);
    setCargando(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      toast.error(d.error || 'No se pudo abrir la carga de tizada');
      cerrar();
      return;
    }
    setDatos(await r.json());
  };

  const deshacer = async () => {
    if (!(await confirmAsync({
      title: 'Deshacer la carga de tizada',
      message: 'Se borra la tizada cargada y el corte sale del saldo pendiente del cortador.',
      confirmLabel: 'Deshacer', danger: true,
    }))) return;
    setBorrando(true);
    const r = await fetch(`/api/produccion/cola/${ordenId}/carga-tizada`, { method: 'DELETE' });
    setBorrando(false);
    if (r.ok) { toast.success('Carga deshecha — el corte salió del saldo'); cerrar(); onGuardado?.(); router.refresh(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo deshacer'); }
  };

  const yaHay = corteEstado === 'validado';
  const label = yaHay ? 'Editar tizada' : '+ Tizada';

  return (
    <>
      {size === 'sm' ? (
        <button type="button" onClick={abrir}
          className="text-xs px-2.5 py-1 border border-stone-200 rounded-lg text-stone-600 hover:border-stone-400 transition">{label}</button>
      ) : (
        <Button variant="secondary" onClick={abrir} className="px-3 py-1.5 rounded-lg text-xs">{label}</Button>
      )}

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-stone-900/40" onClick={cerrar} aria-hidden />
          <div role="dialog" aria-modal="true" aria-label="Cargar tizada por el cortador"
            className="relative w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl border border-stone-200 shadow-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-stone-800">
                  {yaHay ? 'Editar tizada' : 'Cargar tizada'}
                  {datos?.cortadorNombre && <span className="text-stone-400 font-medium"> · {datos.cortadorNombre}</span>}
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  {datos?.sku ? <span className="font-mono">{datos.sku}</span> : null}
                  {datos?.cargaInterna && datos.cargadaPor ? <span> · carga interna de {datos.cargadaPor}</span> : null}
                </p>
              </div>
              <button type="button" onClick={cerrar} aria-label="Cerrar"
                className="text-stone-400 hover:text-stone-600 text-lg leading-none px-1">×</button>
            </div>

            {cargando && <p className="text-sm text-stone-400 py-6 text-center">Cargando…</p>}

            {datos?.motivo && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">{datos.motivo}</p>
            )}

            {datos && !datos.motivo && (
              <>
                <CargaCorteForm
                  modo="interno"
                  ordenId={ordenId}
                  cantidadPlanificada={datos.cantidadPlanificada}
                  cortadorNombre={datos.cortadorNombre}
                  prefill={datos.prefill}
                  hermanas={datos.hermanas}
                  onGuardado={() => { cerrar(); onGuardado?.(); }}
                  onCancelar={cerrar}
                />
                {datos.puedeDeshacer && (
                  <button type="button" onClick={deshacer} disabled={borrando}
                    className="text-xs text-red-500 hover:text-red-700 transition disabled:opacity-50">
                    {borrando ? 'Deshaciendo…' : 'Deshacer esta carga'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
