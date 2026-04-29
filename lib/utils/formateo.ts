export function formatPeso(valor: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(valor);
}

export function formatFecha(fecha: Date | string): string {
  return new Date(fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatHora(hora: string | null | undefined): string {
  return hora ?? '--:--';
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
