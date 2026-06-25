'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LoadingState } from '@/components/ui/LoadingState';

interface RolloResumen { id: string; codigo: string; pesoActual: string; costoUnitario: string; estado: string; colorId: string | null; colorProveedor: string | null; compra: { proveedor: { nombre: string } }; }
interface LoteResumen  { id: string; codigo: string; cantidadActual: string; costoUnitario: string; estado: string; colorId: string | null; colorProveedor: string | null; compra: { proveedor: { nombre: string } }; }
interface InsumoConStock {
  id: string;
  nombre: string;
  categoria: string;
  tipoTrazabilidad: string;
  unidadDefault: string;
  stockMinimo: string | null;
  activo: boolean;
  stockTotal: number;
  rollos: RolloResumen[];
  lotes: LoteResumen[];
}

const ESTADO_COLOR: Record<string, string> = {
  DISPONIBLE:      'bg-emerald-100 text-emerald-700',
  EN_USO_PARCIAL:  'bg-amber-100 text-amber-700',
  AGOTADO:         'bg-stone-100 text-stone-500',
  DESCARTADO:      'bg-red-100 text-red-600',
};

export function InsumosClient({ categoriaInicial = '' }: { categoriaInicial?: string } = {}) {
  const [insumos, setInsumos]   = useState<InsumoConStock[]>([]);
  const [coloresMap, setColoresMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading]   = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState(categoriaInicial);

  useEffect(() => {
    Promise.all([
      fetch('/api/insumos').then((r) => r.ok ? r.json() : []),
      fetch('/api/sku-catalogo?categoria=color').then((r) => r.ok ? r.json() : []),
    ]).then(([ins, colores]) => {
      setInsumos(ins);
      setColoresMap(new Map(colores.map((c: { id: string; nombre: string }) => [c.id, c.nombre])));
    }).finally(() => setLoading(false));
  }, []);

  const categorias = [...new Set(insumos.map((i) => i.categoria))].sort();
  const filtrados = filtroCategoria
    ? insumos.filter((i) => i.categoria === filtroCategoria)
    : insumos;

  const fmt = (n: string | number) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}
          className="px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400">
          <option value="">Todas las categorias</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <Link href="/inventario/compras/nueva"
            className="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
            + Nueva compra
          </Link>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : filtrados.length === 0 ? (
        <p className="text-stone-400 text-sm text-center py-10">Sin insumos. Cargalos desde Configuracion.</p>
      ) : (
        <div className="space-y-3">
          {filtrados.map((ins) => {
            const open = expandido === ins.id;
            const bajoMinimo = ins.stockMinimo != null && ins.stockTotal < Number(ins.stockMinimo);
            return (
              <div key={ins.id} className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <button
                  onClick={() => setExpandido(open ? null : ins.id)}
                  className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-stone-50 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-stone-800">{ins.nombre}</p>
                      <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{ins.categoria}</span>
                      {bajoMinimo && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">Bajo minimo</span>
                      )}
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {ins.tipoTrazabilidad === 'rollo' ? `${ins.rollos.length} rollos` : `${ins.lotes.length} lotes`}
                      {' · '}{ins.unidadDefault}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-stone-800 tabular-nums">{fmt(ins.stockTotal)}</p>
                    <p className="text-xs text-stone-400">{ins.unidadDefault}</p>
                  </div>
                  <span className="text-stone-400 text-sm">{open ? '▲' : '▼'}</span>
                </button>

                {open && (
                  <div className="border-t border-stone-100 px-5 py-3">
                    {(() => {
                      const items = ins.tipoTrazabilidad === 'rollo' ? ins.rollos : ins.lotes;
                      const porColor = new Map<string, { nombre: string; total: number }>();
                      let sinColor = 0;
                      for (const item of items) {
                        const cant = Number('pesoActual' in item ? item.pesoActual : (item as LoteResumen).cantidadActual);
                        if (item.colorId) {
                          const nombre = coloresMap.get(item.colorId) || '?';
                          const prev = porColor.get(item.colorId);
                          porColor.set(item.colorId, { nombre, total: (prev?.total || 0) + cant });
                        } else {
                          sinColor += cant;
                        }
                      }
                      if (porColor.size === 0 && sinColor === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-3 mb-3">
                          {[...porColor.values()].map((v) => (
                            <div key={v.nombre} className="bg-stone-50 rounded-lg px-3 py-1.5 text-xs">
                              <span className="text-stone-500">{v.nombre}:</span>{' '}
                              <span className="font-bold text-stone-800 tabular-nums">{fmt(v.total)}</span>
                            </div>
                          ))}
                          {sinColor > 0 && (
                            <Link href="/inventario/rollos/sin-color" className="bg-amber-50 rounded-lg px-3 py-1.5 text-xs hover:bg-amber-100 transition">
                              <span className="text-amber-600">Sin color:</span>{' '}
                              <span className="font-bold text-amber-800 tabular-nums">{fmt(sinColor)}</span>
                              <span className="text-amber-500 ml-1">→ asignar</span>
                            </Link>
                          )}
                        </div>
                      );
                    })()}
                    {ins.tipoTrazabilidad === 'rollo' ? (
                      ins.rollos.length === 0 ? (
                        <p className="text-xs text-stone-400 py-2">Sin rollos activos</p>
                      ) : (
                        <div className="overflow-x-auto"><table className="w-full text-xs">
                          <thead>
                            <tr className="text-stone-400 uppercase tracking-widest">
                              <th className="text-left py-1.5 font-bold">Codigo</th>
                              <th className="text-left py-1.5 font-bold">Proveedor</th>
                              <th className="text-left py-1.5 font-bold">Color</th>
                              <th className="text-right py-1.5 font-bold">Peso actual</th>
                              <th className="text-right py-1.5 font-bold">$/unidad</th>
                              <th className="text-right py-1.5 font-bold">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ins.rollos.map((r) => (
                              <tr key={r.id} className="border-t border-stone-50">
                                <td className="py-1.5">
                                  <Link href={`/inventario/rollos/${r.id}`} className="font-mono text-stone-700 hover:text-amber-600 transition">
                                    {r.codigo}
                                  </Link>
                                </td>
                                <td className="py-1.5 text-stone-500">{r.compra.proveedor.nombre}</td>
                                <td className="py-1.5">
                                  {r.colorId
                                    ? <span className="text-stone-700">{coloresMap.get(r.colorId) || '?'}</span>
                                    : r.colorProveedor
                                      ? <Link href="/inventario/rollos/sin-color" className="text-stone-400 italic hover:text-amber-600 transition">{r.colorProveedor} <span className="text-amber-500 not-italic">(asignar)</span></Link>
                                      : <Link href="/inventario/rollos/sin-color" className="text-amber-500 hover:underline">— asignar —</Link>}
                                </td>
                                <td className="text-right tabular-nums text-stone-700">{fmt(r.pesoActual)}</td>
                                <td className="text-right tabular-nums text-stone-500">${fmt(r.costoUnitario)}</td>
                                <td className="text-right">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_COLOR[r.estado] || ''}`}>
                                    {r.estado.replace(/_/g, ' ')}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table></div>
                      )
                    ) : (
                      ins.lotes.length === 0 ? (
                        <p className="text-xs text-stone-400 py-2">Sin lotes activos</p>
                      ) : (
                        <div className="overflow-x-auto"><table className="w-full text-xs">
                          <thead>
                            <tr className="text-stone-400 uppercase tracking-widest">
                              <th className="text-left py-1.5 font-bold">Codigo</th>
                              <th className="text-left py-1.5 font-bold">Proveedor</th>
                              <th className="text-left py-1.5 font-bold">Color</th>
                              <th className="text-right py-1.5 font-bold">Cantidad</th>
                              <th className="text-right py-1.5 font-bold">$/unidad</th>
                              <th className="text-right py-1.5 font-bold">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ins.lotes.map((l) => (
                              <tr key={l.id} className="border-t border-stone-50">
                                <td className="py-1.5 font-mono text-stone-700">{l.codigo}</td>
                                <td className="py-1.5 text-stone-500">{l.compra.proveedor.nombre}</td>
                                <td className="py-1.5">
                                  {l.colorId
                                    ? <span className="text-stone-700">{coloresMap.get(l.colorId) || '?'}</span>
                                    : l.colorProveedor
                                      ? <Link href="/inventario/rollos/sin-color" className="text-stone-400 italic hover:text-amber-600 transition">{l.colorProveedor} <span className="text-amber-500 not-italic">(asignar)</span></Link>
                                      : <Link href="/inventario/rollos/sin-color" className="text-amber-500 hover:underline">— asignar —</Link>}
                                </td>
                                <td className="text-right tabular-nums text-stone-700">{fmt(l.cantidadActual)}</td>
                                <td className="text-right tabular-nums text-stone-500">${fmt(l.costoUnitario)}</td>
                                <td className="text-right">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_COLOR[l.estado] || ''}`}>
                                    {l.estado.replace(/_/g, ' ')}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table></div>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
