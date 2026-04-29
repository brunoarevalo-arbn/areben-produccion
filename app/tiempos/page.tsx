'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTiempos } from '@/lib/hooks/useTiempos';
import { Cronometro } from '@/components/tiempos/Cronometro';
import { LogRegistros } from '@/components/tiempos/LogRegistros';
import { FormTiempos } from '@/components/tiempos/FormTiempos';
import { ColaCosturera } from '@/components/produccion/ColaCosturera';

interface SessionUser {
  id: string;
  nombre: string;
  username: string;
  rol: 'admin' | 'costurera';
}

export default function TiemposPage() {
  const [usuario, setUsuario] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const tiempos = useTiempos(usuario?.nombre ?? '');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUsuario(d.user);
        else router.push('/login');
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (loading || !usuario) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-900">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
      </div>
    );
  }

  const fecha = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="flex flex-col h-screen bg-stone-50">

      {/* Header */}
      <header className="bg-stone-900 px-4 py-3 flex items-center justify-between shrink-0">
        <div>
          <p className="text-amber-400 text-xs font-bold uppercase tracking-widest">Areben</p>
          <p className="text-white font-semibold text-sm leading-tight">{usuario.nombre}</p>
          <p className="text-stone-400 text-xs capitalize">{fecha}</p>
        </div>
        <div className="flex items-center gap-2">
          {usuario.rol === 'admin' && (
            <button
              onClick={() => router.push('/dashboard')}
              className="text-stone-400 hover:text-white text-xs border border-stone-700 hover:border-stone-500 px-3 py-1.5 rounded-lg transition"
            >
              Dashboard
            </button>
          )}
          <button
            onClick={handleLogout}
            className="text-stone-400 hover:text-white text-xs border border-stone-700 hover:border-stone-500 px-3 py-1.5 rounded-lg transition"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Cola de producción */}
        <div className="pt-3 pb-1 shrink-0">
          <ColaCosturera />
        </div>

        {/* Cronómetro */}
        <div className="px-4 pt-2 pb-2 shrink-0">
          <Cronometro
            tiempoDisplay={tiempos.tiempoDisplay}
            activo={tiempos.cronometroActivo}
            onIniciar={tiempos.iniciarTarea}
            onDetener={tiempos.terminarTarea}
          />
        </div>

        {tiempos.error && (
          <div className="mx-4 bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">
            {tiempos.error}
          </div>
        )}

        {/* Log */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">
            Registros de hoy
          </p>
          <LogRegistros registros={tiempos.registros} loading={tiempos.loading} />
        </div>

        {/* Formulario */}
        <div className="bg-white border-t border-stone-200 overflow-y-auto max-h-[55vh] shrink-0">
          <FormTiempos
            usuario={usuario.nombre}
            tareaEnCurso={tiempos.tareaEnCurso}
            onGuardar={tiempos.guardarRegistro}
            loading={tiempos.loading}
          />
        </div>

      </div>
    </div>
  );
}
