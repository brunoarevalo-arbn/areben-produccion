'use client';

interface Movimiento {
  id: string;
  tipo: string;
  cantidad: string;
  motivo: string | null;
  usuarioId: string;
  fecha: string;
  reversionNota: string | null;
}

interface RolloFull {
  id: string;
  codigo: string;
  pesoInicial: string;
  pesoActual: string;
  costoUnitario: string;
  estado: string;
  ubicacion: string | null;
  createdAt: string;
  insumo: { nombre: string; categoria: string; unidadDefault: string };
  color: { nombre: string } | null;
  compra: { id: string; fecha: string; numeroFactura: string | null; proveedor: { nombre: string } };
  movimientos: Movimiento[];
}

const TIPO_COLOR: Record<string, string> = {
  INGRESO:   'bg-emerald-100 text-emerald-700',
  CONSUMO:   'bg-blue-100 text-blue-700',
  AJUSTE:    'bg-amber-100 text-amber-700',
  DESCARTE:  'bg-red-100 text-red-600',
  REVERSION: 'bg-stone-100 text-stone-600',
};

const fmt = (n: string | number) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

export function RolloDetalle({ rollo }: { rollo: RolloFull }) {
  const fechaFmt = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const valorActual = Number(rollo.pesoActual) * Number(rollo.costoUnitario);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-8 text-sm">
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Codigo</p>
            <p className="text-stone-800 font-mono font-bold text-lg">{rollo.codigo}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Insumo</p>
            <p className="text-stone-800 font-medium">{rollo.insumo.nombre}</p>
            <p className="text-xs text-stone-400">
              {rollo.insumo.categoria}{rollo.color ? ` · ${rollo.color.nombre}` : ''}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Proveedor</p>
            <p className="text-stone-800">{rollo.compra.proveedor.nombre}</p>
            <p className="text-xs text-stone-400">{rollo.compra.numeroFactura || '--'}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Estado</p>
            <p className="text-stone-800">{rollo.estado.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Peso inicial</p>
            <p className="text-stone-800 tabular-nums">{fmt(rollo.pesoInicial)} {rollo.insumo.unidadDefault}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Peso actual</p>
            <p className="text-stone-800 tabular-nums font-bold">{fmt(rollo.pesoActual)} {rollo.insumo.unidadDefault}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Costo unitario</p>
            <p className="text-stone-800 tabular-nums">${fmt(rollo.costoUnitario)} / {rollo.insumo.unidadDefault}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Valor actual</p>
            <p className="text-stone-800 tabular-nums font-bold">${fmt(valorActual)}</p>
          </div>
        </div>
        {rollo.ubicacion && (
          <div className="mt-4 pt-4 border-t border-stone-100">
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Ubicacion</p>
            <p className="text-sm text-stone-600">{rollo.ubicacion}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-3">Historial de movimientos</h3>
        {rollo.movimientos.length === 0 ? (
          <p className="text-sm text-stone-400">Sin movimientos</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-stone-400 uppercase tracking-widest border-b border-stone-100">
                <th className="text-left py-2 font-bold">Fecha</th>
                <th className="text-left py-2 font-bold">Tipo</th>
                <th className="text-right py-2 font-bold">Cantidad</th>
                <th className="text-left py-2 font-bold">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {rollo.movimientos.map((m) => (
                <tr key={m.id} className="border-b border-stone-50">
                  <td className="py-2 text-xs text-stone-500 whitespace-nowrap">{fechaFmt(m.fecha)}</td>
                  <td className="py-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TIPO_COLOR[m.tipo] || ''}`}>
                      {m.tipo}
                    </span>
                  </td>
                  <td className={`py-2 text-right tabular-nums font-semibold ${Number(m.cantidad) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {Number(m.cantidad) >= 0 ? '+' : ''}{fmt(m.cantidad)}
                  </td>
                  <td className="py-2 text-xs text-stone-600">{m.motivo || m.reversionNota || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
