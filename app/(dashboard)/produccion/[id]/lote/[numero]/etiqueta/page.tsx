import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PrintButton } from '@/components/costos/PrintButton';
import { volverASeguro } from '@/lib/volverA';
import { datosEtiquetaLote } from '@/lib/produccion/etiquetaLote';
import { EtiquetaLote, ESTILO_HOJA_A4 } from '@/components/produccion/EtiquetaLote';
import { SumarAHoja } from '@/components/produccion/HojaEtiquetas';

export const dynamic = 'force-dynamic';

// La etiqueta de un lote suelta. Se imprime en un cuarto de A4, o se suma a la hoja para
// imprimir de a 4 (`/produccion/etiquetas`).
export default async function EtiquetaLotePage({ params, searchParams }: {
  params: Promise<{ id: string; numero: string }>;
  searchParams: Promise<{ volverA?: string }>;
}) {
  const { id, numero } = await params;
  const volver = volverASeguro((await searchParams).volverA, `/produccion/${id}`);
  const datos = await datosEtiquetaLote(id, Number(numero));
  if (!datos) notFound();

  return (
    <div className="p-8 max-w-md mx-auto print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden">
        <Link href={volver} className="text-sm text-stone-500 hover:text-stone-800 transition">← Volver</Link>
        <SumarAHoja id={datos.ordenId} numero={datos.numero} />
        <PrintButton />
      </div>

      <div className="hoja">
        <div><EtiquetaLote e={datos} /></div>
      </div>

      <style>{ESTILO_HOJA_A4}</style>
    </div>
  );
}
