'use client';

import { useState } from 'react';
import type { TableroOrden } from '@/lib/produccion/tablero';
import { ImageDrop } from '@/components/ui/ImageDrop';
import { toast } from '@/components/ui/Toaster';

// El dibujo del color, para reconocerlo de un vistazo. Borde punteado = es el del modelo.
export function Geo({ o, grande }: { o: TableroOrden; grande?: boolean }) {
  const tam = grande ? 'w-[76px] h-24 rounded-xl' : 'w-[46px] h-[58px] rounded-lg';
  if (!o.geometral) {
    return grande ? null : <span className={`${tam} shrink-0 border border-dashed border-stone-200 bg-stone-50`} aria-hidden />;
  }
  return (
    <span className={`${tam} shrink-0 grid place-items-center overflow-hidden bg-white border ${o.geometral.delModelo ? 'border-dashed border-stone-300' : 'border-stone-200'}`}
      title={o.geometral.delModelo ? 'Geometral del modelo: falta el de este color' : 'Geometral'}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={o.geometral.url} alt={`Geometral de ${o.color}`} className="w-full h-full object-contain p-0.5" />
    </span>
  );
}

export function ModalGeometral({ o, onCerrar, onCambio }: { o: TableroOrden; onCerrar: () => void; onCambio: () => void }) {
  const [color, setColor] = useState<string | null>(o.geometral && !o.geometral.delModelo ? o.geometral.url : null);
  const [modelo, setModelo] = useState<string | null>(o.geometral?.delModelo ? o.geometral.url : null);

  const guardar = async (cuerpo: { ordenId?: string; loteId?: string; url: string | null }, que: string) => {
    const r = await fetch('/api/produccion/geometral', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    if (!r.ok) { toast.error((await r.json().catch(() => ({}))).error || 'No se pudo guardar el geometral'); return false; }
    toast.success(cuerpo.url ? `Geometral ${que} guardado` : `Geometral ${que} quitado`);
    onCambio();
    return true;
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-stone-900/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Geometral" className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200"><h3 className="text-base font-bold">Geometral · {o.color}</h3></div>
        <div className="px-5 py-4 grid sm:grid-cols-2 gap-5">
          <div className="grid gap-2 content-start">
            <p className="text-[13px] font-semibold text-stone-800">De este color</p>
            <ImageDrop contain value={color} onChange={async (url) => { if (await guardar({ ordenId: o.id, url }, 'del color')) setColor(url); }} />
            <p className="text-xs text-stone-500">Sale en la fila, en el panel y en la etiqueta de la bolsa.</p>
          </div>
          {o.loteId && (
            <div className="grid gap-2 content-start">
              <p className="text-[13px] font-semibold text-stone-800">Del modelo</p>
              <ImageDrop contain value={modelo} onChange={async (url) => { if (await guardar({ loteId: o.loteId!, url }, 'del modelo')) setModelo(url); }} />
              <p className="text-xs text-stone-500">Para los colores de este modelo que no tienen el suyo.</p>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 flex justify-end">
          <button type="button" onClick={onCerrar} className="h-9 px-3 rounded-lg text-[13px] font-semibold bg-amber-400 text-stone-900 hover:bg-amber-500">Listo</button>
        </div>
      </div>
    </div>
  );
}
