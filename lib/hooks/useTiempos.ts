// lib/hooks/useTiempos.ts

'use client';

import { useState, useRef, useEffect } from 'react';
import { TiemposProduccion } from '@/types/tiempos';
import { crearTiempo, getTiempos } from '@/lib/api/tiempos';

const MAX_AGE_MS = 9 * 60 * 60 * 1000; // 9 horas
const storageKey = (usuario: string) => `cronometro:${usuario}`;

export type EstadoCronometro = 'idle' | 'corriendo' | 'pausado';

function formatDisplay(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function useTiempos(usuario: string) {
  const [registros, setRegistros] = useState<TiemposProduccion[]>([]);
  const [estado, setEstado] = useState<EstadoCronometro>('idle');
  const [tiempoDisplay, setTiempoDisplay] = useState('00:00:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const horaInicioRef  = useRef<Date | null>(null); // primer inicio (para horaInicio del registro)
  const acumuladoMsRef = useRef(0);                 // tiempo activo acumulado (sin contar pausas)
  const segInicioRef   = useRef<Date | null>(null); // inicio del tramo en curso (null si en pausa)
  const intervalRef    = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Tiempo trabajado total: acumulado + tramo en curso si está corriendo.
  const totalMs = () =>
    acumuladoMsRef.current + (segInicioRef.current ? Date.now() - segInicioRef.current.getTime() : 0);

  const persistir = (est: EstadoCronometro) => {
    if (typeof window === 'undefined' || !usuario) return;
    if (est === 'idle' || !horaInicioRef.current) {
      localStorage.removeItem(storageKey(usuario));
      return;
    }
    localStorage.setItem(storageKey(usuario), JSON.stringify({
      horaInicio:  horaInicioRef.current.toISOString(),
      acumuladoMs: acumuladoMsRef.current,
      segInicio:   segInicioRef.current ? segInicioRef.current.toISOString() : null,
      estado:      est,
    }));
  };

  // Cargar registros del día
  useEffect(() => {
    if (usuario) cargarDatos();
  }, [usuario]);

  // Restaurar cronómetro pendiente (corriendo o en pausa) tras un refresh
  useEffect(() => {
    if (!usuario || typeof window === 'undefined') return;
    const raw = localStorage.getItem(storageKey(usuario));
    if (!raw) return;
    try {
      const d = JSON.parse(raw) as {
        horaInicio: string; acumuladoMs?: number; segInicio?: string | null; estado?: EstadoCronometro;
      };
      const inicio = new Date(d.horaInicio);
      if (isNaN(inicio.getTime()) || Date.now() - inicio.getTime() > MAX_AGE_MS || typeof d.acumuladoMs !== 'number') {
        localStorage.removeItem(storageKey(usuario));
        return;
      }
      horaInicioRef.current  = inicio;
      acumuladoMsRef.current = d.acumuladoMs;
      if (d.estado === 'corriendo' && d.segInicio) {
        segInicioRef.current = new Date(d.segInicio);
        setEstado('corriendo');
        setTiempoDisplay(formatDisplay(totalMs()));
      } else {
        segInicioRef.current = null;
        setEstado('pausado');
        setTiempoDisplay(formatDisplay(acumuladoMsRef.current));
      }
    } catch {
      localStorage.removeItem(storageKey(usuario));
    }
  }, [usuario]);

  // Tick del cronómetro mientras corre
  useEffect(() => {
    if (estado !== 'corriendo') return;
    intervalRef.current = setInterval(() => {
      setTiempoDisplay(formatDisplay(totalMs()));
    }, 100);
    return () => clearInterval(intervalRef.current);
  }, [estado]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const datos = await getTiempos(usuario);
      setRegistros(datos);
      setError(null);
    } catch (err) {
      setError('Error cargando datos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const iniciar = () => {
    const ahora = new Date();
    horaInicioRef.current  = ahora;
    acumuladoMsRef.current = 0;
    segInicioRef.current   = ahora;
    setTiempoDisplay('00:00:00');
    setEstado('corriendo');
    persistir('corriendo');
  };

  const pausar = () => {
    if (estado !== 'corriendo' || !segInicioRef.current) return;
    acumuladoMsRef.current += Date.now() - segInicioRef.current.getTime();
    segInicioRef.current = null;
    setTiempoDisplay(formatDisplay(acumuladoMsRef.current));
    setEstado('pausado');
    persistir('pausado');
  };

  const reanudar = () => {
    if (estado !== 'pausado') return;
    segInicioRef.current = new Date();
    setEstado('corriendo');
    persistir('corriendo');
  };

  const descartar = () => {
    horaInicioRef.current  = null;
    acumuladoMsRef.current = 0;
    segInicioRef.current   = null;
    setTiempoDisplay('00:00:00');
    setEstado('idle');
    persistir('idle');
  };

  // Foto de los tiempos para guardar (no resetea; el reset ocurre al guardar OK).
  const obtenerTiempos = () => {
    if (!horaInicioRef.current) return undefined;
    const fin = new Date();
    return {
      horaInicio:   horaInicioRef.current.toTimeString().split(' ')[0],
      horaFin:      fin.toTimeString().split(' ')[0],
      minutosNetos: Math.floor(totalMs() / 60000),
    };
  };

  const guardarRegistro = async (tiempo: TiemposProduccion) => {
    try {
      setLoading(true);
      const resultado = await crearTiempo(tiempo);
      setRegistros((prev) => [...prev, resultado]);

      horaInicioRef.current  = null;
      acumuladoMsRef.current = 0;
      segInicioRef.current   = null;
      setEstado('idle');
      setTiempoDisplay('00:00:00');
      persistir('idle');

      setError(null);
      return resultado;
    } catch (err) {
      setError('Error guardando tiempo');
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    registros,
    estado,
    tiempoDisplay,
    loading,
    error,
    iniciar,
    pausar,
    reanudar,
    descartar,
    obtenerTiempos,
    guardarRegistro,
    cargarDatos,
  };
}
