'use client';

import { useState, useEffect, useCallback } from 'react';
import { TiemposProduccion } from '@/types/tiempos';
import type { EstadoCronometro } from '@/lib/hooks/useTiempos';
import { INCONVENIENTES } from '@/lib/constants/inconvenientes';

interface FormTiemposProps {
  usuario: string;
  ordenesIniciales: OrdenActiva[];
  estado: EstadoCronometro;
  onObtenerTiempos: () => { horaInicio: string; horaFin: string; minutosNetos: number } | undefined;
  onGuardar: (tiempo: TiemposProduccion) => Promise<unknown>;
  onRefresh: () => void;
  loading: boolean;
}

interface OrdenActiva {
  id:          string;
  sku:         string;
  descripcion: string | null;
  marca:       string;
  cantidad:    number;
  estado:      string;
}

const ACTIVIDADES: { label: string; icon: string; color: string }[] = [
  { label: 'Proceso Completado', icon: '✅', color: 'bg-emerald-50 border-emerald-400 text-emerald-800' },
  { label: 'Muestra Zattia',     icon: '📐', color: 'bg-violet-50 border-violet-400 text-violet-800' },
  { label: 'Muestra Stunned',    icon: '📐', color: 'bg-pink-50 border-pink-400 text-pink-800' },
  { label: 'Descanso',           icon: '☕', color: 'bg-sky-50 border-sky-400 text-sky-800' },
  { label: 'Almuerzo',           icon: '🍽️', color: 'bg-orange-50 border-orange-400 text-orange-800' },
  { label: 'Falla Máquina',      icon: '⚠️', color: 'bg-red-50 border-red-400 text-red-800' },
  { label: 'Cambio Hilo',        icon: '🧵', color: 'bg-yellow-50 border-yellow-400 text-yellow-800' },
];

const MAQUINAS = ['Recta', 'Collareta', 'Remalladora', 'Cadeneta', 'Cortacollareta'];
const LIBRE_ID = '__libre__';

