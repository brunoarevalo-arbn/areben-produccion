'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface RolloResumen { id: string; codigo: string; pesoActual: string; costoUnitario: string; estado: string; }
interface LoteResumen  { id: string; codigo: string; cantidadActual: string; costoUnitario: string; estado: string; }

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

export function InsumosClient() {
  const [insumos, setInsumos]   = useState<InsumoConStock[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState('');

  useEffect(() => {
    fetch('/api/insumos')
      .then((r) => r.ok ? r.json() : [])
      .then(setInsumos)
      .finally(() => setLoading(false));
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
          <Link href="/insumos/compras/nueva"
            className="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
            + Nueva compra
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm text-center py-10">Cargando...</p>
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
                    {ins.tipoTrazabilidad === 'rollo' ? (
                      ins.rollos.length === 0 ? (
                        <p className="text-xs text-stone-400 py-2">Sin rollos activos</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-stone-400 uppercase tracking-widest">
                              <th className="text-left py-1.5 font-bold">Codigo</th>
                              <th className="text-right py-1.5 font-bold">Peso actual</th>
                              <th className="text-right py-1.5 font-bold">$/unidad</th>
                              <th className="text-right py-1.5 font-bold">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ins.rollos.map((r) => (
                              <tr key={r.id} className="border-t border-stone-50">
                                <td className="py-1.5">
                                  <Link href={`/insumos/rollos/${r.id}`} className="font-mono text-stone-700 hover:text-amber-600 transition">
                                    {r.codigo}
                                  </Link>
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
                        </table>
                      )
                    ) : (
                      ins.lotes.length === 0 ? (
                        <p className="text-xs text-stone-400 py-2">Sin lotes activos</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-stone-400 uppercase tracking-widest">
                              <th className="text-left py-1.5 font-bold">Codigo</th>
                              <th className="text-right py-1.5 font-bold">Cantidad</th>
                              <th className="text-right py-1.5 font-bold">$/unidad</th>
                              <th className="text-right py-1.5 font-bold">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ins.lotes.map((l) => (
                              <tr key={l.id} className="border-t border-stone-50">
                                <td className="py-1.5 font-mono text-stone-700">{l.codigo}</td>
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
                        </table>
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
