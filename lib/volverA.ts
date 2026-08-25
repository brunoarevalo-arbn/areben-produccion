// `?volverA=` guarda a qué URL volver desde una pantalla de detalle (con la solapa y los
// filtros de la lista de la que se vino). Se valida siempre antes de usarla: es un valor
// que llega por query, y un `//otro-host` también empieza con "/" — sin este filtro el
// "← Volver" se vuelve un redirect abierto.
export function volverASeguro(valor: string | null | undefined, fallback: string): string {
  if (!valor) return fallback;
  if (!valor.startsWith('/') || valor.startsWith('//')) return fallback;
  return valor;
}
