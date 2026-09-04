'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTiempos } from '@/lib/hooks/useTiempos';
import { Cronometro } from './Cronometro';
import { LogRegistros } from './LogRegistros';
import { FormTiempos } from './FormTiempos';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import Link from 'next/link';

interface OrdenActiva {
  id: string;
  sku: string | null;
  descripcion: string | null;
  marca: string;
  cantidad: number;
  estado: string;
}

interface CorridaAbierta {
  id: string;
  nombre: string;
  tipoPrenda: string;
  talle: string;
  modo: string;
  estado: string;
  costurera: string;
  unidadActual: number;
  unidadesObjetivo: number;
  corriendo: boolean;
}

interface CorridaHecha {
  id: string;
  nombre: string;
  talle: string;
  modo: string;
  costurera: string;
  minutos: number;
  pasos: number;
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

  // Las corridas de muestra encendidas para esta costurera. Son la única puerta
  // a la calculadora desde la tablet: no se navega por URL. Van TODAS, no la
  // primera: con cuatro relevamientos cargados, ella elige con cuál arranca.
  const [corridas, setCorridas] = useState<CorridaAbierta[]>([]);
  // Y lo que terminó hoy, que antes desaparecía sin dejar rastro.
  const [hechas, setHechas] = useState<CorridaHecha[]>([]);
  useEffect(() => {
    fetch('/api/tiempos/corrida')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setCorridas(d?.abiertas ?? []);
        setHechas(d?.terminadasHoy ?? []);
      })
      .catch(() => { /* la tablet sigue funcionando sin corrida */ });
  }, []);

  // Registros propios con una solicitud de cambio pendiente (para badge / evitar dupes).
  const [pendientes, setPendientes] = useState<Set<string>>(new Set());
  const refreshPendientes = useCallback(async () => {
    const r = await fetch('/api/tiempos/solicitudes');
    if (r.ok) { const d = await r.json() as { tiempoId: string }[]; setPendientes(new Set(d.map((s) => s.tiempoId))); }
  }, []);
  useEffect(() => { refreshPendientes(); }, [refreshPendientes]);

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
        {corridas.length > 0 && (
          <div className="px-4 pt-4 shrink-0 space-y-2">
            {corridas.length > 1 && (
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
                Tenés {corridas.length} para medir · elegí una
              </p>
            )}
            {corridas.map((c) => (
              <Link key={c.id} href={`/tiempos/corrida/${c.id}`}
                className="block bg-amber-50 border-2 border-amber-400 rounded-xl px-4 py-3.5 transition active:scale-95">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-600 flex items-center gap-2">
                  📐 {c.modo === 'relevamiento' ? 'Relevamiento' : 'Corrida de muestra'}
                  {c.corriendo && (
                    <span className="text-red-600 normal-case tracking-normal">⏱ el reloj está corriendo</span>
                  )}
                  {!c.corriendo && c.estado === 'en_curso' && (
                    <span className="text-stone-400 normal-case tracking-normal">empezada</span>
                  )}
                </p>
                <p className="font-semibold text-stone-900 text-sm mt-0.5">
                  {c.nombre} · {c.talle} <span className="text-amber-600">→</span>
                </p>
                {usuario.rol === 'admin' && (
                  <p className="text-xs text-stone-500 mt-0.5">{c.costurera}</p>
                )}
              </Link>
            ))}
          </div>
        )}

        {hechas.length > 0 && (
          <div className="px-4 pt-3 shrink-0 space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Terminado hoy</p>
            {hechas.map((h) => (
              <div key={h.id} className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm">
                <span className="text-emerald-600">✓</span>
                <span className="flex-1 min-w-0 truncate text-stone-700">
                  {h.modo === 'relevamiento' ? 'Relevamiento' : 'Muestra'} · {h.nombre} · {h.talle}
                </span>
                <span className="tabular-nums text-stone-500 shrink-0">
                  {h.pasos} pasos · {h.minutos.toString().replace('.', ',')} min
                </span>
              </div>
            ))}
          </div>
        )}

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
          <LogRegistros registros={tiempos.registros} loading={tiempos.loading}
            ordenes={ordenesIniciales} pendientes={pendientes} onEnviada={refreshPendientes} />
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
