import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PrintButton } from '@/components/costos/PrintButton';
import { volverASeguro } from '@/lib/volverA';

export const dynamic = 'force-dynamic';

const fmt$ = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fecha = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default async function PasajePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ volverA?: string }> }) {
  const { id } = await params;
  const volver = volverASeguro((await searchParams).volverA, '/costos/pasajes?tab=cerrados');

  const pasaje = await prisma.pasaje.findUnique({
    where: { id },
    include: { items: { orderBy: [{ sku: 'asc' }, { talle: 'asc' }] } },
  });
  if (!pasaje) notFound();

  return (
    <div>
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-stone-200 px-6 py-3 flex items-center gap-4">
        <Link href={volver} className="text-sm text-stone-500 hover:text-stone-800 transition">← Volver</Link>
        <div className="flex-1" />
        <PrintButton />
      </div>

      <div className="max-w-2xl mx-auto px-8 py-10 print:px-0 print:py-0 print:max-w-full">
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-stone-900">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Pasaje a la marca</p>
            <h1 className="text-2xl font-bold text-stone-900">{pasaje.marca} · {pasaje.periodo}</h1>
            <p className="text-sm text-stone-500 mt-1">
              Salidas del {fecha(pasaje.desde)} al {fecha(pasaje.hasta)} · cerrado por {pasaje.creadoPor} el {fecha(pasaje.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-stone-400">Areben</p>
          </div>
        </div>

        <div className="overflow-x-auto"><table className="w-full text-sm print:text-xs">
          <thead>
            <tr className="border-b border-stone-200">
              <th className="text-left py-2 font-semibold text-stone-600 pr-4">SKU</th>
              <th className="text-left py-2 font-semibold text-stone-600 w-20">Talle</th>
              <th className="text-right py-2 font-semibold text-stone-600 w-16">Cant</th>
              <th className="text-right py-2 font-semibold text-stone-600 w-32">$ unitario</th>
              <th className="text-right py-2 font-semibold text-stone-600 w-32">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {pasaje.items.map((i) => (
              <tr key={i.id} className="border-b border-stone-100">
                <td className="py-2 pr-4 font-mono text-stone-800">{i.sku}</td>
                <td className="py-2 text-stone-600">{i.talle}</td>
                <td className="py-2 text-right tabular-nums text-stone-700">{i.cantidad}</td>
                <td className="py-2 text-right tabular-nums text-stone-600">{fmt$(Number(i.costoUnitario))}</td>
                <td className="py-2 text-right tabular-nums font-semibold text-stone-900">{fmt$(Number(i.costoTotal))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-stone-300">
              <td colSpan={2} className="pt-3 font-bold text-stone-700">Total sin IVA</td>
              <td className="pt-3 text-right font-bold tabular-nums text-stone-700">{pasaje.unidades}</td>
              <td />
              <td className="pt-3 text-right font-bold tabular-nums text-stone-900">{fmt$(Number(pasaje.totalNeto))}</td>
            </tr>
          </tfoot>
        </table></div>

        {pasaje.notas && <p className="text-sm text-stone-500 mt-4">{pasaje.notas}</p>}

        {/* El costo del escandallo se arma con precios netos: no hay IVA que sacar. */}
        <p className="text-xs text-stone-400 mt-6 pt-4 border-t border-stone-200">
          Valorizado al costo del escandallo de cada SKU, congelado al cerrar el pasaje: un escandallo
          que cambie después no mueve este total. El importe es <strong>neto, sin IVA</strong>.
        </p>
      </div>
    </div>
  );
}
