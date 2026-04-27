// app/tiempos/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useTiempos } from '@/lib/hooks/useTiempos';

export default function TiemposPage() {
  const [usuario, setUsuario] = useState<string | null>(null);
  const [nombreInput, setNombreInput] = useState('');
  const tiempos = useTiempos(usuario || '');

  useEffect(() => {
    const sesion = sessionStorage.getItem('costurera');
    if (sesion) {
      setUsuario(sesion);
    }
  }, []);

  const handleLogin = () => {
    if (nombreInput.trim()) {
      sessionStorage.setItem('costurera', nombreInput);
      setUsuario(nombreInput);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('costurera');
    setUsuario(null);
    setNombreInput('');
  };

  if (!usuario) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-blue-900 mb-4">⚙️ Areben v2.0</h1>
          <p className="text-gray-600 mb-8">Control de Producción</p>
          <input
            type="text"
            value={nombreInput}
            onChange={(e) => setNombreInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Tu nombre"
            autoFocus
            className="px-4 py-2 border-2 border-gray-300 rounded-lg mb-4 w-80 text-lg"
          />
          <button
            onClick={handleLogin}
            className="block w-80 bg-blue-900 text-white py-3 rounded-lg font-bold uppercase"
          >
            Comenzar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-4 shadow-lg">
        <h1 className="text-2xl font-bold">⚙️ Areben v2.0</h1>
        <div className="text-sm mt-1">
          <span>{usuario}</span> • <span>{new Date().toLocaleDateString('es-AR')}</span>
          <button
            onClick={handleLogout}
            className="float-right bg-red-600 text-white px-3 py-1 rounded text-xs font-bold"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Log Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {tiempos.registros.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              Los registros aparecerán aquí ↓
            </div>
          ) : (
            tiempos.registros.map((reg) => (
              <div
                key={reg.id}
                className="bg-white rounded-lg p-4 mb-3 border-l-4 border-blue-900 shadow-sm"
              >
                <div className="font-bold text-gray-800">{reg.actividad}</div>
                <div className="text-sm text-gray-600">
                  {reg.sku || ''} | {reg.cantidad ? `${reg.cantidad} prendas` : ''}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {reg.horaInicio} → {reg.horaFin} | {reg.minutosNetos.toFixed(1)} min
                </div>
              </div>
            ))
          )}
        </div>

        {/* Form Area */}
        <div className="bg-white border-t border-gray-200 p-4 max-h-96 overflow-y-auto">
          <p className="text-center text-gray-600">
            {tiempos.loading ? 'Cargando...' : 'Formulario de tiempos'}
          </p>
          {tiempos.error && (
            <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
              {tiempos.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
