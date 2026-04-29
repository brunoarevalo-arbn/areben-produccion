'use client';

import { useState } from 'react';
import { TiemposProduccion } from '@/types/tiempos';

interface FormTiemposProps {
  usuario: string;
  tareaEnCurso: any | null;
  onGuardar: (tiempo: TiemposProduccion) => Promise<unknown>;
  loading: boolean;
}

const ACTIVIDADES: { label: string; icon: string; color: string }[] = [
  { label: 'Proceso Completado', icon: '✅', color: 'bg-emerald-50 border-emerald-400 text-emerald-800' },
  { label: 'Muestra/Prototipo',  icon: '📐', color: 'bg-violet-50 border-violet-400 text-violet-800' },
  { label: 'Descanso',           icon: '☕', color: 'bg-sky-50 border-sky-400 text-sky-800' },
  { label: 'Almuerzo',           icon: '🍽️', color: 'bg-orange-50 border-orange-400 text-orange-800' },
  { label: 'Falla Máquina',      icon: '⚠️', color: 'bg-red-50 border-red-400 text-red-800' },
  { label: 'Cambio Hilo',        icon: '🧵', color: 'bg-yellow-50 border-yellow-400 text-yellow-800' },
];

const MARCAS   = ['Zattia', 'Stunned', 'BDI'];
const MAQUINAS = ['Recta', 'Collareta', 'Remalladora', 'Cadeneta', 'Cortacollareta'];

export function FormTiempos({ usuario, tareaEnCurso, onGuardar, loading }: FormTiemposProps) {
  const [actividad, setActividad] = useState('');
  const [marca,     setMarca]     = useState('Zattia');
  const [maquina,   setMaquina]   = useState('');
  const [sku,       setSku]       = useState('');
  const [cantidad,  setCantidad]  = useState('1');
  const [defectos,  setDefectos]  = useState('0');

  const handleGuardar = async () => {
    if (!actividad) return;

    const tiempo: TiemposProduccion = {
      usuario,
      actividad,
      fecha: new Date().toISOString().split('T')[0],
      marca:      marca || undefined,
      maquina:    maquina || undefined,
      sku:        sku || undefined,
      cantidad:   parseInt(cantidad) || 0,
      defectos:   parseInt(defectos) || 0,
      horaInicio: tareaEnCurso?.horaInicio?.toTimeString()?.split(' ')[0],
      horaFin:    tareaEnCurso?.horaFin?.toTimeString()?.split(' ')[0],
      minutosNetos: tareaEnCurso?.minutosNetos || 0,
      estado: 'guardado',
    };

    try {
      await onGuardar(tiempo);
      setActividad('');
      setMarca('Zattia');
      setMaquina('');
      setSku('');
      setCantidad('1');
      setDefectos('0');
    } catch {
      alert('Error guardando registro');
    }
  };

  return (
    <div className="p-4 space-y-4">
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-stone-500 mb-1 uppercase tracking-wide">Marca</label>
          <select
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white text-stone-800 focus:outline-none focus:border-amber-400"
          >
            {MARCAS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>

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
          <label className="block text-xs font-bold text-stone-500 mb-1 uppercase tracking-wide">SKU</label>
          <input
            type="text"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="ej: ZATT-TOP-001"
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white text-stone-800 placeholder-stone-300 focus:outline-none focus:border-amber-400"
          />
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
