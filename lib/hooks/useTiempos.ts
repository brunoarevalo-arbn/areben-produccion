// lib/hooks/useTiempos.ts

'use client';

import { useState, useRef, useEffect } from 'react';
import { TiemposProduccion, TareaCurso } from '@/types/tiempos';
import { crearTiempo, getTiempos } from '@/lib/api/tiempos';

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

  // Cronómetro
  useEffect(() => {
    if (!cronometroActivo || !horaInicioRef.current) return;

    cronometroIntervalRef.current = setInterval(() => {
      if (!horaInicioRef.current) return;

      const ahora = new Date();
      const diff = Math.floor(
        (ahora.getTime() - horaInicioRef.current.getTime()) / 1000
      );

      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;

      setTiempoDisplay(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(
          s
        ).padStart(2, '0')}`
      );
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
    horaInicioRef.current = new Date();
    setCronometroActivo(true);
    setTareaEnCurso({
      horaInicio: new Date(),
      minutosNetos: 0,
      tiempoDisplay: '00:00:00',
    });
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
