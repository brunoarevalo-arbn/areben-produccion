export type EstadoPago = 'PENDIENTE' | 'PARCIAL' | 'PAGADA';

// Deriva el estado de pago del monto pagado vs el total, y acota el pagado a
// [0, total]. Evita marcar PAGADA con monto parcial (deuda fantasma) o pagar de
// más. Es la fuente de verdad: los endpoints derivan el estado, no confían en el
// que mande el cliente.
export function resolverPago(total: number, montoPagado: number): { estadoPago: EstadoPago; montoPagado: number } {
  const t = Math.max(0, total);
  const pagado = Math.min(Math.max(0, montoPagado || 0), t);
  const estadoPago: EstadoPago = pagado <= 0 ? 'PENDIENTE' : pagado >= t ? 'PAGADA' : 'PARCIAL';
  return { estadoPago, montoPagado: pagado };
}
