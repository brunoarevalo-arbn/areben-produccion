export async function getReporteProduccion(fecha: string, usuario?: string) {
  const params = new URLSearchParams({ fecha });
  if (usuario) params.set('usuario', usuario);
  const res = await fetch(`/api/reportes?${params}`);
  if (!res.ok) throw new Error('Error obteniendo reporte');
  return res.json();
}
