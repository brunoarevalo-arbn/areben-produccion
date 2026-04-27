// components/tiempos/FormTiempos.tsx

'use client';

import { useState } from 'react';
import { TiemposProduccion } from '@/types/tiempos';

interface FormTiemposProps {
  usuario: string;
  tareaEnCurso: any | null;
  onGuardar: (tiempo: TiemposProduccion) => Promise<void>;
  loading: boolean;
}

export function FormTiempos({
  usuario,
  tareaEnCurso,
  onGuardar,
  loading,
}: FormTiemposProps) {
  const [actividad, setActividad] = useState('');
  const [marca, setMarca] = useState('Zattia');
  const [maquina, setMaquina] = useState('');
  const [sku, setSku] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [defectos, setDefectos] = useState('0');

  const actividades = [
    'Proceso Completado',
    'Muestra/Prototipo',
    'Descanso',
    'Almuerzo',
    'Falla Máquina',
    'Cambio Hilo',
  ];

  const marcas = ['Zattia', 'Stunned'];
  const maquinas = ['Recta', 'Collareta', 'Remalladora', 'Cadeneta', 'Cortacollareta'];

  const handleGuardar = async () => {
    if (!actividad) {
      alert('Selecciona una actividad');
      return;
    }

    const tiempo: TiemposProduccion = {
      usuario,
      actividad,
      fecha: new Date().toISOString().split('T')[0],
      marca: marca || undefined,
      maquina: maquina || undefined,
      sku: sku || undefined,
      cantidad: parseInt(cantidad) || 0,
      defectos: parseInt(defectos) || 0,
      horaInicio: tareaEnCurso?.horaInicio?.toTimeString()?.split(' ')[0],
      horaFin: tareaEnCurso?.horaFin?.toTimeString()?.split(' ')[0],
      minutosNetos: tareaEnCurso?.minutosNetos || 0,
      estado: 'guardado',
    };

    try {
      await onGuardar(tiempo);
      // Limpiar formulario
      setActividad('');
      setMarca('Zattia');
      setMaquina('');
      setSku('');
      setCantidad('1');
      setDefectos('0');
    } catch (error) {
      alert('Error guardando registro');
    }
  };

  return (
    <div className="bg-white rounded-lg p-4 border-t border-gray-300">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Nuevo Registro</h2>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Actividad */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Actividad
          </label>
          <select
            value={actividad}
            onChange={(e) => setActividad(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          >
            <option value="">Selecciona</option>
            {actividades.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>

        {/* Marca */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Marca
          </label>
          <select
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          >
            {marcas.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Máquina */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Máquina
          </label>
          <select
            value={maquina}
            onChange={(e) => setMaquina(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          >
            <option value="">Selecciona</option>
            {maquinas.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* SKU */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            SKU
          </label>
          <input
            type="text"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="ej: ZATT-TOP-001"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
        </div>

        {/* Cantidad */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Cantidad
          </label>
          <input
            type="number"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
        </div>

        {/* Defectos */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Defectos
          </label>
          <input
            type="number"
            value={defectos}
            onChange={(e) => setDefectos(e.target.value)}
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
        </div>
      </div>

      <button
        onClick={handleGuardar}
        disabled={loading || !actividad}
        className="w-full bg-blue-900 hover:bg-blue-800 disabled:bg-gray-400 text-white py-3 rounded-lg font-bold text-lg transition"
      >
        {loading ? 'Guardando...' : '💾 Guardar Registro'}
      </button>
    </div>
  );
}
