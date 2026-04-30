'use client';

import { useState, useEffect, useCallback } from 'react';
import { TiemposProduccion } from '@/types/tiempos';

interface FormTiemposProps {
  usuario: string;
  tareaEnCurso: any | null;
  onGuardar: (tiempo: TiemposProduccion) => Promise<unknown>;
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
  { label: 'Muestra/Prototipo',  icon: '📐', color: 'bg-violet-50 border-violet-400 text-violet-800' },
  { label: 'Descanso',           icon: '☕', color: 'bg-sky-50 border-sky-400 text-sky-800' },
  { label: 'Almuerzo',           icon: '🍽️', color: 'bg-orange-50 border-orange-400 text-orange-800' },
  { label: 'Falla Máquina',      icon: '⚠️', color: 'bg-red-50 border-red-400 text-red-800' },
  { label: 'Cambio Hilo',        icon: '🧵', color: 'bg-yellow-50 border-yellow-400 text-yellow-800' },
];

const MAQUINAS = ['Recta', 'Collareta', 'Remalladora', 'Cadeneta', 'Cortacollareta'];

const LIBRE_ID = '__libre__';

export function FormTiempos({ usuario, tareaEnCurso, onGuardar, loading }: FormTiemposProps) {
  const [actividad,      setActividad]      = useState('');
  const [ordenId,        setOrdenId]        = useState('');
  const [maquina,        setMaquina]        = useState('');
  const [cantidad,       setCantidad]       = useState('1');
  const [defectos,       setDefectos]       = useState('0');
  const [ordenes,        setOrdenes]        = useState<OrdenActiva[]>([]);
  const [loadingQ,       setLoadingQ]       = useState(true);
  const [errorCola,      setErrorCola]      = useState('');
  const [finalizando,    setFinalizando]    = useState(false);
  const [confirmFin,     setConfirmFin]     = useState(false);

  const cargarCola = useCallback(async () => {
    setLoadingQ(true);
    setErrorCola('');
    let r: Response;
    try {
      r = await fetch('/api/produccion/cola?soloActivas=1');
    } catch (err) {
      setErrorCola(`Fetch falló: ${err instanceof Error ? err.message : String(err)}`);
      setLoadingQ(false);
      return;
    }
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      setErrorCola(`HTTP ${r.status}: ${body.slice(0, 120) || r.statusText}`);
      setLoadingQ(false);
      return;
    }
    try {
      const text = await r.text();
      try {
        setOrdenes(JSON.parse(text));
      } catch {
        setErrorCola(`Resp: ${text.slice(0, 300) || '(vacío)'}`);
      }
    } catch (err) {
      setErrorCola(`Text: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingQ(false);
    }
  }, []);

  useEffect(() => { cargarCola(); }, [cargarCola]);

  const ordenSeleccionada = ordenes.find((o) => o.id === ordenId) ?? null;

  const finalizarCorte = async () => {
    if (!ordenSeleccionada) return;
    setFinalizando(true);
    const r = await fetch(`/api/produccion/cola/${ordenSeleccionada.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'terminado' }),
    });
    if (r.ok) {
      setOrdenes((prev) => prev.filter((o) => o.id !== ordenSeleccionada.id));
      setOrdenId('');
    }
    setFinalizando(false);
    setConfirmFin(false);
  };

  const handleGuardar = async () => {
    if (!actividad) return;

    const tiempo: TiemposProduccion = {
      usuario,
      actividad,
      fecha: new Date().toISOString().split('T')[0],
      marca:        ordenSeleccionada?.marca        || undefined,
      maquina:      maquina                         || undefined,
      sku:          ordenSeleccionada?.sku           || undefined,
      cantidad:     parseInt(cantidad) || 0,
      defectos:     parseInt(defectos) || 0,
      horaInicio:   tareaEnCurso?.horaInicio?.toTimeString()?.split(' ')[0],
      horaFin:      tareaEnCurso?.horaFin?.toTimeString()?.split(' ')[0],
      minutosNetos: tareaEnCurso?.minutosNetos || 0,
      estado: 'guardado',
    };

    try {
      await onGuardar(tiempo);
      setActividad('');
      setOrdenId('');
      setMaquina('');
      setCantidad('1');
      setDefectos('0');
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

      {/* Cola de producción como selector de SKU */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Orden / SKU</p>
          <button onClick={cargarCola} className="text-xs text-stone-400 hover:text-stone-600 transition">
            Actualizar
          </button>
        </div>

        {loadingQ ? (
          <p className="text-xs text-stone-400 py-2">Cargando cola...</p>
        ) : errorCola ? (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{errorCola}</p>
        ) : (
          <div className="space-y-1.5">
            {ordenes.map((orden) => (
              <button
                key={orden.id}
                onClick={() => { setOrdenId(ordenId === orden.id ? '' : orden.id); setConfirmFin(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all active:scale-95 ${
                  ordenId === orden.id
                    ? 'bg-amber-50 border-amber-400'
                    : 'bg-white border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-stone-800">{orden.sku}</span>
                    <span className="text-xs text-stone-400">{orden.marca}</span>
                    {orden.estado === 'en_produccion' && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">En curso</span>
                    )}
                  </div>
                  {orden.descripcion && (
                    <p className="text-xs text-stone-500 truncate mt-0.5">{orden.descripcion}</p>
                  )}
                </div>
                <span className="text-xs text-stone-400 shrink-0">×{orden.cantidad}</span>
                {ordenId === orden.id && (
                  <span className="text-amber-500 text-base shrink-0">✓</span>
                )}
              </button>
            ))}

            {ordenes.length === 0 && (
              <p className="text-xs text-stone-400 italic py-1">Sin órdenes activas en la cola</p>
            )}

            {/* Opción libre (sin orden) */}
            <button
              onClick={() => { setOrdenId(ordenId === LIBRE_ID ? '' : LIBRE_ID); setConfirmFin(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 text-left transition-all active:scale-95 ${
                ordenId === LIBRE_ID
                  ? 'bg-stone-100 border-stone-400'
                  : 'bg-white border-dashed border-stone-200 hover:border-stone-300'
              }`}
            >
              <span className="text-xs text-stone-400 font-medium">Sin orden — trabajo libre</span>
            </button>

            {/* Finalizar corte */}
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
                    <div className="flex gap-2">
                      <button
                        onClick={finalizarCorte}
                        disabled={finalizando}
                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg text-xs font-bold transition active:scale-95"
                      >
                        {finalizando ? 'Finalizando...' : 'Sí, finalizar'}
                      </button>
                      <button
                        onClick={() => setConfirmFin(false)}
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
        )}
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

      <button
        onClick={handleGuardar}
        disabled={loading || !actividad}
        className="w-full bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 disabled:text-stone-400 text-white py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-all active:scale-95"
      >
        {loading ? 'Guardando...' : 'Guardar Registro'}
      </button>
    </div>
  );
}
