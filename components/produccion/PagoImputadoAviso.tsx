import Link from 'next/link';

// Un corte imputado a un pago SE PUEDE editar (con la cuenta corriente el saldo se mueve por
// la diferencia), pero el saldo del cortador se mueve al guardar. El aviso va ANTES del
// formulario: hasta ahora el bloqueo aparecía recién al apretar Guardar, con la edición ya
// tipeada. Lo único que sigue prohibido es cambiar de cortador — eso deja la deuda en una
// cuenta y el pago en la otra.
export interface PagoImputado {
  id: string;
  fecha: string;            // ISO
  monto: number;
  cortador: string | null;
  cortadorId: string | null;
}

const fmt$ = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
const fmtFecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function PagoImputadoAviso({ pago }: { pago: PagoImputado }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900">
      Este corte está <strong>imputado al pago del {fmtFecha(pago.fecha)}</strong> por {fmt$(pago.monto)}.
      Editarlo mueve el saldo{pago.cortador ? <> de <strong>{pago.cortador}</strong></> : null} por la diferencia, y queda la traza de qué cambió.
      {pago.cortadorId && (
        <>
          {' '}
          <Link href={`/produccion/cuenta-cortadores/${pago.cortadorId}`} className="underline font-semibold">
            Ver la cuenta
          </Link>
        </>
      )}
      <span className="block mt-1 text-xs text-amber-700">
        El <strong>cortador no se puede cambiar</strong> sin anular el pago: la deuda se mudaría de cuenta y el pago quedaría en la otra.
      </span>
    </div>
  );
}
