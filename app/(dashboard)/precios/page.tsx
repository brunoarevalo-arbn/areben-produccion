import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { construirFilasPrecios } from '@/lib/costos/preciosData';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const pct = (n: number | null) => (n == null ? '—' : `${(Math.round(n * 10) / 10).toString().replace('.', ',')}%`);
const margenColor = (m: number | null) => (m == null ? 'text-stone-400' : m < 40 ? 'text-red-600' : m < 55 ? 'text-amber-600' : 'text-emerald-700');
const UMBRAL_MARGEN = 40;

export default async function PreciosResumenPage() {
  const { filas } = await construirFilasPrecios();

  const total = filas.length;
  const conCosto = filas.filter((f) => f.costoNeto != null).length;
  const conPvp = filas.filter((f) => f.pvpEfectivo != null).length;
  const conMargen = filas.filter((f) => f.margen != null);
  const margenProm = conMargen.length ? conMargen.reduce((s, f) => s + (f.margen ?? 0), 0) / conMargen.length : null;

  // Margen promedio por marca
  const marcas = [...new Set(filas.map((f) => f.marca).filter(Boolean))].sort();
  const porMarca = marcas.map((m) => {
    const fm = filas.filter((f) => f.marca === m && f.margen != null);
    const prom = fm.length ? fm.reduce((s, f) => s + (f.margen ?? 0), 0) / fm.length : null;
    return { marca: m, n: filas.filter((f) => f.marca === m).length, margen: prom };
  });

  const sinCosto = filas.filter((f) => f.costoNeto == null);
  const margenBajo = filas.filter((f) => f.margen != null && f.margen < UMBRAL_MARGEN);

  const Tile = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) => (
    <Card padding="none" className="p-4">
      <p className="text-xs font-semibold text-stone-500">{label}</p>
      <p className={`text-2xl font-bold tabular-nums mt-1 ${color ?? 'text-stone-800'}`}>{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
    </Card>
  );

  return (
    <div className="p-8">
      <PageHeader eyebrow="Precios" title="Resumen" subtitle="Estado de precios, costos y márgenes de los productos vinculados." />

      {total === 0 ? (
        <Card padding="none" className="p-8 text-center text-stone-500">
          No hay productos vinculados todavía. Vinculá productos en Reposición → Vincular productos.
        </Card>
      ) : (
        <div className="space-y-6 max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Tile label="Productos" value={fmt.format(total)} sub="vinculados de producción propia" />
            <Tile label="Con costo" value={`${conCosto}/${total}`} sub={sinCosto.length ? `${sinCosto.length} sin costo` : 'todos con costo'} color={sinCosto.length ? 'text-amber-600' : 'text-emerald-700'} />
            <Tile label="Con precio (PVP)" value={`${conPvp}/${total}`} sub={conPvp < total ? `${total - conPvp} sin PVP` : 'todos con PVP'} color={conPvp < total ? 'text-amber-600' : 'text-emerald-700'} />
            <Tile label="Margen promedio" value={pct(margenProm)} sub="sobre PVP neto" color={margenColor(margenProm)} />
          </div>

          {/* Por marca */}
          <Card padding="none" className="p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-3">Margen promedio por marca</p>
            <div className="flex flex-wrap gap-6">
              {porMarca.map((m) => (
                <div key={m.marca}>
                  <p className="text-sm font-semibold text-stone-700">{m.marca} <span className="text-xs font-normal text-stone-400">· {m.n} prod.</span></p>
                  <p className={`text-xl font-bold tabular-nums ${margenColor(m.margen)}`}>{pct(m.margen)}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Alertas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card padding="none" className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Sin costo cargado</p>
                <span className={`text-xs font-bold ${sinCosto.length ? 'text-amber-600' : 'text-emerald-700'}`}>{sinCosto.length}</span>
              </div>
              {sinCosto.length === 0 ? (
                <p className="text-sm text-stone-400">Todos los productos tienen costo. 👌</p>
              ) : (
                <ul className="space-y-1 text-sm text-stone-600">
                  {sinCosto.slice(0, 8).map((f) => <li key={f.gnId} className="truncate">{f.nombre} <span className="text-stone-400 text-xs">· {f.skuLiso}</span></li>)}
                  {sinCosto.length > 8 && <li className="text-xs text-stone-400">y {sinCosto.length - 8} más…</li>}
                </ul>
              )}
              <Link href="/precios/lista" className="text-xs font-semibold text-amber-700 hover:underline mt-3 inline-block">Ir a la lista →</Link>
            </Card>

            <Card padding="none" className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Margen bajo ({'<'} {UMBRAL_MARGEN}%)</p>
                <span className={`text-xs font-bold ${margenBajo.length ? 'text-red-600' : 'text-emerald-700'}`}>{margenBajo.length}</span>
              </div>
              {margenBajo.length === 0 ? (
                <p className="text-sm text-stone-400">Ningún producto con margen bajo. 👌</p>
              ) : (
                <ul className="space-y-1 text-sm text-stone-600">
                  {margenBajo.slice(0, 8).map((f) => (
                    <li key={f.gnId} className="flex justify-between gap-2">
                      <span className="truncate">{f.nombre}</span>
                      <span className={`shrink-0 font-semibold ${margenColor(f.margen)}`}>{pct(f.margen)}</span>
                    </li>
                  ))}
                  {margenBajo.length > 8 && <li className="text-xs text-stone-400">y {margenBajo.length - 8} más…</li>}
                </ul>
              )}
              <Link href="/precios/lista" className="text-xs font-semibold text-amber-700 hover:underline mt-3 inline-block">Ir a la lista →</Link>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
