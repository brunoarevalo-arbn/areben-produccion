'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/Toaster';
import { confirmAsync } from '@/components/ui/ConfirmProvider';

const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

/** Anula un pago: sube el saldo su monto y desvincula los cortes que tenía imputados. */
export function AnularPagoBtn({ pagoId, monto, nItems }: { pagoId: string; monto: number; nItems: number }) {
  const router = useRouter();
  const [borrando, setBorrando] = useState(false);

  const anular = async () => {
    if (!(await confirmAsync({
      title: `Anular el pago de ${fmt$(monto)}`,
      message: nItems > 0
        ? `El saldo sube ${fmt$(monto)} y se desvinculan ${nItems} ítem(s), que vuelven a quedar sin imputar. Los cortes NO se borran: siguen en la cuenta.`
        : `El saldo sube ${fmt$(monto)}.`,
      confirmLabel: 'Anular', danger: true,
    }))) return;

    setBorrando(true);
    const r = await fetch(`/api/produccion/pagos-cortes/${pagoId}`, { method: 'DELETE' });
    setBorrando(false);
    if (r.ok) {
      const d = await r.json().catch(() => ({}));
      toast.success(d.cuenta ? `Pago anulado — saldo: ${fmt$(d.cuenta.saldo)}` : 'Pago anulado');
      router.refresh();
    } else {
      const d = await r.json().catch(() => ({}));
      toast.error(d.error || 'No se pudo anular');
    }
  };

  return (
    <button type="button" onClick={anular} disabled={borrando}
      className="text-xs text-stone-400 hover:text-red-600 transition disabled:opacity-50">
      {borrando ? '…' : 'Anular'}
    </button>
  );
}
