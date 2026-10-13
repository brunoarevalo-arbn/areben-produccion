import Link from 'next/link';
import { PrintButton } from '@/components/costos/PrintButton';
import { EtiquetaLote, ESTILO_HOJA_A4 } from '@/components/produccion/EtiquetaLote';
import { ControlesHoja, SacarDeHoja } from '@/components/produccion/HojaEtiquetas';
import { datosEtiquetaLote } from '@/lib/produccion/etiquetaLote';

export const dynamic = 'force-dynamic';

// Varias etiquetas de lote juntas, de a 4 por A4. La lista viene en `?e=ordenId:lote,...`;
// sin ella, la toma de la cola que se fue armando con «+ Sumar a la hoja».
export default async function HojaEtiquetasPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  const pedidos = (e ?? '').split(',').map((s) => {
    const [id, n] = s.split(':');
    return { id, numero: Number(n) };
  }).filter((x) => x.id && Number.isInteger(x.numero) && x.numero >= 1);

  const datos = await Promise.all(pedidos.map((p) => datosEtiquetaLote(p.id, p.numero)));
  const etiquetas = datos.flatMap((d) => (d ? [d] : []));
  const hojas: typeof etiquetas[] = [];
  for (let i = 0; i < etiquetas.length; i += 4) hojas.push(etiquetas.slice(i, i + 4));

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden">
        <Link href="/produccion" className="text-sm text-stone-500 hover:text-stone-800 transition">← Volver</Link>
        <p className="text-sm text-stone-600">
          {etiquetas.length} etiqueta{etiquetas.length === 1 ? '' : 's'} · {hojas.length} hoja{hojas.length === 1 ? '' : 's'} A4
          {etiquetas.length < pedidos.length && <span className="text-red-600"> · {pedidos.length - etiquetas.length} ya no existe(n)</span>}
        </p>
        <div className="flex gap-2">
          <ControlesHoja enUrl={pedidos} />
          {etiquetas.length > 0 && <PrintButton />}
        </div>
      </div>

      {etiquetas.length === 0 ? (
        <p className="text-stone-500 text-sm">La hoja está vacía. Abrí la etiqueta de un lote y tocá «+ Sumar a la hoja».</p>
      ) : (
        <div className="space-y-8 print:space-y-0">
          {hojas.map((hoja, h) => (
            <div key={h} className="hoja grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl">
              {hoja.map((d) => (
                <div key={`${d.ordenId}:${d.numero}`} className="space-y-1">
                  <EtiquetaLote e={d} />
                  <SacarDeHoja id={d.ordenId} numero={d.numero} enUrl={pedidos} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <style>{ESTILO_HOJA_A4}</style>
    </div>
  );
}
