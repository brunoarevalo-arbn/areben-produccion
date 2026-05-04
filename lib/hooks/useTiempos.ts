// lib/hooks/useTiempos.ts

'use client';

import { useState, useRef, useEffect } from 'react';
import { TiemposProduccion, TareaCurso } from '@/types/tiempos';
import { crearTiempo, getTiempos } from '@/lib/api/tiempos';

const MAX_AGE_MS = 9 * 60 * 60 * 1000; // 9 horas
const storageKey = (usuario: string) => `cronometro:${usuario}`;

function formatDisplay(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function useTiempos(usuario: string) {
  const [registros, setRegistros] = useState<TiemposProduccion[]>([]);
  const [tareaEnCurso, setTareaEnCurso] = useState<TareaCurso | null>(null);
  const [cronometroActivo, setCronometroActivo] = useState(false);
  const [tiempoDisplay, setTiempoDisplay] = useState('00:00:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const horaInicioRef = useRef<Date | null>(null);
  const cronometroIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Cargar datos al iniciar
  useEffect(() => {
    if (usuario) {
      cargarDatos();
    }
  }, [usuario]);

  // Restaurar cronómetro desde localStorage si quedó pendiente
  useEffect(() => {
    if (!usuario || typeof window === 'undefined') return;

    const raw = localStorage.getItem(storageKey(usuario));
    if (!raw) return;

    try {
      const { horaInicio, horaFin } = JSON.parse(raw) as { horaInicio: string; horaFin?: string };
      const inicio = new Date(horaInicio);
      if (isNaN(inicio.getTime()) || Date.now() - inicio.getTime() > MAX_AGE_MS) {
        localStorage.removeItem(storageKey(usuario));
        return;
      }

      horaInicioRef.current = inicio;

      if (horaFin) {
        // Tarea ya detenida, esperando guardar
        const fin = new Date(horaFin);
        const ms = fin.getTime() - inicio.getTime();
        const display = formatDisplay(ms);
        setTiempoDisplay(display);
        setTareaEnCurso({
          horaInicio: inicio,
          horaFin: fin,
          minutosNetos: Math.floor(ms / 60000),
          tiempoDisplay: display,
        });
      } else {
        // Cronómetro estaba corriendo
        setTareaEnCurso({
          horaInicio: inicio,
          minutosNetos: 0,
          tiempoDisplay: formatDisplay(Date.now() - inicio.getTime()),
        });
        setCronometroActivo(true);
      }
    } catch {
      localStorage.removeItem(storageKey(usuario));
    }
  }, [usuario]);

  // Cronómetro
  useEffect(() => {
    if (!cronometroActivo || !horaInicioRef.current) return;

    cronometroIntervalRef.current = setInterval(() => {
      if (!horaInicioRef.current) return;
      setTiempoDisplay(formatDisplay(Date.now() - horaInicioRef.current.getTime()));
    }, 100);

    return () => clearInterval(cronometroIntervalRef.current);
  }, [cronometroActivo]);

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

  const iniciarTarea = () => {
    const ahora = new Date();
    horaInicioRef.current = ahora;
    setCronometroActivo(true);
    setTareaEnCurso({
      horaInicio: ahora,
      minutosNetos: 0,
      tiempoDisplay: '00:00:00',
    });
    if (typeof window !== 'undefined' && usuario) {
      localStorage.setItem(storageKey(usuario), JSON.stringify({ horaInicio: ahora.toISOString() }));
    }
  };

  const terminarTarea = () => {
    if (!horaInicioRef.current) return;

    const horaFin = new Date();
    const minutosNetos = Math.floor(
      (horaFin.getTime() - horaInicioRef.current.getTime()) / 60000
    );

    setCronometroActivo(false);
    setTareaEnCurso({
      horaInicio: horaInicioRef.current,
      horaFin,
      minutosNetos,
      tiempoDisplay,
    });

    if (typeof window !== 'undefined' && usuario) {
      localStorage.setItem(storageKey(usuario), JSON.stringify({
        horaInicio: horaInicioRef.current.toISOString(),
        horaFin: horaFin.toISOString(),
      }));
    }

    return {
      horaInicio: horaInicioRef.current.toTimeString().split(' ')[0],
      horaFin: horaFin.toTimeString().split(' ')[0],
      minutosNetos,
    };
  };

  const guardarRegistro = async (tiempo: TiemposProduccion) => {
    try {
      setLoading(true);
      const resultado = await crearTiempo(tiempo);

      const nuevos = [...registros, resultado];
      setRegistros(nuevos);

      setTareaEnCurso(null);
      setCronometroActivo(false);
      setTiempoDisplay('00:00:00');
      horaInicioRef.current = null;

      if (typeof window !== 'undefined' && usuario) {
        localStorage.removeItem(storageKey(usuario));
      }

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
    tareaEnCurso,
    cronometroActivo,
    tiempoDisplay,
    loading,
    error,
    iniciarTarea,
    terminarTarea,
    guardarRegistro,
    cargarDatos,
  };
}
