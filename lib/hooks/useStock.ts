'use client';

import { useState, useCallback } from 'react';
import { TipoMovimiento } from '@/types/stock';

export function useStock() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const registrarMovimiento = useCallback(async (
    productoId: string,
    tipo: TipoMovimiento,
    cantidad: number,
    nota?: string,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productoId, tipo, cantidad, nota }),
      });
      if (!res.ok) throw new Error('Error registrando movimiento');
      return await res.json();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, registrarMovimiento };
}
