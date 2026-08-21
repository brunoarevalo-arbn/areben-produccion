import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { cuentaPorCortador, pagosSinCortador } from '@/lib/produccion/cuenta-cortador';

export const dynamic = 'force-dynamic';
const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

// Hub de cuenta corriente: todo lo cortado menos todo lo pagado, por cortador.
// La regla vive entera en lib/produccion/cuenta-cortador.ts — acá no se arma ninguna query
// de plata, para que no vuelva a haber cuatro copias de la misma fórmula.
export default async function CuentaCortadoresPage() {
  const [cortadores, cuentas, huerfanos] = await Promise.all([
    prisma.cortador.findMany({ orderBy: { nombre: 'asc' }, select: { id: true, nombre: true, activo: true } }),
    cuentaPorCortador(),
    pagosSinCortador(),
  ]);

  // Los dados de baja se muestran igual si tienen plata en juego: si no, el saldo
  // desaparece de la pantalla con el cortador adentro.
  const filas = cortadores
    .map((c) => ({ ...c, cuenta: cuentas.get(c.id) }))
    .filter((f) => f.activo || (f.cuenta && f.cuenta.saldo !== 0));

  const deudaTotal = filas.reduce((t, f) => t + Math.max(0, f.cuenta?.saldo ?? 0), 0);
  const favorTotal = filas.reduce((t, f) => t + Math.max(0, -(f.cuenta?.saldo ?? 0)), 0);
  const totalHuerfanos = huerfanos.reduce((t, p) => t + p.montoTotal, 0);

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader eyebrow="Producción" title="Cuenta de cortadores" subtitle="Cuenta corriente: todo lo cortado menos todo lo pagado. Entrá para ver el detalle y pagar." />

      {huerfanos.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
          <strong>{huerfanos.length} pago(s) sin cortador ({fmt$(totalHuerfanos)})</strong> — no se están sumando a ninguna cuenta.
          Se arreglan asignándoles el cortador: <span className="font-mono text-xs">npx tsx prisma/migrate-pago-cortador-ago26.ts --aplicar</span>
        </div>
      )}

      <Card padding="none" className="divide-y divide-stone-100">
        {filas.map((f) => {
          const c = f.cuenta;
          const saldo = c?.saldo ?? 0;
          return (
            <Link key={f.id} href={`/produccion/cuenta-cortadores/${f.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50 transition">
              <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-bold shrink-0">{f.nombre.charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-stone-900">{f.nombre}{!f.activo && <span className="text-xs font-normal text-stone-400"> · dado de baja</span>}</p>
                <p className="text-xs text-stone-400">
                  {fmt$(c?.deuda ?? 0)} cortado ({c?.nCortes ?? 0} corte{c?.nMuestras ? ` · ${c.nMuestras} muestra` : ''}) · {fmt$(c?.pagos ?? 0)} pagado ({c?.nPagos ?? 0})
                </p>
              </div>
              <div className="text-right">
                <p className={`font-bold tabular-nums ${saldo > 0 ? 'text-amber-700' : saldo < 0 ? 'text-emerald-600' : 'text-stone-300'}`}>{fmt$(Math.abs(saldo))}</p>
                <p className="text-xs text-stone-400">{saldo < 0 ? 'a favor' : 'saldo'}</p>
              </div>
            </Link>
          );
        })}
        {filas.length === 0 && <div className="px-5 py-10 text-center text-sm text-stone-400">No hay cortadores activos.</div>}
      </Card>

      {/* Deuda y saldo a favor van separados: sumados con signo, un cortador a favor tapa
          la deuda de otro y el total no dice nada. */}
      <div className="mt-4 flex justify-end gap-6 text-sm text-stone-500">
        <span>Se debe: <strong className="text-amber-700 ml-1 tabular-nums">{fmt$(deudaTotal)}</strong></span>
        {favorTotal > 0 && <span>A favor: <strong className="text-emerald-600 ml-1 tabular-nums">{fmt$(favorTotal)}</strong></span>}
      </div>
    </div>
  );
}
