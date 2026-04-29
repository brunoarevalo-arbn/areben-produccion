import { Producto, ProductoInput } from '@/types/diseno';

const BASE = '/api/productos';

export async function getProductos(params?: { marca?: string; estado?: string }): Promise<Producto[]> {
  const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
  const res = await fetch(`${BASE}${qs}`);
  if (!res.ok) throw new Error('Error obteniendo productos');
  return res.json();
}

export async function getProducto(id: string): Promise<Producto> {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error('Producto no encontrado');
  return res.json();
}

export async function crearProducto(data: ProductoInput): Promise<Producto> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error creando producto');
  return res.json();
}

export async function actualizarProducto(id: string, data: Partial<ProductoInput>): Promise<Producto> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error actualizando producto');
  return res.json();
}

export async function eliminarProducto(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error eliminando producto');
}
