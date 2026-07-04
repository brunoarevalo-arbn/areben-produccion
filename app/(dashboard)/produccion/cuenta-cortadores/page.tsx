import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';
const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

// Hub de cuenta corriente: cada cortador con su saldo pendiente (cortes + muestras sin pagar).
export default async function CuentaCortadoresPage() {
  const [cortadores, ops, muestras] = await Promise.all([
    prisma.cortador.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
    prisma.ordenProduccion.findMany({ where: { fichaCorteCargada: true, costoCorte: { gt: 0 }, pagoCorteId: null, cortadorId: { not: null } }, select: { cortadorId: true, costoCorte: true } }),
    prisma.corteMuestra.findMany({ where: { estado: 'validado', pagoCorteId: null }, select: { cortadorId: true, valor: true } }),
  ]);

  const saldo = new Map<string, { cortes: number; nCortes: number; muestras: number; nMuestras: number }>();
  const get = (id: string) => { if (!saldo.has(id)) saldo.set(id, { cortes: 0, nCortes: 0, muestras: 0, nMuestras: 0 }); return saldo.get(id)!; };
  for (const o of ops) { const s = get(o.cortadorId!); s.cortes += Number(o.costoCorte); s.nCortes++; }
  for (const m of muestras) { const s = get(m.cortadorId); s.muestras += Number(m.valor); s.nMuestras++; }

  const filas = cortadores.map((c) => { const s = saldo.get(c.id) ?? { cortes: 0, nCortes: 0, muestras: 0, nMuestras: 0 }; return { ...c, ...s, total: s.cortes + s.muestras }; });
  const totalGeneral = filas.reduce((t, f) => t + f.total, 0);

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader eyebrow="Producción" title="Cuenta de cortadores" subtitle="Saldo pendiente de cada cortador (cortes + muestras sin pagar). Entrá para pagar." />

      <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
        {filas.map((f) => (
          <Link key={f.id} href={`/produccion/cuenta-cortadores/${f.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-stone-50 transition">
            <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-bold shrink-0">{f.nombre.charAt(0).toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-stone-900">{f.nombre}</p>
              <p className="text-xs text-stone-400">{f.nCortes} corte(s){f.nMuestras > 0 ? ` · ${f.nMuestras} muestra(s)` : ''} pendiente(s)</p>
            </div>
            <div className="text-right">
              <p className={`font-bold tabular-nums ${f.total > 0 ? 'text-amber-700' : 'text-stone-300'}`}>{fmt$(f.total)}</p>
              <p className="text-xs text-stone-400">saldo</p>
            </div>
          </Link>
        ))}
        {filas.length === 0 && <div className="px-5 py-10 text-center text-sm text-stone-400">No hay cortadores activos.</div>}
      </div>

      <div className="mt-4 flex justify-end text-sm text-stone-500">Total pendiente: <strong className="text-stone-800 ml-2 tabular-nums">{fmt$(totalGeneral)}</strong></div>
    </div>
  );
}
