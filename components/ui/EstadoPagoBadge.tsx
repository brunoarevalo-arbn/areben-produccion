import { Badge } from './Badge';

// Badge único para estado de pago. Antes había 4+ mapas `ESTADO_PAGO_COLOR`
// duplicados y spans sueltos → el mismo estado se veía distinto en pantallas
// que se comparan lado a lado.
const VARIANT: Record<string, 'amber' | 'blue' | 'success'> = {
  PENDIENTE: 'amber',
  PARCIAL: 'blue',
  PAGADA: 'success',
};

export function EstadoPagoBadge({ estado, className = '' }: { estado: string; className?: string }) {
  return (
    <Badge variant={VARIANT[estado] ?? 'default'} className={className}>
      {estado.toLowerCase()}
    </Badge>
  );
}
