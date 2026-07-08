'use client';

import { useRouter } from 'next/navigation';
import { useTiempos } from '@/lib/hooks/useTiempos';
import { Cronometro } from './Cronometro';
import { LogRegistros } from './LogRegistros';
import { FormTiempos } from './FormTiempos';
import { confirmAsync } from '@/components/ui/ConfirmProvider';

interface OrdenActiva {
  id: string;
  sku: string | null;
  descripcion: string | null;
  marca: string;
  cantidad: number;
  estado: string;
}

interface SessionUser {
  id: string;
  nombre: string;
  username: string;
  rol: 'admin' | 'costurera' | 'diseñadora' | 'estampador';
}

interface Props {
  usuario: SessionUser;
  ordenesIniciales: OrdenActiva[];
}

export function TiemposClient({ usuario, ordenesIniciales }: Props) {
  const router  = useRouter();
  const tiempos = useTiempos(usuario.nombre);

  const handleDescartar = async () => {
    const ok = await confirmAsync({ message: '¿Descartar el registro en curso? Se va a perder el tiempo medido.', danger: true, confirmLabel: 'Descartar' });
    if (ok) tiempos.descartar();
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const fecha = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="flex flex-col h-screen bg-stone-50">
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

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-4 pb-2 shrink-0">
          <Cronometro
            tiempoDisplay={tiempos.tiempoDisplay}
            estado={tiempos.estado}
            onIniciar={tiempos.iniciar}
            onPausar={tiempos.pausar}
            onReanudar={tiempos.reanudar}
            onDescartar={handleDescartar}
          />
        </div>

        {tiempos.error && (
          <div className="mx-4 bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">
            {tiempos.error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-2">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">
            Registros de hoy
          </p>
          <LogRegistros registros={tiempos.registros} loading={tiempos.loading} />
        </div>

        <div className="bg-white border-t border-stone-200 overflow-y-auto max-h-[50vh] md:max-h-[65vh] shrink-0">
          <FormTiempos
            usuario={usuario.nombre}
            ordenesIniciales={ordenesIniciales}
            estado={tiempos.estado}
            onObtenerTiempos={tiempos.obtenerTiempos}
            onGuardar={tiempos.guardarRegistro}
            onRefresh={() => router.refresh()}
            loading={tiempos.loading}
          />
        </div>
      </div>
    </div>
  );
}
