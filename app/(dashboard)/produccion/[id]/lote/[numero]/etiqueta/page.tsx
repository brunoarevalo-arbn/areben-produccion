import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PrintButton } from '@/components/costos/PrintButton';
import { volverASeguro } from '@/lib/volverA';
import { estadoDeLotes } from '@/lib/produccion/lotesPlanificados';
import { tallesCortados } from '@/lib/produccion/cantidades';
import { DESPUES_DE_LOTE_1, ordenarTalles } from '@/lib/constants/lotes';

export const dynamic = 'force-dynamic';

// La etiqueta de la BOLSA de producción: qué orden es, qué lote ("Lote 2 de 2") y qué
// talles lleva adentro. Es lo que mira la costurera para decirle a la tablet de qué lote
// son los minutos. Una orden sin separar tiene una sola: "Lote 1 de 1", con todo el corte.
export default async function EtiquetaLotePage({ params, searchParams }: {
  params: Promise<{ id: string; numero: string }>;
  searchParams: Promise<{ volverA?: string }>;
}) {
  const { id, numero: numeroTxt } = await params;
  const volver = volverASeguro((await searchParams).volverA, `/produccion/${id}`);
  const numero = Number(numeroTxt);
  if (!Number.isInteger(numero) || numero < 1) notFound();

  const orden = await prisma.ordenProduccion.findUnique({ where: { id }, include: { cortesPorTalle: true } });
  if (!orden) notFound();

  const lotes = await estadoDeLotes(prisma, orden);
  let talles: { talle: string; cantidad: number }[];
  let total: number;
  let despuesDe: string | null = null;
  let fecha: Date;
  if (lotes.length > 0) {
    const lote = lotes.find((l) => l.numero === numero);
    if (!lote) notFound();
    talles = lote.talles;
    despuesDe = lote.despuesDe === DESPUES_DE_LOTE_1 ? null : lote.despuesDe;
    fecha = lote.separadoAt;
    total = lotes.length;
  } else {
    if (numero !== 1) notFound();
    talles = ordenarTalles(tallesCortados(orden) ?? []);
    fecha = orden.fechaCorte ?? orden.createdAt;
    total = 1;
  }
  const unidades = talles.reduce((s, t) => s + t.cantidad, 0);

  return (
    <div className="p-8 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link href={volver} className="text-sm text-stone-500 hover:text-stone-800 transition">← Volver</Link>
        <PrintButton />
      </div>

      <div className="etiqueta bg-white rounded-xl border-2 border-stone-900 p-6 space-y-4 print:rounded-none">
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-500 font-bold">{orden.marca} · Producción</p>
          <h1 className="text-2xl font-bold font-mono text-stone-900 mt-1 break-all">{orden.sku ?? 'S/SKU'}</h1>
          {orden.descripcion && <p className="text-sm text-stone-700 mt-1 leading-snug">{orden.descripcion}</p>}
        </div>

        <div className="bg-stone-900 text-white rounded-lg px-4 py-3 text-center">
          <p className="text-4xl font-black tracking-wide">LOTE {numero}</p>
          <p className="text-sm opacity-80">de {total}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {talles.map((t) => (
            <div key={t.talle} className="flex-1 min-w-[4.5rem] border-2 border-stone-300 rounded-lg px-3 py-2 text-center">
              <p className="text-sm font-bold text-stone-500">{t.talle}</p>
              <p className="text-3xl font-black text-stone-900 tabular-nums">{t.cantidad}</p>
            </div>
          ))}
        </div>
        <p className="text-right text-lg font-bold text-stone-900">Total: {unidades} u</p>

        <p className="text-xs text-stone-500 border-t border-stone-200 pt-3">
          {despuesDe ? <>Separado después de <strong className="text-stone-800">{despuesDe}</strong> · </> : null}
          {fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </p>
      </div>

      {/* 10 × 15 cm: el tamaño de una etiqueta de bolsa. Si la impresora pide otro, se cambia acá. */}
      <style>{`
        @media print {
          @page { size: 100mm 150mm; margin: 5mm; }
          html, body { background: #fff !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print\\:hidden { display: none !important; }
          .etiqueta { border-width: 2px; }
        }
      `}</style>
    </div>
  );
}
