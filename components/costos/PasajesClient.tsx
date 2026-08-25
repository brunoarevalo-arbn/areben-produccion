'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SkuChip } from '@/components/ui/SkuChip';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { CopiarResumen } from '@/components/costos/CopiarResumen';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { toast } from '@/components/ui/Toaster';
import { useParamState } from '@/lib/hooks/useParamState';

interface Salida {
  sku: string; talle: string; tipo: string; cantidad: number; marca: string | null;
  costoUnitario: number | null; costoTotal: number | null; motivo: string | null;
  desde: string; hasta: string;
}
interface Grupo {
  marca: string | null; costeadas: Salida[]; sinCosto: Salida[];
  unidades: number; totalNeto: number; desde: string | null; hasta: string | null;
}
interface Cerrado {
  id: string; marca: string; periodo: string; desde: string; hasta: string;
  unidades: number; totalNeto: number; items: number; notas: string | null;
  creadoPor: string; createdAt: string;
}

const fmt$ = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function PasajesClient() {
  const [pendientes, setPendientes] = useState<Grupo[]>([]);
  const [cerrados, setCerrados]     = useState<Cerrado[]>([]);
  const [loading, setLoading]       = useState(true);
  const [cerrando, setCerrando]     = useState<string | null>(null);
  const [subTab, setSubTab] = useParamState<'pendientes' | 'cerrados'>('tab', 'pendientes');

  // Sin `setLoading(true)` acá: arranca en true y las recargas posteriores repintan solas.
  // Un setState síncrono dentro del efecto dispara renders en cascada (y lo marca el lint).
  const cargar = useCallback(() => {
    fetch('/api/costos/pasajes')
      .then((r) => r.ok ? r.json() : { pendientes: [], cerrados: [] })
      .then((d) => { setPendientes(d.pendientes ?? []); setCerrados(d.cerrados ?? []); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const cerrar = async (g: Grupo) => {
    if (!g.marca) return;
    const ok = await confirmAsync({
      message: `Se cierra el pasaje de ${g.marca}: ${g.unidades} unidades por ${fmt$(g.totalNeto)} sin IVA. Las salidas quedan selladas y no se vuelven a listar. ¿Cerrar?`,
      confirmLabel: 'Cerrar el pasaje',
    });
    if (!ok) return;
    setCerrando(g.marca);
    const r = await fetch('/api/costos/pasajes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marca: g.marca }),
    });
    setCerrando(null);
    if (r.ok) { toast.success('Pasaje cerrado'); setSubTab('cerrados'); cargar(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo cerrar'); }
  };

  const anular = async (p: Cerrado) => {
    const ok = await confirmAsync({
      message: `Anular el pasaje de ${p.marca} ${p.periodo} (${fmt$(p.totalNeto)})? Las salidas vuelven a la lista de pendientes. Si ya lo cargaste en el dashboard, corregilo también allá.`,
      danger: true, confirmLabel: 'Anular',
    });
    if (!ok) return;
    const r = await fetch(`/api/costos/pasajes/${p.id}`, { method: 'DELETE' });
    if (r.ok) { toast.success('Pasaje anulado'); cargar(); } else toast.error('No se pudo anular');
  };

  if (loading) return <LoadingState />;

  const pill = (activo: boolean) =>
    `px-4 py-2 text-sm font-semibold rounded-xl transition ${activo ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500 hover:text-stone-800'}`;

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <button onClick={() => setSubTab('pendientes')} className={pill(subTab === 'pendientes')}>
          Sin pasar{pendientes.length > 0 ? ` (${pendientes.length})` : ''}
        </button>
        <button onClick={() => setSubTab('cerrados')} className={pill(subTab === 'cerrados')}>
          Pasajes cerrados{cerrados.length > 0 ? ` (${cerrados.length})` : ''}
        </button>
      </div>

      {subTab === 'pendientes' && (
        <div className="space-y-5">
          {pendientes.length === 0 && (
            <EmptyState message="No hay salidas de producto terminado sin pasar. Las salidas se cargan en Inventario → Producto terminado, con origen «Venta»." />
          )}
          {pendientes.map((g) => (
            <Card key={g.marca ?? 'sin-marca'} padding="none" className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-bold text-stone-900">{g.marca ?? 'Sin marca reconocida'}</h3>
                  <p className="text-xs text-stone-400">
                    {g.desde && g.hasta ? `Salidas del ${fecha(g.desde)} al ${fecha(g.hasta)}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Total sin IVA</p>
                  <p className="text-xl font-bold tabular-nums text-stone-900">{fmt$(g.totalNeto)}</p>
                  <p className="text-xs text-stone-400 tabular-nums">{g.unidades} unidades</p>
                </div>
              </div>

              {g.costeadas.length > 0 && (
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500">
                      <th className="text-left py-2 font-semibold">SKU</th>
                      <th className="text-left py-2 font-semibold w-20">Talle</th>
                      <th className="text-right py-2 font-semibold w-16">Cant</th>
                      <th className="text-right py-2 font-semibold w-32">$ unitario</th>
                      <th className="text-right py-2 font-semibold w-32">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.costeadas.map((f) => (
                      <tr key={`${f.sku}|${f.talle}|${f.tipo}`} className="border-b border-stone-100">
                        <td className="py-2"><SkuChip sku={f.sku} /></td>
                        <td className="py-2 text-stone-600">{f.talle}</td>
                        <td className="py-2 text-right tabular-nums text-stone-700">{f.cantidad}</td>
                        <td className="py-2 text-right tabular-nums text-stone-600">{fmt$(f.costoUnitario!)}</td>
                        <td className="py-2 text-right tabular-nums font-semibold text-stone-900">{fmt$(f.costoTotal!)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}

              {/* Sin escandallo no hay total: se dice QUÉ falta en vez de mostrar un número incompleto. */}
              {g.sinCosto.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                  <p className="text-sm font-semibold text-amber-800 mb-2">
                    Falta costear {g.sinCosto.length} línea(s) — hasta que estén, el pasaje no se puede cerrar
                  </p>
                  <div className="space-y-1">
                    {g.sinCosto.map((f) => (
                      <div key={`${f.sku}|${f.talle}|${f.tipo}`} className="flex items-baseline gap-2 text-sm">
                        <SkuChip sku={f.sku} />
                        <span className="text-stone-500">{f.talle} · {f.cantidad} u</span>
                        <span className="text-xs text-amber-700">{f.motivo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 flex-wrap items-center">
                <Button onClick={() => cerrar(g)} disabled={!g.marca || g.sinCosto.length > 0 || g.costeadas.length === 0 || cerrando === g.marca}>
                  {cerrando === g.marca ? 'Cerrando…' : 'Cerrar el pasaje'}
                </Button>
                {!g.marca && (
                  <span className="text-xs text-stone-500">
                    Sin marca no se puede cerrar: estos SKU no tienen una orden de producción que diga de qué marca son.
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {subTab === 'cerrados' && (
        <div className="space-y-3">
          {cerrados.length === 0 && <EmptyState message="Todavía no se cerró ningún pasaje." />}
          {cerrados.map((p) => (
            <Card key={p.id} padding="none" className="p-5 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-stone-900">{p.marca} · {p.periodo}</p>
                <p className="text-xs text-stone-400">
                  {fecha(p.desde)} al {fecha(p.hasta)} · {p.items} líneas · {p.unidades} unidades · cerrado por {p.creadoPor}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Total sin IVA</p>
                <p className="text-lg font-bold tabular-nums text-stone-900">{fmt$(p.totalNeto)}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <CopiarResumen compact label="📋 Copiar" texto={[
                  `*Compra ${p.marca} a Areben — ${p.periodo}*`,
                  `Salidas del ${fecha(p.desde)} al ${fecha(p.hasta)}`,
                  `${p.unidades} unidades · ${p.items} líneas`,
                  ``,
                  `💵 Total sin IVA: $${Math.round(p.totalNeto).toLocaleString('es-AR')}`,
                ].join('\n')} />
                <a href={`/costos/pasajes/${p.id}`}
                  className="text-xs px-3 py-1.5 rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-50 transition">
                  Ver detalle
                </a>
                <button onClick={() => anular(p)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">
                  Anular
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
