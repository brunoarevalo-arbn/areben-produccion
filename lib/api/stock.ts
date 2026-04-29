import { TipoMovimiento } from '@/types/stock';

export async function getStock() {
  const res = await fetch('/api/stock');
  if (!res.ok) throw new Error('Error obteniendo stock');
  return res.json();
}

export async function registrarMovimiento(
  productoId: string,
  tipo: TipoMovimiento,
  cantidad: number,
  nota?: string,
) {
  const res = await fetch('/api/stock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productoId, tipo, cantidad, nota }),
  });
  if (!res.ok) throw new Error('Error registrando movimiento');
  return res.json();
}
