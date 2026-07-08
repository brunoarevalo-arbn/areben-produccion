'use client';

import { useState, useRef, useEffect } from 'react';

// Cronómetro puro (sin API ni dominio): iniciar / pausar / reanudar / descartar,
// display en vivo y una foto {horaInicio, horaFin, minutosNetos} al parar. Persiste
// en localStorage para sobrevivir refresh. El `ns` separa cronómetros distintos por
// pantalla (ej. 'estampado') para no pisar el de costura.
const MAX_AGE_MS = 9 * 60 * 60 * 1000; // 9 horas
const storageKey = (ns: string, usuario: string) => `cronometro:${ns}:${usuario}`;

export type EstadoCronometro = 'idle' | 'corriendo' | 'pausado';

function formatDisplay(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function useCronometro(usuario: string, ns = 'default') {
  const [estado, setEstado] = useState<EstadoCronometro>('idle');
  const [tiempoDisplay, setTiempoDisplay] = useState('00:00:00');

  const horaInicioRef  = useRef<Date | null>(null);
  const acumuladoMsRef = useRef(0);
  const segInicioRef   = useRef<Date | null>(null);
  const intervalRef    = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const totalMs = () =>
    acumuladoMsRef.current + (segInicioRef.current ? Date.now() - segInicioRef.current.getTime() : 0);

  const persistir = (est: EstadoCronometro) => {
    if (typeof window === 'undefined' || !usuario) return;
    if (est === 'idle' || !horaInicioRef.current) { localStorage.removeItem(storageKey(ns, usuario)); return; }
    localStorage.setItem(storageKey(ns, usuario), JSON.stringify({
      horaInicio:  horaInicioRef.current.toISOString(),
      acumuladoMs: acumuladoMsRef.current,
      segInicio:   segInicioRef.current ? segInicioRef.current.toISOString() : null,
      estado:      est,
    }));
  };

  // Restaurar cronómetro pendiente tras refresh
  useEffect(() => {
    if (!usuario || typeof window === 'undefined') return;
    const raw = localStorage.getItem(storageKey(ns, usuario));
    if (!raw) return;
    try {
      const d = JSON.parse(raw) as { horaInicio: string; acumuladoMs?: number; segInicio?: string | null; estado?: EstadoCronometro };
      const inicio = new Date(d.horaInicio);
      if (isNaN(inicio.getTime()) || Date.now() - inicio.getTime() > MAX_AGE_MS || typeof d.acumuladoMs !== 'number') {
        localStorage.removeItem(storageKey(ns, usuario)); return;
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
    } catch { localStorage.removeItem(storageKey(ns, usuario)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, ns]);

  useEffect(() => {
    if (estado !== 'corriendo') return;
    intervalRef.current = setInterval(() => setTiempoDisplay(formatDisplay(totalMs())), 100);
    return () => clearInterval(intervalRef.current);
  }, [estado]);

  const iniciar = () => {
    const ahora = new Date();
    horaInicioRef.current = ahora; acumuladoMsRef.current = 0; segInicioRef.current = ahora;
    setTiempoDisplay('00:00:00'); setEstado('corriendo'); persistir('corriendo');
  };
  const pausar = () => {
    if (estado !== 'corriendo' || !segInicioRef.current) return;
    acumuladoMsRef.current += Date.now() - segInicioRef.current.getTime();
    segInicioRef.current = null;
    setTiempoDisplay(formatDisplay(acumuladoMsRef.current)); setEstado('pausado'); persistir('pausado');
  };
  const reanudar = () => {
    if (estado !== 'pausado') return;
    segInicioRef.current = new Date(); setEstado('corriendo'); persistir('corriendo');
  };
  const descartar = () => {
    horaInicioRef.current = null; acumuladoMsRef.current = 0; segInicioRef.current = null;
    setTiempoDisplay('00:00:00'); setEstado('idle'); persistir('idle');
  };
  // Foto para guardar (no resetea; llamar descartar() al guardar OK).
  const obtenerTiempos = () => {
    if (!horaInicioRef.current) return undefined;
    const fin = new Date();
    return {
      horaInicio:   horaInicioRef.current.toTimeString().split(' ')[0],
      horaFin:      fin.toTimeString().split(' ')[0],
      minutosNetos: Math.floor(totalMs() / 60000),
    };
  };

  return { estado, tiempoDisplay, iniciar, pausar, reanudar, descartar, obtenerTiempos };
}
