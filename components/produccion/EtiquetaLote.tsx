import type { DatosEtiquetaLote } from '@/lib/produccion/etiquetaLote';

// La etiqueta de la BOLSA de producción: qué orden es, qué lote ("Lote 2 de 2") y qué
// talles lleva adentro. Es lo que mira la costurera para decirle a la tablet de qué lote
// son los minutos.
export function EtiquetaLote({ e }: { e: DatosEtiquetaLote }) {
  return (
    <div className="etiqueta bg-white rounded-xl border-2 border-stone-900 p-6 space-y-4 print:rounded-none">
      <div className="flex gap-4 items-start">
        {/* El geometral, para reconocer la bolsa sin leer el SKU (Bruno, 8-oct). */}
        {e.geometral && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.geometral} alt="" className="w-20 h-24 object-contain border border-stone-300 rounded-md shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-stone-500 font-bold">{e.marca} · Producción</p>
          <h1 className="text-2xl font-bold font-mono text-stone-900 mt-1 break-all">{e.sku ?? 'S/SKU'}</h1>
          {e.descripcion && <p className="text-sm text-stone-700 mt-1 leading-snug">{e.descripcion}</p>}
        </div>
      </div>

      <div className="bg-stone-900 text-white rounded-lg px-4 py-3 text-center">
        <p className="text-4xl font-black tracking-wide">LOTE {e.numero}</p>
        <p className="text-sm opacity-80">de {e.total}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {e.talles.map((t) => (
          <div key={t.talle} className="flex-1 min-w-[4.5rem] border-2 border-stone-300 rounded-lg px-3 py-2 text-center">
            <p className="text-sm font-bold text-stone-500">{t.talle}</p>
            <p className="text-3xl font-black text-stone-900 tabular-nums">{t.cantidad}</p>
          </div>
        ))}
      </div>
      <p className="text-right text-lg font-bold text-stone-900">Total: {e.unidades} u</p>

      <p className="text-xs text-stone-500 border-t border-stone-200 pt-3">
        {e.despuesDe ? <>Separado después de <strong className="text-stone-800">{e.despuesDe}</strong> · </> : null}
        {e.fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
      </p>
    </div>
  );
}

// A4 con 4 etiquetas (2 × 2) por hoja: 100 × 143 mm cada una (10 × 15 no entra dos veces en
// 297 mm). Se imprimen todas en A4 (Bruno, 13-oct).
export const ESTILO_HOJA_A4 = `
  @media print {
    @page { size: A4; margin: 5mm; }
    html, body { background: #fff !important; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .print\\:hidden { display: none !important; }
    .hoja { display: grid !important; grid-template-columns: 100mm 100mm; grid-template-rows: 143mm 143mm; gap: 0; width: 200mm; height: 286mm; break-after: page; }
    .hoja:last-child { break-after: auto; }
    .hoja > * { width: 100mm; height: 143mm; overflow: hidden; padding: 2mm; box-sizing: border-box; }
    .hoja .etiqueta { height: 100%; border-width: 2px; padding: 5mm; }
    .hoja .etiqueta > * + * { margin-top: 3mm; }
  }
`;
