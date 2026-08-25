import Link from 'next/link';
import { EstadoPagoBadge } from '@/components/ui/EstadoPagoBadge';
import { Card } from '@/components/ui/Card';

interface GastoDetalleProps {
  gasto: {
    id: string; categoria: string; tipo: string; marca: string | null; sku: string | null;
    monto: number; concepto: string | null; fecha: string; creadoPor: string;
    proveedorNombre: string | null; numeroFactura: string | null;
    estadoPago: string | null; montoPagado: number | null; fechaPago: string | null; formaPago: string | null;
  };
}

const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

export function GastoDetalle({ gasto: g, volver = '/compras' }: GastoDetalleProps & { volver?: string }) {
  return (
    <div className="max-w-2xl">
      <Link href={volver} className="text-sm text-stone-500 hover:text-stone-800 transition">← Volver a Compras</Link>

      <Card padding="none" className="p-6 mt-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900">{g.proveedorNombre || 'Gasto sin proveedor'}</h2>
            <p className="text-xs text-stone-400 mt-0.5 capitalize">{g.categoria} · {g.tipo}{g.numeroFactura ? ` · Factura ${g.numeroFactura}` : ''}</p>
          </div>
          <span className="text-2xl font-bold text-stone-900 tabular-nums">{fmt$(g.monto)}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {g.concepto && <div className="col-span-2"><span className="text-stone-400">Concepto: </span>{g.concepto}</div>}
          {g.sku && <div><span className="text-stone-400">SKU: </span><span className="font-mono">{g.sku}</span></div>}
          {g.marca && <div><span className="text-stone-400">Marca: </span>{g.marca}</div>}
          <div><span className="text-stone-400">Fecha: </span>{g.fecha}</div>
          <div><span className="text-stone-400">Cargado por: </span>{g.creadoPor}</div>
        </div>

        {g.estadoPago && (
          <div className="mt-4 pt-4 border-t border-stone-100">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Pago</p>
            <div className="flex items-center gap-3 text-sm">
              <EstadoPagoBadge estado={g.estadoPago} />
              {g.montoPagado != null && <span className="text-stone-500">Pagado: <strong>{fmt$(g.montoPagado)}</strong></span>}
              {g.fechaPago && <span className="text-stone-500">el {g.fechaPago}</span>}
              {g.formaPago && <span className="text-stone-500">· {g.formaPago}</span>}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