export function FormTiempos({ usuario, ordenesIniciales, estado, onObtenerTiempos, onGuardar, onRefresh, loading }: FormTiemposProps) {
  const [actividad,   setActividad]   = useState('');
  const [ordenId,     setOrdenId]     = useState('');
  const [maquina,     setMaquina]     = useState('');
  const [cantidad,    setCantidad]    = useState('1');
  const [defectos,    setDefectos]    = useState('0');
  const [ordenes,     setOrdenes]     = useState<OrdenActiva[]>(ordenesIniciales);
  const [finalizando, setFinalizando] = useState(false);
  const [confirmFin,  setConfirmFin]  = useState(false);
  const [errorFin,    setErrorFin]    = useState<string | null>(null);
  const [inconveniente,      setInconveniente]      = useState<string>('');
  const [inconvenienteNotas, setInconvenienteNotas] = useState<string>('');
  const [showInconv,         setShowInconv]         = useState(false);

  const fetchOrdenes = useCallback(async () => {
    try {
      const r = await fetch('/api/tiempos/cola');
      if (r.ok) {
        const data: OrdenActiva[] = await r.json();
        setOrdenes(data);
      }
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { fetchOrdenes(); }, [fetchOrdenes]);

  useEffect(() => {
    const interval = setInterval(fetchOrdenes, 30_000);
    return () => clearInterval(interval);
  }, [fetchOrdenes]);

  const ordenSeleccionada = ordenes.find((o) => o.id === ordenId) ?? null;
  // Hay un cronómetro abierto (corriendo o en pausa) listo para guardarse.
  const hayTarea = estado !== 'idle';

  const finalizarCorte = async () => {
    if (!ordenSeleccionada) return;
    setFinalizando(true);
    setErrorFin(null);
    try {
      const r = await fetch(`/api/tiempos/cola/${ordenSeleccionada.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'terminado' }),
      });
      if (r.ok) {
        setOrdenId('');
        setConfirmFin(false);
        await fetchOrdenes();
      } else {
        const data = await r.json().catch(() => ({}));
        setErrorFin(`Error ${r.status}: ${data.error ?? 'No se pudo finalizar'}`);
      }
    } catch (e) {
      setErrorFin(`Error de red: ${String(e)}`);
    } finally {
      setFinalizando(false);
    }
  };

  const handleGuardar = async () => {
    if (!actividad || estado === 'idle') return;

    const t = onObtenerTiempos();
    if (!t) return;
    const { horaInicio, horaFin, minutosNetos } = t;

    const tiempo: TiemposProduccion = {
      usuario,
      actividad,
      fecha:        new Date().toISOString().split('T')[0],
      marca:        ordenSeleccionada?.marca   || undefined,
      maquina:      maquina                   || undefined,
      sku:          ordenSeleccionada?.sku     || undefined,
      cantidad:     parseInt(cantidad) || 0,
      defectos:     parseInt(defectos) || 0,
      horaInicio,
      horaFin,
      minutosNetos,
      estado: 'guardado',
      inconveniente:      inconveniente || undefined,
      inconvenienteNotas: inconveniente && inconvenienteNotas.trim() ? inconvenienteNotas.trim() : undefined,
    };
    try {
      await onGuardar(tiempo);
      setActividad('');
      setOrdenId('');
      setMaquina('');
      setCantidad('1');
      setDefectos('0');
      setInconveniente('');
      setInconvenienteNotas('');
      setShowInconv(false);
    } catch {
      alert('Error guardando registro');
    }
  };

  return (
    <div className="p-4 space-y-4">

      {/* Actividad */}
      <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Actividad</p>
      <div className="grid grid-cols-2 gap-2">
        {ACTIVIDADES.map(({ label, icon, color }) => (
          <button
            key={label}
            onClick={() => setActividad(label)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all active:scale-95 ${
              actividad === label
                ? color + ' ring-2 ring-offset-1 ring-stone-400'
                : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
            }`}
          >
            <span>{icon}</span>
            <span className="leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* Órdenes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Orden / SKU</p>
          <button onClick={fetchOrdenes} className="text-xs text-stone-400 hover:text-stone-600 transition">
            Actualizar
          </button>
        </div>

        <div className="space-y-1.5">
          {ordenes.map((orden) => (
            <button
              key={orden.id}
              onClick={() => {
                if (ordenId === orden.id) {
                  setOrdenId('');
                  setCantidad('1');
                } else {
                  setOrdenId(orden.id);
                  setCantidad(String(orden.cantidad));
                }
                setConfirmFin(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all active:scale-95 ${
                ordenId === orden.id ? 'bg-amber-50 border-amber-400' : 'bg-white border-stone-200 hover:border-stone-300'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-stone-800">{orden.sku}</span>
                  <span className="text-xs text-stone-400">{orden.marca}</span>
                  {orden.estado === 'COSTURA' && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">Costura</span>
                  )}
                </div>
                {orden.descripcion && (
                  <p className="text-xs text-stone-500 truncate mt-0.5">{orden.descripcion}</p>
                )}
              </div>
              <span className="text-xs text-stone-400 shrink-0">×{orden.cantidad}</span>
              {ordenId === orden.id && <span className="text-amber-500 text-base shrink-0">✓</span>}
            </button>
          ))}

          {ordenes.length === 0 && (
            <p className="text-xs text-stone-400 italic py-1">Sin órdenes activas en la cola</p>
          )}

          <button
            onClick={() => {
              setOrdenId(ordenId === LIBRE_ID ? '' : LIBRE_ID);
              setCantidad('1');
              setConfirmFin(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 text-left transition-all active:scale-95 ${
              ordenId === LIBRE_ID ? 'bg-stone-100 border-stone-400' : 'bg-white border-dashed border-stone-200 hover:border-stone-300'
            }`}
          >
            <span className="text-xs text-stone-400 font-medium">Sin orden — trabajo libre</span>
          </button>

          {ordenSeleccionada && (
            <div className="pt-1">
              {!confirmFin ? (
                <button
                  onClick={() => setConfirmFin(true)}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-red-200 text-red-500 text-xs font-bold uppercase tracking-wide hover:bg-red-50 transition active:scale-95"
                >
                  Finalizar corte — {ordenSeleccionada.sku}
                </button>
              ) : (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-bold text-red-700 text-center">
                    ¿Confirmar que el corte <span className="font-mono">{ordenSeleccionada.sku}</span> está terminado?
                  </p>
                  {errorFin && (
                    <p className="text-xs text-red-800 bg-red-100 border border-red-300 rounded-lg px-2 py-1.5 font-mono break-all">
                      {errorFin}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={finalizarCorte}
                      disabled={finalizando}
                      className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg text-xs font-bold transition active:scale-95"
                    >
                      {finalizando ? 'Finalizando...' : 'Sí, finalizar'}
                    </button>
                    <button
                      onClick={() => { setConfirmFin(false); setErrorFin(null); }}
                      className="px-4 py-2 rounded-lg border border-stone-200 text-stone-500 text-xs font-semibold hover:border-stone-400 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Resto del formulario */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-stone-500 mb-1 uppercase tracking-wide">Máquina</label>
          <select
            value={maquina}
            onChange={(e) => setMaquina(e.target.value)}
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white text-stone-800 focus:outline-none focus:border-amber-400"
          >
            <option value="">— Opcional —</option>
            {MAQUINAS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-stone-500 mb-1 uppercase tracking-wide">Cantidad</label>
          <input
            type="number"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            min="0"
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white text-stone-800 focus:outline-none focus:border-amber-400"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-bold text-stone-500 mb-1 uppercase tracking-wide">Defectos</label>
          <input
            type="number"
            value={defectos}
            onChange={(e) => setDefectos(e.target.value)}
            min="0"
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white text-stone-800 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Inconveniente */}
      <div>
        {!showInconv && !inconveniente && (
          <button
            type="button"
            onClick={() => setShowInconv(true)}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-amber-200 text-amber-600 text-xs font-bold uppercase tracking-wide hover:bg-amber-50 transition active:scale-95"
          >
            ⚠ Reportar inconveniente
          </button>
        )}

        {(showInconv || inconveniente) && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800">Inconveniente</p>
              <button
                type="button"
                onClick={() => { setInconveniente(''); setInconvenienteNotas(''); setShowInconv(false); }}
                className="text-xs text-amber-700 hover:text-amber-900 transition"
              >
                Quitar
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {INCONVENIENTES.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setInconveniente(opt)}
                  className={`px-2.5 py-2 rounded-lg border text-xs font-semibold transition active:scale-95 ${
                    inconveniente === opt
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-white border-amber-200 text-amber-700 hover:border-amber-400'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <textarea
              value={inconvenienteNotas}
              onChange={(e) => setInconvenienteNotas(e.target.value)}
              placeholder="Notas (opcional)"
              rows={2}
              className="w-full px-2.5 py-1.5 border border-amber-200 rounded-lg text-xs bg-white focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-1 bg-gradient-to-t from-white via-white to-transparent">
        {hayTarea && !actividad && (
          <p className="text-xs text-amber-600 text-center mb-1.5 font-semibold">
            Elegí una actividad arriba para guardar ↑
          </p>
        )}
        {!hayTarea && (
          <p className="text-xs text-stone-400 text-center mb-1.5">
            Iniciá el cronómetro para registrar un trabajo
          </p>
        )}
        <button
          onClick={handleGuardar}
          disabled={loading || !actividad || !hayTarea}
          className="w-full bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 disabled:text-stone-400 text-white py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-all active:scale-95"
        >
          {loading ? 'Guardando...' : '✓ Guardar registro'}
        </button>
      </div>
    </div>
  );
}
